# DeepSeek Harness Desktop (macOS)

把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web GUI 封装成 macOS 桌面应用：双击启动、鲸鱼主题启动动画、独立窗口、菜单栏托盘、随应用退出一并关停服务。

## ✨ 功能特性

在原有基础上加了以下功能：

1、滑动变阻器：点模型芯片弹出鲸鱼滑块，只显示**当前模型**的 `Off / Low / High / Max` 思考强度，鲸鱼就是滑块，拖或点轨道换档；模型身份在「高级 > 模型」中单独切换，新增模型不会把轨道拉成长串。

2、余额跳转：右上角余额徽章可点击，每完成一次任务刷新，直达 DeepSeek 开放平台充值页。

3、用量面板：余额摘要、近期 token 用量、近一年每日热力图；先读缓存、后台子进程增量扫描，卡不住页面。

4、高峰/非高峰提示：工具行中央常驻，琥珀点高峰（北京时间 9:00–12:00、14:00–18:00）、绿点非高峰。

5、移动端访问：开关一开就能局域网访问，设置页直接出地址和二维码，手机打开自动切 App 式布局，和桌面同一份配置和会话。

6、文件与图片：任意文件/文件夹上传，存会话目录、删会话一并清掉；卡片显示真实 macOS 图标；官方 Vision 模型原生接收图片并优先复用 DeepSeek Files API，失败时自动回退内联图片。

7、其他：@ 提及其他会话获取上下文、历史 Prompt 时间轴、ESC 后原位编辑重发、会话/工作区/归档批量彻底删除、设置里直接编辑全局约束规则；启动动画、托盘、单实例、路径自愈都在；回植了 persistent Bash 修复，命令不再白等三秒半。

## 原理

- Electron 主进程用 `ELECTRON_RUN_AS_NODE` 在本机拉起 `dsh web` 服务子进程（Electron 39 内置 Node 22.22.1，满足 dsh 的 `^22.19` 引擎要求，**无需系统安装 Node**）；
- 服务绑定 `127.0.0.1`，窗口加载本地 URL（沿用 `--port` 与「3080 被占用则自动选空闲端口」策略）；
- 启动时先播放鲸鱼主题的启动动画（`assets/splash.html`：终端网格背景 + 鲸鱼 logo 淡入 + 逐字打字 + 闪烁光标 + 状态轮播），右上角版本由 Electron 的 `app.getVersion()` 注入，与当前安装包/软件版本一致；服务就绪后淡出切换到应用，启动失败时动画会切到红色错误态；
- DSH 数据沿用 `~/.dsh`：你在终端里配好的模型、会话、预设原样可用；
- 设置面板新增「全局约束规则」分类（设置 → 全局约束规则）：文本框直接读写 dsh 原生注入每个会话的 `$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`），打开即载入现有内容，保存后新会话生效。实现为一个随应用打包的双面插件（`packages/dsh-desktop`：宿主 Typert 远程服务 + 客户端设置分类），通过 `--patch`（`assets/desktop.patch.yml` 的 insert 形式）挂载，并在启动时链接进 profile 的模块回退目录。
另：桌面端会话页右上角的余额徽章现在可以直接点击，一键跳转 DeepSeek 开放平台充值页（platform.deepseek.com/top_up），刷新按钮不受影响；徽章样式与「Session log」按钮完全一致（透明底、细白描边胶囊）。
- 输入区的模型选择器默认保持系统原生样式（只显示模型与推理档位）；**点击芯片**才弹出鲸鱼思考强度变阻器。轨道只反映当前模型实际发布的思考档位：官方 rc.2 的三个 DeepSeek 模型均为 `Off → Low → High → Max` 四档，切换模型则在「高级 > 模型」完成。`DeepSeek-V4-Flash-Vision-Exp` 与普通 Flash 目前共用轻快鲸鱼动画，界面仍明确显示 Vision；Pro 使用更有力量的图集。Low 暂复用对应 High 的 24 帧序列并减慢播放，后续可单独补素材，而无需改变交互。**鲸鱼就是滑块拇指**：游在轨道里、位置就是当前档位，按住鲸鱼拖动或点击轨道空白处即可切换；档位越高浮游/摆尾越快。换成其他厂商模型时也只按当前模型的实际档位生成刻度；无档位模型只显示芯片并提示不支持调节。点击外部或 Esc 收起，动画遵循系统“减少动态效果”设置；桌面与手机端使用同一组本地同源素材。
- 输入框支持 `@会话` 提及：输入 `@` 弹出触发菜单（「会话」组，按标题 / 会话 id / 工作目录过滤），选中后插入以会话标题为标签的 chip；发送时 chip 序列化为规范的 `@[标题](dsh-session:<base64url id>)` 提及，宿主在 `agent/pre-step` 边界识别提及，并把被引用会话的当前上下文快照作为只读 recall 上下文注入本轮——与斜杠调用 Skill 同一条管线，复用 rc.2 的 `session-reference` 与会话查询服务。
- 会话页左缘（抽屉右侧）提供「历史 Prompt 时间轴」：一条 Prompt 对应一根左端对齐的 6×1px 细横线，8px 节距，时间从上向下推进（最新在最下）。鼠标移动时，邻近横线只沿水平方向按像素距离形成高斯鱼眼，最接近光标的横线约伸长至 26px，线条始终保持 1px 粗；右侧气泡不显示标题、日期、序号、箭头或描边，只显示最多四行 Prompt 正文并与当前横线垂直居中。点击横线会定位到会话中的原始用户消息，**不会再填充输入框**；目标尚未进入当前历史窗口时会自动逐页加载，找到后居中滚动。聊天上滑接近顶部会自动加载更早消息，顶部不再显示需要反复点击的「加载更早」按钮。宿主只在根 agent 的 `agent/pre-step` 接受边界记录真实用户 Prompt，最多保留 100 条、相同文本自动去重；历史保存在 `$DSH_HOME/desktop/prompt-history.json`（权限 600），桌面和手机端共享，不进入仓库或安装包。v1.3.2 起每条记录带会话归属，时间轴**只显示当前会话**的 Prompt；v1.4.2 起新记录同时保存稳定消息 ID，旧记录用同文本与最接近时间兼容定位。
- 发送图片：会话里**以图片本体显示**（桌面端走官方附件插槽，手机端 `/mobile` 同样渲染），多张图片全部保留。选择 `DeepSeek-V4-Flash-Vision-Exp` 时，rc.2 运行时自动预处理尺寸/格式，优先通过 DeepSeek Files API 上传和复用，上传失败或超时则用相同请求图片回退为内联 base64；普通 Flash/Pro 属于文本模型，发送前会明确提示不支持图片。旧版 vision MCP 委派不再位于发送主链路。
- 任意文件/文件夹上传（v1.3.0）：输入框「+」是纯上传菜单（上传文件 / 上传文件夹，选完自动收起；命令仍用 `/` 输入），粘贴（Cmd+V）、拖放、菜单三条路径都能上传任何类型文件。文本（txt/md/代码 ≤512KB）内容直接内联给模型；二进制与大文本保存在**当前会话目录**，Agent 拿到精确路径用工具读取。文件/文件夹使用桌面 `file` 元数据块和真实 macOS 图标，绝不会误入图片通道。ESC 停止生成后点最后一条消息的铅笔，可像 Codex 一样在消息**原位**编辑：`Enter` 重发、`Shift+Enter` 换行、`Esc` 取消。实现：`patches/` 中 rc.2 conversation/apiproxy 两个整文件覆盖、`packages/dsh-desktop` 插件与 `main/main.mjs` 主进程桥。
- rc.2 主侧边栏遵循官方归档生命周期；需要永久清理时使用设置里的「归档管理」，支持单条或批量删除持久会话。桌面插件优先走宿主可用的删除能力，缺少旧版 ApiProxy 端点时回退到 workspace registry 的安全清理路径。
- 删除工作区（分组）连带永久删除会话（v1.3.1）：删除确认弹窗明确警告「将永久删除其中的全部会话与聊天记录，不可恢复，文件夹本身保留」。宿主先捕获该工作区的会话记账，再逐个完成与单会话删除同一套清理（停活跃 agent → 删除持久日志 → 清除 live 注册），单个会话失败只告警、不回滚已提交的工作区删除；被删会话不再落入「未分组」，删除后客户端立即刷新会话基线。
- 归档管理页支持删除（v1.3.1，v1.3.9 重做）：单个 + 多选批量**彻底永久删除**（会话记录、日志文件、工作区与归档记账全部清除）。单选删除的二次确认内联在该行原位（「确认删除 / 取消」与删除按钮放一起），多选批量删除在顶部批量条二次确认；宿主每个会话走 ApiProxy 的 `workspace.deleteSession`（与侧边栏删除同一条 teardown：停活体 agent → 解绑注册 → 删持久日志），删除后客户端立即刷新会话基线——被删会话从侧边栏彻底消失，**不会残留在「未分组」**；每步有超时兜底，界面不会卡死在「正在删除…」。手机窄屏下表格自动切换为卡片式行布局（复选框 | 标题 / 工作区·日期 / 操作按钮），不再挤压成竖排；会话行的「…」菜单在触屏上常驻显示（触屏没有悬停，归档/删除入口在手机上可直接操作）。
- 高峰/非高峰时段提示（v1.3.1 起，v1.3.8 定版在输入卡工具行）：输入框卡片底部工具行（模型选择与发送按钮那一行）**正中**常驻读数，仅两个标签——琥珀点「高峰时段」/ 绿点「非高峰时段」，字号与行内控件一致（13px）。北京时间 9:00–12:00 与 14:00–18:00 为高峰；悬停显示完整计费规则（非高峰价为高峰价的一半）与当前北京时间，每 30 秒自动刷新。挂载在 `conversation.input.right`，注入 `.uV2eYG_row{position:relative}` 后绝对定位在行中央，无需测量代码；空白新会话同样显示。手机窄屏下提示改为行内左侧常驻（加入 trailing 行，与模型芯片并列不重叠），桌面端保持行中央。
- 「应用」设置里新增「移动端访问」开关（默认关闭，开关样式 + 已开启/已关闭标注）：开启后服务监听 `0.0.0.0` 并自动重启，**停留在设置页内**直接显示局域网地址 + 二维码（开启过程轮询服务状态，不用重进设置；重启先停旧进程并复用原端口，地址不变、窗口不重载）。手机连同一 Wi-Fi 打开根地址（或扫码）即可使用同一服务：完整的原生 Web 端，通过注入的引导层自动选中工作区、显示全部会话，并在手机窄屏上自动切换为 App 式布局（侧边栏抽屉 + 汉堡按钮 + 全屏会话），电脑宽屏不受影响（#151517 背景 / #679EFE 强调色 / 侧边栏扁平会话列表与选中高亮）——左侧可展开/收起的侧边栏（新建会话、历史会话列表、底部设置入口；收起时保留图标窄栏），右侧会话页（消息流、markdown 助手回复、彩色工具标签、Deep diving 状态卡片、实时任务与日志、图片、权限批准/拒绝），另含手机端「设置」页（分类标签页：应用 / 用量 / 全局约束规则 / 归档管理 / 扩展 MCP+Skills，与桌面端同一份配置）——没有任何同步层，手机端就是同一服务的第二个视图；断线重连与唤醒时会自动补拉任务进度（投屏语义）。手机窄屏细节：设置面板打开时汉堡按钮自动隐藏（避免压住设置导航）；头部 Session log 胶囊隐藏、余额芯片紧凑化，标题独占第一行，标准模式 / 后台任务芯片自动换到第二行（防止固定宽度芯片在窄行里互相叠压）；会话行「…」菜单常驻（触屏无悬停）；视口跨断点（旋转/分屏）时布局引导层幂等重装，不会叠加出重复按钮。首次启动选定的端口会写入配置并在后续启动中复用，手机保存的地址（或主屏幕图标）长期有效，等于把桌面端固定映射在 `http://<电脑IP>:<端口>`。由于发布版 CLI 出于安全拒绝 `--host 0.0.0.0`，桌面壳通过 `--patch` 覆盖 webserver 行 config 的方式完成绑定（`main/server.mjs` 生成 overlay patch），保留 dsh 自带的局域网信任围栏（只接受 IP 字面量，防 DNS rebinding）。注意：局域网模式意味着同网段设备都能访问本服务，请仅在可信网络开启。

## 📦 下载安装

从 [GitHub Releases](https://github.com/lijunyu726/deepseek-harness-desktop/releases) 下载最新版本的 `DeepSeek.Harness-<版本>-arm64.dmg`（或 `-arm64-mac.zip`），把 `DeepSeek Harness.app` 拖进「应用程序」即可。当前只提供 arm64（Apple Silicon）安装包。

> 应用未签名：首次打开如被 Gatekeeper 拦截，右键 → 打开，或
> `xattr -d com.apple.quarantine "/Applications/DeepSeek Harness.app"`。

## 目录

| 路径 | 作用 |
| --- | --- |
| `main/main.mjs` | Electron 入口：单实例（含僵尸锁自愈）、启动流程、生命周期 |
| `main/server.mjs` | dsh 服务子进程管理（启动/端口探测/就绪轮询/日志/优雅关停） |
| `main/menu.mjs` / `main/tray.mjs` | macOS 菜单栏与托盘 |
| `assets/splash.html` | 启动动画（自包含单文件，无外部资源） |
| `assets/desktop.patch.yml` | 桌面壳补丁层（insert 形式挂载全局约束规则插件行） |
| `patches/` | rc.2 上游包整文件补丁（conversation / apiproxy）；workspace 与 web-frontend 使用官方实现 |
| `packages/dsh-desktop/` | 双面插件：宿主 `globalInstructions` 远程服务、历史 Prompt、鲸鱼序列帧同源路由、客户端设置分类与变阻器、`@会话` 提及、`/mobile` 手机端页面；`lib/whale-sprites/` 存放六套 6×4 无损 WebP 图集 |
| `scripts/build-icon.mjs` | 用官方鲸鱼 logo 生成应用图标与托盘图标 |
| `scripts/check-rc2-runtime.mjs` | 校验官方 rc.2、原生 Vision Files API 与 Persistent Bash 快速路径 |
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
- 修改 `packages/dsh-desktop/lib/` 后：`npm run pack:plugin`（先强制校验插件 JavaScript 语法，再打进 tarball 并刷新 node_modules 里的插件副本），然后 `npm run dist` 重新打包；每次 `dist` 也会自动跑这一步。
- `npm run dist` 在打包前会校验官方 rc.2 自带的 Persistent Bash 与原生多模态能力、清理依赖构建注释中的本机绝对路径；打包后再执行 Release 纯净度审计。发现 `.env`、凭据/用户数据文件、真实密钥格式、本机路径或非运行时顶层文件时，构建以失败结束，不得上传产物。

## 旧版存档

迁移前（依赖 DSH 大仓、构建链含 monorepo:prepare）的旧版代码归档在 `legacy` 分支，README 顶部已标注「旧版存档（LEGACY）」，仅作存档不再维护。

## 从新克隆构建

```bash
npm install                                   # 恢复官方 rc.2 依赖（按锁文件）
npm run dist                                  # 打包
```

> 本项目是独立 Git 仓库（私有 GitHub：lijunyu726/deepseek-harness-desktop），直接消费官方 npm rc.2；构建和运行不依赖维护者机器上的 DSH 大仓或绝对项目路径。

## 打包

```bash
npm run dist          # 产出 release/DeepSeek Harness-<版本>-arm64.dmg 与 .zip（版本号来自 package.json）
npm run dist:dir      # 只出 .app，不压 dmg（快速验证）
npm run audit:release # 审计 .app 中的用户数据、凭据、密钥模式和构建机路径
npm run benchmark:bash # 用打包 .app 内的真实 PTY 连跑 5 次命令，验证受控 Prompt 快速路径
node scripts/verify-cold-start.mjs # 把 .app 复制到项目外，用隔离数据目录检查服务和渲染器
```

`.app` 位于 `release/mac-arm64/DeepSeek Harness.app`。拖进「应用程序」即可。

Electron 打包采用运行时白名单，只包含 `main/`、`assets/`、`package.json` 和生产 `node_modules/`；README、AGENTS、ARCHITECTURE、构建脚本、本地插件源码和 source map 不进入面向用户的应用包。

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

## Persistent Bash 命令提速修复

当前桌面端直接使用官方 DSH `0.1.1-rc.2`，不再向依赖树回植旧补丁。官方运行时本身已经在 `dsh-terminal-bash` 的 `PROMPT_COMMAND` 中重设受控 `PS1`，持久 Bash 工具初始化只关闭 echo，并以 `stdin_read` 信号快速结算。`npm run upstream:check` / `npm run bash:check` 会同时核对协议两侧；`npm run benchmark:bash` 则直接加载打包 `.app` 内的模块做真实 PTY 回归，避免把静态标记误当成实际性能。

## DeepSeek rc.2 原生多模态

官方 rc.2 默认公布 `deepseek-v4-flash`、`deepseek-v4-pro` 和 `deepseek-v4-flash-vision-exp`。只有 Vision 型号声明 `inputModalities: [text, image]`；普通 Flash/Pro 保持文本输入。会话发送图片前按当前模型能力检查，不能靠改声明把文本模型伪装成视觉模型。

Vision 请求沿官方链路处理：附件内容寻址落盘，按模型预算自动缩放和选择 PNG/WebP/JPEG 编码，优先 `POST /files` 并缓存可复用 `file_id`；文件解析失败或超时时，用相同派生图片重建整次请求并回退内联 base64，不在同一请求混用两种表示。桌面补丁只额外保留普通文件/文件夹的 `file` 元数据块，不改写 image 块，也不再把 GUI 图片强制委派给 vision MCP。

`scripts/check-rc2-runtime.mjs` 会核对官方版本、Vision 模型、Files API 和 Bash 快速路径，最终 `.app` 也在 Release 审计阶段复测。依赖版本或结构漂移会直接阻止打包，不能通过编辑 `.app` 内文件绕过。

设置中的 `vision` MCP 管理仍保留，供 Agent 主动读取任意本地图片路径或给其他文本模型显式调用；它不再是 Vision 模型拖放图片的必经链路，其 API Key 也不会进入仓库或安装包。

图片桥接不绕过当前对话模型的计费和额度：MCP 看图成功后，DeepSeek 仍需一次可用的文本推理请求来发起工具调用并生成最终回答。DeepSeek 账户余额不足时，文字和图片消息都会在模型请求处失败。

要恢复纯官方界面行为，按锁文件重装依赖且不运行 `upload:prepare` 即可；要继续使用本桌面端增强，则按 `upstream:check → upload:prepare → pack:plugin` 顺序重建。

## 升级 dsh 版本

```bash
npm install @deepseek-ai/dsh@<最新版本>
npm run dist
```
