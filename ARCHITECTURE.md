# DeepSeek Harness Desktop Architecture

## Runtime

Electron 主进程用 Electron 自带的 Node 运行时（`ELECTRON_RUN_AS_NODE=1` + `process.execPath`，无需系统 Node）启动打包好的 `dsh web` 服务子进程。子进程默认只绑 `127.0.0.1`；Electron 窗口加载这个本地 URL。主进程负责启动、日志、重启与优雅退出；用户数据（会话、凭据、桌面配置）在 `$DSH_HOME`（默认 `~/.dsh`）与 `~/Library/Application Support/DeepSeek Harness`，与程序本体完全分离。

- `main/child-guard.mjs` 由服务子进程预加载：所属 Electron 进程消失时服务自行退出，避免遗留孤儿服务；重启请求在重启期间串行化。
- 端口持久化：首次启动选定的端口写入桌面配置，之后重启复用同一端口（被占用才换新），使手机端保存的地址长期有效；端口不变时重启不重载窗口。
- 局域网模式：CLI 出于安全拒绝 `--host 0.0.0.0`，桌面壳改由 `--patch` 覆盖 webserver 行 config 完成全接口绑定，保留 dsh 的浏览器信任围栏。

## 双面 Cordis 插件（`@deepseek-ai/dsh-desktop`）

`assets/desktop.patch.yml` 以 insert 形式挂载插件。`DshServer.ensurePluginFallback()` 在启动前把打包的插件软链进 profile 的模块回退目录。插件主机端（`lib/index.js`）通过 Typert 远程（`globalInstructions/*`，SRC 反射模式）暴露全部业务面；浏览器端（`lib/client.js`）是一个客户端模块 bundle（`window.__ModuleLoader__.load`），注册设置分类与会话页界面；`lib/mobile.js` 在服务端注入 index.html 引导脚本（工作区自选 + 手机抽屉布局）。

### 设置分类（`settings.section`）

- **用量**：总量来自投影缓存；按日用量先从持久扫描缓存同步返回，独立扫描子进程在后台增量更新，客户端以 800ms 静默轮询收敛到新 revision（见下）；余额走 DeepSeek `user/balance`。
- **全局约束规则**：直接读写 `$DSH_HOME/AGENTS.md`。
- **归档管理 / 扩展**：会话归档取消、MCP 服务器与 Skills 的列表/开关/删除（读写 profile 补丁与 SKILL.md frontmatter）。
- **看图工具**：vision MCP 的模型名/调用地址/API Key 写入服务脚本旁的 `vision.config.json`（每次调用实时读取）；首次保存会把旧硬编码脚本替换为随应用打包的 `assets/vision-server.mjs` 模板并重启该 MCP 行。
- **应用**：通知、开机自启、局域网访问（二维码/地址）、代理、统计样式、存储占用。

### 按日用量扫描（隔离子进程）

Electron 内置 Node 的 zstd 原生解码（同步/异步/流式路径均实测复现）会随机 SIGTRAP，因此**一切解压都在 `assets/usage-scan.mjs` 子进程**：扫描器按帧边界拆分日志（会话日志是只追加的 zstd 帧流）、逐帧流式解码 `assistant/message` 用量并按本地日期聚合。主机端 RPC 先同步聚合 `$DSH_HOME/desktop/usage-scan-cache.json` 并立即返回，再以单飞任务执行 readdir+stat、按 mtime/size/frameEnd 找出增量、通过 `--jobs` 下发扫描并合并结果；15 秒新鲜度窗口避免完成轮询再次触发扫描。子进程崩溃只丢一次后台刷新。

### 历史 Prompt

宿主在根 agent 的 `agent/pre-step` waterfall 接受边界，从原始 claimed batch 中仅选取 `source.kind === 'user'` 的 text blocks；被拒绝的输入、系统/插件上下文、工具消息与未发送草稿不入库。记录按文本去重、最新优先、上限 100 条，原子写入 `$DSH_HOME/desktop/prompt-history.json`（权限 600）。客户端通过 `globalInstructions/promptHistory` 读取，注册在 `conversation.session.header.utilities`（该槽位提供 `useInput`/`inputActions` 标准 props），渲染为钉在对话页左缘（抽屉右侧，Codex 式，由 composer 卡片的宽祖先元素测得 pane 左缘）的裸刻度时间轴（无胶囊外壳，刻度 6×1.5px）：每条 Prompt 一根刻度（最新在最上），悬停时整列按与悬停刻度的距离做鱼眼扩散缩放（当前 1.6 → 逐级递减），并在右侧弹出预览气泡，点击通过标准 `inputActions.setDraft()` 恢复文本；没有旁路操作 textarea 或输入状态机。轨道 z-index 12 / 气泡 13，低于设置等浮层（1000），打开面板时不会压在其上。桌面与手机连接同一服务，因此天然共享历史。

### 局域网可信名单自愈

dsh 在服务启动瞬间对网络接口做一次性快照生成 `trustedHosts`；恰逢网络切换的快照为空时，手机所有 `/api` 请求 403。插件在 loader 就绪后及每 30 秒把当前非内部 IPv4（过滤 198.18/15、169.254/16 等不可达虚拟隧道地址）补进 connection 行的 `trustedHosts`（`entry.update`，进程内生效、不写补丁文件）。

### 鲸鱼思考强度变阻器

接管 `conversation.input.model` 单席位（priority -10 压过 shell 的 0）：收起态渲染一个与 shell 默认模型芯片像素一致的触发器（只显示模型 + 档位 + 箭头，视觉上像没改过），点击后展开鲸鱼变阻器弹出层（锚定芯片右上方，点击外部或 Esc 收起）。一个滑块串联两个 DeepSeek 模型共六档，客户端用显式状态表固定为 Flash·Off→High→Max→V4 Pro·Off→High→Max，不依赖模型接口的返回顺序。选中即走 `session.selectModel` 官方通道（会话级状态，桌面/手机同流实时同步）。

每档拥有独立的透明底 24 帧动画，运行时素材为 `lib/whale-sprites/*.webp` 下的 1056×512 无损 WebP（6×4 网格，单格 176×128）。宿主 `lib/whale-sprites.js` 在 `/dsh-desktop/whale-sprites/<state>.webp` 注册六个精确同源路由，浏览器端预加载后以 CSS `background-position` 播放；切档通过 React key 重启动画，系统开启“减少动态效果”时停在首帧。Flash 三档保持轻快，Pro 三档的动作语义更强，避免 Flash·Max 比 Pro 更努力。

视觉层：鲸鱼整体 `scaleX(-1)` 翻转，使朝向（右）与档位递增方向一致；鲸鱼 56×42 半浸在轨道上沿（`dsh-rheo-sea` 固定高度容器，轨道绝对定位贴底，避免外边距折叠），位置与填充宽度都以 `THUMB=28` 为基准，满档时填充恰好 100%。填充用蓝系渐变（hue 212→235，不含紫色），内含流光扫过层与随档位增多的星尘粒子（2→8 颗，伪随机种子按档位稳定）；轨道上按档位等距渲染 6 个圆点刻度（已过档位点亮，鲸鱼只没入轨道上沿不遮挡圆点）。弹层背景为提亮的磨砂玻璃（rgba(46,50,64,0.92) + blur 20px）。轨道高度用 `!important` 加固，避免第三方注入的全局样式压扁布局。

### @会话提及

输入 `@` 触发会话候选菜单。候选按会话 id 去重；同标题（且同创建日）的会话追加短 id 尾缀区分。提交时序列化为 `dsh-session:` URI，主机端在 `agent/pre-step` 由 session-reference resolver 解析并注入快照上下文；解析失败不阻断回合。

## 视觉桥

`scripts/apply-vision-bridge.mjs` 确定性地给 rc.6 依赖打补丁：图片消息经附件存储落地后替换为对 `mcp__vision__describe_image` 的文本指令（文本模型照常调用工具回路取回文字描述）；原生支持图片的模型不经过桥。脚本要求锚点精确匹配，依赖升级导致锚点消失时报错而不是静默半补丁。

## 数据与凭据流

- DeepSeek 凭据只由 dsh 自身的模型配置持有；插件只调用 `user/balance` 查询余额。
- 历史 Prompt 属于本机用户数据，只写入 `$DSH_HOME/desktop/prompt-history.json`，不进入仓库、构建产物或日志；单条上限 64 KiB。
- vision MCP 的 API Key 只存本机（`vision.config.json`，权限 600，接口不回传浏览器）；缺省回退到环境变量 / `$DSH_HOME/.credentials.yaml`。
- 图片字节存于 `$DSH_HOME/attachments/v1/objects/<prefix>/<sha256>`；只有 agent 调用看图工具时才离开本机。

## 构建与回退

- 构建链：`vision:prepare` → `pack:plugin`（tgz → node_modules）→ `ensure-peer-deps`（peer 依赖钉入 package.json，防止 electron-builder 裁剪导致外来电脑启动失败）→ electron-builder（arm64 DMG+zip，未签名）。
- 校验：`npm run vision:check`、`node --check`、隔离 `DSH_HOME` 冷启动、外来路径冷启动。
- 回退：插件代码回退后重跑 `pack:plugin` + `dist`；补丁异常时重装依赖重跑；运行时行为回退只需清桌面配置目录，数据不受影响。
