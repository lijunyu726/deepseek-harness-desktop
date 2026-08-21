# DeepSeek Harness Desktop Architecture

## Runtime

Electron 主进程用 Electron 自带的 Node 运行时（`ELECTRON_RUN_AS_NODE=1` + `process.execPath`，无需系统 Node）启动打包好的 `dsh web` 服务子进程。子进程默认只绑 `127.0.0.1`；Electron 窗口加载这个本地 URL。主进程负责启动、日志、重启与优雅退出；用户数据（会话、凭据、桌面配置）在 `$DSH_HOME`（默认 `~/.dsh`）与 `~/Library/Application Support/DeepSeek Harness`，与程序本体完全分离。

- `main/child-guard.mjs` 由服务子进程预加载：所属 Electron 进程消失时服务自行退出，避免遗留孤儿服务；重启请求在重启期间串行化。
- 端口持久化：首次启动选定的端口写入桌面配置，之后重启复用同一端口（被占用才换新），使手机端保存的地址长期有效；端口不变时重启不重载窗口。
- 局域网模式：CLI 出于安全拒绝 `--host 0.0.0.0`，桌面壳改由 `--patch` 覆盖 webserver 行 config 完成全接口绑定，保留 dsh 的浏览器信任围栏。

## 双面 Cordis 插件（`@deepseek-ai/dsh-desktop`）

`assets/desktop.patch.yml` 以 insert 形式挂载插件。`DshServer.ensurePluginFallback()` 在启动前把打包的插件软链进 profile 的模块回退目录。插件主机端（`lib/index.js`）通过 Typert 远程（`globalInstructions/*`，SRC 反射模式）暴露全部业务面；浏览器端（`lib/client.js`）是一个客户端模块 bundle（`window.__ModuleLoader__.load`），注册设置分类与会话页界面；`lib/mobile.js` 在服务端注入 index.html 引导脚本（工作区自选 + 手机抽屉布局）。引导脚本幂等安装——媒体查询变化（旋转/分屏/跨断点）重入时只重跑布局强化，不重复注入样式/遮罩/汉堡按钮；窄屏下常驻会话行「…」菜单（触屏无悬停）、设置面板打开时隐藏汉堡按钮（`:has(.VOzbGW_overlay)` + MutationObserver 兜底）。头部窄屏适配在客户端 bundle（`installHeaderCompactStyle`，随页面加载热更新、无需重启应用）：隐藏 Session log 胶囊、余额芯片去「余额」词紧凑化、`titleCluster` 内部换行——标题独占第一行，标准模式/后台任务芯片落第二行，避免固定宽度芯片溢出 flex 行后在中部互相叠压（headerActions 是 titleCluster 的子元素，因此换行发生在簇内部）。

### 设置分类（`settings.section`）

- **用量**：总量来自投影缓存；按日用量先从持久扫描缓存同步返回，独立扫描子进程在后台增量更新，客户端以 800ms 静默轮询收敛到新 revision（见下）；余额走 DeepSeek `user/balance`。
- **全局约束规则**：直接读写 `$DSH_HOME/AGENTS.md`。
- **归档管理 / 扩展**：会话归档取消、MCP 服务器与 Skills 的列表/开关/删除（读写 profile 补丁与 SKILL.md frontmatter）。
- **看图工具**：vision MCP 的模型名/调用地址/API Key 写入服务脚本旁的 `vision.config.json`（每次调用实时读取）；首次保存会把旧硬编码脚本替换为随应用打包的 `assets/vision-server.mjs` 模板并重启该 MCP 行。
- **应用**：通知、开机自启、移动端访问（二维码/地址）、代理、统计样式、存储占用。

### 按日用量扫描（隔离子进程）

Electron 内置 Node 的 zstd 原生解码（同步/异步/流式路径均实测复现）会随机 SIGTRAP，因此**一切解压都在 `assets/usage-scan.mjs` 子进程**：扫描器按帧边界拆分日志（会话日志是只追加的 zstd 帧流）、逐帧流式解码 `assistant/message` 用量并按本地日期聚合。主机端 RPC 先同步聚合 `$DSH_HOME/desktop/usage-scan-cache.json` 并立即返回，再以单飞任务执行 readdir+stat、按 mtime/size/frameEnd 找出增量、通过 `--jobs` 下发扫描并合并结果；15 秒新鲜度窗口避免完成轮询再次触发扫描。子进程崩溃只丢一次后台刷新。

### 历史 Prompt

宿主在根 agent 的 `agent/pre-step` waterfall 接受边界，从原始 claimed batch 中仅选取 `source.kind === 'user'` 的 text blocks；被拒绝的输入、系统/插件上下文、工具消息与未发送草稿不入库。记录按文本去重、最新优先、上限 100 条，原子写入 `$DSH_HOME/desktop/prompt-history.json`（权限 600）；v1.4.2 起同时保存原始 `message.id`，旧记录缺失时保持可读。客户端通过 `globalInstructions/promptHistory` 读取，注册在 `conversation.session.header.utilities`，渲染为钉在对话页左缘、抽屉右侧的裸时间轴：历史在渲染前反转为最旧在上、最新在下；每项拥有 30×8px 稳定命中区，`::before` 绘制左端对齐的 6×1px 横线。轨道 `mousemove` 持续上报鼠标 Y，每根横线按自身中心与光标的像素距离计算高斯值（σ=18），仅通过 CSS 自定义属性把 `scaleX` 从 1 放大至约 4.35，线宽峰值约 26px且厚度始终为 1px；几何在挂载、条目变化、滚动和窗口缩放时重测。悬停气泡与最近横线垂直居中，只渲染最多四行 Prompt 正文。点击不再写入 composer，而是派发 `dsh-desktop:navigate-prompt`；ChatView 先按稳定 messageId 查找当前 user/steering 节点，旧记录再用同文本和最接近 `createdAt` 的事件时间回退。目标不在当前投影窗口时，单飞逐页 `loadOlder()`，命中后把对应行居中；普通阅读上滑到顶部 48px 内同样自动翻页，首屏不足一页时自动补齐，因此不再渲染手动「加载更早」按钮。轨道 z-index 12 / 气泡 13，低于设置等浮层。桌面与手机连接同一服务，因此天然共享历史；手机布局下 pane 左缘为视口边缘、`cardRect.left - 30` 为负值，钳位到 ≥4px 的可见槽内，避免时间轴跑到屏幕外。

### 局域网可信名单自愈

dsh 在服务启动瞬间对网络接口做一次性快照生成 `trustedHosts`；恰逢网络切换的快照为空时，手机所有 `/api` 请求 403。插件在 loader 就绪后及每 30 秒把当前非内部 IPv4（过滤 198.18/15、169.254/16 等不可达虚拟隧道地址）补进 connection 行的 `trustedHosts`（`entry.update`，进程内生效、不写补丁文件）。

### 鲸鱼思考强度变阻器

接管 `conversation.input.model` 单席位（priority -10 压过 shell 的 0）：收起态渲染与 shell 默认模型芯片一致的触发器，点击后展开当前模型的思考强度滑块。**模型身份与 effort 分离**：普通层只按当前模型目录上报的 `reasoning.efforts` 生成刻度；官方 rc.2 的 Vision/Flash/Pro 均为 `Off → Low → High → Max`。高级层单独切换 provider/model 或 effort，选中统一走 `session.selectModel`。因此第三个模型不会把轨道扩成 9/12 档，桌面/手机仍共享会话级状态。Vision 复用 Flash 图集，Low 复用对应 High 图集但播放更慢；显示标签始终保留真实 Vision 身份。

运行时素材为 `lib/whale-sprites/*.webp` 下的六套 1056×512 无损 WebP（6×4 网格、24 帧、单格 176×128）。宿主在 `/dsh-desktop/whale-sprites/<state>.webp` 注册精确同源路由；客户端按模型家族与 effort 映射素材和速度，切档通过 React key 重启动画，系统开启“减少动态效果”时停在首帧。

视觉层：鲸鱼整体 `scaleX(-1)` 翻转，使朝向（右）与档位递增方向一致；**鲸鱼就是滑块拇指**——44×33 渲染在轨道内部、位置即当前档位（`THUMB=22` 基准），`pointer-events: auto` + `cursor: grab/grabbing`，按下鲸鱼拖动即可切换档位（stopPropagation 避免与轨道的 pointerdown 重复触发）；点击轨道空白处仍可直接跳档。档位圆点贴在轨道内部底部一行（4px 圆点，轨道加高到 40px，鲸鱼浮在上方、精灵透明边距保证不遮挡），视觉上完全在变阻器内。填充用蓝系渐变（hue 212→235，不含紫色），内含流光扫过层与随档位增多的星尘粒子（2→8 颗，伪随机种子按档位稳定）；满档时填充恰好 100%。弹层背景为提亮的磨砂玻璃（rgba(46,50,64,0.92) + blur 20px）。轨道高度用 `!important` 加固，避免第三方注入的全局样式压扁布局。

### @会话提及

输入 `@` 触发会话候选菜单。候选按会话 id 去重；同标题（且同创建日）的会话追加短 id 尾缀区分。提交时序列化为 `dsh-session:` URI，主机端在 `agent/pre-step` 由 session-reference resolver 解析并注入快照上下文；解析失败不阻断回合。

## 官方 rc.2 原生多模态

`@deepseek-ai/dsh-llm-deepseek@0.1.1-rc.2` 原生发布 `deepseek-v4-flash-vision-exp`（text+image）。图片经附件存储与预算化预处理后优先上传 DeepSeek Files API，按 endpoint/API-key/variant 复用 `file_id`；解析失败时整次请求切换为相同派生图片的 inline 表示。`patches/apiproxy-index.js` 保留 `admitEncodedImages` 路径，只在 durable content 中增加普通 `file` 块及工具可读说明，不再生成 `desktopVisionMcpContent`。`check-rc2-runtime.mjs` 同时验证模型、Files API 与官方 Persistent Bash 标记。

## 上传增强（v1.3.0）

两个 rc.2 上游包（conversation / apiproxy）不在本仓库构建，增强以**完整文件**存在 `patches/`，由 `scripts/apply-upload-enhancements.mjs` 覆盖进 node_modules（原文件留 `.upstream-backup`，幂等 + 语法预检，`--check` 模式验证）。workspace 与 web-frontend 保持官方 rc.2 的归档生命周期和附件 slot 实现。

- **conversation 补丁**：上传管线（`__DSH_ADD_FILES__` 入口、`isImageFile` 双校验、`serializeImages` 产出 image/file/text 三类 part）、消息文件卡片渲染（`contentParts` → `FileAttachmentCard`，真实图标 + emoji 兜底）、ESC 原位编辑器（正文从 durable content 提取；Enter 重发、Shift+Enter 换行、Esc 取消）、历史 Prompt 稳定消息定位与顶部自动分页。
- **apiproxy 补丁**：消息 wire schema 新增 `file` 块（`fileKind: file|folder`，只带元数据与路径、不带字节）；`durablePromptContent` 透传 file 块为 durable content；`desktopFileContent` 为模型附加"磁盘路径 + 非图片"文本说明；`workspace.delete` 删除工作区注册前先捕获会话记账、逐个 `teardownSessionForDelete`（flush → 停 agent → 删日志 → 清注册，子代理归属会话跳过），`workspace.deleteSession` 复用同一 helper。
- **官方 attachment slot**：图片草稿与消息图库走 rc.2 的 `conversation.input.attachments` / `conversation.message.images`；桌面 conversation 覆盖只为普通文件另渲染元数据 chip/卡片，不修改 web-frontend 的哈希 bundle。
- **插件（packages/dsh-desktop）**：`saveUploadFile`（base64 → `~/.dsh/sessions/<项目>/<会话ID>/uploads/`，找不到会话目录回退 `~/.dsh/uploads/<会话ID>/`）、`copyFolderUpload`（整体递归复制，2000 文件/200MB/深度 8）、`pickFolderNative`/`resolvePickFolder`（主进程原生目录选择器桥）、`getFileIcon`/`resolveFileIcon`（macOS 图标桥）；客户端侧纯上传菜单、`SessionIdTracker`、`__DSH_SAVE_UPLOAD__`/`__DSH_GET_FILE_ICON__` 页面桥、ESC 编辑状态机。编辑重发只能走当前会话 `inputActions.setDraft()` → `inputActions.submit()`，成功交接后才清除原位编辑态。
- **主进程（main/main.mjs）**：`pick-folder` 与 `file-icon` 两种 desktop-event 处理（dialog.showOpenDialog / app.getFileIcon → `executeJavaScript` 回注）。
- **生命周期**：附件字节在会话目录内，删除会话由 `dsh-session-persistence-jsonl` 递归删目录（既有行为）；归档保留；file 块随会话日志持久化，历史回放保留卡片。

## 工作区删除与高峰时段提示（v1.3.1 – v1.3.8）

- **工作区删除连带删除会话**：宿主 `workspace.delete` 删除注册前捕获 `workspace.sessionIds`，逐个执行与单会话删除相同的 teardown；单会话失败只告警不回滚。`origin === "subagent"` 的会话跳过（随父会话 teardown 清理，且从不作为顶层行渲染，不会落入 Ungrouped）。客户端删除后刷新会话基线，冷会话（无 live 帧）立即从列表消失。
- **归档管理删除（v1.3.9 重做）**：插件宿主 `deleteSessions` remote（批量、每步超时兜底）改为**逐会话委托 ApiProxy 的 `workspace.deleteSession`**——与侧边栏删除同一条 teardown（停活体 agent → 解绑注册 → 删持久日志），因为 agent 工厂的解绑闭包是模块私有的，插件侧只做 `cancel + scope.dispose` 会留下 live 注册，被删会话以幽灵形式重回「未分组」（v1.3.1 版本的缺陷）。幽灵场景（日志已删但仍在 live 注册）下 teardown 先处置后报 session-not-found，宿主以「无 live 残留即视为删除成功」兜底。客户端单选删除二次确认内联在行原位（确认删除/取消与删除按钮同排），多选批量删除用顶部批量确认条；删除落库后 `gateway.refreshSessions()` 重拉会话基线，冷会话立即从侧边栏消失。无 ApiProxy 的宿主回退到 best-effort 序列。
- **rc.2 归档生命周期**：主侧边栏使用官方 archive 流程，不再向新的 agent/session 注册表套用 rc.6 `remove(id)` 补丁。设置中的归档管理永久删除优先调用宿主暴露的删除 remote，缺失时由插件走 workspace registry 的 best-effort 清理并刷新客户端基线。
- **高峰/非高峰时段提示**：纯客户端组件 `PriceHoursHint`，浏览器时钟按 UTC+8 换算北京时间（无夏令时），9:00–12:00 / 14:00–18:00 判为高峰，其余为非高峰（价格为高峰一半）；30 秒刷新，仅两个标签，字号与工具行控件一致（13px/500/20px）。v1.3.8 定版：挂载在 `conversation.input.right`（位于输入卡底部工具行 `uV2eYG_row` 内），注入样式 `.uV2eYG_row{position:relative}` 后组件以 `position:absolute + translate(-50%,-50%)` 落在行中央——无测量代码，水平/垂直都随行自适应。迭代史上依次弃用的挂载：composer.dock → header.utilities → input.dock（fixed 定位 + 面板矩形测量）；v1.3.4 修复了 `Date.now()` 时间戳被误当 Date 实例的渲染崩溃（这是此前任何位置都看不到提示的根因）。
- **历史 Prompt 按会话隔离（v1.3.2）与消息定位（v1.4.2）**：宿主记录每条 prompt 时携带 `String(agent.id)` 会话归属，v1.4.2 再携带 `message.id`；`promptHistory(limit, sessionId)` remote 按会话过滤。客户端 `PromptHistoryRail` 随会话切换重载；点击只导航到原消息，不再预填输入框，ChatView 负责按需加载旧页并定位。

## 数据与凭据流

- DeepSeek 凭据只由 dsh 自身的模型配置持有；插件只调用 `user/balance` 查询余额。
- 历史 Prompt 属于本机用户数据，只写入 `$DSH_HOME/desktop/prompt-history.json`，不进入仓库、构建产物或日志；单条上限 64 KiB。
- vision MCP 的 API Key 只存本机（`vision.config.json`，权限 600，接口不回传浏览器）；缺省回退到环境变量 / `$DSH_HOME/.credentials.yaml`。
- 图片字节先存于 `$DSH_HOME/attachments/v1/objects/<prefix>/<sha256>`；选择官方 Vision 模型发送时，由 rc.2 按请求版本上传 DeepSeek Files API（失败时 inline 回退）。普通本地图片只有在 Agent 显式调用 vision MCP 时才走该工具配置。

## Persistent Bash 官方实现

官方 rc.2 已直接包含完整快速路径：`dsh-terminal-bash` 的受控 `PROMPT_COMMAND` 每次重设 `PS1`，`dsh-tool-bash-persistent` 初始化只关闭 echo，并以 terminal seam 的 `stdin_read` 结算部分输出。本项目不再修改这两个包；`upstream:check` 做静态契约验证，`benchmark:bash` 对最终 `.app` 做真实 PTY 验证。

## Release 纯净度边界

Electron `files` 白名单只允许 `main/`、`assets/`、根 `package.json` 和生产 `node_modules/` 进入 `.app`，排除仓库文档、构建/补丁脚本、本地 package 源码与 source map。`sanitize-runtime-build-paths.mjs` 只清理由 DeepSeek bundler 写入 `//#region \\0dsh-css:` 注释的开发机路径，并在继续打包前拒绝任何当前 HOME/项目根残留；`audit-release.mjs` 对最终 `.app` 检查顶层白名单、敏感配置/用户数据库文件名、本机路径和常见真实凭据格式。最终 DMG 仍需只读挂载复扫，脚本通过、安装包生成和 Release 上传是三个独立状态。

## 构建与回退

- 构建链：`upstream:check` → `upload:prepare` → `pack:plugin`（tgz → node_modules）→ `sanitize:runtime` → electron-builder 运行时白名单（arm64 DMG+zip，未签名）→ `audit:release`（含最终 App 的 rc.2、编辑和历史定位复测）。
- 校验：`npm run upstream:check`、`npm run upload:check`、`npm run edit:check -- --installed`、`npm run history:check -- --installed`、`node --check`、`npm run benchmark:bash`（加载打包应用内模块的真实 PTY 时延）、`node scripts/verify-cold-start.mjs`（项目外副本、隔离 `DSH_HOME`/userData、服务与渲染器）、最终 `.app` 与 DMG 纯净度复扫。
- 回退：插件代码回退后重跑 `pack:plugin` + `dist`；补丁异常时重装依赖重跑；运行时行为回退只需清桌面配置目录，数据不受影响。
