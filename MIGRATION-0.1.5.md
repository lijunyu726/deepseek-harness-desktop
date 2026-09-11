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

## 尚未解决

**永久删除会话/工作区的 API 已重构**，桌面端「设置 → 归档管理」彻底删除功能依赖的
链路需要重新设计：

- `dsh-host-apiproxy` 的 `workspace.deleteSession` 已不存在
- 会话删除不在 `dsh-api-session-controller` 的 commands 里
- `dsh-workspace` 接缝不再暴露 `deleteSession`
- `deleteSession` 目前只出现在 `dsh-session-query-sqlite`（内部索引维护，非公开 API）
  和本项目插件自身

## 构建链

补丁应用是**表驱动 + 全量预检**的：任一补丁缺失即拒绝启动，避免半途失败留下
「部分已 patch」的假成功。`patches/superseded-0.1.1/` 存放 0.1.1 版本的整文件，
**不参与应用**——它们若被套到 0.1.5 的包上会用旧实现覆盖新包。

## 发现：0.1.5 原生的文件卡片可能与桌面端的文件芯片重叠

`dsh-client-ui-chat` 的 `UserStyleBubble` 已经原生渲染 durable 文件附件卡片
（`MessageItem_module_css_default.fileCard` + `FileTypeIcon` + `fileExtension` +
`fileSizeText`），数据来自 0.1.5 官方的 `fileUploads` 收据流：

客户端上传 → `receiptId` → 宿主 `ctx.fileUploads.resolve()` → durable
`FileAttachmentRef` → 气泡上渲染成卡片，模型按引用读取。

桌面端 `FileAttachmentCard` 覆盖的能力与它的差异：

| 能力 | 0.1.5 原生 | 桌面端芯片 |
| --- | --- | --- |
| 文件卡片（图标/名/扩展名/大小） | ✅ | ✅ |
| macOS 真实文件图标（`app.getFileIcon` 桥） | ❌（按扩展名给图标） | ✅ |
| 文件夹上传 | ❓ 待确认 | ✅ |
| 点击显示完整路径 | ❌ | ✅ |

**因此 chat 补丁里的文件芯片部分（11–14 共 4 处、约 200 行）可能不需要移植**，
改为让桌面端走官方 `fileUploads` 流程即可。这会把 conversation/chat 两个补丁的
文件相关改动整体消掉，代价是失去 macOS 真实图标、文件夹上传与路径显示。

这个取舍需要用户拍板；`patches/superseded-0.1.1/conversation-client.js` 保留了
原实现，若要保留随时可以移植。

## chat 补丁（11 处）逐处说明

| # | 行数 | 内容 | 0.1.5 处理建议 |
| --- | --- | --- | --- |
| 11 | +164 | `contentParts` 增加 `files` 收集 + `FileAttachmentCard`/`fileEmoji`/`normalizeFileBlock`/`parseFileCaption`/`DESKTOP_VISION_BRIDGE_DISPLAY` | 文件芯片部分视上面取舍；`DESKTOP_VISION_BRIDGE_DISPLAY` **必须移植**（隐藏桥接文本） |
| 12 | +1 | 解构出 `files` | 随 11（注意 0.1.5 返回的是 `attachments` 不是 `images`） |
| 13 | +4 | 渲染文件卡片列表 | 随 11 |
| 14 | +2/−2 | 缩进连带调整 | 随 13 |
| 15 | +126 | `UserMessageNodeView` 原位编辑（`useDshEditStore` + `__dshEditStore`） | 必须移植 |
| 16 | +29 | `promptTargetKey` 时间轴定位 | 必须移植（锚点已重构，需定位） |
| 17 | +5 | `olderRequestRef`/`promptNavigationRef` 等 refs | 必须移植 |
| 18 | +1 | 滚到顶部 48px 内自动 `loadOlderAnchored()` | 必须移植 |
| 19 | +1/−1 | 用 guard 取代分页按钮的 ref-null 断言 | 必须移植 |
| 20 | +60 | 历史时间轴导航与自动逐页加载 | 必须移植 |
| 21 | +0/−9 | 移除「加载更早」按钮 | 必须移植 |
| 22 | +1 | 投影里带上 `messageId`（时间轴精确定位用） | 必须移植 |

0.1.5 的 `contentParts` 签名已变：返回 `{ text, attachments, rest }`，其中
`attachments` 同时承载 image 与 file 附件；原补丁的 `images` 字段已不存在。
解构锚点也从 `const { text, images, rest }` 变为
`const { text, attachments: contentAttachments, rest }`（`client.js:1234`）。
