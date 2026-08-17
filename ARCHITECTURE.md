# DeepSeek Harness Desktop Architecture

## Runtime

Electron 主进程用 Electron 自带的 Node 运行时（`ELECTRON_RUN_AS_NODE=1` + `process.execPath`，无需系统 Node）启动打包好的 `dsh web` 服务子进程。子进程默认只绑 `127.0.0.1`；Electron 窗口加载这个本地 URL。主进程负责启动、日志、重启与优雅退出；用户数据（会话、凭据、桌面配置）在 `$DSH_HOME`（默认 `~/.dsh`）与 `~/Library/Application Support/DeepSeek Harness`，与程序本体完全分离。

- `main/child-guard.mjs` 由服务子进程预加载：所属 Electron 进程消失时服务自行退出，避免遗留孤儿服务；重启请求在重启期间串行化。
- 端口持久化：首次启动选定的端口写入桌面配置，之后重启复用同一端口（被占用才换新），使手机端保存的地址长期有效；端口不变时重启不重载窗口。
- 局域网模式：CLI 出于安全拒绝 `--host 0.0.0.0`，桌面壳改由 `--patch` 覆盖 webserver 行 config 完成全接口绑定，保留 dsh 的浏览器信任围栏。

## 双面 Cordis 插件（`@deepseek-ai/dsh-desktop`）

`assets/desktop.patch.yml` 以 insert 形式挂载插件。`DshServer.ensurePluginFallback()` 在启动前把打包的插件软链进 profile 的模块回退目录。插件主机端（`lib/index.js`）通过 Typert 远程（`globalInstructions/*`，SRC 反射模式）暴露全部业务面；浏览器端（`lib/client.js`）是一个客户端模块 bundle（`window.__ModuleLoader__.load`），注册设置分类与会话页界面；`lib/mobile.js` 在服务端注入 index.html 引导脚本（工作区自选 + 手机抽屉布局）。

### 设置分类（`settings.section`）

- **用量**：总量来自投影缓存；按日用量由独立扫描子进程产出（见下）；余额走 DeepSeek `user/balance`。
- **全局约束规则**：直接读写 `$DSH_HOME/AGENTS.md`。
- **归档管理 / 扩展**：会话归档取消、MCP 服务器与 Skills 的列表/开关/删除（读写 profile 补丁与 SKILL.md frontmatter）。
- **看图工具**：vision MCP 的模型名/调用地址/API Key 写入服务脚本旁的 `vision.config.json`（每次调用实时读取）；首次保存会把旧硬编码脚本替换为随应用打包的 `assets/vision-server.mjs` 模板并重启该 MCP 行。
- **应用**：通知、开机自启、局域网访问（二维码/地址）、代理、统计样式、存储占用。

### 按日用量扫描（隔离子进程）

Electron 内置 Node 的 zstd 原生解码（同步/异步/流式路径均实测复现）会随机 SIGTRAP，因此**一切解压都在 `assets/usage-scan.mjs` 子进程**：扫描器按帧边界拆分日志（会话日志是只追加的 zstd 帧流）、逐帧流式解码 `assistant/message` 用量并按本地日期聚合。主机端只做：readdir+stat 找出变更文件、按 mtime/size/frameEnd 缓存（持久化于 `$DSH_HOME/desktop/usage-scan-cache.json`）、以 `--jobs` 下发增量任务、合并结果。子进程崩溃只丢一次刷新。

### 局域网可信名单自愈

dsh 在服务启动瞬间对网络接口做一次性快照生成 `trustedHosts`；恰逢网络切换的快照为空时，手机所有 `/api` 请求 403。插件在 loader 就绪后及每 30 秒把当前非内部 IPv4（过滤 198.18/15、169.254/16 等不可达虚拟隧道地址）补进 connection 行的 `trustedHosts`（`entry.update`，进程内生效、不写补丁文件）。

### 鲸鱼思考强度变阻器

接管 `conversation.input.model` 单席位（priority -10 压过 shell 的 0）：一个滑块串联两个 DeepSeek 模型共六档（Flash·Off→High→Max→V4 Pro·Off→High→Max）。选中即走 `session.selectModel` 官方通道（会话级状态，桌面/手机同流实时同步）。视觉层全部为手绘 SVG + CSS：logo 风格扁平蓝鲸、六档表情递进（闭眼→圆眼→立眉→压眉→咬牙→张嘴）、档位驱动泳速/前倾、最高档才喷水、气泡随档位增多。

### @会话提及

输入 `@` 触发会话候选菜单。候选按会话 id 去重；同标题（且同创建日）的会话追加短 id 尾缀区分。提交时序列化为 `dsh-session:` URI，主机端在 `agent/pre-step` 由 session-reference resolver 解析并注入快照上下文；解析失败不阻断回合。

## 视觉桥

`scripts/apply-vision-bridge.mjs` 确定性地给 rc.6 依赖打补丁：图片消息经附件存储落地后替换为对 `mcp__vision__describe_image` 的文本指令（文本模型照常调用工具回路取回文字描述）；原生支持图片的模型不经过桥。脚本要求锚点精确匹配，依赖升级导致锚点消失时报错而不是静默半补丁。

## 数据与凭据流

- DeepSeek 凭据只由 dsh 自身的模型配置持有；插件只调用 `user/balance` 查询余额。
- vision MCP 的 API Key 只存本机（`vision.config.json`，权限 600，接口不回传浏览器）；缺省回退到环境变量 / `$DSH_HOME/.credentials.yaml`。
- 图片字节存于 `$DSH_HOME/attachments/v1/objects/<prefix>/<sha256>`；只有 agent 调用看图工具时才离开本机。

## 构建与回退

- 构建链：`vision:prepare` → `pack:plugin`（tgz → node_modules）→ `ensure-peer-deps`（peer 依赖钉入 package.json，防止 electron-builder 裁剪导致外来电脑启动失败）→ electron-builder（arm64 DMG+zip，未签名）。
- 校验：`npm run vision:check`、`node --check`、隔离 `DSH_HOME` 冷启动、外来路径冷启动。
- 回退：插件代码回退后重跑 `pack:plugin` + `dist`；补丁异常时重装依赖重跑；运行时行为回退只需清桌面配置目录，数据不受影响。
