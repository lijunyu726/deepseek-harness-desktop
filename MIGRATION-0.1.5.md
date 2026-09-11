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

## 覆盖层清单（当前）

| 补丁 | 目标 | 状态 |
| --- | --- | --- |
| `agent-loop-index.js` | `dsh-agent-loop/lib/index.js` | ✅ |
| `session-controller-index.js` | `dsh-api-session-controller/lib/index.js` | ✅ |
| `workspace-index.js` | `dsh-workspace/lib/index.js` | ✅ |
| `chat-client.js` | `dsh-client-ui-chat/lib/client.js` | 🟡 1/4 标记 |
| `conversation-client.js` | `dsh-client-ui-conversation/lib/client.js` | ❌ |

## 构建链

补丁应用是**表驱动 + 全量预检**的：任一补丁缺失即拒绝启动，避免半途失败留下
「部分已 patch」的假成功。`patches/superseded-0.1.1/` 存放 0.1.1 版本的整文件，
**不参与应用**——它们若被套到 0.1.5 的包上会用旧实现覆盖新包。
