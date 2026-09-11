# 0.1.1-rc.2 → 0.1.5-rc.2 迁移笔记

本文件是迁移期间的工作记忆，**迁移完成后应删除**。它记录的是「为什么这样改」和
「还剩什么没做」，供后续会话接着干时不必重新勘察。

## 为什么迁移

上游 2026-09-10 发布 DeepSeek-V4.1-Flash（模型名 `deepseek-flash`）：原生多模态、
1M 上下文、并发 2500、价格约为 V4-Pro 的 1/4。旧名 `deepseek-v4-flash` 与
`deepseek-v4-flash-vision-exp` 已下线但仍路由到新模型；`deepseek-v4-pro` 自
北京时间 2026-09-14 12:00 起也路由到 V4.1-Flash。

后果：桌面端「三档变阻器」`Vision Max → Flash Max → Pro Max` 所对应的三个模型 id
会全部指向同一个模型，档位语义失效。

## 上游包结构的破坏性变化

| 0.1.1 位置 | 0.1.5 位置 |
| --- | --- |
| `dsh-host-apiproxy` | **包已删除**，拆成 `dsh-api-session-controller`（提示词/附件/会话）、`dsh-api-workspace-controller`（工作区）、`dsh-api-settings-controller`、`dsh-api-workspace-files` |
| `dsh-client-runtime` | **包已删除**，由 `dsh-client-resources` 承接 |
| `dsh-client-ui-conversation`（渲染 + 输入区） | 渲染部分拆到 `dsh-client-ui-chat`；composer 留在 `dsh-client-ui-conversation` |
| `dsh-attachment` 的 `ctx.attachments.root` | **不再暴露**；改用 `fileHostPath(ref)` / `imageHostPath(ref)` |

其余与桌面端相关的破坏性变更（经实测对本项目**无影响**）：
- 插件用的 5 个插槽在 0.1.5 全部健在：`settings.section`、
  `conversation.session.header.utilities`、`conversation.composer.dock`、
  `conversation.input.right`、`conversation.input.model`
- 被移除的是 `ctx.agent`（单数）；插件用的是 `ctx.agents`（复数），仍在
- 插件未使用 Inbox、`session.events`、`seq`、`eventAt`、`panellist` 等已变更 API

## 真实改动量（以**纯净 npm 0.1.1-rc.2** 为基准）

不要用仓库里的 `node_modules/**.upstream-backup` 做基准——它并非纯净上游
（`conversation` 的备份比纯净版多 481 行，会把改动量严重低估）。

| 补丁 | 真实改动 | 状态 |
| --- | --- | --- |
| `agent-loop-index.js` | +17 / −2（2 处） | ✅ 已移植 |
| `apiproxy-index.js` | +223 / −20（5 处） | 🟡 vision 部分已移植，删除部分待做 |
| `conversation-client.js` | +541 / −52（24 处） | ❌ 待移植 |

## conversation 补丁 24 处改动的归属（用上游上下文行做指纹判定）

- **chat（`dsh-client-ui-chat`）11 处**：11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22
  —— 文件芯片渲染、`contentParts`、`UserMessageNodeView` 原位编辑、
  `promptTargetKey` 时间轴定位、`loadOlder` 自动分页
- **conv（`dsh-client-ui-conversation`）8 处**：1, 3, 4, 5, 6, 7, 9, 10
  —— draft 附件分类（`browserDraftAttachment` / `isImageFile`）、
  `serializeImages`、输入区 accessory/命令菜单
- **锚点已重构，需单独定位 4 处**：2, 8, 16, 23
  —— `sendSession(session, text, imageIds, …)` 签名、`intakeImages` 回调、
  `ProducedFiles` 工作区打开、`cwd` 取值
- **1 处无上下文**：24

## 关键设计决策：文件块不走结构化 wire 格式

0.1.5 把 `session.prompt` 的 codec 定为 **strict**，其 `file` 变体强制要求
`receiptId`：

```js
z.object({ "type": z.literal("file"), "receiptId": z.string() })   // 必填
```

桌面端原本的 metadata 文件块 `{type:'file', fileKind, name, size, path, shortPath, files}`
没有 `receiptId`，会在 RPC 边界被拒收。三处 schema 都要改（都是生成文件）：

1. `dsh-api-session-controller/lib/typert.host.js`（宿主侧）
2. `dsh-api-session-controller/lib/typert.remote-client.js`（客户端侧，package.json 导出）
3. `dsh-api-remotes/lib/client.js`（浏览器 wire 客户端）

**决定：不改 schema**。改为让客户端把文件元数据发成**文本标题**，渲染器已有回退分支
直接消费：

- `normalizeFileBlock(block)` 产出 `{ kind, name, size, path }`
- `parseFileCaption(text)` 产出**完全相同**的 `{ kind, name, size, path }`

两者可互换，芯片渲染无差别，且 `parseFileCaption` 的注释本就写着它是给旧消息用的
回退路径。代价仅是 durable 会话日志里文件从结构块变成文本。

## 永久删除 / 取消归档：已在插件侧闭环

0.1.5 把这两个能力**从上游 API 里整个拿掉了**，两条路径都断：

- RPC 层（实测 `dsh-api-remotes` 的注册表）：会话侧只有 attachment / cancel /
  control / create / follow / fork / list / modelCatalog / openWorkspacePath /
  page / prompt / rename / search / selectModel / updateQueue —— **没有 `session/delete`**；
  工作区侧只有 `workspace/archiveSession`、`workspace/delete` 等。
- 接缝层：`dsh-workspace` 的 registry 只有 `archiveSession()`，**没有
  `unarchiveSession()`，也没有 `deleteSession()`**；`dsh-session-persistence`
  只给 append/close/flush/read。

而桌面端两条路径都依赖它们：`packages/dsh-desktop/lib/index.js` 的
`deleteSessions()` 走 ApiProxy（0.1.5 里该包已删除），回退分支调用
`registry.deleteSession(id)`；`unarchiveSession()` 调用 `registry.unarchiveSession(id)`。

**处置：新增 `patches/workspace-index.js`**，在 `dsh-workspace/lib/index.js` 的
registry 类里补回这两个方法（对上游差异 56 行）：

- `unarchiveSession(id)`：从 `archivedSessionIds` 里移除该 id（幂等）。
- `deleteSession(id)`：解绑工作区记账 → 移出归档集 → 按 `sessionPaths` 记录的路径
  删除会话日志 → 清理 `sessionPaths` 与 `headers` 索引（幂等，文件已不存在也 resolve）。
  另需把 `rm` 加进 `node:fs/promises` 的 import。

  ⚠️ 踩坑：workspace 包里其实有**两个类**——`WorkspaceEntity`（每工作区，拥有
  `mutate` / `detachSession` / `sessionIds`）与 `WorkspaceRegistry`（拥有
  `archiveSession` / `sessionPaths` / `headers` / `enqueueOperation`）。第一版
  `deleteSession` 误用了 `this.mutate`（registry 上没有，运行期会抛错），改为遍历
  `this.list()` 找到所属实体再 `detachSession`。新增方法必须只用 registry 上的成员：
  `enqueueOperation` / `requireState` / `setState` / `list` / `sessionPaths` / `headers`。

因此 `api-workspace-controller` 覆盖层**不再需要**——功能回到了本项目自己的插件里。

### 待运行期验证

插件回退分支还调用 `agents.remove?.(id)` 与 `sessions.remove?.(id)`（都是可选链）。
实测 0.1.5 的 `dsh-agent` 服务方法表里 **`remove(messageId)` 是删除收件箱消息**，
不是注销 agent；`dsh-session` 也没有 `remove`。两者会静默空转，被删会话是否
「幽灵」回侧边栏（插件注释里描述的 0.1.1 症状）需要在冒烟测试里实测。
若确实残留，可行方向是让 `deleteSession()` 一并从 header 索引与 `session/list`
的枚举源里剔除（`session/list` 的枚举来源需再确认）。

## 修正：文件处理改走「原生文件 + 桌面文件夹」混合方案

上一轮看到 0.1.5 无文件夹上传后，结论是「整套保留桌面端文件处理」。本轮细读
0.1.5 的 composer 后发现那个结论低估了成本：**0.1.5 的附件管线是重建过的**，
不是可以照搬的同一套结构。

0.1.5 的实际管线（`dsh-client-ui-conversation/lib/client.js`）：

- `serializeDraftAttachments(attachmentIds)`（:3111）——图片经 `encodeImage()` 内联成
  base64；**普通文件必须引用后台完成的上传收据 `{type:"file", receiptId}`，收据没
  ready 就抛错**，且明确注释「never reread browser bytes」。
- 草稿附件由 `fileUploads` 快照驱动（`file-upload` 插件 + 宿主 `ctx.fileUploads`）。
- 另有 `QueueFile` 组件、队列路径 `serializeAttachments()` 等**两处以上**调用点。

桌面端的模型是另一套：宿主桥接把文件写进会话目录，客户端发路径元数据
（`__dshFolderPath` / `__dshSavedPath` / `__DSH_SAVE_UPLOAD__`）。

**两者要强行合并，就得重写 composer 的附件管线，而不是移植 8 处 diff。**

### 改为混合方案

| 类型 | 走哪条 | 补丁量 |
| --- | --- | --- |
| 普通文件 | **0.1.5 原生流程**（后台上传 + 收据 + 原生文件卡片） | 0 |
| 文件夹 | 桌面端处理，发文本标题（原生没有目录选择入口） | ~15 行 |
| 图片 | 0.1.5 原生内联（`encodeImage`） | 0 |

理由：桌面端原来的文件处理本身就是**对 0.1.5 尚未提供之能力的变通**；0.1.5 现在
原生提供了，而且更完整（后台上传、进度、跨会话可见、模型按 durable 引用读取）。
强行保留旧实现等于长期维护一套与上游重复的管线。

代价：普通文件失去 macOS 真实图标与点击显示路径（原生卡片按扩展名给图标）。
文件夹上传保留——它是实测确认的原生硬缺口。

### 具体接入点（估计已修正）

⚠️ 前一版估计「约 15 行」偏乐观，本轮细查后修正：0.1.5 的 `browserDraftAttachment`
**只处理图片**（`kind: "image"`，带 `previewUrl`），普通文件走后台上传通道，
**文件夹在 0.1.5 的 composer 里没有任何通道**。因此要接进来需要：

1. draft store 里新增一种文件夹描述符（现只有 image 描述符 + 文件上传记录）；
2. 接入 intake 路径（0.1.5 的 `intakeImages` 已不存在，需定位新的入口）；
3. `serializeDraftAttachments` 增加文件夹分支（`map` → `flatMap` 语义，一个附件
   产出两个 part）；
4. `serializeAttachments()`（约 :2922）与队列路径（约 :2950）两处调用点都要覆盖；
5. chat 侧的芯片渲染分支。

**更省的做法**：让文件夹根本不进附件管线——宿主主进程已经持有文件夹选择器与
`__dshFolderPath`，直接把 `📁 文件夹：<名> → <路径>` 作为**文本**塞进 composer 草稿
（复用类似 `__DSH_ADD_FILES__` 的桥接函数）。这样 composer 零改动，代价是草稿区
不显示文件夹 chip（发送后才显示）。倾向这条。

## 模型配置：已切到 deepseek-flash（含一处会抵消收益的坑）

`~/.dsh/settings.yaml` 在第 2 轮期间被改过（11:56，非本次迁移所为）：默认模型已切到
`deepseek-flash`，并新增了一个 `llm-deepseek.models` 显式目录块（4 项）。

**那个块会抵消升级的核心收益，已移除。** 原因（均已在 0.1.5 源码中核实）：

- `dsh-llm-deepseek` 的 schema 是 `models: z.array(catalogModel).default(DEFAULT_MODELS)`，
  `resolveModels()` 走 `(models ?? DEFAULT_MODELS).map(...)` —— **显式列表整体替换内置目录**。
- 同一文件里 `const inputModalities = model.inputModalities ?? ["text"]` —— **省略即按纯文本**。

而那个块里 `deepseek-flash` 只写了 `id` 与 `name`，没有 `inputModalities`，于是
V4.1-Flash 的原生读图会被降级成纯文本路由 —— 恰恰是这次升级要拿到的能力。

移除后由 0.1.5 内置目录接管：`deepseek-flash` 自带 `inputModalities: ["text","image"]`。
顺带好处是不再手工维护一份会与上游漂移的副本（这次它已经漂了）。

两层都已统一为 `deepseek-flash`：

| 层 | 位置 | 说明 |
| --- | --- | --- |
| settings | `~/.dsh/settings.yaml` → `agent-default-model.model` | 热重载，优先生效 |
| composition | `~/.dsh/profiles/web/cordis.yml` → `agent-default-model.config.model` | 组合 base；升级到 0.1.5 时该文件可能被重新生成 |

改前备份：`/Volumes/S690/dsh-backups/20260911-122525-pre-model-switch/`。
`cordis.yml` 仅改 1 行、总行数不变（579）。

## 插件侧待改：桌面「+」上传菜单的接线

取消 conversation 覆盖层后，0.1.5 里不再存在 `window.__DSH_ADD_FILES__` 与
`window.__DSH_OPEN_UPLOAD_MENU__`（它们原本由被取消的那份补丁定义）。受影响的插件代码：

| 位置 | 现状 | 需要改成 |
| --- | --- | --- |
| `client.js` 文件夹流程 | ✅ 已改为把 `📁 文件夹：<名> → <短路径>` 追加进草稿 | 完成 |
| `_deliverFiles()` (约 :3314) | 调用 `window.__DSH_ADD_FILES__`，0.1.5 里**恒为 false** | 普通文件应交给 0.1.5 原生流程：直接触发原生文件输入，而不是自己接管 |
| `_triggerFileInput()` (约 :3321) | 依赖 `_deliverFiles` | 同上 |
| 「+」菜单 | 依赖 `window.__DSH_OPEN_UPLOAD_MENU__` | 改为点击原生文件输入 / 原生上传入口 |

**判据**：0.1.5 的普通文件必须走后台上传 + 收据（`fileUploads`），桌面端不要自己
读取浏览器字节——那条路已被上游重建，自己接管等于与上游重复且必然漂移。

文件夹是唯一例外（原生实测无目录选择入口），走草稿文本标题。

## 冒烟验证：已通过（并修掉一个启动期竞态）

用隔离 DSH_HOME 以 `dsh --profile web` 直接起 0.1.5 运行时逐步定位：

| 步骤 | 结果 |
| --- | --- |
| `--dump-config` 组合 profile | ✅ 全部插件行解析成功 |
| 启动，**不带**桌面补丁 | ✅ 监听成功、HTTP 401（要 token，正常） |
| 启动，**带**桌面补丁 | ❌ `dsh-client-connection: fiber state 5`，整树不激活 |
| 定位 | 插件的 connection trust heal 在 `loader.await()` 后**立即** `entry.update()`，会**重启 connection fiber**；0.1.5 在启动序列里新增了 `assertEntriesActivated`（断言每个条目 ACTIVE）。两者构成竞态：重启窗口内条目非激活，断言即失败。 |
| 修复 | `installConnectionTrustHeal` 去掉「settle 后立刻 tick」，只保留 30s 间隔。heal 本身是为网络切换后的信任名单修复而存在，晚一个周期无损失。 |
| 复测 | ✅ 监听成功、HTTP 401、零错误行 |
| 带 token 取首页 | ✅ HTTP 200 / 40,632 字节 / `<title>DeepSeek Harness</title>` / `__DSH_BOOT__` 就位 / **页面中 `dsh-desktop` 出现 6 次**（插件客户端半边已登记） |

这个竞态在任何 `trustedHosts` 尚未写全的机器上都会让整个 profile 启不来——
包括**第一次在新机器上安装**。所以是必须修的，不是测试环境的偶然。

## 覆盖层清单（已收敛为 4 个，构建链全绿）

| 补丁 | 目标 | 与上游差异 |
| --- | --- | --- |
| `agent-loop-index.js` | `dsh-agent-loop/lib/index.js` | 17 行 |
| `session-controller-index.js` | `dsh-api-session-controller/lib/index.js` | 31 行 |
| `workspace-index.js` | `dsh-workspace/lib/index.js` | 60 行 |
| `chat-client.js` | `dsh-client-ui-chat/lib/client.js` | 369 行 |

**conversation-client 覆盖层已取消。** 0.1.5 重建了 composer 的附件管线（后台上传 +
收据），桌面端的文件夹若要走进去需要新增描述符类型、改三处调用点。但文件夹根本
不必成为附件：插件已经通过宿主 gateway 的 `copyFolderUpload` 把文件夹复制进会话
目录并拿到 `path` / `shortPath` / `files` / `totalBytes`，只是目前把它包成一个带
`__dshFolderPath` 的合成 `File` 再交给附件管线。

**改为插件侧直接把 `📁 文件夹：<名> → <短路径>` 追加进 composer 草稿**
（插件已持有 `inputActions.setDraft`）。composer 零改动，chat 侧的
`parseFileCaption` 在发送后渲染成文件夹芯片。

代价：文件夹在**草稿区**显示为文本而非芯片（发送后正常显示芯片）。

**⚠️ 尚未实施**：这一改动在 `packages/dsh-desktop/lib/client.js`（约 :3413，
现在是构造合成 File + `_deliverFiles`），属于插件适配轮次的工作。

## 构建链

补丁应用是**表驱动 + 全量预检**的：任一补丁缺失即拒绝启动，避免半途失败留下
「部分已 patch」的假成功。`patches/superseded-0.1.1/` 存放 0.1.1 版本的整文件，
**不参与应用**——它们若被套到 0.1.5 的包上会用旧实现覆盖新包。
