# AGENTS.md — deepseek-harness-desktop

给智能体修改本项目时的技术约束、目录规范、验证方式、安全边界与回退方法。修改前先读本文件。

## 项目是什么

把 DeepSeek Harness 的 `dsh web` GUI 包成 macOS 桌面应用（Electron 39，内置 Node 22.22.1，无需系统 Node），并叠加一套桌面/手机共用的增强功能（设置分类、用量热力图、鲸鱼思考强度变阻器、局域网手机访问、看图 MCP 管理等）。

- 服务子进程 = 同一个 `dsh web`（`--profile web`），桌面窗口和手机浏览器连的是**同一个服务**，没有同步层。
- 用户数据（会话/API Key/配置）全部在 `$DSH_HOME`（默认 `~/.dsh`）与 `~/Library/Application Support/DeepSeek Harness`，**永远不在本仓库内**。

## 目录规范

```
main/                  Electron 主进程（入口 main.mjs、服务子进程 server.mjs、菜单、托盘）
assets/                随应用打包的静态资源（desktop.patch.yml、usage-scan.mjs、
                       vision-server.mjs、splash.html）
packages/dsh-desktop/  双面 Cordis 插件（lib/index.js = 主机端，lib/client.js = 浏览器端，
                       lib/mobile.js = 手机布局引导层；打包成 tgz 再装入 node_modules）
scripts/               构建链：apply-vision-bridge.mjs、pack-plugin.mjs、
                       ensure-peer-deps.mjs、sync-monorepo-overrides.mjs、build-icon.mjs
release/               构建产物（.app/.dmg/.zip）——只进 git 的忽略列表，绝不提交
node_modules/          安装产物——绝不提交
```

## 构建链（顺序不可乱）

0. **（仅新克隆/重装依赖后）fork 覆盖层**：本项目消费 npm 发布的 rc.6 依赖，但本地 fork 的会话删除等特性需要从 DSH 大仓覆盖运行时文件。克隆后先 `npm install`，再（如大仓可用）构建大仓并执行 `DSH_MONOREPO=<大仓路径> npm run sync:monorepo`；没有大仓时应用仍可构建运行，只是缺 fork 特性。已迁移的本机 node_modules 已含覆盖层，日常构建跳过此步。
1. `npm run vision:prepare` —— 给 rc.6 依赖打视觉桥补丁（可重建、拒绝未知版本）；
2. `npm run pack:plugin` —— 把 `packages/dsh-desktop/lib/*` 打进 tgz 并刷新 `node_modules/@deepseek-ai/dsh-desktop`（**改插件代码后必须重跑**，否则应用里跑的是旧包）；
3. `node scripts/ensure-peer-deps.mjs` —— 把全部 peer 依赖钉进 `package.json`（electron-builder 会裁掉 peer 依赖，漏掉会导致别的电脑启动即崩）；
4. `npm run dist` —— 打 arm64 DMG+zip（未签名，首次打开用右键→打开）。

`npm start` / `npm run dev` 会自动跑 1+2。

## 关键实现约束（改代码前必读）

- **zstd 解码必须留在子进程**：Electron 内置 Node 的 zstd 原生解码（同步/异步/流式）都会随机 SIGTRAP，任何「进程内解压」都是回归。用量扫描全部在 `assets/usage-scan.mjs` 子进程里，失败只丢刷新、不杀服务。
- **日志扫描是增量的**：会话日志是只追加的 zstd 帧流；扫描结果（mtime/size/frameEnd/按日用量）持久化在 `$DSH_HOME/desktop/usage-scan-cache.json`，重启后不变的文件零开销。
- **路径自愈**：插件内所有定位 app 资源（usage-scan.mjs、vision-server.mjs 模板）都用「模块目录相对路径 + `process.execPath` 回退」双候选；`ensureVisionCommand` 会在启动时把 vision MCP 行的 `command` 从系统 `node` 改写为应用自带 Node（app 移动后自动重写）。**不要把绝对路径写死在插件里。**
- **插槽优先级**：接管 shell 的单席位要用比 0 更低的 priority（鲸鱼变阻器用 -10）。
- **客户端连接面**：Typert 远程走 `connection.rpc.call('/api', 'globalInstructions/<m>')`；shell 原生 unary 走 `connection.api.sessions/llm/...`（不是 `connection.sessions`）。
- **安全围栏**：`settings.describe`/`credentials.*` 被 dsh 硬锁回环地址，手机端会 403——这是上游安全设计，不要试图在补丁里放宽。
- **局域网可信名单**：dsh 启动瞬间对网络接口做一次性快照，网络切换时可能拿到空集导致手机 403。插件每 30 秒把当前 IPv4 补进 connection 行的 `trustedHosts`（`entry.update`，不写补丁文件），并过滤 198.18/15、169.254/16 这类不可达的虚拟隧道地址。

## 验证方式

- 语法：`node --check packages/dsh-desktop/lib/*.js assets/*.mjs`；
- 隔离服务冒烟：复制 release 应用为 `TestApp.app`，用独立 `DSH_HOME` + `ELECTRON_RUN_AS_NODE=1` 启动（注意：插件必须由应用内 node_modules 解析，加载器不认 profile 里的软链指向的其它副本；补丁参数 `--expose-internals` 必须在 bin.js 之前）；
- 浏览器交互：ego-browser（`useOrCreateTaskSpace` + 手机/桌面视口），测完 `completeTaskSpace`；
- 打包产物核对：检查 `release/mac-arm64/…app/node_modules/@deepseek-ai/dsh-desktop/lib` 与新代码一致；
- 外来电脑模拟：把 .app 复制到项目树之外的路径（无上游 node_modules 可借）冷启动，必须能起服务——这验证 peer 依赖补齐没有回归。

## 安全边界

- 不得把 `$DSH_HOME` 下的任何真实数据（会话日志、投影缓存、凭据、vision.config.json）复制进仓库或构建产物；
- 不得放宽 dsh 的信任围栏/特权方法锁；
- 提交前 `grep` 检查明文密钥（`sk-`、XIAOMI key 值）与本机路径；
- 局域网访问开关默认关闭，且只面向用户可信网络。

## 回退方法

- 插件代码回退：改回 `packages/dsh-desktop/lib/*` → `npm run pack:plugin` → `npm run dist` 重打；
- 依赖补丁回退：`scripts/apply-vision-bridge.mjs --check` 校验完整性；异常时用干净依赖重装后重跑；
- 运行时回退：停掉桌面应用、删 `~/Library/Application Support/DeepSeek Harness` 里的桌面配置即可回到默认（不影响 ~/.dsh 数据）；
- 应用移动后：新位置首次启动会自动重建插件软链、重写 vision 命令路径、重拍可信名单——无需手工清理。
