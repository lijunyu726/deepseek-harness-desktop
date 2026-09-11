# AGENTS.md — deepseek-harness-desktop

给智能体修改本项目时的技术约束、目录规范、验证方式、安全边界与回退方法。修改前先读本文件。

## 项目是什么

把 DeepSeek Harness 的 `dsh web` GUI 包成 macOS 桌面应用（Electron 39，内置 Node 22.22.1，无需系统 Node），并叠加一套桌面/手机共用的增强功能（设置分类、用量热力图、历史 Prompt、鲸鱼思考强度变阻器、移动端访问（局域网手机访问）、看图 MCP 管理等）。

- 服务子进程 = 同一个 `dsh web`（`--profile web`），桌面窗口和手机浏览器连的是**同一个服务**，没有同步层。
- 用户数据（会话/API Key/配置）全部在 `$DSH_HOME`（默认 `~/.dsh`）与 `~/Library/Application Support/DeepSeek Harness`，**永远不在本仓库内**。

## 目录规范

```
main/                  Electron 主进程（入口 main.mjs、服务子进程 server.mjs、菜单、托盘）
assets/                随应用打包的静态资源（desktop.patch.yml、usage-scan.mjs、
                       vision-server.mjs、splash.html）
packages/dsh-desktop/  双面 Cordis 插件（lib/index.js = 主机端，lib/client.js = 浏览器端，
                       lib/mobile.js = 手机布局引导层，lib/whale-sprites/ = 鲸鱼图集；
                       打包成 tgz 再装入 node_modules）
scripts/               构建链：check-runtime.mjs、apply-upload-enhancements.mjs、
                       pack-plugin.mjs、ensure-peer-deps.mjs、build-icon.mjs
patches/               上游包整文件补丁（4 个，见 apply-upload-enhancements.mjs 的表），
                       由该脚本覆盖进 node_modules；superseded-0.1.1/ 只作参考、不参与应用
release/               构建产物（.app/.dmg/.zip）——只进 git 的忽略列表，绝不提交
node_modules/          安装产物——绝不提交
```

## 构建链（顺序不可乱）

0. `npm install` —— 按锁文件安装官方 `@deepseek-ai/dsh@0.1.5-rc.2` 依赖树；不再需要旧 rc.6 fork 覆盖层。
1. `npm run upstream:check` —— 精确确认 0.1.5-rc.2、`deepseek-flash` 原生 text+image 目录、attachment 接缝的 `imageHostPath`、已删包缺席，以及官方 Persistent Bash 快速路径标记；未知版本或缺能力立即失败。
2. `npm run upload:prepare` —— 按表把 `patches/` 里的 4 个增强完整文件覆盖到各自目标包，原文件留 `.upstream-backup`，幂等 + 语法预检；**任一补丁缺失即拒绝启动**，避免半途失败留下「部分已 patch」的假成功。
3. `npm run pack:plugin` —— 先对 `packages/dsh-desktop/lib/*.js` 执行强制语法预检，再把插件打进 tgz 并刷新 `node_modules/@deepseek-ai/dsh-desktop`（**改插件代码后必须重跑**）。
4. `npm run sanitize:runtime` —— 清理 DeepSeek 运行时 bundle 注释中的构建机绝对路径，并拒绝残留当前 HOME/项目根路径。
5. `node scripts/ensure-peer-deps.mjs` —— 把全部 peer 依赖钉进 `package.json`（electron-builder 会裁掉 peer 依赖，漏掉会导致别的电脑启动即崩）。
6. `npm run dist` —— 以运行时文件白名单打 arm64 DMG+zip，并自动运行 `audit:release`；审计未通过的产物不得上传（未签名，首次打开用右键→打开）。

`npm start` / `npm run dev` 会自动跑 1+2+3。

## 发布纪律（每次功能改动完成后必须执行，用户明确要求）

- 改动经「验证方式」确认后，先递增根 `package.json` 版本号，再 `npm run dist` 在 `release/` 打出新版本 DMG+zip；`audit:release` 未通过的产物不得交付。版本号必须高于 Git 历史和 Releases 中出现过的全部正式版本，严禁回退；当前发布版本是 `1.4.9`（0.1.5 迁移完成后应为 `1.5.0`）。
- 打包与审计通过后，**必须**把全部源码改动（`patches/`、`packages/`、`scripts/`、`main/`、`assets/`、文档、版本号）提交并推送 GitHub（`origin/main`）。`release/` 与 `node_modules/` 永不提交；若用户需要安装包进 GitHub，走 GitHub Release 挂附件。

## 关键实现约束（改代码前必读）

- **量上游差异必须以「纯净 npm 包」为基准**：不要用 `node_modules/**.upstream-backup`——它未必是纯净上游（本项目曾出现备份比纯净版多 481 行的情况，会把真实改动量严重低估）。取基准的做法：`npm pack @deepseek-ai/<pkg>@<被替换的版本>` 解包后与新补丁 diff。
- **`llm-deepseek.models` 是整体替换内置目录的**：设置文档里写这个分节会丢掉内置条目的一切未列出字段；**省略 `inputModalities` 即按 `["text"]` 处理**，会让默认的 `deepseek-flash` 丢掉 V4.1-Flash 的原生读图。要用该分节就必须把 `inputModalities`（以及 `imagePixelBudget` / `imageMaxBytes` / `systemPromptUpdate`）一并写全。
- **`session.prompt` 的 codec 是 strict**：0.1.5 的 `content` 联合只接受 `text` / `image` / 带**必填** `receiptId` 的 `file`。桌面端自定义的文件元数据块不在其中，且 schema 由 typert 生成在宿主与客户端各一份（`typert.host.js`、`dsh-api-remotes/lib/client.js`），改它等于加两个大覆盖层。因此桌面端的文件/文件夹卡片改走**文本标题**（`📎 附件：…` / `📁 文件夹：…`），由 `parseFileCaption` 渲染——它产出的 `{kind, name, size, path}` 与原生 `normalizeFileBlock` 完全一致。普通文件则直接走 0.1.5 原生上传流程。
- **上传增强 = 整文件补丁，不许改成字符串手术**：0.1.5 的增强以完整文件存在 `patches/`，由 `apply-upload-enhancements.mjs` 的**表驱动**清单覆盖（原文件留 `.upstream-backup`）。0.1.5 拆分了上游包，落点随之变化：apiproxy → `dsh-api-session-controller` + `dsh-workspace`；conversation → `dsh-client-ui-chat`（composer 侧不再需要补丁）。改动流程：改已装依赖文件 → 验证 → 同步回 `patches/` → `npm run upload:prepare` 再构建。`patches/superseded-0.1.1/` 是 0.1.1 版本的整文件，**只作参考**，套到 0.1.5 的包上会用旧实现覆盖新包。
- **删除会话只有归档管理一个入口**：工作区/侧边栏会话行不提供「删除会话」（官方 rc.2 的 workspace 行菜单只有重命名/复制/归档；v1.4.2 的行内删除来自已废弃的 workspace-client 覆盖，已砍掉）。永久删除统一在「设置 → 归档管理」：`deleteSessions` remote → 逐会话停活体 agent（`live.cancel` + `whenIdle` + `scope.dispose`，每步有超时兜底）→ `workspaceRegistry.deleteSession(id)`（解绑记账 → 移出归档集 → 删日志 → 清索引，幂等）。**0.1.5 删除了 ApiProxy 与 registry 的 `deleteSession` / `unarchiveSession`，这两个方法由 `patches/workspace-index.js` 补回**；不得改回依赖 ApiProxy。支持单选（行内二次确认）与多选批量（顶部批量条确认）。不得为恢复行内删除重新引入 workspace-client 覆盖。
- **file 块协议约束**：消息 wire 的 `file` 块只带元数据与路径，**不带字节**（字节存会话目录）；`desktopFileContent` 必须为每个 file 块附加 text 说明，且不得把 file 块当 image（`isImageFile` 双校验 MIME+扩展名）。文件卡片渲染依赖 durable content 里的 file 块，删除会话递归清理 `uploads/` 是预期行为。
- **图标链路走主进程桥**：文件图标经 Host stdout `[desktop-event] {kind:'file-icon'}` → 主进程 `app.getFileIcon` → `executeJavaScript` 回注 → 页面转发 `resolveFileIcon`；与 `pick-folder` 原生目录选择器同一条双跳桥模式。页面侧必须按路径缓存 + in-flight 去重。
- **zstd 解码必须留在子进程**：Electron 内置 Node 的 zstd 原生解码（同步/异步/流式）都会随机 SIGTRAP，任何「进程内解压」都是回归。用量扫描全部在 `assets/usage-scan.mjs` 子进程里，失败只丢刷新、不杀服务。
- **Persistent Bash 使用官方实现**：不得再应用 rc.6 回植脚本或按网帖改提示符。`scripts/check-runtime.mjs` 必须同时确认 terminal 的受控 `PROMPT_COMMAND` / `stdin_read` 与 persistent tool 的 `stty -echo` / `waitReason === "stdin_read"`。
- **图片双路径**：声明 image 模态的模型（默认的 `deepseek-flash` 就是，V4.1-Flash 原生多模态）图片沿官方附件准入 → 预处理 → DeepSeek Files API（失败时 inline 回退）路径发送，不得改写 image 块。文本模型图片走桌面看图 MCP 委派：`patches/session-controller-index.js` 按 `inputModalities` 决定 `delegateToVisionMcp`，委派时 `desktopVisionMcpContent` 保留 image 块（转录渲染）并追加 `[The user attached …` 桥接文本；**本地对象路径经 attachment 接缝的 `imageHostPath(ref)` 取得**（0.1.5 的 store 不再暴露 `root`，手工拼路径会失败）。`patches/agent-loop-index.js` 的 `stripDelegatedImages` 在请求边界把桥接消息里的 image 块剥离（模型请求不带图、避免适配器 UNSUPPORTED_CONTENT），模型经 `mcp__vision__describe_image` 读取该路径看图；客户端 `contentParts` 用 `DESKTOP_VISION_BRIDGE_DISPLAY` 隐藏桥接文本。**注意**：设置文档里的 `llm-deepseek.models` 是整体替换内置目录的，省略 `inputModalities` 即按纯文本——写这个分节会让默认模型丢掉原生读图。
- **日志扫描是增量且不阻塞面板的**：会话日志是只追加的 zstd 帧流；扫描结果（mtime/size/frameEnd/按日用量）持久化在 `$DSH_HOME/desktop/usage-scan-cache.json`。用量 RPC 必须先返回缓存，再后台启动单飞增量扫描；不得重新让客户端等待 zstd 子进程。
- **历史 Prompt 只在接受边界记录，且点击只做消息定位**：仅从根 agent 的 `agent/pre-step` claimed batch 记录 `source.kind === 'user'` 的文字，不监听 DOM 猜测发送、不记录草稿/系统注入/工具消息。每条新记录必须携带 `sessionId`（`String(agent.id)`）和原始 `message.id`；历史只能写入 `$DSH_HOME/desktop/prompt-history.json`，上限 100 条、单条 64 KiB、权限 600；`promptHistory` remote 必须按 sessionId 过滤，时间轴只显示当前会话。点击时间轴严禁调用 `inputActions.setDraft()`，必须派发 `dsh-desktop:navigate-prompt`，由 ChatView 按 messageId 精确定位；旧记录回退同文本 + 最接近时间。目标未投影时自动逐页 `loadOlder()`，聊天滚到顶部 48px 内也自动加载；不得重新渲染「加载更早」按钮。
- **被中断 Prompt 的编辑必须走正式输入状态机**：ESC 停止生成后，只允许最后一条有文字的用户消息显示编辑入口；消息正文从该行 durable content 的 `contentParts()` 提取，不得引用 `actions(text)` 回调之外的 `text`。原位编辑器必须支持 Enter 重发、Shift+Enter 换行、Esc 取消；重发走当前会话 `inputActions.setDraft()` → `inputActions.submit()`，提交交接成功后才清编辑态。改动后运行 `npm run edit:check -- --installed`。**`useDshEditStore` 必须在本补丁内定义**（`useSyncExternalStore` 桥接插件的 `window.__dshEditStore`，subscribe/getSnapshot 用稳定引用）——重写补丁时曾漏掉该定义，导致 `UserMessageNodeView` 渲染抛 ReferenceError、**所有用户消息气泡消失**（slot 错误占位）；同样地 `DESKTOP_VISION_BRIDGE_DISPLAY`、`promptTargetKey` 等被引用标识符都必须有定义。
- **路径自愈**：插件内所有定位 app 资源（usage-scan.mjs、vision-server.mjs 模板）都用「模块目录相对路径 + `process.execPath` 回退」双候选；`ensureVisionCommand` 会在启动时把 vision MCP 行的 `command` 从系统 `node` 改写为应用自带 Node（app 移动后自动重写）。**不要把绝对路径写死在插件里。**
- **插槽优先级**：接管 shell 的单席位要用比 0 更低的 priority（鲸鱼变阻器用 -10）。
- **鲸鱼图集契约**：素材固定为 `flash-off/high/max`、`pro-off/high/max`；每张是 1056×512、6×4 网格、24 帧、176×128 单元格的带透明通道无损 WebP。变阻器**对所有供应商（含 DeepSeek）走同一条按 catalog 现读的 effort 轨**：轨道刻度来自当前模型自己的 reasoning 档位，拖动/点击即 `selectModel` + 固定该档 effort。DeepSeek 原来那条固定三档模型轨道（Vision Max → Flash Max → Pro Max）已删除——V4.1 线把 Vision/Flash 合并成 `deepseek-flash` 一个原生多模态模型，`deepseek-v4-pro` 也自 2026-09-14 12:00（北京时间）起路由到它，三个档位会指向同一个模型。**不得再引入硬编码的模型 id 列表**：读 catalog 才能让未来的 V4.1 Pro 自动出现。effort 精细调节仍在「高级」面板（模型/供应商/思考强度三个子页）。
- **客户端连接面（0.1.5 已变，务必按新写法）**：
  - Typert 远程仍走 `connection.rpc.call('/api', 'globalInstructions/<m>')`，未变。
  - **`connection.api` 在 0.1.5 里整个不存在**（不是某个方法改名）。会话类调用改走 `remote.session.<method>()`，信封也从 `{result: {ok, value}}` 变成 `{ok, value}`。
  - **Cordis 只把「声明过的」服务暴露为 ctx 属性**：插件顶层必须写
    `const inject = ['slots', 'connection', 'remote', 'remote.session']`——
    `remote` 与 `remote.session` **两个都要**，否则报
    `cannot get property "remote.session" without inject`；只写 `remote` 而用
    `ctx.get('remote')` 则拿到 `undefined`（服务未声明时不进 ctx）。官方
    `dsh-client-ui-model-selection` 的 `static inject` 就是这三项写法，照抄即可。
  - 这类调用在 `useEffect` 里一旦同步抛错（例如对 undefined 取属性），`.catch()`
    抓不到，会直接崩掉整个槽位并在控制台留下
    `slot entry crashed in '<slot>'`。**排查槽位不渲染时先看这一条。**
- **版本单一来源**：应用/DMG 版本来自根 `package.json`；启动页通过 `app.getVersion()` 接收该版本，不得再硬编码展示版本号。dsh 上游依赖版本可单独出现在诊断信息中，但不能冒充桌面应用版本。
- **安全围栏**：`settings.describe`/`credentials.*` 被 dsh 硬锁回环地址，手机端会 403——这是上游安全设计，不要试图在补丁里放宽。
- **局域网可信名单**：dsh 启动瞬间对网络接口做一次性快照，网络切换时可能拿到空集导致手机 403。插件每 30 秒把当前 IPv4 补进 connection 行的 `trustedHosts`（`entry.update`，不写补丁文件），并过滤 198.18/15、169.254/16 这类不可达的虚拟隧道地址。

## 验证方式

- 语法：`node --check packages/dsh-desktop/lib/*.js assets/*.mjs scripts/*.mjs`；历史定位与自动分页另跑 `npm run history:check -- --installed`；
- 依赖与官方能力：`npm run upstream:check && npm run upload:check && npm run vision:check`；Bash 性能回归用 `npm run benchmark:bash`，它必须直接加载 `release/mac-arm64/DeepSeek Harness.app` 内的模块并通过真实 PTY 快速路径；
- 隔离服务冒烟（**最快的一步，先跑它**）：用独立 `DSH_HOME` 直接起运行时——
  `DSH_HOME=/tmp/x node node_modules/@deepseek-ai/dsh/lib/bin.js --profile smoke --from-default-profile web --dump-config` 先验证组合能否解析，
  再去掉 `--dump-config` 启动并 `curl` 首页；`--patch <desktop.patch.yml>` 必须放在子命令**之前**。
  桌面插件要按 `main/server.mjs` 的做法链进 `$DSH_HOME/profiles/node_modules/@deepseek-ai/dsh-desktop`，否则 `desktop` 行会 ERR_MODULE_NOT_FOUND。
  日志里出现 `N entry did not activate` 时，注意 **0.1.5 新增了启动期的 `assertEntriesActivated`**：任何在 `loader.await()` 之后立刻触发 fiber 重启的插件代码都会与它竞争而让整树启不来（本项目已因此修过 connection trust heal）。
- **打包后必跑 `node scripts/verify-cold-start.mjs`**：它把 `.app` 复制到项目树**之外**、以隔离 `DSH_HOME`/userData 冷启动，是唯一能证明「装到别的机器也能起」的检查。**在仓库内跑冒烟会骗过你**：`release/` 位于项目树中，Node 向上解析会借用项目 `node_modules`，被 electron-builder 裁掉的依赖照样能加载；装到 `/Applications` 后没有上层可借，立刻 `ERR_MODULE_NOT_FOUND`（已实际踩过）。它需要网络为隔离 profile 安装依赖，本机应带代理：
  `HTTP_PROXY=... HTTPS_PROXY=... NO_PROXY=127.0.0.1,localhost node scripts/verify-cold-start.mjs`
  通过标准：`renderer.title` 为 `DeepSeek Harness`、`editStoreReady` 与 `editBridgeContract` 均为 `true`、`pluginLoadFailureDetected` 为 `false`。
- 完整应用冒烟：复制 release 应用为 `TestApp.app`，用独立 `DSH_HOME` + `ELECTRON_RUN_AS_NODE=1` 启动（注意：插件必须由应用内 node_modules 解析，加载器不认 profile 里的软链指向的其它副本；补丁参数 `--expose-internals` 必须在 bin.js 之前）；
- 浏览器交互：ego-browser（`useOrCreateTaskSpace` + 手机/桌面视口），测完 `completeTaskSpace`；
- 打包产物核对：检查 `release/mac-arm64/…app/node_modules/@deepseek-ai/dsh-desktop/lib` 与新代码一致；
- 外来电脑模拟：运行 `node scripts/verify-cold-start.mjs`；它会把 `.app` 复制到项目树之外，以隔离的 `DSH_HOME`/userData 冷启动并检查服务、渲染器及插件错误——这验证 peer 依赖补齐和插件加载没有回归。
- 发布纯净度：`npm run audit:release`；同时挂载最终 DMG 复扫敏感文件名、真实密钥模式、用户数据目录和构建机绝对路径。

## 安全边界

- 不得把 `$DSH_HOME` 下的任何真实数据（会话日志、投影缓存、凭据、vision.config.json）复制进仓库或构建产物；
- 面向用户的 `.app` 只能包含 `main/`、`assets/`、`package.json` 与生产 `node_modules/`；项目文档、构建脚本、本地插件源码、source map 和本机绝对路径不得进入 DMG；
- 不得放宽 dsh 的信任围栏/特权方法锁；
- 提交前 `grep` 检查明文密钥（`sk-`、XIAOMI key 值）与本机路径；
- 移动端访问开关默认关闭，且只面向用户可信网络。

## 回退方法

- 插件代码回退：改回 `packages/dsh-desktop/lib/*` → `npm run pack:plugin` → `npm run dist` 重打；
- 依赖补丁回退：按锁文件重装官方 0.1.5-rc.2 依赖，再运行 `upstream:check` → `upload:prepare` → `pack:plugin`；不得套用旧 rc.6 修复脚本；
- 运行时回退：停掉桌面应用、删 `~/Library/Application Support/DeepSeek Harness` 里的桌面配置即可回到默认（不影响 ~/.dsh 数据）；
- 应用移动后：新位置首次启动会自动重建插件软链、重写 vision 命令路径、重拍可信名单——无需手工清理。
