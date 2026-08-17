# DeepSeek Harness Desktop (macOS)

把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web GUI 封装成 macOS 桌面应用：双击启动、Codex 风格启动动画、独立窗口、菜单栏托盘、随应用退出一并关停服务。

## 原理

- Electron 主进程用 `ELECTRON_RUN_AS_NODE` 在本机拉起 `dsh web` 服务子进程（Electron 39 内置 Node 22.22.1，满足 dsh 的 `^22.19` 引擎要求，**无需系统安装 Node**）；
- 服务绑定 `127.0.0.1`，窗口加载本地 URL（沿用 `--port` 与「3080 被占用则自动选空闲端口」策略）；
- 启动时先播放 Codex 风格的启动动画（`assets/splash.html`：终端网格背景 + 鲸鱼 logo 淡入 + 逐字打字 + 闪烁光标 + 状态轮播），右上角版本由 Electron 的 `app.getVersion()` 注入，与当前安装包/软件版本一致；服务就绪后淡出切换到应用，启动失败时动画会切到红色错误态；
- DSH 数据沿用 `~/.dsh`：你在终端里配好的模型、会话、预设原样可用；
- 设置面板新增「全局约束规则」分类（设置 → 全局约束规则）：文本框直接读写 dsh 原生注入每个会话的 `$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`，对应 Codex 的自定义指令），打开即载入现有内容，保存后新会话生效。实现为一个随应用打包的双面插件（`packages/dsh-desktop`：宿主 Typert 远程服务 + 客户端设置分类），通过 `--patch`（`assets/desktop.patch.yml` 的 insert 形式）挂载，并在启动时链接进 profile 的模块回退目录。
另：桌面端会话页右上角的余额徽章现在可以直接点击，一键跳转 DeepSeek 开放平台充值页（platform.deepseek.com/top_up），刷新按钮不受影响；徽章样式与「Session log」按钮完全一致（透明底、细白描边胶囊）。
- 输入区的模型选择器默认保持系统原生样式（DeepSeek Honeycomb 风格芯片，只显示模型与推理档位）；**点击芯片**才弹出鲸鱼思考强度变阻器，固定六档顺序为 `Flash·Off → Flash·High → Flash·Max → V4 Pro·Off → V4 Pro·High → V4 Pro·Max`。六档各使用一套透明底 24 帧动画：Flash 保持轻快，Pro 的动作和表情更有力量，因而 Flash 最高档不会显得比 Pro 更努力。鲸鱼浮在轨道上方朝右游（与档位方向一致），档位越高浮游/摆尾越快；轨道填充为蓝系渐变（无紫色），满档时填充到头；填充内有随档位增多的星尘粒子和流光扫过，轨道上有六个档位圆点刻度（走过的点亮、未走过的暗，鲸鱼不遮挡）。点击外部或 Esc 收起。动画遵循系统“减少动态效果”设置；桌面窗口与手机端使用同一组本地同源素材。
- 输入框支持 Codex 风格的 `@会话` 提及：输入 `@` 弹出触发菜单（「会话」组，按标题 / 会话 id / 工作目录过滤），选中后插入以会话标题为标签的 chip；发送时 chip 序列化为规范的 `@[标题](dsh-session:<base64url id>)` 提及，宿主在 `agent/pre-step` 边界识别提及，并把被引用会话的当前上下文快照作为只读 recall 上下文注入本轮——与斜杠调用 Skill 同一条管线（客户端 `inputTriggers` 注册 `@` 触发源 + 宿主 pre-step 注入），复用 rc.6 内置的 `session-reference` 解析器（候选排行 / 快照预算 / 渲染）与会话查询服务。
- 会话页最左侧新增「历史 Prompt 时间轴」（无外壳的裸小杠，不贴聊天框）：宿主只在根 agent 的 `agent/pre-step` 接受边界记录真实用户 Prompt，最多保留 100 条、相同文本自动去重；一条 Prompt 对应一根小杠（最新在最上），鼠标悬停时整列小杠以悬停那根为中心向外逐级变小（鱼眼扩散），并在右侧弹出带箭头的预览气泡（标题 + 时间 + 原文），点击小杠即把该条 Prompt 填回输入框。轨道层级低于设置等浮层，打开设置面板时不会压在上面。历史保存在 `$DSH_HOME/desktop/prompt-history.json`（权限 600），桌面和手机端共享，不进入仓库或安装包。
- 发送图片：会话里**以图片本体显示**（桌面端走 shell 原生图库渲染，手机端 `/mobile` 同样渲染），多张图片全部保留；愿景桥的描述文字（`[The user attached…]`）只发给模型、不再出现在聊天记录里。实现：`scripts/apply-vision-bridge.mjs` 在准入时保留 image 块并附描述，在切换模型时认可已桥接图片，在模型请求边界剥离 image 块，并在聊天记录显示层过滤描述块。
- 会话行菜单支持“删除会话”：二次确认后停止当前根会话（若正在运行）、从工作区与归档记账中解绑，并永久删除持久日志。该能力来自仓库本地构建；桌面打包前由 `scripts/sync-monorepo-overrides.mjs` 覆盖相关发布依赖，避免源码已改而 `.app` 仍运行旧包。
- 「应用」设置里新增「局域网访问（手机端）」开关（默认关闭，开关样式 + 已开启/已关闭标注）：开启后服务监听 `0.0.0.0` 并自动重启，**停留在设置页内**直接显示局域网地址 + 二维码（开启过程轮询服务状态，不用重进设置；重启先停旧进程并复用原端口，地址不变、窗口不重载）。手机连同一 Wi-Fi 打开根地址（或扫码）即可使用同一服务：完整的原生 Web 端，通过注入的引导层自动选中工作区、显示全部会话，并在手机窄屏上自动切换为 App 式布局（侧边栏抽屉 + 汉堡按钮 + 全屏会话），电脑宽屏不受影响（#151517 背景 / #679EFE 强调色 / 侧边栏扁平会话列表与选中高亮）——左侧可展开/收起的侧边栏（新建会话、历史会话列表、底部设置入口；收起时保留图标窄栏），右侧会话页（消息流、markdown 助手回复、彩色工具标签、Deep diving 状态卡片、实时任务与日志、图片、权限批准/拒绝），另含手机端「设置」页（分类标签页：应用 / 用量 / 全局约束规则 / 归档管理 / 扩展 MCP+Skills，与桌面端同一份配置）——没有任何同步层，手机端就是同一服务的第二个视图；断线重连与唤醒时会自动补拉任务进度（投屏语义）。首次启动选定的端口会写入配置并在后续启动中复用，手机保存的地址（或主屏幕图标）长期有效，等于把桌面端固定映射在 `http://<电脑IP>:<端口>`。由于发布版 CLI 出于安全拒绝 `--host 0.0.0.0`，桌面壳通过 `--patch` 覆盖 webserver 行 config 的方式完成绑定（`main/server.mjs` 生成 overlay patch），保留 dsh 自带的局域网信任围栏（只接受 IP 字面量，防 DNS rebinding）。注意：局域网模式意味着同网段设备都能访问本服务，请仅在可信网络开启。

## 目录

| 路径 | 作用 |
| --- | --- |
| `main/main.mjs` | Electron 入口：单实例（含僵尸锁自愈）、启动流程、生命周期 |
| `main/server.mjs` | dsh 服务子进程管理（启动/端口探测/就绪轮询/日志/优雅关停） |
| `main/menu.mjs` / `main/tray.mjs` | macOS 菜单栏与托盘 |
| `assets/splash.html` | 启动动画（自包含单文件，无外部资源） |
| `assets/desktop.patch.yml` | 桌面壳补丁层（insert 形式挂载全局约束规则插件行） |
| `packages/dsh-desktop/` | 双面插件：宿主 `globalInstructions` 远程服务、历史 Prompt、鲸鱼序列帧同源路由、客户端设置分类与变阻器、`@会话` 提及、`/mobile` 手机端页面；`lib/whale-sprites/` 存放六套 6×4 无损 WebP 图集 |
| `scripts/build-icon.mjs` | 用官方鲸鱼 logo 生成应用图标与托盘图标 |
| `scripts/sync-monorepo-overrides.mjs` | 将仓库本地构建的会话删除功能同步进桌面依赖树 |
| `scripts/apply-vision-bridge.mjs` | 将 GUI 图片保存为原生附件并委派给 `vision` MCP 的可重建补丁 |
| `electron-builder.yml` | 打包配置（dmg + zip，arm64） |

## 开发

```bash
cd desktop
npm install          # 首次
npm run dev          # 以开发模式启动（服务直接跑在 electron 的 node 上）
```

- 服务日志：`~/Library/Logs/DeepSeek Harness/server.log`（菜单「视图 → 打开服务日志」）。
- 想调试启动动画帧：`DSH_SPLASH_CAPTURE=/tmp npm run dev`，会在 `/tmp` 写入 `splash-t1.png` / `splash-t2.png`。
- 想在桌面壳里调试仓库本地的 dsh 源码（而非 npm 发布版）：
  ```bash
  DSH_DEV_BIN=/path/to/deepseek-harness/apps/cli/lib/bin.js npm run dev
  ```
  需要该仓库已构建（`pnpm build`），且本机有 Node ≥ 22.19（用 `DSH_DEV_NODE` 指定路径）。

### 开发注意事项

- 本工程入口是 ESM，Electron 的 `electron` 内置模块只在入口文件里 import（其余模块通过参数注入接收 API）——子模块里 import `electron` 会解析到 npm 的 `electron` 包（那是启动器，不是 API），这是 Electron ESM 加载器的已知行为。
- 如果你的终端环境里有 `ELECTRON_RUN_AS_NODE=1`，会让 electron 以纯 Node 模式启动而崩溃，用 `env -u ELECTRON_RUN_AS_NODE npm run dev` 排除。
- 应用被强杀（SIGKILL）后可能留下 `~/Library/Application Support/DeepSeek Harness/SingletonLock` 僵尸锁导致下次启动静默退出；当前版本已在启动时自愈，也可手动删除该目录下的 `Singleton*` 文件。
- 服务子进程预加载 `main/child-guard.mjs` 监视所属 Electron 进程；桌面壳崩溃或被强杀后，服务会自行退出，避免遗留多套 `dsh web` 与 MCP 进程。用量页打开时先从 `$DSH_HOME/desktop/usage-scan-cache.json` 立即渲染，再由后台子进程增量扫描原始会话日志并静默更新，不再让面板等待 zstd 解码。Electron 内置 Node 的 zstd 原生解码存在随机 SIGTRAP（同步/异步/流式路径均复现过），因此所有解压都隔离在 `assets/usage-scan.mjs` 子进程中（崩溃不影响服务进程），并按文件 mtime+size+frameEnd 缓存，只重扫发生变化的日志。
- 开发调试时如需与已安装实例共存，用 `DSH_USER_DATA_DIR=/tmp/dsh-uitest` 隔离开发实例的配置目录（锁、缓存、日志互不干扰）。
- 修改 `packages/dsh-desktop/lib/` 后：`npm run pack:plugin`（打进 tarball 并刷新 node_modules 里的插件副本），然后 `npm run dist` 重新打包；每次 `dist` 也会自动跑这一步。

## 旧版存档

迁移前（依赖 DSH 大仓、构建链含 monorepo:prepare）的旧版代码归档在 `legacy` 分支，README 顶部已标注「旧版存档（LEGACY）」，仅作存档不再维护。

## 从新克隆构建

```bash
npm install                                   # 恢复依赖（按锁文件）
DSH_MONOREPO=/path/to/deepseek-harness npm run sync:monorepo   # 可选：恢复本地 fork 特性覆盖层
npm run dist                                  # 打包
```

> 本项目位于 `/Volumes/S690/codes/deepseek-harness-desktop`，独立 Git 仓库（私有 GitHub：lijunyu726/deepseek-harness-desktop）。没有 DSH 大仓时也能构建运行，只是缺会话删除等 fork 特性。

## 打包

```bash
npm run dist          # 产出 release/DeepSeek Harness-<版本>-arm64.dmg 与 .zip（版本号来自 package.json）
npm run dist:dir      # 只出 .app，不压 dmg（快速验证）
```

`.app` 位于 `release/mac-arm64/DeepSeek Harness.app`。拖进「应用程序」即可。

### 应用搬家与路径自愈

应用本体可以随意移动（换目录、换机器），不需要任何手工配置：首次启动会自动重建插件软链、把看图工具的启动命令改写为应用自带 Node（旧路径自动纠正）、按当前网络重建局域网可信名单。用户数据（`~/.dsh`）与桌面配置（`~/Library/Application Support/DeepSeek Harness`）不随应用移动，始终保留。

> 当前未签名：首次打开如被 Gatekeeper 拦截，右键 → 打开，或
> `xattr -d com.apple.quarantine "/Applications/DeepSeek Harness.app"`。
> 正式分发前建议用 Developer ID 签名 + 公证（见下文）。

## 已知限制 / 后续方向

- **未签名**：发布给他人需要 Apple Developer ID（`electron-builder.yml` 里配 `identity` + `notarize`，可用 `@electron/notarize`）。
- **未做自动更新**：可接入 `electron-updater` + 静态发布源。
- **未携带独立 Node**：当前依赖 Electron 内置 Node（22.22.1）；将来 dsh 要求更高版本时，换用内置 Node 满足要求的新版 Electron，或在 `extraResources` 里附带独立 Node。
- **单实例窗口**：一个桌面实例对应一个服务进程；如需多开，改走多实例端口分配。
- **x86_64**：`electron-builder.yml` 目前只出 arm64，Intel Mac 加 `x64` target 即可。
- 桌面端与终端里的 `dsh web` 共用 `~/.dsh`，同时运行时两个实例会各自选端口；长期只保留桌面端即可。

## DeepSeek 文本模型的图片桥接

DeepSeek V4 的 chat-completions 路由是纯文本模型。官方文档中的 `input: [text, image]` 只用于声明一个自定义提供方的模型本身确实接受图片，不能把 DeepSeek V4 改造成视觉模型；错误声明会把原始图片发给 DeepSeek，并由提供方拒绝。

桌面端因此在打包依赖上应用一层可重建的 MCP 委派桥接：当 GUI 消息含图片且当前模型只接受文本时，宿主先按 Harness 原生图片限制验证并保存文件，在持久消息中保留图片以供界面展示，同时附加包含不可变本地附件路径的工具指令。模型请求边界会移除图片块，所以 DeepSeek 只收到文字，并被明确要求调用 `mcp__vision__describe_image`；`vision` MCP 使用多模态模型读取该路径，把文字结果送回 DeepSeek 的正常工具循环。切换到文本模型时，只有每张历史图片都带有这种桥接指令才会放行；未桥接的原生视觉历史仍会被安全拒绝。原生支持图片的模型仍接收原始图片。

桥接脚本是 `scripts/apply-vision-bridge.mjs`。`npm run dev`、`npm run dist` 和 `npm run dist:dir` 会先构建仓库、同步本地功能覆盖，再执行桥接；脚本可重复运行，并拒绝修改无法识别的依赖版本。`npm run vision:check` 检查补丁完整性和生成文件语法。发送请求的取消信号会传到图片准入阶段，因此前端取消后不会继续把消息加入队列。视觉模型的网络超时仍由 `vision` MCP 自己控制，工具失败会作为工具错误返回到本轮，而不是形成一个脱离会话的后台请求。

`vision` MCP 必须挂载为服务名 `vision`，并暴露 `describe_image`。设置 → 扩展 → 看图工具可直接修改它的模型名、调用地址与 API Key（写入服务脚本旁的 `vision.config.json`，每次调用实时读取；首次保存会把服务脚本替换为随应用打包的配置读取模板 `assets/vision-server.mjs` 并重启该 MCP 行）。它按文件头而不是扩展名识别 PNG/JPEG/WebP/GIF，因为 Harness 的内容寻址附件文件没有扩展名。MCP 仍可用于模型主动读取用户给出的普通本地图片路径；GUI 拖放或粘贴图片会自动生成同一种工具调用路径。

图片桥接不绕过当前对话模型的计费和额度：MCP 看图成功后，DeepSeek 仍需一次可用的文本推理请求来发起工具调用并生成最终回答。DeepSeek 账户余额不足时，文字和图片消息都会在模型请求处失败。

要恢复原生行为，重新安装 `desktop` 依赖即可还原 `node_modules`，随后不要运行 `vision:prepare`；原生行为会在 DeepSeek 会话发送图片前报告模型不支持图片。升级 `@deepseek-ai/dsh` 后必须先运行 `npm run vision:prepare`，如果脚本拒绝新版本，应先对照新的 `dsh-host-apiproxy` 源码更新补丁，不能直接编辑 `.app` 内文件。

## 升级 dsh 版本

```bash
npm install @deepseek-ai/dsh@<最新版本>
npm run dist
```
