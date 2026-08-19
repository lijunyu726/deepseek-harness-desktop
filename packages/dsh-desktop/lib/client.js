/**
 * @deepseek-ai/dsh-desktop — browser half (client module bundle).
 *
 * Settings categories and session-page surfaces for the desktop shell:
 *   - 全局约束规则 (global instructions editor, $DSH_HOME/AGENTS.md)
 *   - 用量 (balance summary + usage charts from the local projection cache)
 *   - 应用 (notifications / launch-at-login / proxy / storage / updates)
 *   - 归档管理 (archived session list + unarchive)
 *   - 扩展 (MCP servers + Skills: lists, templates, creation flows)
 *   - Session header balance chip (Session log-styled)
 *   - Prompt-history timeline rail (side ticks + hover preview popover)
 * Served by the host client-module system at
 * /plugins/@deepseek-ai/dsh-desktop/client.js.
 */

window.__ModuleLoader__.load({
  id: '@deepseek-ai/dsh-desktop',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    let react = require('react')

    // — Shared bits ----------------------------------------------------------
    const BRAND = '#4D6BFE'
    const TEAL = '#39C5BB'
    const WARN = '#D9A24A'
    const ERR = '#E5484D'
    const OK = '#57C07C'

    const SEC_WRAP = { display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 0' }
    const ROW = { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(128,140,160,0.14)' }
    const ROW_LABEL = { flex: '1 1 260px', fontSize: '13px' }
    const ROW_HINT = { display: 'block', fontSize: '11px', opacity: 0.6, marginTop: '2px' }
    const CHECK = { width: '16px', height: '16px', accentColor: BRAND }
    const INPUT = {
      flex: '1', maxWidth: '360px', fontSize: '12px', padding: '6px 10px',
      borderRadius: '6px', border: '1px solid rgba(128,140,160,0.4)',
      background: 'transparent', color: 'inherit', outline: 'none',
      fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
    }
    const SMALL_BTN = {
      fontFamily: 'inherit', fontSize: '12px', cursor: 'pointer', padding: '6px 12px',
      borderRadius: '6px', border: '1px solid rgba(128,140,160,0.4)',
      background: 'transparent', color: 'inherit',
    }
    const PRIMARY_BTN = {
      fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
      padding: '6px 14px', borderRadius: '6px', border: 'none',
      background: BRAND, color: '#FFFFFF',
    }
    const REFRESH_BTN = {
      border: 'none', background: 'transparent', cursor: 'pointer',
      color: 'inherit', fontSize: '11px', padding: '0 2px', opacity: 0.6,
    }
    const K = { fontSize: '11px', opacity: 0.6, marginBottom: '4px' }
    const V = { fontSize: '16px', fontWeight: 600 }
    const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' }
    const TH = { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid rgba(128,140,160,0.3)', opacity: 0.65, fontWeight: 500 }
    const TD = { padding: '6px 8px', borderBottom: '1px solid rgba(128,140,160,0.14)' }
    const SECTION_TITLE = { fontSize: '13px', fontWeight: 600, marginBottom: '2px' }

    function fmtTokens(n) {
      const v = Number(n) || 0
      if (v >= 1e8) return `${parseFloat((v / 1e8).toFixed(2))}亿`
      if (v >= 1e4) return `${parseFloat((v / 1e4).toFixed(1))}万`
      return String(Math.round(v))
    }
    function fmtMs(ms) {
      const v = Number(ms) || 0
      const m = Math.round(v / 60000)
      if (m >= 60) return `${(m / 60).toFixed(1)} 小时`
      return `${m} 分钟`
    }
    function fmtBytes(n) {
      const v = Number(n) || 0
      if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GB`
      if (v >= 1e6) return `${(v / 1e6).toFixed(1)} MB`
      if (v >= 1e3) return `${(v / 1e3).toFixed(1)} KB`
      return `${v} B`
    }
    function fmtMoney(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      return n.toFixed(2)
    }
    function currencySymbol(currency) {
      if (currency === 'CNY') return '¥'
      if (currency === 'USD') return '$'
      return `${currency ?? ''} `
    }
    function fmtDay(ts) {
      if (!ts) return '—'
      const d = new Date(ts)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    // — 内置 skill 的中文标签与功能说明（未知 skill 回退到原文描述）-------------
    const SKILL_ZH = {
      brandkit: ['品牌视觉套件', '生成高端品牌板、Logo 系统与视觉世界'],
      'cordis-plugin-development': ['动态插件开发', '创建、修改与调试 Cordis 插件'],
      'design-taste-frontend': ['前端设计品味', '落地页、门户与重设计的反套路设计'],
      'design-taste-frontend-v1': ['前端设计 v1', '旧版设计品味技能（兼容保留）'],
      'editing-cordis-compositions': ['Cordis 组合编辑', '编写与校验 agent 预设组合'],
      'ego-browser': ['浏览器自动化', '打开网页、填表、点击、截图、提取数据'],
      'find-skills': ['技能发现', '查找并安装新的技能'],
      'firecrawl-website-design-clone': ['网站设计克隆', '提取目标网站设计系统为 DESIGN.md'],
      'full-output-enforcement': ['完整输出强制', '禁止截断与占位，强制完整生成代码'],
      'gpt-taste': ['精英动效设计', 'GSAP 动效与 AIDA 布局的高端 UX'],
      hallmark: ['反 AI 味设计', '新页面构建、审计与重设计的品味规范'],
      'high-end-visual-design': ['高端视觉设计', '贵感字体、间距、阴影与卡片规范'],
      humanizer: ['去 AI 味（英文）', '让英文文本更自然，消除 AI 痕迹'],
      'humanizer-zh': ['去 AI 味（中文）', '让中文文本更自然，消除 AI 痕迹'],
      'humanizer-zh-plus': ['去 AI 味增强（中文）', '32 种模式检测与修复 AI 写作痕迹'],
      'image-to-code': ['图转代码', '先生成设计图，再按图实现网页'],
      'imagegen-frontend-mobile': ['移动端图生', '生成 App 界面概念图与多屏一致性设计'],
      'imagegen-frontend-web': ['网页图生', '为落地页每个区块生成设计参考图'],
      'industrial-brutalist-ui': ['工业粗野风 UI', '军事终端美学与瑞士排版的硬核界面'],
      'minimalist-ui': ['极简 UI', '暖色单色、编辑风格的克制界面'],
      obsidian: ['Obsidian 笔记', 'vault、笔记与同步的操作技能'],
      'redesign-existing-projects': ['存量项目升级', '为现有网站/应用做高端重设计'],
      'stitch-design-taste': ['Stitch 设计系统', '生成可执行的 DESIGN.md 设计规范'],
      'token-receipt': ['Token 小票', '把对话 token 用量做成热敏纸小票'],
    }

    function skillZh(name) {
      return SKILL_ZH[name] ?? null
    }

    /** MCP 服务器的中文说明（按命令匹配模板；未知的给通用描述）。 */
    function mcpZh(server) {
      const target = `${server.command ?? ''} ${(server.args ?? []).join(' ')}`
      if (target.includes('server-filesystem')) return '文件系统：读写本机指定目录'
      if (target.includes('mcp-server-fetch')) return '网页抓取：把网页内容转成 markdown'
      if (target.includes('server-github')) return 'GitHub：仓库、Issue、PR 操作'
      if (target.includes('server-memory')) return '知识图谱记忆：持久化实体与关系'
      if (server.transport === 'streamable-http') return 'HTTP 远程 MCP 服务'
      return '外部工具服务器'
    }

    // — 胶囊开关 ---------------------------------------------------------------
    function TogglePill({ checked, disabled, onChange, title }) {
      return react.createElement(
        'button',
        {
          type: 'button',
          title,
          disabled: disabled === true,
          onClick: () => onChange(!checked),
          style: {
            position: 'relative', width: '34px', height: '19px', borderRadius: '999px',
            border: 'none', cursor: disabled ? 'default' : 'pointer', padding: 0,
            background: disabled ? 'rgba(128,140,160,0.15)' : checked ? BRAND : 'rgba(128,140,160,0.35)',
            opacity: disabled ? 0.5 : 1, flexShrink: 0,
          },
        },
        react.createElement('span', {
          style: {
            position: 'absolute', top: '2px', left: checked ? '17px' : '2px',
            width: '15px', height: '15px', borderRadius: '50%',
            background: '#FFFFFF',
          },
        }),
      )
    }

    const DELETE_BTN = {
      border: 'none', background: 'transparent', cursor: 'pointer',
      color: ERR, fontSize: '11px', padding: '2px 0', opacity: 0.75,
      fontFamily: 'inherit', width: '72px', textAlign: 'center', flexShrink: 0,
    }

    // — 全局约束规则 -----------------------------------------------------------
    const G_WRAP = { display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }
    const G_HINT = { fontSize: '12px', lineHeight: 1.7, opacity: 0.72 }
    const G_TA = {
      width: '100%', minHeight: '300px', resize: 'vertical', boxSizing: 'border-box',
      fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
      fontSize: '13px', lineHeight: 1.65, padding: '12px 14px', borderRadius: '8px',
      border: '1px solid rgba(128,140,160,0.4)', background: 'transparent',
      color: 'inherit', outline: 'none', tabSize: 4,
    }
    const G_FOOT = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }

    function GlobalInstructionsSection({ gateway }) {
      const [text, setText] = react.useState('')
      const [saved, setSaved] = react.useState(undefined)
      const [saving, setSaving] = react.useState(false)
      const [notice, setNotice] = react.useState({ text: '', kind: '' })

      react.useEffect(() => {
        let cancelled = false
        gateway.load().then(
          (r) => {
            if (cancelled) return
            if (r && r.ok) {
              const content = r.content ?? ''
              setText(content)
              setSaved(content)
            } else {
              setNotice({ text: '读取失败：' + ((r && r.error) || '未知错误'), kind: 'err' })
            }
          },
          (err) => {
            if (!cancelled) setNotice({ text: '读取失败：' + String((err && err.message) || err), kind: 'err' })
          },
        )
        return () => {
          cancelled = true
        }
      }, [gateway])

      const dirty = saved !== undefined && text !== saved
      const save = () => {
        if (saving || !dirty) return
        setSaving(true)
        gateway.save(text).then(
          (r) => {
            if (r && r.ok) {
              setSaved(text)
              setNotice({ text: '已保存 ✓', kind: 'ok' })
            } else {
              setNotice({ text: '保存失败：' + ((r && r.error) || '未知错误'), kind: 'err' })
            }
            setSaving(false)
          },
          (err) => {
            setNotice({ text: '保存失败：' + String((err && err.message) || err), kind: 'err' })
            setSaving(false)
          },
        )
      }

      const statusText = notice.kind === 'err' ? notice.text : dirty ? '有未保存的修改' : notice.text
      const statusColor = dirty ? WARN : notice.kind === 'err' ? ERR : notice.kind === 'ok' ? OK : undefined

      return react.createElement(
        'div',
        { style: G_WRAP },
        react.createElement(
          'div',
          { style: G_HINT },
          '写入 ~/.dsh/AGENTS.md，对所有会话生效（对应 Codex 的自定义指令）。支持 Markdown，可用 ## 标题分节；保存后新会话立即生效。',
        ),
        react.createElement('textarea', {
          style: G_TA,
          value: text,
          spellCheck: false,
          placeholder: '在此输入全局约束规则，例如：\n## 工作规范\n- 回复使用简体中文\n- 修改代码前先阅读相关文件',
          onChange: (e) => setText(e.target.value),
        }),
        react.createElement(
          'div',
          { style: G_FOOT },
          react.createElement('span', { style: { fontSize: 12, color: statusColor } }, statusText),
          react.createElement(
            'button',
            { style: saving || !dirty ? { ...PRIMARY_BTN, opacity: 0.45, cursor: 'default' } : PRIMARY_BTN, disabled: saving || !dirty, onClick: save },
            saving ? '保存中…' : '保存',
          ),
        ),
      )
    }

    // — 归档管理 ---------------------------------------------------------------
    const ARCH_HINT = { fontSize: '12px', lineHeight: 1.7, opacity: 0.72 }

    // Phone layout: a 5-column table cannot survive 290px — columns collapse
    // (title got 41px, the 取消归档 button wrapped into a 38×82px tower). On
    // narrow/touch screens restyle each row as a card: checkbox | title /
    // cwd · date / action buttons, with the header row hidden entirely.
    function installArchivesMobileStyle() {
      if (document.getElementById('dsh-archives-mobile-css') !== null) return
      const style = document.createElement('style')
      style.id = 'dsh-archives-mobile-css'
      style.textContent = [
        '@media (max-width: 760px), (pointer: coarse) and (max-width: 960px) {',
        '  .dsh-archives-table thead { display: none !important; }',
        '  .dsh-archives-table, .dsh-archives-table tbody { display: block !important; width: 100% !important; }',
        '  .dsh-archives-table tr { display: grid !important; grid-template-columns: 24px minmax(0, 1fr) auto; column-gap: 8px; row-gap: 4px; padding: 8px 10px; border: 1px solid rgba(128,140,160,0.22); border-radius: 10px; margin: 0 0 8px; }',
        '  .dsh-archives-table td { display: block !important; padding: 0 !important; border: none !important; width: auto !important; }',
        '  .dsh-archives-table td:nth-child(1) { grid-column: 1; grid-row: 1 / span 2; align-self: start; padding-top: 2px !important; }',
        '  .dsh-archives-table td:nth-child(2) { grid-column: 2 / span 2; grid-row: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '  .dsh-archives-table td:nth-child(3) { grid-column: 2; grid-row: 2; opacity: 0.62; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '  .dsh-archives-table td:nth-child(4) { grid-column: 3; grid-row: 2; opacity: 0.62; white-space: nowrap; }',
        '  .dsh-archives-table td:nth-child(5) { grid-column: 1 / span 3; grid-row: 3; padding-top: 6px !important; }',
        '}',
      ].join('\n')
      document.head.appendChild(style)
    }

    function cwdLabel(cwd) {
      if (typeof cwd !== 'string' || cwd.length === 0) return '—'
      const parts = cwd.split('/').filter(Boolean)
      return parts.length > 0 ? parts[parts.length - 1] : cwd
    }

    /**
     * 设置 → 归档管理：列出注册表级归档集合中的会话，提供「取消归档」和
     * 「删除」（单个 + 多选批量）。删除走 host remote（deleteSessions）；
     * 宿主流在注册表变化后推送 host/archived-sessions-changed，列表与
     * 侧边栏自动同步。单选删除的二次确认内联在该行原位（确认删除/取消
     * 与删除按钮放一起），多选批量删除用顶部批量确认条；删除落库后刷新
     * 客户端会话基线，被删会话立刻从侧边栏消失，不会残留在「未分组」。
     * remote 内部每步都有超时兜底，客户端另有总超时，界面绝不会卡死。
     */
    function ArchivesSection({ gateway, useSessions, useWorkspaces }) {
      const [notice, setNotice] = react.useState({ text: '', kind: '' })
      const [busyId, setBusyId] = react.useState(null)
      const [selected, setSelected] = react.useState([])
      const [confirmId, setConfirmId] = react.useState(null)
      const [deleting, setDeleting] = react.useState(false)
      react.useEffect(() => {
        installArchivesMobileStyle()
      }, [])
      const archivedIds = useWorkspaces((s) => s.archivedSessionIds)
      const byId = useSessions((s) => s.byId)

      const rows = (archivedIds ?? []).map((id) => {
        const row = byId[id]
        return {
          id,
          title: row?.displayTitle ?? String(id),
          cwd: row?.cwd,
          updatedAt: typeof row?.updatedAt === 'number' ? row.updatedAt : 0,
        }
      })

      const unarchive = (id) => {
        if (busyId !== null || deleting) return
        setBusyId(id)
        // The row leaves this list on success; drop its pending inline
        // delete confirmation so a later re-archive cannot resurrect it.
        if (confirmId === id) setConfirmId(null)
        gateway.unarchiveSession(id).then(
          (r) => {
            if (r && r.ok) setNotice({ text: '已取消归档 ✓（会话回到侧边栏原分组）', kind: 'ok' })
            else setNotice({ text: '取消归档失败：' + ((r && r.error) || '未知错误'), kind: 'err' })
            setBusyId(null)
          },
          () => {
            setNotice({ text: '取消归档失败：RPC 调用出错', kind: 'err' })
            setBusyId(null)
          },
        )
      }

      const toggleSelect = (id) => {
        setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
      }
      const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id))
      const toggleSelectAll = () => {
        if (allSelected) setSelected([])
        else setSelected(rows.map((row) => row.id))
      }

      const deadline = (p, ms, message) => {
        const tracked = Promise.resolve(p)
        tracked.catch(() => {})
        let timer
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), ms)
        })
        return Promise.race([tracked, timeout]).finally(() => clearTimeout(timer))
      }

      const doDelete = async (ids) => {
        if (deleting) return
        setDeleting(true)
        setBusyId(null)
        setNotice({ text: '', kind: '' })
        try {
          const r = await deadline(gateway.deleteSessions(ids), 20000, '删除请求超时')
          const results = Array.isArray(r && r.results) ? r.results : []
          const okIds = results.filter((x) => x && x.ok === true).map((x) => x.id)
          const fails = results.filter((x) => !(x && x.ok === true))
          if (r && r.ok === true && fails.length === 0) {
            setNotice({ text: `已删除 ${okIds.length} 个会话 ✓`, kind: 'ok' })
          } else if (r && r.ok === true) {
            setNotice({ text: `已删除 ${okIds.length} 个，失败 ${fails.length} 个：${fails.map((x) => (x && x.error) || '未知错误').join('；')}`, kind: 'err' })
          } else {
            setNotice({ text: `删除失败：${(r && r.error) || '未知错误'}`, kind: 'err' })
          }
          setSelected((cur) => cur.filter((id) => !okIds.includes(id)))
        } catch (err) {
          setNotice({ text: `删除失败：${String(err?.message ?? err ?? 'RPC 调用出错')}`, kind: 'err' })
        } finally {
          setDeleting(false)
          setConfirmId(null)
          // The Host purge is durable once the RPC settles; re-pull the
          // session baseline so every deleted cold session leaves the
          // sidebar immediately instead of ghosting into the ungrouped
          // bucket (a cold session emits no live removed frame).
          try {
            await gateway.refreshSessions()
          } catch {
            /* best effort: the host stream still converges the archives list */
          }
        }
      }

      const confirmBulk = confirmId === '__bulk__' && selected.length > 0

      return react.createElement(
        'div',
        { style: SEC_WRAP },
        react.createElement(
          'div',
          { style: ARCH_HINT },
          '已归档的会话会从侧边栏分组视图中隐藏，但会话日志与工作区记账都完整保留。取消归档后，会话会回到它原来的分组位置。删除会永久移除会话及其全部对话记录，此操作不可撤销。',
        ),
        notice.text && react.createElement('div', {
          style: { fontSize: 12, color: notice.kind === 'err' ? ERR : OK, padding: '6px 0' },
        }, notice.text),
        rows.length === 0 && react.createElement(
          'div',
          { style: { fontSize: 12, opacity: 0.6, padding: '14px 0' } },
          '没有已归档的会话。在侧边栏会话行的菜单里选择「归档会话」，就会把会话收进这里。',
        ),
        rows.length > 0 && react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0', flexWrap: 'wrap' } },
          react.createElement(
            'label',
            { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 12, cursor: 'pointer' } },
            react.createElement('input', { type: 'checkbox', style: CHECK, checked: allSelected, onChange: toggleSelectAll }),
            '全选',
          ),
          selected.length > 0 && react.createElement('span', { style: { fontSize: 12, opacity: 0.75 } }, `已选 ${selected.length} 项`),
          selected.length > 0 && react.createElement('button', {
            style: { ...SMALL_BTN, borderColor: 'rgba(229,72,77,0.5)', color: ERR },
            disabled: deleting,
            onClick: () => setConfirmId('__bulk__'),
          }, deleting ? '正在删除…' : `删除所选 (${selected.length})`),
          selected.length > 0 && react.createElement('button', {
            style: SMALL_BTN,
            disabled: deleting,
            onClick: () => {
              setSelected([])
              setConfirmId(null)
            },
          }, '取消选择'),
        ),
        confirmBulk && react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid rgba(229,72,77,0.45)', borderRadius: '8px', fontSize: 12, marginTop: '4px', flexWrap: 'wrap' } },
          react.createElement(
            'span',
            { style: { flex: '1 1 320px' } },
            `确定要永久删除已选的 ${selected.length} 个会话及其全部对话记录吗？此操作不可撤销。`,
          ),
          react.createElement('button', {
            style: SMALL_BTN,
            disabled: deleting,
            onClick: () => setConfirmId(null),
          }, '取消'),
          react.createElement('button', {
            style: { ...SMALL_BTN, borderColor: 'rgba(229,72,77,0.5)', color: ERR },
            disabled: deleting,
            onClick: () => {
              const ids = rows.filter((row) => selected.includes(row.id)).map((row) => row.id)
              if (ids.length > 0) void doDelete(ids)
              else setConfirmId(null)
            },
          }, deleting ? '正在删除…' : '确认删除'),
        ),
        rows.length > 0 && react.createElement(
          'table',
          { style: { ...TABLE, marginTop: '6px' }, className: 'dsh-archives-table' },
          react.createElement(
            'thead',
            null,
            react.createElement(
              'tr',
              null,
              react.createElement('th', { style: { ...TH, width: '32px' } }, ''),
              react.createElement('th', { style: TH }, '会话'),
              react.createElement('th', { style: TH }, '工作区'),
              react.createElement('th', { style: TH }, '最近更新'),
              react.createElement('th', { style: TH }, '操作'),
            ),
          ),
          react.createElement(
            'tbody',
            null,
            rows.map((row) =>
              react.createElement(
                'tr',
                { key: row.id },
                react.createElement('td', { style: TD },
                  react.createElement('input', {
                    type: 'checkbox',
                    style: CHECK,
                    checked: selected.includes(row.id),
                    onChange: () => toggleSelect(row.id),
                  }),
                ),
                react.createElement('td', { style: TD, title: row.id }, row.title.slice(0, 48)),
                react.createElement('td', { style: TD, title: row.cwd ?? '' }, cwdLabel(row.cwd)),
                react.createElement('td', { style: TD }, fmtDay(row.updatedAt)),
                react.createElement('td', { style: TD },
                  confirmId === row.id
                    ? react.createElement(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                      react.createElement('span', { style: { fontSize: '11px', color: ERR } }, '将永久删除'),
                      react.createElement('button', {
                        style: { ...SMALL_BTN, borderColor: 'rgba(229,72,77,0.5)', color: ERR, fontWeight: 600 },
                        disabled: deleting,
                        onClick: () => void doDelete([row.id]),
                      }, deleting ? '正在删除…' : '确认删除'),
                      react.createElement('button', {
                        style: SMALL_BTN,
                        disabled: deleting,
                        onClick: () => setConfirmId(null),
                      }, '取消'),
                    )
                    : react.createElement(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
                      react.createElement('button', {
                        style: SMALL_BTN,
                        disabled: busyId !== null || deleting,
                        onClick: () => unarchive(row.id),
                      }, busyId === row.id ? '处理中…' : '取消归档'),
                      react.createElement('button', {
                        style: { ...DELETE_BTN, width: 'auto' },
                        disabled: busyId !== null || deleting,
                        onClick: () => {
                          setConfirmId(row.id)
                          setNotice({ text: '', kind: '' })
                        },
                      }, '删除'),
                    ),
                ),
              ),
            ),
          ),
        ),
      )
    }

    // — 会话页头部余额芯片 -----------------------------------------------------
    // Identical visual recipe to the shell's "Session log" header button
    // (32px pill, 13px text, transparent fill, hairline white border) so the
    // balance reads as a peer control rather than a highlighted badge.
    const CHIP = {
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      height: '32px', boxSizing: 'border-box',
      fontSize: '13px', lineHeight: '20px',
      userSelect: 'text', cursor: 'pointer',
      padding: '6px 12px', borderRadius: '18px',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-primary, #F9FAFB)',
    }
    const CHIP_VALUE = { fontWeight: 400, color: 'var(--dsw-alias-label-primary, #F9FAFB)' }
    const CHIP_REFRESH = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '22px', height: '22px', marginRight: '-6px',
      border: 'none', background: 'transparent', cursor: 'pointer',
      color: 'inherit', fontSize: '13px', opacity: 0.55, padding: 0,
    }

    /** Invisible session tracker: exposes the current session id for the
     *  folder-upload flow (window.__dshCurrentSessionId__). */
    function SessionIdTracker({ sessionId }) {
      react.useEffect(() => {
        window.__dshCurrentSessionId__ = typeof sessionId === 'string' ? sessionId : ''
        return () => {
          if (window.__dshCurrentSessionId__ === sessionId) window.__dshCurrentSessionId__ = ''
        }
      }, [sessionId])
      return null
    }

    function installHeaderCompactStyle() {
      if (document.getElementById('dsh-header-compact-css') !== null) return
      const style = document.createElement('style')
      style.id = 'dsh-header-compact-css'
      // Phone header row: the hamburger eats 56px, the Session log pill is
      // hidden (the same log view stays reachable through the 轨迹 tab), and
      // the balance chip drops its "余额" word. The session title then takes
      // the whole first line while the 标准模式 / background-task chips wrap
      // onto a second line — without the wrap, the fixed-width chips overflow
      // the flex row and pile on top of each other in the middle (the shell's
      // headerActions live INSIDE titleCluster, so the cluster itself wraps).
      style.textContent = [
        '@media (max-width: 760px), (pointer: coarse) and (max-width: 960px) {',
        '  .nL4_yW_sessionLogButton { display: none !important; }',
        '  .wSkVaW_titleCluster { flex-wrap: wrap !important; row-gap: 4px !important; }',
        '  .wSkVaW_crumbs { flex: 1 1 100% !important; min-width: 0 !important; }',
        '  .dsh-balance-chip { gap: 4px; padding: 6px 10px; height: 28px; }',
        '  .dsh-balance-chip-label { display: none; }',
        '}',
      ].join('\n')
      document.head.appendChild(style)
    }

    function BalanceChip({ gateway }) {
      const [state, setState] = react.useState({ loading: true, infos: null, error: '' })
      react.useEffect(() => {
        installHeaderCompactStyle()
      }, [])
      const refresh = () => {
        setState((s) => ({ ...s, loading: true, error: '' }))
        gateway.balance().then((r) => {
          if (r && r.ok && Array.isArray(r.infos) && r.infos.length > 0) {
            setState({ loading: false, infos: r.infos, error: '' })
          } else {
            setState({ loading: false, infos: null, error: (r && r.error) || '查询失败' })
          }
        })
      }
      react.useEffect(() => {
        refresh()
        const timer = setInterval(refresh, 60_000)
        const onFocus = () => refresh()
        const onTaskDone = () => refresh()
        window.addEventListener('focus', onFocus)
        window.addEventListener('dsh-desktop:agent-idle', onTaskDone)
        return () => {
          clearInterval(timer)
          window.removeEventListener('focus', onFocus)
          window.removeEventListener('dsh-desktop:agent-idle', onTaskDone)
        }
      }, [gateway])
      const info = state.infos ? state.infos[0] : null
      const title = info ? `账户余额 ${currencySymbol(info.currency)}${fmtMoney(info.total_balance)} · 点击前往开放平台充值` : state.error || undefined
      const label = state.loading
        ? '余额 …'
        : info
          ? `余额 ${currencySymbol(info.currency)}${fmtMoney(info.total_balance)}`
          : `余额 · ${state.error || '未配置'}`
      const openRecharge = () => {
        // The Electron shell routes external https windows to the system
        // browser (setWindowOpenHandler); a plain browser opens a new tab.
        window.open('https://platform.deepseek.com/top_up', '_blank', 'noopener')
      }
      const money = info ? `${currencySymbol(info.currency)}${fmtMoney(info.total_balance)}` : '—'
      return react.createElement(
        'span',
        {
          className: 'dsh-balance-chip',
          style: CHIP,
          title,
          onClick: openRecharge,
        },
        react.createElement('span', { className: 'dsh-balance-chip-label' }, '余额'),
        react.createElement('span', { style: CHIP_VALUE }, state.loading ? '…' : money),
        react.createElement('button', {
          style: CHIP_REFRESH,
          title: '刷新余额',
          onClick: (e) => {
            e.stopPropagation()
            refresh()
          },
        }, '↻'),
      )
    }

    // — 用量 -------------------------------------------------------------------
    const CARD = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }
    const CARD_ITEM = { border: '1px solid rgba(128,140,160,0.3)', borderRadius: '8px', padding: '12px 14px' }
    const BALANCE_CARD = { border: `1px solid ${BRAND}55`, borderRadius: '8px', padding: '12px 14px', background: 'rgba(77,107,254,0.07)' }

    const HEAT_TOOLTIP = {
      position: 'fixed', zIndex: 1000, pointerEvents: 'none',
      background: 'rgba(16,19,28,0.97)', border: '1px solid rgba(128,140,160,0.35)',
      borderRadius: '6px', padding: '6px 9px', fontSize: '11px', lineHeight: 1.6,
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    }

    const LEVEL_COLORS = [`${BRAND}26`, `${BRAND}45`, `${BRAND}66`, `${BRAND}8a`, `${BRAND}b0`]


    function HeatCell({ day, color, border, inputTokens, outputTokens }) {
      const [pos, setPos] = react.useState(null)
      const total = (inputTokens ?? 0) + (outputTokens ?? 0)
      return react.createElement(
        'div',
        {
          style: { position: 'relative' },
          onMouseEnter: (e) => setPos({ x: e.clientX, y: e.clientY }),
          onMouseMove: (e) => setPos({ x: e.clientX, y: e.clientY }),
          onMouseLeave: () => setPos(null),
        },
        react.createElement('div', { style: { height: '13px', borderRadius: '2px', background: color, border } }),
        pos && react.createElement(
          'div',
          { style: { ...HEAT_TOOLTIP, left: pos.x + 14, top: pos.y - 12 } },
          react.createElement('span', { style: { display: 'block', opacity: 0.7 } }, day),
          react.createElement('span', { style: { display: 'block' } }, `用了 ${fmtTokens(total)} tokens`),
        ),
      )
    }

    function UsageSection({ gateway }) {
      const [usage, setUsage] = react.useState(null)
      const [balance, setBalance] = react.useState(null)
      const [error, setError] = react.useState('')
      const [loading, setLoading] = react.useState(true)
      const [expanded, setExpanded] = react.useState(true)
      const usagePollRef = react.useRef(null)
      const usageRequestInFlightRef = react.useRef(false)
      const mountedRef = react.useRef(true)

      const requestUsage = react.useCallback((force = false, foreground = false) => {
        if (usageRequestInFlightRef.current) return
        usageRequestInFlightRef.current = true
        if (foreground) setLoading(true)
        gateway.usage(force).then((r) => {
          if (!mountedRef.current) return
          if (r && r.ok) {
            setUsage(r)
            setError('')
          } else {
            setError((r && r.error) || '读取失败')
          }
          setLoading(false)
          if (r && r.ok && r.refreshing) {
            if (usagePollRef.current !== null) clearTimeout(usagePollRef.current)
            usagePollRef.current = setTimeout(() => requestUsage(false, false), 800)
          }
        }).catch(() => {
          if (!mountedRef.current) return
          setError('读取失败')
          setLoading(false)
        }).finally(() => {
          usageRequestInFlightRef.current = false
        })
      }, [gateway])

      const requestBalance = react.useCallback(() => {
        gateway.balance().then((r) => {
          if (mountedRef.current && r && r.ok && Array.isArray(r.infos)) setBalance(r.infos)
        }).catch(() => {})
      }, [gateway])

      const refresh = () => {
        requestUsage(true, usage === null)
        requestBalance()
      }
      react.useEffect(() => {
        mountedRef.current = true
        requestUsage(false, true)
        requestBalance()
        const backgroundRefresh = () => {
          requestUsage(true, false)
          requestBalance()
        }
        const timer = setInterval(backgroundRefresh, 60_000)
        const onFocus = () => backgroundRefresh()
        const onTaskDone = () => backgroundRefresh()
        window.addEventListener('focus', onFocus)
        window.addEventListener('dsh-desktop:agent-idle', onTaskDone)
        return () => {
          mountedRef.current = false
          clearInterval(timer)
          if (usagePollRef.current !== null) clearTimeout(usagePollRef.current)
          window.removeEventListener('focus', onFocus)
          window.removeEventListener('dsh-desktop:agent-idle', onTaskDone)
        }
      }, [requestBalance, requestUsage])

      const totals = usage && usage.totals ? usage.totals : null
      const sessions = usage && Array.isArray(usage.sessions) ? usage.sessions : []
      const days = usage && Array.isArray(usage.days) ? usage.days : []
      const shownDays = days
      const shownMax = shownDays.reduce((m, d) => Math.max(m, (d.inputTokens ?? 0) + (d.outputTokens ?? 0)), 1)
      const shownTotal = shownDays.reduce((s, d) => s + (d.inputTokens ?? 0) + (d.outputTokens ?? 0), 0)
      const todayTotal = shownDays.length > 0
        ? (shownDays[shownDays.length - 1].inputTokens ?? 0) + (shownDays[shownDays.length - 1].outputTokens ?? 0)
        : 0
      // Heatmap tiers, configurable in 应用 settings (stored in 万 tokens).
      // Five color levels: ≤t1 / ≤t2 / ≤t3 / ≤t4 / >t4.
      const tier1 = 100 * 1e4
      const tier2 = 500 * 1e4
      const tier3 = 1500 * 1e4
      const tier4 = 5000 * 1e4
      // Weekday-aligned column flow (GitHub style): weeks as columns, fixed 7 rows.
      const startPad = new Date(`${shownDays[0]?.day ?? ''}T00:00:00`).getDay()
      const sessionCount = sessions.length
      const avgInput = sessionCount > 0 && totals ? Math.round(totals.inputTokens / sessionCount) : 0
      const info0 = balance ? balance[0] : null

      return react.createElement(
        'div',
        { style: SEC_WRAP },
        react.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          react.createElement(
            'span',
            { style: { fontSize: '12px', opacity: 0.7 } },
            usage?.refreshing ? '近期会话 token 用量（已显示缓存，后台更新中…）' : '近期会话 token 用量（本地缓存）',
          ),
          react.createElement('button', { style: REFRESH_BTN, onClick: refresh }, loading ? '…' : usage?.refreshing ? '↻ 更新中' : '↻ 刷新'),
        ),
        error && react.createElement('div', { style: { color: ERR, fontSize: 12 } }, error),
        react.createElement(
          'div',
          { style: BALANCE_CARD },
          react.createElement('div', { style: K }, 'DeepSeek 账户余额'),
          info0
            ? react.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'baseline', gap: '14px' } },
              react.createElement('span', { style: { fontSize: '22px', fontWeight: 700 } }, `${currencySymbol(info0.currency)}${fmtMoney(info0.total_balance)}`),
            )
            : react.createElement('span', { style: { fontSize: 12, opacity: 0.7 } }, '未配置 API Key（在 设置 → 模型 中填写）'),
        ),
        totals && react.createElement(
          'div',
          { style: CARD },
          react.createElement(
            'div',
            { style: CARD_ITEM },
            react.createElement('div', { style: K }, '输入 tokens（含缓存）'),
            react.createElement('div', { style: V }, fmtTokens(totals.inputTokens)),
          ),
          react.createElement(
            'div',
            { style: CARD_ITEM },
            react.createElement('div', { style: K }, '输出 tokens'),
            react.createElement('div', { style: V }, fmtTokens(totals.outputTokens)),
          ),
          react.createElement(
            'div',
            { style: CARD_ITEM },
            react.createElement('div', { style: K }, '回合 / 步骤'),
            react.createElement('div', { style: V }, `${totals.turns ?? 0} / ${totals.steps ?? 0}`),
          ),
          react.createElement(
            'div',
            { style: CARD_ITEM },
            react.createElement('div', { style: K }, '模型耗时 / 会话数'),
            react.createElement('div', { style: V }, fmtMs(totals.llmMs)),
            react.createElement('div', { style: { fontSize: 11, opacity: 0.6 } }, `${sessionCount} 个会话 · 平均每次 ${fmtTokens(avgInput)} 输入`),
          ),
        ),
        days.length > 0 && react.createElement(
          'div',
          { style: { border: '1px solid rgba(128,140,160,0.2)', borderRadius: '8px', padding: '14px' } },
          react.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
            react.createElement('div', { style: { ...K, marginBottom: 0, flex: '1 1 160px' } }, '近一年每日用量热力图'),
            react.createElement('span', { style: { fontSize: 11, opacity: 0.6 } },
              `累计 ${fmtTokens(shownTotal)} tokens · 今日 ${fmtTokens(todayTotal)} tokens`),
          ),
          react.createElement(
            'div',
            { style: { overflowX: 'auto', overflowY: 'hidden', marginTop: '12px', maxWidth: '100%', paddingBottom: '4px' } },
            react.createElement(
              'div',
              {
                style: {
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridTemplateRows: 'repeat(7, 13px)',
                  gridAutoColumns: '13px',
                  gap: '3px',
                  width: 'fit-content',
                },
              },
              Array.from({ length: startPad }).map((_, i) => react.createElement('div', { key: `pad-${i}` })),
              shownDays.map((d) => {
                const total = (d.inputTokens ?? 0) + (d.outputTokens ?? 0)
                // Configurable fixed tiers (defaults: 100万/500万/1500万/5000万).
                const level = total === 0 ? 0 : total <= tier1 ? 1 : total <= tier2 ? 2 : total <= tier3 ? 3 : total <= tier4 ? 4 : 5
                const color = total === 0
                  ? 'rgba(128,140,160,0.10)'
                  : LEVEL_COLORS[level - 1]
                return react.createElement(HeatCell, {
                  key: d.day,
                  day: d.day,
                  color,
                  border: total === 0 ? '1px solid rgba(128,140,160,0.14)' : 'none',
                  inputTokens: d.inputTokens ?? 0,
                  outputTokens: d.outputTokens ?? 0,
                })
              }),
            ),
          ),
          react.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', opacity: 0.5, maxWidth: '845px' } },
            react.createElement('span', null, shownDays[0]?.day ?? ''),
            react.createElement('span', null, shownDays[shownDays.length - 1]?.day ?? ''),
          ),
        ),
        sessions.length > 0 && react.createElement(
          'div',
          null,
          react.createElement(
            'button',
            { style: SMALL_BTN, onClick: () => setExpanded(!expanded) },
            `${expanded ? '收起' : '展开'} 会话明细（${sessions.length}）`,
          ),
          expanded && react.createElement(
            'table',
            { style: { ...TABLE, marginTop: '10px' } },
            react.createElement(
              'thead',
              null,
              react.createElement(
                'tr',
                null,
                react.createElement('th', { style: TH }, '会话'),
                react.createElement('th', { style: TH }, '输入'),
                react.createElement('th', { style: TH }, '输出'),
                react.createElement('th', { style: TH }, '日期'),
              ),
            ),
            react.createElement(
              'tbody',
              null,
              sessions.slice(0, 20).map((s) =>
                react.createElement(
                  'tr',
                  { key: s.id },
                  react.createElement('td', { style: TD }, (s.title || s.id || '').slice(0, 40)),
                  react.createElement('td', { style: TD }, fmtTokens(s.inputTokens)),
                  react.createElement('td', { style: TD }, fmtTokens(s.outputTokens)),
                  react.createElement('td', { style: TD }, fmtDay(s.createdAt)),
                ),
              ),
            ),
          ),
        ),
        loading && !usage && react.createElement('div', { style: { fontSize: 12, opacity: 0.6 } }, '读取中…'),
      )
    }

    // — 应用 -------------------------------------------------------------------
    function DesktopSection({ gateway }) {
      const [cfg, setCfg] = react.useState(null)
      const [proxy, setProxy] = react.useState('')
      const [updateUrl, setUpdateUrl] = react.useState('')
      const [storage, setStorage] = react.useState(null)
      const [lan, setLan] = react.useState(null)
      const [notice, setNotice] = react.useState({ text: '', kind: '' })

      react.useEffect(() => {
        gateway.desktopConfig().then((r) => {
          if (r && r.ok) {
            setCfg(r.config || {})
            setProxy(r.config?.proxyUrl ?? '')
            setUpdateUrl(r.config?.updateUrl ?? '')
            setLan(r.lan ?? null)
          } else {
            setNotice({ text: '配置读取失败：' + ((r && r.error) || ''), kind: 'err' })
          }
        })
        gateway.storageUsage().then((r) => {
          if (r && r.ok) setStorage(r)
        })
      }, [gateway])

      const save = (patch) => {
        gateway.saveDesktopConfig(patch).then((r) => {
          if (r && r.ok) {
            setCfg(r.config || {})
            setNotice({ text: '已保存 ✓', kind: 'ok' })
          } else {
            setNotice({ text: '保存失败：' + ((r && r.error) || '未知错误'), kind: 'err' })
          }
        })
      }

      // Poll the live LAN state after a toggle: the server rebinds on the
      // next restart, and the QR/URL block appears in place once bound —
      // the settings page stays open throughout.
      const pollLan = (want) => {
        clearTimeout(pollLan._t)
        let tries = 0
        const step = () => {
          tries += 1
          gateway.desktopConfig().then((r) => {
            if (r && r.ok) {
              setCfg(r.config || {})
              setLan(r.lan ?? null)
              const bound = r.lan?.bound === true
              if (tries >= 15 || (want && bound) || (!want && !bound)) {
                setNotice(want && bound
                  ? { text: '移动端访问已开启 ✓（手机访问根地址，自动适配手机）', kind: 'ok' }
                  : want
                    ? { text: '服务重启失败，请重试', kind: 'err' }
                    : { text: '移动端访问已关闭', kind: 'ok' })
                return
              }
            }
            pollLan._t = setTimeout(step, 1200)
          }).catch(() => {
            pollLan._t = setTimeout(step, 1200)
          })
        }
        step()
      }

      return react.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', padding: '4px 0' } },
        react.createElement(
          'label',
          { style: ROW },
          react.createElement('span', { style: ROW_LABEL },
            '任务完成通知',
            react.createElement('span', { style: ROW_HINT }, '任务完成后发送系统通知并更新 Dock 角标')),
          react.createElement('input', {
            type: 'checkbox', style: CHECK,
            checked: cfg?.notifications !== false,
            onChange: (e) => save({ notifications: e.target.checked }),
          }),
        ),
        react.createElement(
          'label',
          { style: ROW },
          react.createElement('span', { style: ROW_LABEL },
            '开机时自动启动',
            react.createElement('span', { style: ROW_HINT }, '登录 macOS 后在后台启动服务（托盘常驻）')),
          react.createElement('input', {
            type: 'checkbox', style: CHECK,
            checked: cfg?.launchAtLogin === true,
            onChange: (e) => save({ launchAtLogin: e.target.checked }),
          }),
        ),
        react.createElement(
          'div',
          { style: ROW },
          react.createElement('span', { style: ROW_LABEL },
            '代理服务器',
            react.createElement('span', { style: ROW_HINT }, 'HTTP 代理地址，如 http://127.0.0.1:7890（服务重启后生效）')),
          react.createElement('input', {
            style: INPUT, value: proxy, spellCheck: false,
            placeholder: '留空 = 直连',
            onChange: (e) => setProxy(e.target.value),
            onBlur: () => save({ proxyUrl: proxy.trim() }),
            onKeyDown: (e) => { if (e.key === 'Enter') { e.target.blur() } },
          }),
        ),
        react.createElement(
          'label',
          {
            style: {
              ...ROW, borderRadius: '10px', margin: '4px 0', padding: '10px 12px',
              border: '1px solid rgba(128,140,160,0.3)', background: 'transparent',
            },
          },
          react.createElement('span', { style: ROW_LABEL },
            react.createElement('span', { style: { fontWeight: 600 } }, '移动端访问'),
            react.createElement('span', { style: ROW_HINT }, '手机与电脑连同一 Wi-Fi 即可使用完整界面（自动适配手机屏幕：侧边栏抽屉 + 全屏会话），会话与任务实时同步。开启后服务监听局域网并自动重启；局域网内的设备都能访问本服务，请仅在可信网络开启')),
          react.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 } },
            react.createElement('span', { style: { fontSize: 11, color: cfg?.lanAccess === true ? OK : 'rgba(154,163,181,1)' } },
              cfg?.lanAccess === true ? '已开启' : '已关闭'),
            react.createElement('span', { style: { position: 'relative', width: 40, height: 22, flexShrink: 0 } },
              react.createElement('input', {
                type: 'checkbox', checked: cfg?.lanAccess === true,
                style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, margin: 0, cursor: 'pointer', zIndex: 1 },
                onChange: (e) => {
                  save({ lanAccess: e.target.checked })
                  setNotice({ text: '正在重启服务以应用移动端访问设置…', kind: 'ok' })
                  pollLan(e.target.checked)
                },
              }),
              react.createElement('span', {
                style: {
                  position: 'absolute', inset: 0, borderRadius: 999, pointerEvents: 'none',
                  background: cfg?.lanAccess === true ? 'rgba(77,107,254,0.35)' : 'rgba(128,140,160,0.25)',
                  border: `1px solid ${cfg?.lanAccess === true ? BRAND : 'rgba(128,140,160,0.5)'}`,
                  transition: 'background 0.2s, border-color 0.2s',
                },
              }),
              react.createElement('span', {
                style: {
                  position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
                  pointerEvents: 'none',
                  background: cfg?.lanAccess === true ? BRAND : '#8A93A8',
                  transform: cfg?.lanAccess === true ? 'translateX(18px)' : 'none',
                  transition: 'transform 0.2s, background 0.2s',
                },
              }),
            ),
          ),
        ),
        cfg?.lanAccess === true && lan && lan.bound && react.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', borderRadius: '10px', border: '1px solid rgba(128,140,160,0.3)', background: 'transparent' } },
          react.createElement('div', { style: { fontSize: '12.5px', fontWeight: 600 } }, '手机访问'),
          lan.qr && react.createElement('img', {
            src: lan.qr, alt: '移动端访问二维码', width: 172, height: 172,
            style: { borderRadius: '8px', background: '#FFFFFF', padding: '6px' },
          }),
          react.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            (lan.urls ?? []).map((url) => react.createElement(
              'div',
              { key: url, style: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', wordBreak: 'break-all' } },
              `${url}`,
            )),
          ),
          react.createElement('div', { style: { fontSize: '11.5px', opacity: 0.6 } }, '手机连同一 Wi-Fi 后，扫码或输入上面的地址即可打开完整界面（手机自动适配为抽屉侧边栏布局）；打开 /desktop 可直接进入电脑端当前会话。会话、任务与日志实时同步。'),
        ),
        cfg?.lanAccess === true && lan && !lan.bound && react.createElement(
          'div',
          { style: { fontSize: '12px', padding: '8px 0', opacity: 0.7 } },
          '正在重启服务以应用移动端访问设置，请稍候…',
        ),
        react.createElement(
          'div',
          { style: ROW },
          react.createElement('span', { style: ROW_LABEL },
            '会话统计样式',
            react.createElement('span', { style: ROW_HINT }, '底部统计行的显示方式（也可点击统计行旁的小按钮快速切换）')),
          react.createElement('select', {
            style: INPUT,
            value: cfg?.statsStyle ?? 'wrap',
            onChange: (e) => {
              publishStatsStyle(e.target.value)
              save({ statsStyle: e.target.value })
            },
          },
            react.createElement('option', { value: 'wrap' }, '完整换行'),
            react.createElement('option', { value: 'hover' }, '悬停展开'),
            react.createElement('option', { value: 'hidden' }, '隐藏'),
          ),
        ),
        react.createElement(
          'div',
          { style: ROW },
          react.createElement('span', { style: ROW_LABEL },
            '本地存储',
            react.createElement('span', { style: ROW_HINT },
              storage ? `占用 ${fmtBytes(storage.totalBytes)}（会话/存储/配置）` : '统计中…')),
          react.createElement('button', {
            style: SMALL_BTN, title: storage?.home ?? '',
            onClick: () => void gateway.desktopAction('open-storage-dir', storage?.home ?? ''),
          }, '打开目录'),
        ),
        notice.text && react.createElement('div', {
          style: { padding: '8px 0', fontSize: 12, color: notice.kind === 'err' ? ERR : OK },
        }, notice.text),
      )
    }

    // — 扩展（MCP + Skills）-----------------------------------------------------
    function ExtensionsSection({ gateway }) {
      return react.createElement(
        'div',
        { style: SEC_WRAP },
        react.createElement(
          'div',
          { style: { fontSize: 12, opacity: 0.7, lineHeight: 1.7 } },
          '扩展是给 agent 增加能力的入口：MCP 服务器（外部工具协议）与 Skills（知识包）都在这里管理。',
          react.createElement('br'),
          '与「插件」不同——插件是程序代码扩展；Skills 只是 SKILL.md 指令与资源，零风险。',
        ),
        react.createElement(McpBlock, { gateway }),
        react.createElement(SkillsBlock, { gateway }),
      )
    }

    // — 看图工具模型设置 ---------------------------------------------------------
    function VisionBlock({ gateway }) {
      const [info, setInfo] = react.useState(null)
      const [error, setError] = react.useState('')
      const [model, setModel] = react.useState('')
      const [baseUrl, setBaseUrl] = react.useState('')
      const [apiKey, setApiKey] = react.useState('')
      const [busy, setBusy] = react.useState(false)
      const [notice, setNotice] = react.useState('')

      const refresh = () => {
        gateway.visionConfig().then((r) => {
          if (r && r.ok) {
            setInfo(r)
            setModel(r.config?.model ?? '')
            setBaseUrl(r.config?.baseUrl ?? '')
            setError('')
          } else {
            setError((r && r.error) || '读取失败')
          }
        })
      }
      react.useEffect(() => {
        refresh()
      }, [gateway])

      const save = (reset) => {
        setBusy(true)
        setNotice('')
        const input = reset
          ? { model: '', baseUrl: '', apiKey: null }
          : { model, baseUrl, apiKey }
        gateway.saveVisionConfig(input).then((r) => {
          setBusy(false)
          if (r && r.ok) {
            setNotice(reset
              ? '已恢复默认模型与地址，API Key 已清除。'
              : `已保存${r.restarted ? '，看图工具已重启生效' : ''}。`)
            setApiKey('')
            refresh()
          } else {
            setNotice((r && r.error) || '保存失败')
          }
        })
      }

      const hasKey = !!(info && info.hasApiKey)
      const configDir = info?.configPath ? String(info.configPath).replace(/[^/]+$/, '') : ''

      return react.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(128,140,160,0.14)', paddingTop: '14px' } },
        react.createElement('div', { style: SECTION_TITLE }, '看图工具（vision MCP）'),
        react.createElement(
          'div',
          { style: { fontSize: '12px', opacity: 0.7, lineHeight: 1.7 } },
          '给 agent 的看图工具指定视觉模型。填「模型名」和「调用地址」（OpenAI 兼容 /chat/completions），再填该模型服务的 API Key；留空则沿用当前值。',
          '修改立即重启看图工具，无需重启整个服务。',
        ),
        error && react.createElement('div', { style: { color: ERR, fontSize: 12 } }, error),
        react.createElement(
          'div',
          { style: ROW },
          react.createElement(
            'div',
            { style: ROW_LABEL },
            '模型名',
            react.createElement('span', { style: ROW_HINT }, '例如 mimo-v2.5 / qwen-vl-max / gpt-4o'),
          ),
          react.createElement('input', {
            style: INPUT, value: model, placeholder: '留空恢复默认 mimo-v2.5',
            onChange: (e) => setModel(e.target.value), spellCheck: false,
          }),
        ),
        react.createElement(
          'div',
          { style: ROW },
          react.createElement(
            'div',
            { style: ROW_LABEL },
            '调用地址',
            react.createElement('span', { style: ROW_HINT }, 'API Base URL，如 https://token-plan-cn.xiaomimimo.com/v1'),
          ),
          react.createElement('input', {
            style: INPUT, value: baseUrl, placeholder: '留空恢复默认地址',
            onChange: (e) => setBaseUrl(e.target.value), spellCheck: false,
          }),
        ),
        react.createElement(
          'div',
          { style: ROW },
          react.createElement(
            'div',
            { style: ROW_LABEL },
            'API Key',
            react.createElement('span', { style: ROW_HINT }, hasKey
              ? '已配置；留空保持不变，输入新值则覆盖（仅保存在本机）'
              : '未配置时回退读取 .credentials.yaml / 环境变量'),
          ),
          react.createElement('input', {
            style: INPUT, type: 'password', value: apiKey, placeholder: hasKey ? '已配置（留空保持不变）' : '填写 API Key',
            onChange: (e) => setApiKey(e.target.value), spellCheck: false, autoComplete: 'off',
          }),
        ),
        react.createElement(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
          react.createElement('button', {
            style: PRIMARY_BTN, disabled: busy,
            onClick: () => save(false),
          }, busy ? '保存中…' : '保存'),
          react.createElement('button', {
            style: SMALL_BTN, disabled: busy,
            onClick: () => save(true),
          }, '恢复默认'),
          notice && react.createElement('span', { style: { fontSize: 12, color: notice.includes('失败') ? ERR : OK } }, notice),
        ),
        info && react.createElement(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, opacity: 0.55 } },
          react.createElement('span', null, `配置 ${info.configPath ?? ''}`),
          configDir.length > 0 && react.createElement('button', {
            style: SMALL_BTN,
            onClick: () => void gateway.desktopAction('open-path', configDir),
          }, '打开目录'),
        ),
      )
    }

    function McpBlock({ gateway }) {
      const [data, setData] = react.useState(null)
      const [error, setError] = react.useState('')
      const [loading, setLoading] = react.useState(true)
      const [confirmId, setConfirmId] = react.useState(null)

      const refresh = () => {
        setLoading(true)
        gateway.listMcpServers().then((r) => {
          if (r && r.ok) {
            setData(r)
            setError('')
          } else {
            setError((r && r.error) || '读取失败')
          }
          setLoading(false)
        })
      }
      react.useEffect(() => {
        refresh()
      }, [gateway])

      const servers = data && Array.isArray(data.servers) ? data.servers : []
      const doRemove = (entryId) => {
        if (confirmId !== entryId) {
          setConfirmId(entryId)
          setTimeout(() => setConfirmId((c) => (c === entryId ? null : c)), 3000)
          return
        }
        setConfirmId(null)
        gateway.removeMcpServer(entryId).then(refresh)
      }

      return react.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(128,140,160,0.14)', paddingTop: '14px' } },
        react.createElement('div', { style: SECTION_TITLE }, 'MCP 服务器'),
        react.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          react.createElement('span', { style: { fontSize: '12px', opacity: 0.7 } }, `已配置 ${servers.length} 个（来自启动配置）`),
          react.createElement('button', { style: REFRESH_BTN, onClick: refresh }, loading ? '…' : '↻ 刷新'),
        ),
        error && react.createElement('div', { style: { color: ERR, fontSize: 12 } }, error),
        servers.length === 0 && !loading && react.createElement(
          'div', { style: { fontSize: 12, opacity: 0.65, lineHeight: 1.7 } },
          '尚未配置。在 ~/.dsh/cordis.patch.yml 中添加 @deepseek-ai/dsh-mcp-client 行（stdio 或 streamable-http），或用下方「打开配置文件」编辑。',
        ),
        servers.length > 0 && react.createElement(
          'table',
          { style: TABLE },
          react.createElement(
            'thead',
            null,
            react.createElement(
              'tr',
              null,
              react.createElement('th', { style: TH }, '名称'),
              react.createElement('th', { style: TH }, '说明'),
              react.createElement('th', { style: TH }, '状态'),
              react.createElement('th', { style: TH }, '启用'),
              react.createElement('th', { style: TH }, '操作'),
            ),
          ),
          react.createElement(
            'tbody',
            null,
            servers.map((s) =>
              react.createElement(
                'tr',
                { key: s.entryId },
                react.createElement('td', { style: TD },
                  s.serverName || s.entryId,
                  react.createElement('span', { style: { display: 'block', fontSize: '10px', opacity: 0.5 } }, `${s.transport} · ${(s.target || '').slice(0, 40)}`),
                ),
                react.createElement('td', { style: TD }, mcpZh(s)),
                react.createElement('td', { style: TD }, s.disabled ? '已禁用' : s.fiberPhase ?? '未加载'),
                react.createElement('td', { style: TD },
                  react.createElement(TogglePill, {
                    checked: !s.disabled,
                    title: '启用 / 禁用（立即生效，重启保持）',
                    onChange: () => { void gateway.toggleMcpServer(s.entryId, !s.disabled).then(refresh) },
                  }),
                ),
                react.createElement('td', { style: TD },
                  react.createElement('button', {
                    style: DELETE_BTN,
                    onClick: () => doRemove(s.entryId),
                  }, confirmId === s.entryId ? '确认删除？' : '删除'),
                ),
              ),
            ),
          ),
        ),
        react.createElement(
          'div',
          { style: { display: 'flex', gap: 8 } },
          data?.patchFile && react.createElement('button', {
            style: SMALL_BTN,
            onClick: () => void gateway.desktopAction('open-path', data.patchFile),
          }, '打开配置文件'),
          react.createElement('button', {
            style: SMALL_BTN, title: '重启本地 dsh 服务（窗口与会话保留）',
            onClick: () => void gateway.desktopAction('restart-server', ''),
          }, '重启服务'),
        ),
      )
    }

    function SkillsBlock({ gateway }) {
      const [skills, setSkills] = react.useState(null)
      const [error, setError] = react.useState('')
      const [loading, setLoading] = react.useState(true)
      const [skillsHome, setSkillsHome] = react.useState('')
      const [confirmName, setConfirmName] = react.useState(null)
      const [notice, setNotice] = react.useState({ text: '', kind: '' })

      const refresh = () => {
        setLoading(true)
        gateway.listSkills().then((r) => {
          if (r && r.ok) {
            setSkills(r.skills ?? [])
            setError('')
          } else {
            setError((r && r.error) || '读取失败')
          }
          setLoading(false)
        })
      }
      react.useEffect(() => {
        refresh()
        gateway.storageUsage().then((r) => {
          if (r && r.ok && r.home) setSkillsHome(`${r.home}/skills`)
        })
      }, [gateway])

      const doRemove = (name) => {
        if (confirmName !== name) {
          setConfirmName(name)
          setTimeout(() => setConfirmName((c) => (c === name ? null : c)), 3000)
          return
        }
        setConfirmName(null)
        gateway.removeSkill(name).then((r) => {
          if (r && r.ok) {
            setNotice({ text: '已删除。', kind: 'ok' })
          } else {
            setNotice({ text: `删除失败：${(r && r.error) || '未知错误'}`, kind: 'err' })
          }
          refresh()
        })
      }

      const list = skills ?? []
      const removable = (s) => s.source === 'user-dsh' || s.source === 'user-agents'
      return react.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(128,140,160,0.14)', paddingTop: '14px' } },
        react.createElement('div', { style: SECTION_TITLE }, 'Skills'),
        react.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          react.createElement('span', { style: { fontSize: '12px', opacity: 0.7 } }, `已安装 ${list.length} 个 · ${skillsHome || '~/.dsh/skills'}`),
          react.createElement(
            'div',
            { style: { display: 'flex', gap: 8 } },
            react.createElement('button', { style: SMALL_BTN, onClick: () => void gateway.desktopAction('open-path', skillsHome) }, '打开目录'),
            react.createElement('button', { style: REFRESH_BTN, onClick: refresh }, loading ? '…' : '↻ 刷新'),
          ),
        ),
        error && react.createElement('div', { style: { color: ERR, fontSize: 12 } }, error),
        notice.text && react.createElement('div', { style: { fontSize: 12, color: notice.kind === 'err' ? ERR : OK } }, notice.text),
        list.length === 0 && !loading && react.createElement(
          'div', { style: { fontSize: 12, opacity: 0.65 } }, '暂无用户 skills。把 skill 目录（含 SKILL.md）放入 skills 目录即可。'),
        react.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column' } },
          list.map((s) => {
            const zh = skillZh(s.name)
            const removableRow = removable(s)
            return react.createElement(
              'div',
              { key: s.name, style: ROW },
              react.createElement(
                'span',
                { style: ROW_LABEL, title: s.description || '' },
                zh ? zh[0] : s.name,
                react.createElement('span', { style: { display: 'block', fontSize: '10px', opacity: 0.5, fontFamily: 'ui-monospace, Menlo, monospace' } }, s.name),
                react.createElement('span', { style: ROW_HINT }, zh ? zh[1] : (s.description || '').slice(0, 90)),
              ),
              react.createElement(TogglePill, {
                checked: s.modelInvocable,
                disabled: !removableRow,
                title: removableRow ? '启用 / 禁用（立即生效）' : '内置 skill 不可禁用',
                onChange: () => { void gateway.toggleSkill(s.name, !s.modelInvocable).then(refresh) },
              }),
              removableRow && react.createElement('button', {
                style: DELETE_BTN,
                onClick: () => doRemove(s.name),
              }, confirmName === s.name ? '确认删除？' : '删除'),
            )
          }),
        ),
      )
    }

    // — 会话统计样式 ----------------------------------------------------------
    const STATS_CLASS = 'FJxK0a_root'
    const STATS_SEP_CLASS = 'FJxK0a_sep'
    const STATS_STYLES = [
      { id: 'wrap', label: '完整', css: `.${STATS_CLASS}{white-space:normal !important;font-size:12px !important}.${STATS_SEP_CLASS}{margin:0 10px !important}` },
      { id: 'hover', label: '悬停', css: `.${STATS_CLASS}{white-space:nowrap !important;font-size:12px !important}.${STATS_CLASS}:hover{white-space:normal !important}` },
      { id: 'hidden', label: '隐藏', css: `.${STATS_CLASS}{display:none !important}` },
    ]
    const STATS_STYLE_ID = 'dsh-desktop-stats-style'
    const STATS_CHIP = {
      border: 'none', background: 'transparent', cursor: 'pointer',
      color: 'inherit', fontSize: '11px', opacity: 0.55, padding: '0 2px',
      fontFamily: 'inherit',
    }

    function applyStatsStyle(mode) {
      const def = STATS_STYLES.find((s) => s.id === mode) ?? STATS_STYLES[0]
      let tag = document.getElementById(STATS_STYLE_ID)
      if (tag === null) {
        tag = document.createElement('style')
        tag.id = STATS_STYLE_ID
        document.head.appendChild(tag)
      }
      tag.textContent = def.css
      return def
    }

    /** Broadcast a style change so every consumer (chip, settings) stays in sync. */
    function publishStatsStyle(mode) {
      try {
        window.dispatchEvent(new CustomEvent('dsh-desktop:stats-style', { detail: mode }))
      } catch {
        /* non-browser context */
      }
    }

    function listenStatsStyle(handler) {
      window.addEventListener('dsh-desktop:stats-style', (e) => {
        if (typeof e.detail === 'string') handler(e.detail)
      })
      return () => window.removeEventListener('dsh-desktop:stats-style', handler)
    }

    /**
     * Quick cycle chip for the shipped session stats line: 完整（换行全显）→
     * 悬停展开 → 紧凑单行 → 隐藏. The preference persists via desktop config
     * and the same value is editable in 设置 → 应用.
     */
    function StatsStyleChip({ gateway }) {
      const [mode, setMode] = react.useState('wrap')
      react.useEffect(() => {
        gateway.desktopConfig().then((r) => {
          if (r && r.ok && typeof r.config?.statsStyle === 'string') setMode(r.config.statsStyle)
        })
        return listenStatsStyle((next) => setMode(next))
      }, [gateway])
      react.useEffect(() => {
        applyStatsStyle(mode)
      }, [mode])
      const current = STATS_STYLES.find((s) => s.id === mode) ?? STATS_STYLES[0]
      const cycle = () => {
        const index = STATS_STYLES.findIndex((s) => s.id === mode)
        const next = STATS_STYLES[(index + 1) % STATS_STYLES.length]
        setMode(next.id)
        publishStatsStyle(next.id)
        void gateway.saveDesktopConfig({ statsStyle: next.id })
      }
      return react.createElement(
        'button',
        { style: STATS_CHIP, title: '会话统计样式：完整 / 悬停 / 紧凑 / 隐藏（点击切换）', onClick: cycle },
        `统计·${current.label}`,
      )
    }

    // — 高峰 / 非高峰时段提示 ----------------------------------------------------
    // DeepSeek 计费：非高峰时段价格为高峰时段的一半；高峰时段为北京时间
    // 9:00–12:00 与 14:00–18:00，其余为非高峰。北京时间无夏令时（UTC+8），
    // 直接从浏览器时钟按 UTC+8 换算，无需网络或 Host。
    // 挂载在输入卡底部工具行（uV2eYG_row）内，绝对定位在行中央；行级
    // position:relative 由注入的样式表提供，无需任何测量代码。
    const PEAK_WINDOWS_MIN = [[9 * 60, 12 * 60], [14 * 60, 18 * 60]]

    function beijingClock(now) {
      // `now` is a Date.now() timestamp (number), not a Date instance.
      const t = typeof now === 'number' ? now : now.getTime()
      const shifted = new Date(t + 8 * 3600 * 1000)
      return { hours: shifted.getUTCHours(), minutes: shifted.getUTCMinutes() }
    }

    function pricePhase(now) {
      const { hours, minutes } = beijingClock(now)
      const t = hours * 60 + minutes
      return PEAK_WINDOWS_MIN.some(([start, end]) => t >= start && t < end) ? 'peak' : 'offpeak'
    }

    function installPriceHoursStyle() {
      if (document.getElementById('dsh-price-hours-css') !== null) return
      const style = document.createElement('style')
      style.id = 'dsh-price-hours-css'
      // Wide screens keep the absolutely-centered chip (deliberate v1.3.8
      // design). On the narrow/touch phone layout the centered chip overlaps
      // the model chip, so it joins the trailing flex row as a normal first
      // item instead — the row can never overlap, it just shrinks the model
      // label (which already ellipsizes) when space is tight.
      style.textContent = [
        '.uV2eYG_row { position: relative; }',
        '@media (max-width: 760px), (pointer: coarse) and (max-width: 960px) {',
        '  .dsh-price-hint { position: static !important; left: auto !important; top: auto !important; transform: none !important; margin-left: 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; }',
        '}',
      ].join('\n')
      document.head.appendChild(style)
    }

    function PriceHoursHint() {
      const [now, setNow] = react.useState(() => Date.now())
      const [narrow, setNarrow] = react.useState(() =>
        window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 960px)').matches,
      )
      react.useEffect(() => {
        installPriceHoursStyle()
        const timer = window.setInterval(() => setNow(Date.now()), 30 * 1000)
        const mq = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 960px)')
        const onMq = () => setNarrow(mq.matches)
        mq.addEventListener('change', onMq)
        return () => {
          window.clearInterval(timer)
          mq.removeEventListener('change', onMq)
        }
      }, [])
      const peak = pricePhase(now) === 'peak'
      const { hours, minutes } = beijingClock(now)
      const hh = String(hours).padStart(2, '0')
      const mm = String(minutes).padStart(2, '0')
      const title = peak
        ? `高峰时段（北京时间 9:00–12:00 / 14:00–18:00）· 按标准价格计费。非高峰时段价格为高峰时段的一半。当前北京时间 ${hh}:${mm}。`
        : `非高峰时段 · 价格为高峰时段的一半（5 折）。高峰时段为北京时间 9:00–12:00 / 14:00–18:00。当前北京时间 ${hh}:${mm}。`
      // Phone layout: the tool row also holds the attach/modes controls, the
      // model chip, the context ring and send — a dot + full 5-char label no
      // longer fits. Render a compact colored label ("高峰"/"非高峰") instead
      // and let the row place it as a normal flex item (see the injected CSS);
      // the dot is dropped because the text itself carries the color cue.
      if (narrow) {
        return react.createElement(
          'span',
          {
            className: 'dsh-price-hint',
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              border: 'none',
              background: 'transparent',
              color: peak ? WARN : OK,
              fontSize: '12px',
              fontWeight: 500,
              opacity: 0.85,
              padding: 0,
              fontFamily: 'inherit',
              lineHeight: '20px',
              cursor: 'default',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            },
            title,
          },
          peak ? '高峰' : '非高峰',
        )
      }
      return react.createElement(
        'span',
        {
          className: 'dsh-price-hint',
          style: {
            // Absolutely centered inside the composer tool row (the injected
            // stylesheet gives the row position:relative); the row flexes
            // around it, so the chip always occupies the visual middle with
            // no measurement or resize handling. Font matches the row's
            // other controls (13px / 500 / 20px).
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            fontSize: '13px',
            fontWeight: 500,
            opacity: 0.62,
            padding: '0 4px',
            fontFamily: 'inherit',
            lineHeight: '20px',
            cursor: 'default',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          },
          title,
        },
        react.createElement('span', {
          style: { width: 8, height: 8, borderRadius: 999, background: peak ? WARN : OK, flex: 'none' },
        }),
        peak ? '高峰时段' : '非高峰时段',
      )
    }

    // — 历史 Prompt -----------------------------------------------------------
    // Accepted user prompts are recorded by the host at agent/pre-step. This
    // button reads that shared history and restores entries through the
    // conversation input machine's public setDraft action, so desktop and
    // mobile use the same data and preserve input-machine invariants.

    const PROMPT_HISTORY_CSS = [
      // Codex-style bare timeline: a fixed-width hit lane containing fine,
      // left-anchored strokes. Only the stroke pseudo-element scales, keeping
      // every target easy to hit without making the line visually thicker.
      '.dsh-prompt-rail { position: fixed; z-index: 12; display: flex; flex-direction: column; align-items: flex-start; width: 30px; padding: 2px 0; background: none; border: none; max-height: min(56vh, 480px) !important; overflow-y: auto !important; overflow-x: hidden !important; scrollbar-width: none; }',
      '.dsh-prompt-rail::-webkit-scrollbar { display: none; }',
      '.dsh-prompt-rail-tick { --dsh-prompt-scale: 1; --dsh-prompt-opacity: .34; appearance: none; display: block; position: relative; flex: 0 0 8px; width: 30px; height: 8px; margin: 0; padding: 0; border: 0; outline: 0; background: transparent; color: inherit; cursor: pointer; }',
      '.dsh-prompt-rail-tick::before { content: ""; position: absolute; left: 0; top: 50%; width: 6px; height: 1px; border-radius: 999px; background: rgba(192,197,205,.88); opacity: var(--dsh-prompt-opacity); transform: translateY(-50%) scaleX(var(--dsh-prompt-scale)); transform-origin: left center; transition: transform 90ms cubic-bezier(.2,.8,.2,1), opacity 90ms ease, background-color 90ms ease; }',
      '.dsh-prompt-rail-tick:hover::before,.dsh-prompt-rail-tick:focus-visible::before { background: rgba(231,234,239,.96); }',
      '.dsh-prompt-rail-pop { position: fixed; z-index: 13; width: min(323px, calc(100vw - 86px)); box-sizing: border-box; padding: 9px 11px 10px; border: 0; border-radius: 12px; background: rgba(48,48,50,.97); box-shadow: 0 8px 24px rgba(0,0,0,.28); color: rgba(239,239,241,.94); pointer-events: none; animation: dsh-prompt-rail-pop-in 90ms ease-out; }',
      '@keyframes dsh-prompt-rail-pop-in { from { opacity: 0; } to { opacity: 1; } }',
      '.dsh-prompt-rail-pop-text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; font-size: 13px; line-height: 20px; font-weight: 400; }',
      '@media (max-width:700px) { .dsh-prompt-rail { width: 28px; } .dsh-prompt-rail-tick { width: 28px; } .dsh-prompt-rail-pop { width: min(300px, calc(100vw - 76px)); } }',
    ].join('\n')

    let promptHistoryStyleInstalled = false
    function installPromptHistoryStyle() {
      if (promptHistoryStyleInstalled) return
      promptHistoryStyleInstalled = true
      if (document.getElementById('dsh-prompt-history-css') !== null) return
      const style = document.createElement('style')
      style.id = 'dsh-prompt-history-css'
      style.textContent = PROMPT_HISTORY_CSS
      document.head.appendChild(style)
    }

    function focusComposerAtEnd() {
      requestAnimationFrame(() => {
        const textarea = document.querySelector('[data-composer-card] textarea')
        if (!(textarea instanceof HTMLTextAreaElement)) return
        textarea.focus({ preventScroll: true })
        const end = textarea.value.length
        textarea.setSelectionRange(end, end)
      })
    }

    function PromptHistoryRail({ useInput, inputActions, gateway, sessionId }) {
      const input = typeof useInput === 'function' ? useInput((state) => state) : null
      const [items, setItems] = react.useState([])
      const [mouseY, setMouseY] = react.useState(null)
      const [paneLeft, setPaneLeft] = react.useState(null)
      const itemsRef = react.useRef(items)
      const inputRef = react.useRef(input)
      const leaveTimerRef = react.useRef(null)
      const railRef = react.useRef(null)
      const measureRef = react.useRef({ firstTop: 0, step: 8 })
      itemsRef.current = items
      inputRef.current = input

      // Expose inputActions globally so the ESC cancel handler can use setDraft.
      react.useEffect(() => {
        window.__dshInputActions = inputActions
        return () => { window.__dshInputActions = null }
      }, [inputActions])

      react.useEffect(() => {
        installPromptHistoryStyle()
      }, [])

      // Measure tick geometry for the continuous fisheye: tick centers are
      // computed arithmetically (scaleX never shifts Y, so one measurement
      // per layout change is enough).
      const measureTicks = react.useCallback(() => {
        const rail = railRef.current
        if (rail === null) return
        const ticks = rail.querySelectorAll('.dsh-prompt-rail-tick')
        if (ticks.length === 0) return
        const first = ticks[0].getBoundingClientRect()
        let step = 8
        if (ticks.length > 1) step = ticks[1].getBoundingClientRect().top - first.top
        measureRef.current = { firstTop: first.top + first.height / 2, step }
      }, [])

      react.useEffect(() => {
        measureTicks()
      }, [items.length, measureTicks])

      react.useEffect(() => {
        const onResize = () => measureTicks()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [measureTicks])

      const load = react.useCallback(() => gateway.promptHistory(100, sessionId).then((result) => {
        const next = result && result.ok && Array.isArray(result.items) ? [...result.items].reverse() : []
        // The timeline reads chronologically from top to bottom, with the
        // newest accepted prompt at the bottom like Codex. Only THIS
        // session's prompts belong on the rail — the host filters by the
        // owning session id.
        setItems(next)
        itemsRef.current = next
        return next
      }).catch(() => []), [gateway, sessionId])

      react.useEffect(() => {
        load()
        const onTaskDone = () => load()
        window.addEventListener('dsh-desktop:agent-idle', onTaskDone)
        return () => window.removeEventListener('dsh-desktop:agent-idle', onTaskDone)
      }, [load])

      // Pin the rail to the conversation page's left edge (right after the
      // drawer, Codex-style) — not over the drawer and not against the
      // composer. The pane is the composer card's wide ancestor.
      react.useEffect(() => {
        const place = () => {
          const composer = document.querySelector('[data-composer-card]')
          if (!(composer instanceof HTMLElement)) return
          const cardRect = composer.getBoundingClientRect()
          if (cardRect.width === 0) return
          let el = composer.parentElement
          let left = cardRect.left - 30
          while (el) {
            const r = el.getBoundingClientRect()
            if (r.width > cardRect.width + 300 && r.left > 0) {
              left = r.left + 16
              break
            }
            el = el.parentElement
          }
          // On the phone layout the pane's left edge is the viewport edge and
          // `cardRect.left - 30` goes negative, which would park the rail off
          // screen. Clamp to the free gutter instead (messages start at ~32px).
          setPaneLeft(Math.max(left, 4))
        }
        place()
        window.addEventListener('resize', place)
        const observer = new ResizeObserver(() => place())
        observer.observe(document.body)
        return () => {
          window.removeEventListener('resize', place)
          observer.disconnect()
        }
      }, [])

      const applyEntry = react.useCallback((index) => {
        if (inputRef.current?.phase !== 'plain') return
        const entry = itemsRef.current[index]
        if (entry === undefined) return
        inputActions.setDraft(entry.text)
        focusComposerAtEnd()
        setMouseY(null)
      }, [inputActions])

      const scheduleLeave = react.useCallback(() => {
        if (leaveTimerRef.current !== null) clearTimeout(leaveTimerRef.current)
        leaveTimerRef.current = setTimeout(() => {
          leaveTimerRef.current = null
          setMouseY(null)
        }, 140)
      }, [])

      const cancelLeave = react.useCallback(() => {
        if (leaveTimerRef.current !== null) {
          clearTimeout(leaveTimerRef.current)
          leaveTimerRef.current = null
        }
      }, [])

      if (items.length === 0 || paneLeft === null) return null
      const railStyle = {
        left: paneLeft,
        top: '50%',
        transform: 'translateY(-50%)',
      }
      const measure = measureRef.current
      // Continuous Codex fisheye: only horizontal length changes. Every line
      // stays 1px thick and left-anchored while nearby lines form a smooth
      // Gaussian fan around the cursor.
      let hovered = null
      if (mouseY !== null && items.length > 0) {
        let bestDistance = Infinity
        for (let i = 0; i < items.length; i++) {
          const center = measure.firstTop + i * measure.step
          const distance = Math.abs(center - mouseY)
          if (distance < bestDistance) {
            bestDistance = distance
            hovered = i
          }
        }
      }
      const popStyle = hovered === null ? null : {
        left: Math.min(paneLeft + 36, window.innerWidth - 337),
        top: Math.min(Math.max(measure.firstTop + hovered * measure.step, 62), Math.max(62, window.innerHeight - 62)),
        transform: 'translateY(-50%)',
      }
      const entry = hovered !== null ? items[hovered] : null
      const tickStyle = (index) => {
        if (mouseY === null) return null
        const distance = Math.abs(measure.firstTop + index * measure.step - mouseY)
        const sigma = 18
        const gaussian = Math.exp(-(distance * distance) / (2 * sigma * sigma))
        const scale = 1 + 3.35 * gaussian
        const opacity = 0.34 + 0.62 * gaussian
        return {
          '--dsh-prompt-scale': scale.toFixed(3),
          '--dsh-prompt-opacity': opacity.toFixed(3),
        }
      }
      return react.createElement(
        react.Fragment,
        null,
        react.createElement(
          'div',
          {
            ref: railRef,
            className: 'dsh-prompt-rail',
            style: railStyle,
            role: 'listbox',
            'aria-label': '历史 Prompt 时间轴',
            title: '历史 Prompt：悬停预览 · 点击填入输入框',
            onMouseEnter: cancelLeave,
            onMouseMove: (event) => {
              cancelLeave()
              setMouseY(event.clientY)
            },
            onMouseLeave: scheduleLeave,
            onScroll: measureTicks,
          },
          items.map((item, index) => react.createElement('button', {
            key: index,
            type: 'button',
            className: 'dsh-prompt-rail-tick',
            role: 'option',
            'aria-selected': index === hovered,
            'aria-label': `历史 Prompt ${index + 1}`,
            style: tickStyle(index),
            onClick: () => applyEntry(index),
          })),
        ),
        hovered !== null && entry !== undefined && popStyle !== null && react.createElement(
          'div',
          {
            className: 'dsh-prompt-rail-pop',
            style: popStyle,
            role: 'tooltip',
            title: entry.text,
          },
          react.createElement('div', { className: 'dsh-prompt-rail-pop-text' }, entry.text),
        ),
      )
    }

    // — @会话 mention source (Codex-style cross-session references) -----------
    // Browser-side encoder for the canonical mention URI: `dsh-session:` +
    // base64url(JSON-stringified session id) — must match the host decoder in
    // @deepseek-ai/dsh-session-reference exactly (UTF-8 → base64url).
        // — 模型思考强度滑动变阻器 ------------------------------------------------
    // One slider spanning both DeepSeek models: each model's reasoning
    // efforts run left→right (off → max), then the next model picks up, so
    // the rheostat reads Flash·Off … Flash·Max | V4 Pro·Off … V4 Pro·Max.
    // Every stop owns a lossless 24-frame sprite animation. Flash stays
    // light/fast while Pro reads as heavier and more forceful, so Flash·Max
    // never visually works harder than any Pro stop.

    const RHEOSTAT_CSS = [
      '.dsh-rheostat { display: inline-flex; align-items: center; position: relative; }',
      // Collapsed trigger: pixel-identical to the shell's default model chip
      // (the "Honeycomb" model select trigger), so the seat looks untouched
      // until the user clicks it.
      '.dsh-rheo-trigger { min-width: 0; max-width: 220px; height: 28px; color: var(--dsw-alias-label-secondary, rgba(226,230,240,0.85)); cursor: pointer; background: transparent; border: none; border-radius: 24px; outline: none; display: flex; align-items: center; gap: 4px; padding: 0 4px 0 8px; font-family: inherit; font-size: 13px; font-weight: 500; line-height: 20px; }',
      '.dsh-rheo-trigger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(128,140,160,0.16)); }',
      '.dsh-rheo-trigger:focus-visible { box-shadow: 0 0 0 2px var(--dsw-alias-border-l3, rgba(103,158,254,0.6)); }',
      '.dsh-rheo-trigger:disabled { color: var(--dsw-alias-label-dimmed, rgba(220,225,238,0.5)); cursor: default; }',
      '.dsh-rheo-trigger-label { text-overflow: ellipsis; white-space: nowrap; min-width: 0; overflow: hidden; }',
      '.dsh-rheo-trigger-effort { color: var(--dsw-alias-label-caption, rgba(220,225,238,0.6)); flex: none; }',
      '.dsh-rheo-chevron { display: inline-flex; color: var(--dsw-alias-label-caption, rgba(220,225,238,0.6)); flex: none; transition: transform 0.12s; }',
      '.dsh-rheo-chevron.open { transform: rotate(180deg); }',
      '.dsh-rheo-pop { position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 30; width: 240px; padding: 8px 6px; border: 1px solid rgba(128,140,160,0.3); border-radius: 12px; background: rgba(18,21,30,0.97); box-shadow: 0 12px 32px rgba(0,0,0,0.45); backdrop-filter: blur(20px); animation: dsh-rheo-pop-in 0.16s ease-out; }',
      '@keyframes dsh-rheo-pop-in { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }',
      // 高级 accordion toggle (triangle rotates when expanded).
      '.dsh-rheo-adv-toggle { display: flex; align-items: center; gap: 6px; width: 100%; border: none; background: transparent; color: rgba(232,236,246,0.9); font: inherit; font-size: 12.5px; cursor: pointer; padding: 2px 6px 8px; text-align: left; }',
      '.dsh-rheo-adv-toggle:hover { color: #fff; }',
      '.dsh-rheo-adv-tri { display: inline-flex; color: rgba(220,225,238,0.55); transition: transform 0.15s ease; }',
      '.dsh-rheo-adv-toggle.open .dsh-rheo-adv-tri { transform: rotate(90deg); }',
      '.dsh-rheostat-track { position: relative; width: 100%; height: 32px !important; min-height: 32px !important; border-radius: 999px; background: rgba(128,140,160,0.15); border: 1px solid rgba(128,140,160,0.26); cursor: pointer; touch-action: none; user-select: none; overflow: hidden; transition: border-color 0.2s ease, box-shadow 0.2s ease; }',
      '.dsh-rheostat-track:hover { border-color: rgba(130,162,255,0.5); box-shadow: 0 0 0 3px rgba(77,107,254,0.09); }',
      '.dsh-rheostat-track.dsh-rheostat-locked { cursor: default; opacity: 0.55; }',
      '.dsh-rheostat-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; overflow: hidden !important; transition: width 0.22s ease, background 0.3s ease; }',
      '.dsh-rheostat-shine { position: absolute; inset: 0; background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,0.28) 50%, transparent 62%); background-size: 240% 100%; animation: dsh-rheostat-shine 3.6s ease-in-out infinite; }',
      '@keyframes dsh-rheostat-shine { 0% { background-position: 130% 0; } 55%, 100% { background-position: -70% 0; } }',
      '.dsh-rheostat-particle { position: absolute; bottom: 3px; border-radius: 50%; background: rgba(255,255,255,0.92); box-shadow: 0 0 6px rgba(140,180,255,0.9); opacity: 0; pointer-events: none; animation: dsh-particle-rise 2.2s linear infinite; }',
      '@keyframes dsh-particle-rise { 0% { transform: translateY(0) scale(1); opacity: 0; } 12% { opacity: 0.95; } 80% { opacity: 0.45; } 100% { transform: translateY(-18px) scale(0.35); opacity: 0; } }',
      // Level dots sit on the track's vertical centerline; the whale thumb
      // may cover the CURRENT stop's dot (that's the point), past/future
      // dots stay visible around it.
      '.dsh-rheostat-dots { position: absolute; inset: 0; z-index: 2; pointer-events: none; }',
      '.dsh-rheostat-dot { position: absolute; top: 50%; width: 5px; height: 5px; margin-left: -2.5px; transform: translateY(-50%); border-radius: 50%; background: rgba(255,255,255,0.3); transition: background 0.25s ease, box-shadow 0.25s ease; }',
      '.dsh-rheostat-dot.past { background: rgba(255,255,255,0.95); box-shadow: 0 0 5px rgba(120,160,255,0.9); }',
      // The whale IS the thumb: it sits inside the track at the current stop
      // and can be grabbed and dragged to switch stops.
      '.dsh-rheostat-whale { position: absolute; top: 50%; width: 40px !important; height: 32px !important; z-index: 3; pointer-events: auto; cursor: grab; transform: translate(-50%, -50%) scaleX(-1); transition: left 0.22s ease; filter: drop-shadow(0 2px 3px rgba(8,16,32,0.45)) drop-shadow(0 0 8px rgba(122,172,255,0.45)); }',
      '.dsh-rheostat-whale.dragging { cursor: grabbing; }',
      // Advanced mode: the original two-level model menu (models → efforts),
      // styled like the shell's native selector.
      '.dsh-rheo-adv { display: flex; flex-direction: column; gap: 2px; }',
      '.dsh-rheo-adv-cell { width: 100%; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: none; background: transparent; border-radius: 10px; color: var(--dsw-alias-label-primary, #F9FAFB); font: inherit; font-size: 14px; line-height: 22px; cursor: pointer; text-align: left; }',
      '.dsh-rheo-adv-cell:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,140,160,0.16)); }',
      '.dsh-rheo-adv-cell-label { flex: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      // Advanced mode: the original two-level model menu (model → effort),
      // Codex-style rows: label + current value + chevron, divider, section.
      '.dsh-rheo-adv-cell-value { flex: none; min-width: 0; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(220,225,238,0.55); }',
      '.dsh-rheo-adv-cell-chevron { flex: none; color: rgba(220,225,238,0.45); display: inline-flex; }',
      '.dsh-rheo-adv-head { display: flex; align-items: center; gap: 8px; padding: 2px 4px 8px; border-bottom: 1px solid rgba(128,140,160,0.14); margin-bottom: 4px; font-size: 12px; color: rgba(220,225,238,0.6); }',
      '.dsh-rheo-adv-back { display: inline-flex; align-items: center; gap: 4px; border: none; background: transparent; color: inherit; font: inherit; font-size: 12px; cursor: pointer; padding: 3px 8px; border-radius: 6px; }',
      '.dsh-rheo-adv-back:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,140,160,0.16)); }',
      '.dsh-rheo-adv-groups { max-height: min(330px, 48vh); overflow-y: auto; }',
      '.dsh-rheo-adv-group-title { padding: 6px 8px 3px; font-size: 12px; font-weight: 500; line-height: 18px; color: rgba(220,225,238,0.6); }',
      '.dsh-rheo-adv-option { width: 100%; min-height: 38px; display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: none; background: transparent; border-radius: 10px; color: var(--dsw-alias-label-primary, #F9FAFB); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }',
      '.dsh-rheo-adv-option:hover, .dsh-rheo-adv-option:focus-visible { background: var(--dsw-alias-interactive-bg-hover, rgba(128,140,160,0.16)); }',
      '.dsh-rheo-adv-option:disabled { opacity: 0.5; cursor: default; }',
      '.dsh-rheo-adv-option-copy { display: flex; flex-direction: column; flex: 1; min-width: 0; }',
      '.dsh-rheo-adv-option-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 500; line-height: 20px; }',
      '.dsh-rheo-adv-option-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 18px; color: rgba(220,225,238,0.6); }',
      '.dsh-rheo-adv-check { color: #679EFE; flex: 0 0 18px; display: grid; place-items: center; }',
      '.dsh-rheostat-whale-inner { position: absolute; inset: 0; animation: dsh-whale-state-in 0.18s ease-out both; }',
      '.dsh-rheostat-whale-bob { position: absolute; inset: 0; animation: dsh-whale-bob var(--sprite-duration, 2.4s) ease-in-out infinite; }',
      '.dsh-rheostat-whale-frame { position: absolute; inset: 0; display: block; background-repeat: no-repeat; background-size: 600% 400%; background-position: 0% 0%; animation: dsh-whale-sprite var(--sprite-duration, 2.4s) step-end infinite; }',
      '@keyframes dsh-whale-state-in { from { opacity: 0.25; transform: scale(0.82); } to { opacity: 1; transform: scale(1); } }',
      '@keyframes dsh-whale-bob { 0%, 100% { transform: translateY(-1.5px); } 50% { transform: translateY(1.5px); } }',
      '@keyframes dsh-whale-sprite {',
      '  0% { background-position: 0% 0%; }',
      '  4.1667% { background-position: 20% 0%; }',
      '  8.3333% { background-position: 40% 0%; }',
      '  12.5% { background-position: 60% 0%; }',
      '  16.6667% { background-position: 80% 0%; }',
      '  20.8333% { background-position: 100% 0%; }',
      '  25% { background-position: 0% 33.3333%; }',
      '  29.1667% { background-position: 20% 33.3333%; }',
      '  33.3333% { background-position: 40% 33.3333%; }',
      '  37.5% { background-position: 60% 33.3333%; }',
      '  41.6667% { background-position: 80% 33.3333%; }',
      '  45.8333% { background-position: 100% 33.3333%; }',
      '  50% { background-position: 0% 66.6667%; }',
      '  54.1667% { background-position: 20% 66.6667%; }',
      '  58.3333% { background-position: 40% 66.6667%; }',
      '  62.5% { background-position: 60% 66.6667%; }',
      '  66.6667% { background-position: 80% 66.6667%; }',
      '  70.8333% { background-position: 100% 66.6667%; }',
      '  75% { background-position: 0% 100%; }',
      '  79.1667% { background-position: 20% 100%; }',
      '  83.3333% { background-position: 40% 100%; }',
      '  87.5% { background-position: 60% 100%; }',
      '  91.6667% { background-position: 80% 100%; }',
      '  95.8333% { background-position: 100% 100%; }',
      '  100% { background-position: 0% 0%; }',
      '}',
      '@media (prefers-reduced-motion: reduce) { .dsh-rheostat-whale, .dsh-rheostat-fill, .dsh-rheostat-shine, .dsh-rheostat-particle { transition: none; animation: none; } .dsh-rheostat-whale-frame, .dsh-rheostat-whale-bob, .dsh-rheostat-whale-inner { animation: none; } .dsh-rheostat-whale-frame { background-position: 0% 0%; } }',
    ].join('\n')

    let rheostatStyleInstalled = false
    function installRheostatStyle() {
      if (rheostatStyleInstalled) return
      rheostatStyleInstalled = true
      if (document.getElementById('dsh-rheostat-css') !== null) return
      const style = document.createElement('style')
      style.id = 'dsh-rheostat-css'
      style.textContent = RHEOSTAT_CSS
      document.head.appendChild(style)
    }

    const WHALE_SPRITE_BASE = '/dsh-desktop/whale-sprites'
    const WHALE_STATES = [
      { model: 'deepseek-v4-flash', effort: 'off', modelLabel: 'Flash', sprite: 'flash-off', duration: 3.0 },
      { model: 'deepseek-v4-flash', effort: 'high', modelLabel: 'Flash', sprite: 'flash-high', duration: 2.0 },
      { model: 'deepseek-v4-flash', effort: 'max', modelLabel: 'Flash', sprite: 'flash-max', duration: 1.7 },
      { model: 'deepseek-v4-pro', effort: 'off', modelLabel: 'V4 Pro', sprite: 'pro-off', duration: 2.4 },
      { model: 'deepseek-v4-pro', effort: 'high', modelLabel: 'V4 Pro', sprite: 'pro-high', duration: 1.6 },
      { model: 'deepseek-v4-pro', effort: 'max', modelLabel: 'V4 Pro', sprite: 'pro-max', duration: 1.333 },
    ]

    function whaleSpriteUrl(sprite) {
      return `${WHALE_SPRITE_BASE}/${sprite}.webp`
    }

    function ModelRheostat({ sessionId, locked, connection }) {
      const [groups, setGroups] = react.useState(null)
      const [current, setCurrent] = react.useState(null)
      const [busy, setBusy] = react.useState(false)
      const [dragging, setDragging] = react.useState(false)
      const draggingRef = react.useRef(false)
      const [expanded, setExpanded] = react.useState(false)
      // One popover, two layers: the slider by default; the 高级 accordion
      // (supplier → model → effort) on top of it.
      const [advancedOpen, setAdvancedOpen] = react.useState(false)
      const [pane, setPane] = react.useState(null)
      const [supplier, setSupplier] = react.useState(null)
      const trackRef = react.useRef(null)
      const rootRef = react.useRef(null)

      // When the current session model changes, follow its provider as the
      // active supplier filter.
      react.useEffect(() => {
        if (current !== null) setSupplier(current.provider)
      }, [current])

      const openPopover = react.useCallback(() => {
        setPane(null)
        setExpanded(true)
      }, [])

      // Collapsed by default: the seat shows a chip identical to the shell's
      // default model trigger; clicking it opens the popover (always on the
      // outermost view).
      react.useEffect(() => {
        if (!expanded) return
        const onPointerDown = (event) => {
          if (rootRef.current !== null && rootRef.current.contains(event.target)) return
          setExpanded(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setExpanded(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [expanded])

      react.useEffect(() => {
        installRheostatStyle()
      }, [])

      react.useEffect(() => {
        for (const state of WHALE_STATES) {
          const image = new Image()
          image.src = whaleSpriteUrl(state.sprite)
        }
      }, [])

      const stops = react.useMemo(() => {
        // DeepSeek keeps the chained Flash→Pro six-stop design.
        if (current?.provider === 'deepseek-official') {
          const group = (groups ?? []).find((g) => g.id === 'deepseek-official')
          if (group === undefined) return []
          return WHALE_STATES.flatMap((state) => {
            const model = (group.models ?? []).find((entry) => entry.id === state.model)
            const effort = (model?.reasoning?.efforts ?? []).find((entry) => entry.id === state.effort)
            if (model === undefined || effort === undefined) return []
            return [{
              provider: group.id,
              model: state.model,
              effort: state.effort,
              modelName: model.name ?? state.model,
              effortName: effort.name ?? state.effort,
              modelLabel: state.modelLabel,
              sprite: state.sprite,
              duration: state.duration,
            }]
          })
        }
        // Other vendors: adapt the stops to the CURRENT model's own
        // reasoning efforts (whatever the catalog reports).
        if (current === null) return []
        const group = (groups ?? []).find((g) => g.id === current.provider)
        const model = group?.models?.find((entry) => entry.id === current.model)
        if (model === undefined) return []
        const efforts = model.reasoning?.efforts ?? []
        if (efforts.length === 0) return []
        // Map DeepSeek sprites to effort tiers so non-DeepSeek models also
        // get visual variety (not just speed changes).
        const SPRITE_TIERS = [
          { sprite: 'flash-off',  duration: 3.0 },
          { sprite: 'flash-high', duration: 2.2 },
          { sprite: 'pro-off',    duration: 1.8 },
          { sprite: 'pro-high',   duration: 1.5 },
          { sprite: 'pro-max',    duration: 1.333 },
        ]
        return efforts.map((effort, i) => {
          // Map effort index → sprite tier (distribute evenly across tiers).
          const tier = efforts.length <= 1
            ? SPRITE_TIERS[0]
            : SPRITE_TIERS[Math.round(i * (SPRITE_TIERS.length - 1) / (efforts.length - 1))]
          return {
            provider: group.id,
            model: model.id,
            effort: effort.id,
            modelName: model.name ?? model.id,
            effortName: effort.name ?? effort.id,
            modelLabel: model.name ?? model.id,
            sprite: tier.sprite,
            duration: tier.duration,
          }
        })
      }, [groups, current])

      react.useEffect(() => {
        const load = () => {
          connection.api.llm.models({}).then((r) => {
            if (r && r.result && r.result.ok) setGroups(r.result.value.groups ?? [])
          }).catch(() => {})
          connection.api.sessions.models({ sessionId }).then((r) => {
            if (r && r.result && r.result.ok) setCurrent(r.result.value.current ?? null)
          }).catch(() => {})
        }
        load()
        const timer = setInterval(load, 30_000)
        const onFocus = () => load()
        window.addEventListener('focus', onFocus)
        return () => {
          clearInterval(timer)
          window.removeEventListener('focus', onFocus)
        }
      }, [sessionId, connection])

      const stopIndex = react.useMemo(() => {
        if (stops.length === 0 || current === null) return 0
        let idx = stops.findIndex((s) => s.model === current.model && s.effort === current.reasoningEffort)
        if (idx === -1) {
          const defaultEffort = (groups ?? [])
            .find((g) => g.id === current.provider)?.models
            ?.find((m) => m.id === current.model)?.reasoning?.defaultEffort
          idx = stops.findIndex((s) => s.model === current.model && s.effort === defaultEffort)
        }
        return idx === -1 ? 0 : idx
      }, [stops, current, groups])

      // Star-dust particles: more of them at higher levels (2 → 8), each
      // with a stable pseudo-random position so re-renders don't jitter.
      const particles = react.useMemo(() => {
        if (stops.length === 0) return []
        const level = stops.length > 1 ? stopIndex / (stops.length - 1) : 0
        const count = 2 + Math.round(level * 6)
        let seed = (stopIndex + 1) * 2654435761 % 4294967296
        const rand = () => {
          seed = (seed * 1103515245 + 12345) % 2147483648
          return seed / 2147483648
        }
        return Array.from({ length: count }, () => ({
          left: 6 + rand() * 86,
          size: 2 + rand() * 1.8,
          delay: rand() * 2.2,
          duration: 1.7 + rand() * 1.1,
        }))
      }, [stopIndex, stops.length])

      const select = react.useCallback((idx) => {
        const stop = stops[idx]
        if (stop === undefined || busy || stops.length === 0) return
        setBusy(true)
        connection.api.sessions.selectModel({
          sessionId,
          provider: stop.provider,
          model: stop.model,
          reasoningEffort: stop.effort,
        }).then((r) => {
          setBusy(false)
          if (r && r.result && r.result.ok) setCurrent(r.result.value.selected ?? null)
        }).catch(() => setBusy(false))
      }, [stops, busy, sessionId, connection])

      // Advanced-mode actions: switch the session model or its effort through
      // the same official session.selectModel wire as the shell's menu. After
      // a pick the menu returns to the root view — it never closes.
      const chooseModel = react.useCallback((provider, modelId) => {
        const group = (groups ?? []).find((g) => g.id === provider)
        const model = group?.models?.find((m) => m.id === modelId)
        if (model === undefined) return
        if (current?.provider === provider && current?.model === modelId) {
          setPane(null)
          return
        }
        const effort = model.reasoning?.defaultEffort ?? model.reasoning?.efforts?.[0]?.id
        setBusy(true)
        connection.api.sessions.selectModel({
          sessionId,
          provider,
          model: modelId,
          ...(effort === undefined ? {} : { reasoningEffort: effort }),
        }).then((r) => {
          setBusy(false)
          if (r && r.result && r.result.ok) {
            setCurrent(r.result.value.selected ?? null)
            setSupplier(provider)
            setPane(null)
          }
        }).catch(() => setBusy(false))
      }, [groups, current, busy, sessionId, connection])

      const chooseEffort = react.useCallback((effortId) => {
        if (current === null) return
        if (current.reasoningEffort === effortId) {
          setPane(null)
          return
        }
        setBusy(true)
        connection.api.sessions.selectModel({
          sessionId,
          provider: current.provider,
          model: current.model,
          reasoningEffort: effortId,
        }).then((r) => {
          setBusy(false)
          if (r && r.result && r.result.ok) {
            setCurrent(r.result.value.selected ?? null)
            setPane(null)
          }
        }).catch(() => setBusy(false))
      }, [current, busy, sessionId, connection])

      const stopFromEvent = (clientX) => {
        const el = trackRef.current
        if (el === null || stops.length < 2) return 0
        const rect = el.getBoundingClientRect()
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
        return Math.round(ratio * (stops.length - 1))
      }
      const onPointerDown = (e) => {
        if (locked || busy || stops.length < 2) return
        draggingRef.current = true
        setDragging(true)
        select(stopFromEvent(e.clientX))
        // Use document-level listeners as a robust fallback: pointer capture
        // can silently fail in Electron when the pointer leaves the window.
        const onDocMove = (ev) => {
          if (!draggingRef.current) return
          select(stopFromEvent(ev.clientX))
        }
        const onDocUp = () => {
          draggingRef.current = false
          setDragging(false)
          document.removeEventListener('pointermove', onDocMove)
          document.removeEventListener('pointerup', onDocUp)
          document.removeEventListener('pointercancel', onDocUp)
        }
        document.addEventListener('pointermove', onDocMove)
        document.addEventListener('pointerup', onDocUp)
        document.addEventListener('pointercancel', onDocUp)
      }
      const onPointerMove = (e) => {
        if (!draggingRef.current) return
        select(stopFromEvent(e.clientX))
      }
      const onPointerUp = () => {
        draggingRef.current = false
        setDragging(false)
      }
      // Safety net: if pointer capture is lost (e.g. released outside the
      // window), reset dragging state so hover doesn't trigger adjustment.
      const onLostPointerCapture = () => {
        draggingRef.current = false
        setDragging(false)
      }

      const noStops = stops.length === 0
      if (noStops && current === null) return null
      const idx = stopIndex
      const stop = stops[idx]
      const level = stops.length > 1 ? stopIndex / (stops.length - 1) : 0
      // The collapsed chip always shows the REAL current model (never the
      // fallback first stop), so third-party models read correctly.
      const currentModel = (() => {
        if (current === null) return null
        const group = (groups ?? []).find((g) => g.id === current.provider)
        return group?.models?.find((m) => m.id === current.model) ?? null
      })()
      const triggerName = noStops
        ? (currentModel?.name ?? current?.model ?? '模型')
        : stop.modelLabel
      const triggerEffort = noStops ? '' : stop.effortName
      const title = noStops
        ? `模型：${triggerName}`
        : `模型与思考强度：${stop.modelName} · 推理 ${stop.effortName}（点击展开调整）`
      const THUMB = 20 // half of the whale width; the whale IS the thumb
      const fillStyle = noStops ? null : {
        width: `calc(${THUMB}px + (100% - ${THUMB}px) * ${level})`,
        background: `linear-gradient(90deg, hsl(212, 92%, 61%), hsl(${227 + Math.round(level * 8)}, 88%, 63%))`,
      }
      const whaleStyle = noStops ? null : {
        left: `calc(${THUMB}px + (100% - ${THUMB * 2}px) * ${level})`,
        '--sprite-duration': `${stop.duration}s`,
      }
      // Level ticks: one dot per stop on the track's centerline (past = lit,
      // future = dim); the whale thumb covers only its own dot.
      const dots = noStops ? [] : stops.map((_, index) => react.createElement('span', {
        key: index,
        className: `dsh-rheostat-dot${index < idx ? ' past' : ''}`,
        style: { left: `calc(${THUMB}px + (100% - ${THUMB * 2}px) * ${index / Math.max(1, stops.length - 1)})` },
      }))
      const chevron = react.createElement(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': true },
        react.createElement('path', { d: 'M3.5 5.5 7 9l3.5-3.5', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
      const chevronRight = react.createElement(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': true },
        react.createElement('path', { d: 'M5.5 3.5 9 7l-3.5 3.5', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
      const checkIcon = react.createElement(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', 'aria-hidden': true },
        react.createElement('path', { d: 'M2.5 7.5 5.5 10.5 11.5 4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
      const currentEffortName = (() => {
        if (current === null) return ''
        const efforts = currentModel?.reasoning?.efforts ?? []
        return efforts.find((e) => e.id === current.reasoningEffort)?.name ?? current.reasoningEffort ?? ''
      })()
      const supplierGroup = (() => {
        const id = supplier ?? current?.provider ?? null
        return (groups ?? []).find((g) => g.id === id) ?? null
      })()
      const supplierName = supplierGroup?.name ?? supplierGroup?.id ?? '—'
      // The 高级 accordion: collapsed → the slider; expanded → supplier /
      // model / effort rows; sub-panes return to the rows after a pick.
      const advancedContent = (() => {
        if (pane === 'supplier') {
          return react.createElement('div', { className: 'dsh-rheo-adv' },
            react.createElement('div', { className: 'dsh-rheo-adv-head' },
              react.createElement('button', { type: 'button', className: 'dsh-rheo-adv-back', onClick: () => setPane(null) }, '‹ 返回'),
              react.createElement('span', null, '模型供应商'),
            ),
            react.createElement('div', { className: 'dsh-rheo-adv-groups' },
              (groups ?? []).map((group) => {
                const selected = supplier === group.id
                return react.createElement('button', {
                  key: group.id,
                  type: 'button',
                  className: 'dsh-rheo-adv-option',
                  onClick: () => {
                    setSupplier(group.id)
                    setPane('model')
                  },
                },
                  react.createElement('span', { className: 'dsh-rheo-adv-option-copy' },
                    react.createElement('span', { className: 'dsh-rheo-adv-option-name' }, group.name ?? group.id),
                  ),
                  react.createElement('span', { className: 'dsh-rheo-adv-check' }, selected ? checkIcon : null),
                )
              }),
            ),
          )
        }
        if (pane === 'model') {
          const group = supplierGroup ?? (groups ?? [])[0] ?? null
          const models = group?.models ?? []
          return react.createElement('div', { className: 'dsh-rheo-adv' },
            react.createElement('div', { className: 'dsh-rheo-adv-head' },
              react.createElement('button', { type: 'button', className: 'dsh-rheo-adv-back', onClick: () => setPane(null) }, '‹ 返回'),
              react.createElement('span', null, `选择模型 · ${group?.name ?? ''}`),
            ),
            models.length === 0
              ? react.createElement('div', { style: { padding: '14px', fontSize: '12px', color: 'rgba(220,225,238,0.6)' } }, '该供应商暂无模型。')
              : react.createElement('div', { className: 'dsh-rheo-adv-groups' },
                  models.map((model) => {
                    const selected = current !== null && current.provider === group.id && current.model === model.id
                    return react.createElement('button', {
                      key: model.id,
                      type: 'button',
                      className: 'dsh-rheo-adv-option',
                      disabled: busy,
                      onClick: () => chooseModel(group.id, model.id),
                    },
                      react.createElement('span', { className: 'dsh-rheo-adv-option-copy' },
                        react.createElement('span', { className: 'dsh-rheo-adv-option-name' }, model.name ?? model.id),
                        model.description !== undefined && react.createElement('span', { className: 'dsh-rheo-adv-option-desc' }, model.description),
                      ),
                      react.createElement('span', { className: 'dsh-rheo-adv-check' }, selected ? checkIcon : null),
                    )
                  }),
                ),
          )
        }
        if (pane === 'effort') {
          const efforts = currentModel?.reasoning?.efforts ?? []
          return react.createElement('div', { className: 'dsh-rheo-adv' },
            react.createElement('div', { className: 'dsh-rheo-adv-head' },
              react.createElement('button', { type: 'button', className: 'dsh-rheo-adv-back', onClick: () => setPane(null) }, '‹ 返回'),
              react.createElement('span', null, `思考强度 · ${triggerName}`),
            ),
            efforts.length === 0
              ? react.createElement('div', { style: { padding: '14px', fontSize: '12px', color: 'rgba(220,225,238,0.6)' } }, '该模型没有推理档位。')
              : react.createElement('div', { className: 'dsh-rheo-adv-groups' },
                  efforts.map((effort) => {
                    const selected = current?.reasoningEffort === effort.id
                    return react.createElement('button', {
                      key: effort.id,
                      type: 'button',
                      className: 'dsh-rheo-adv-option',
                      disabled: busy,
                      onClick: () => chooseEffort(effort.id),
                    },
                      react.createElement('span', { className: 'dsh-rheo-adv-option-copy' },
                        react.createElement('span', { className: 'dsh-rheo-adv-option-name' }, effort.name ?? effort.id),
                      ),
                      react.createElement('span', { className: 'dsh-rheo-adv-check' }, selected ? checkIcon : null),
                    )
                  }),
                ),
          )
        }
        // Root of the expanded accordion: 模型供应商 / 模型 / 思考强度.
        return react.createElement('div', { className: 'dsh-rheo-adv' },
          react.createElement('button', { type: 'button', className: 'dsh-rheo-adv-cell', onClick: () => setPane('supplier') },
            react.createElement('span', { className: 'dsh-rheo-adv-cell-label' }, '模型供应商'),
            react.createElement('span', { className: 'dsh-rheo-adv-cell-value' }, supplierName),
            react.createElement('span', { className: 'dsh-rheo-adv-cell-chevron' }, chevronRight),
          ),
          react.createElement('button', { type: 'button', className: 'dsh-rheo-adv-cell', onClick: () => setPane('model') },
            react.createElement('span', { className: 'dsh-rheo-adv-cell-label' }, '模型'),
            react.createElement('span', { className: 'dsh-rheo-adv-cell-value' }, triggerName),
            react.createElement('span', { className: 'dsh-rheo-adv-cell-chevron' }, chevronRight),
          ),
          react.createElement('button', { type: 'button', className: 'dsh-rheo-adv-cell', onClick: () => setPane('effort') },
            react.createElement('span', { className: 'dsh-rheo-adv-cell-label' }, '思考强度'),
            react.createElement('span', { className: 'dsh-rheo-adv-cell-value' }, currentEffortName || '—'),
            react.createElement('span', { className: 'dsh-rheo-adv-cell-chevron' }, chevronRight),
          ),
        )
      })()
      // Grabbing the whale starts a drag; stopPropagation keeps the track's
      // own pointerdown (bubbled) from firing a duplicate select.
      const onWhalePointerDown = (event) => {
        event.stopPropagation()
        onPointerDown(event)
      }
      return react.createElement(
        'div',
        { className: 'dsh-rheostat', title, ref: rootRef },
        react.createElement(
          'button',
          {
            type: 'button',
            className: 'dsh-rheo-trigger',
            'aria-haspopup': 'dialog',
            'aria-expanded': expanded,
            disabled: locked,
            onClick: () => expanded ? setExpanded(false) : openPopover(),
          },
          react.createElement('span', { className: 'dsh-rheo-trigger-label' }, triggerName),
          triggerEffort !== '' && react.createElement('span', { className: 'dsh-rheo-trigger-effort' }, triggerEffort),
          react.createElement('span', { className: `dsh-rheo-chevron${expanded ? ' open' : ''}` }, chevron),
        ),
        expanded && react.createElement(
          'div',
          { className: 'dsh-rheo-pop', role: 'dialog', 'aria-label': '模型与思考强度调节' },
          // 高级 accordion toggle: collapsed → slider, expanded → rows.
          react.createElement(
            'button',
            {
              type: 'button',
              className: `dsh-rheo-adv-toggle${advancedOpen ? ' open' : ''}`,
              'aria-expanded': advancedOpen,
              onClick: () => setAdvancedOpen((value) => !value),
            },
            react.createElement('span', { className: 'dsh-rheo-adv-tri', 'aria-hidden': true }, chevronRight),
            react.createElement('span', null, '高级'),
          ),
          advancedOpen
            ? advancedContent
            : noStops
              ? react.createElement(
                'div',
                { style: { padding: '18px 14px', fontSize: '12px', lineHeight: 1.6, color: 'rgba(220,225,238,0.6)' } },
                `当前模型「${triggerName}」不支持推理档位调节。`,
              )
              : react.createElement(
              'div',
              {
                ref: trackRef,
                className: locked ? 'dsh-rheostat-track dsh-rheostat-locked' : 'dsh-rheostat-track',
                style: { height: 32, minHeight: 32 },
                onPointerDown,
                onPointerMove,
                onPointerUp,
                onPointerCancel: onPointerUp,
                onLostPointerCapture,
              },
              react.createElement(
                'div',
                { className: 'dsh-rheostat-fill', style: fillStyle },
                react.createElement('span', { className: 'dsh-rheostat-shine', 'aria-hidden': true }),
                particles.map((particle, index) => react.createElement('span', {
                  key: index,
                  className: 'dsh-rheostat-particle',
                  'aria-hidden': true,
                  style: {
                    left: `${particle.left}%`,
                    width: particle.size,
                    height: particle.size,
                    animationDelay: `${particle.delay}s`,
                    animationDuration: `${particle.duration}s`,
                  },
                })),
              ),
              react.createElement('span', { className: 'dsh-rheostat-dots', 'aria-hidden': true }, dots),
              react.createElement(
                'span',
                {
                  key: `${stop.model}:${stop.effort}`,
                  className: `dsh-rheostat-whale${dragging ? ' dragging' : ''}`,
                  style: whaleStyle,
                  title: '拖动鲸鱼切换档位',
                  onPointerDown: onWhalePointerDown,
                },
                react.createElement('span', { className: 'dsh-rheostat-whale-inner' },
                  react.createElement('span', { className: 'dsh-rheostat-whale-bob' },
                    react.createElement('span', {
                      className: 'dsh-rheostat-whale-frame',
                      'aria-hidden': true,
                      style: { backgroundImage: `url("${whaleSpriteUrl(stop.sprite)}")` },
                    }),
                  ),
                ),
              ),
            ),
          ),
      )
    }

    function b64urlEncode(text) {
      const bytes = new TextEncoder().encode(text)
      let bin = ''
      for (const byte of bytes) bin += String.fromCharCode(byte)
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }
    function sessionMentionUri(sessionId) {
      return `dsh-session:${b64urlEncode(JSON.stringify(String(sessionId)))}`
    }
    function sessionMentionMarkdown(label, sessionId) {
      const escaped = String(label).replace(/[\\\]]/g, match => `\\${match}`)
      return `@[${escaped}](${sessionMentionUri(sessionId)})`
    }

    /**
     * Build the `@` trigger source that offers the user's other sessions.
     * Returns `{ register, dispose }` or undefined when the input-trigger
     * service is unavailable. The roster (session list) is fetched once per
     * session scope with a short TTL, so per-keystroke filtering stays local.
     */
    function buildSessionMentionSource(ctx, gateway) {
      const inputTriggers = ctx.get('inputTriggers')
      if (inputTriggers === undefined) return undefined
      const TTL_MS = 60000
      const rosterCache = new Map() // scope sessionId -> { at, sessions }
      const pending = new Map() // scope sessionId -> Promise
      const byName = new Map() // scope sessionId -> Map<menuName, entry>
      const labelOf = new Map() // target sessionId -> label

      const indexRoster = (scopeId, sessions) => {
        // Many sessions share a title (e.g. forks/subagents minted in one
        // batch carry the same title AND the same creation timestamp). The
        // menu must still tell them apart: colliding titles get the date,
        // and title+date collisions additionally get a short id fragment.
        const labelOfDate = new Map() // `${label} · ${date}` -> count
        const counts = new Map()
        for (const entry of sessions) {
          const label = String(entry.label ?? entry.sessionId)
          counts.set(label, (counts.get(label) ?? 0) + 1)
          const date = entry.createdAt
            ? new Date(Number(entry.createdAt)).toLocaleDateString('zh-CN')
            : String(entry.sessionId).slice(0, 8)
          const key = `${label} · ${date}`
          labelOfDate.set(key, (labelOfDate.get(key) ?? 0) + 1)
        }
        const names = new Map()
        for (const entry of sessions) {
          const label = String(entry.label ?? entry.sessionId)
          let name = label
          if ((counts.get(label) ?? 0) > 1) {
            const date = entry.createdAt
              ? new Date(Number(entry.createdAt)).toLocaleDateString('zh-CN')
              : String(entry.sessionId).slice(0, 8)
            name = `${label} · ${date}`
            if ((labelOfDate.get(name) ?? 0) > 1) {
              name = `${name} · ${String(entry.sessionId).slice(-4)}`
            }
          }
          names.set(name, entry)
          labelOf.set(String(entry.sessionId), label)
        }
        byName.set(scopeId, names)
      }

      const fetchRoster = (scopeId) => {
        const hit = rosterCache.get(scopeId)
        if (hit !== undefined && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.sessions)
        const inflight = pending.get(scopeId)
        if (inflight !== undefined) return inflight
        const promise = gateway.listSessionCandidates(scopeId, '', 50).then(
          (res) => {
            if (res.ok && Array.isArray(res.sessions)) {
              const unique = []
              const seenIds = new Set()
              for (const entry of res.sessions) {
                const id = String(entry.sessionId)
                if (seenIds.has(id)) continue
                seenIds.add(id)
                unique.push(entry)
              }
              rosterCache.set(scopeId, { at: Date.now(), sessions: unique })
              indexRoster(scopeId, unique)
              return unique
            }
            const stale = rosterCache.get(scopeId)
            return stale === undefined ? [] : stale.sessions
          },
          () => {
            const stale = rosterCache.get(scopeId)
            return stale === undefined ? [] : stale.sessions
          },
        )
        promise.finally(() => pending.delete(scopeId)).catch(() => {})
        pending.set(scopeId, promise)
        return promise
      }

      const clearAll = () => {
        rosterCache.clear()
        byName.clear()
        labelOf.clear()
      }

      const source = {
        trigger: '@',
        name: '会话',
        order: -1,
        async candidates(session, { query, signal }) {
          try {
            const sessions = await fetchRoster(session.sessionId)
            if (signal.aborted) return []
            const needle = String(query ?? '').toLowerCase()
            const names = byName.get(session.sessionId)
            return sessions
              .filter(entry => String(entry.label ?? '').toLowerCase().includes(needle)
                || String(entry.sessionId ?? '').toLowerCase().includes(needle)
                || (typeof entry.cwd === 'string' && entry.cwd.toLowerCase().includes(needle)))
              .slice(0, 8)
              .map(entry => {
                const nameEntry = names === undefined
                  ? undefined
                  : [...names.entries()].find(([, value]) => value.sessionId === entry.sessionId)
                return {
                  name: nameEntry === undefined ? String(entry.label ?? entry.sessionId) : nameEntry[0],
                  description: entry.createdAt
                    ? `引用上下文 · ${new Date(Number(entry.createdAt)).toLocaleDateString('zh-CN')}`
                    : '引用会话上下文',
                }
              })
          } catch {
            return []
          }
        },
        warm(session) {
          fetchRoster(session.sessionId).catch(() => {})
        },
        onPick({ candidate, session }) {
          const names = byName.get(session.sessionId)
          const entry = names === undefined ? undefined : names.get(candidate.name)
          if (entry === undefined) return undefined
          const label = String(entry.label ?? entry.sessionId)
          return {
            insert: {
              source: '会话',
              ref: String(entry.sessionId),
              label,
              clipboardText: sessionMentionMarkdown(label, entry.sessionId),
            },
          }
        },
        codec: {
          clipboardText(ref) {
            const id = String(ref)
            return sessionMentionMarkdown(labelOf.get(id) ?? id, id)
          },
          serialize(ref) {
            const id = String(ref)
            return Promise.resolve(sessionMentionMarkdown(labelOf.get(id) ?? id, id))
          },
        },
      }

      ctx.on('connection/reset', clearAll)
      window.addEventListener('dsh-desktop:agent-idle', clearAll)
      return {
        register: () => inputTriggers.registerSource(source),
        dispose: () => {
          clearAll()
          window.removeEventListener('dsh-desktop:agent-idle', clearAll)
        },
      }
    }

    const inject = ['slots', 'connection']

    function apply(ctx) {
      const connection = ctx.get('connection')
      // Widen the settings panel so wide surfaces (365-day heatmap, tables)
      // fit without scrollbars. Overrides the shell's 800px default.
      let panelStyle = document.getElementById('dsh-desktop-ui-overrides')
      if (panelStyle === null) {
        panelStyle = document.createElement('style')
        panelStyle.id = 'dsh-desktop-ui-overrides'
        panelStyle.textContent = '.VOzbGW_panel{width:1240px !important;max-width:calc(100vw - 48px) !important;height:min(960px,100vh - 24px) !important}'
          + '._8HJdBW_cubeRow{display:flex !important;gap:6px !important;flex-wrap:wrap}'
          + '._8HJdBW_themeCube{flex:0 1 auto !important;flex-direction:row !important;padding:6px 14px !important;border-radius:999px !important;font-size:13px !important;line-height:18px !important;gap:6px !important;justify-content:center !important;align-items:center !important}'
        document.head.appendChild(panelStyle)
      }

      // Custom nav icons for the desktop-owned sections (the shell hardcodes
      // icons by section id; unknown ids all fall back to the settings gear).
      const NAV_ICONS = {
        用量: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.5 13.5v-5M8 13.5V2.5M13.5 13.5v-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        归档管理: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5h13v10h-13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.5 3.5v-2h5v2M1.5 6.5h13" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
        全局约束规则: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.5L12.5 4.5v10H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 1.5v3h3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 9.4l1.2 1.2 2.6-2.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        扩展: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M9.5 4V1.5h-3V4M6.5 8h3M8 8v6.5M3.5 5.5h9V7.5h-9z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        看图工具: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.5 8s2.2-4.5 6.5-4.5S14.5 8 14.5 8s-2.2 4.5-6.5 4.5S1.5 8 1.5 8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/></svg>',
        应用: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="8.5" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M6 13.5h4M8 11.5v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      }
      let iconTimer = null
      const applyNavIcons = () => {
        const cells = document.querySelectorAll('.VOzbGW_navCell')
        for (const cell of cells) {
          const label = cell.querySelector('.VOzbGW_navLabel')?.textContent?.trim() ?? ''
          const svg = NAV_ICONS[label]
          if (svg === undefined) continue
          const holder = cell.querySelector('.VOzbGW_navIcon')
          if (holder && holder.innerHTML !== svg) holder.innerHTML = svg
        }
      }
      const scheduleNavIcons = () => {
        if (iconTimer !== null) return
        iconTimer = setTimeout(() => {
          iconTimer = null
          applyNavIcons()
        }, 150)
      }
      const navObserver = new MutationObserver(scheduleNavIcons)
      navObserver.observe(document.body, { childList: true, subtree: true })
      scheduleNavIcons()
      const unwrap = (r) => {
        if (r && r.ok) return r.value ?? {}
        return { ok: false, error: (r && r.error && (r.error.message || r.error.code)) || 'RPC 失败' }
      }
      const gateway = {
        load: () => connection.rpc.call('/api', 'globalInstructions/load', { args: {} }).then(unwrap),
        save: (text) => connection.rpc.call('/api', 'globalInstructions/save', { args: { text } }).then(unwrap),
        balance: () => connection.rpc.call('/api', 'globalInstructions/balance', { args: {} }).then(unwrap),
        usage: (refresh = false) => connection.rpc.call('/api', 'globalInstructions/usage', { args: { refresh } }).then(unwrap),
        promptHistory: (limit = 50, sessionId) => connection.rpc.call('/api', 'globalInstructions/promptHistory', { args: { limit, sessionId } }).then(unwrap),
        desktopConfig: () => connection.rpc.call('/api', 'globalInstructions/desktopConfig', { args: {} }).then(unwrap),
        saveDesktopConfig: (patch) => connection.rpc.call('/api', 'globalInstructions/saveDesktopConfig', { args: { patch } }).then(unwrap),
        desktopAction: (action, path) => connection.rpc.call('/api', 'globalInstructions/desktopAction', { args: { action, path } }).then(unwrap),
        storageUsage: () => connection.rpc.call('/api', 'globalInstructions/storageUsage', { args: {} }).then(unwrap),
        unarchiveSession: (sessionId) => connection.rpc.call('/api', 'globalInstructions/unarchiveSession', { args: { sessionId } }).then(unwrap),
        deleteSessions: (sessionIds) => connection.rpc.call('/api', 'globalInstructions/deleteSessions', { args: { sessionIds } }).then(unwrap),
        // Re-pull the client session baseline (single-flight, drops entries
        // the Host no longer serves). Archive-management deletes use this so
        // deleted cold sessions vanish from the sidebar instead of ghosting
        // into the ungrouped bucket.
        refreshSessions: () => {
          const sessions = ctx.get('sessions')
          if (sessions === undefined || typeof sessions.refresh !== 'function') return Promise.resolve()
          return Promise.resolve(sessions.refresh()).catch(() => {})
        },
        listSessionCandidates: (sessionId, query, limit) => connection.rpc.call('/api', 'globalInstructions/listSessionCandidates', { args: { sessionId, query, limit } }).then(unwrap),
        listSkills: () => connection.rpc.call('/api', 'globalInstructions/listSkills', { args: {} }).then(unwrap),
        listMcpServers: () => connection.rpc.call('/api', 'globalInstructions/listMcpServers', { args: {} }).then(unwrap),
        mcpTemplates: () => connection.rpc.call('/api', 'globalInstructions/mcpTemplates', { args: {} }).then(unwrap),
        addMcpServer: (input) => connection.rpc.call('/api', 'globalInstructions/addMcpServer', { args: { input } }).then(unwrap),
        toggleMcpServer: (entryId, enabled) => connection.rpc.call('/api', 'globalInstructions/toggleMcpServer', { args: { entryId, enabled } }).then(unwrap),
        removeMcpServer: (entryId) => connection.rpc.call('/api', 'globalInstructions/removeMcpServer', { args: { entryId } }).then(unwrap),
        skillTemplates: () => connection.rpc.call('/api', 'globalInstructions/skillTemplates', { args: {} }).then(unwrap),
        createSkill: (input) => connection.rpc.call('/api', 'globalInstructions/createSkill', { args: { input } }).then(unwrap),
        toggleSkill: (name, enabled) => connection.rpc.call('/api', 'globalInstructions/toggleSkill', { args: { name, enabled } }).then(unwrap),
        removeSkill: (name) => connection.rpc.call('/api', 'globalInstructions/removeSkill', { args: { name } }).then(unwrap),
        visionConfig: () => connection.rpc.call('/api', 'globalInstructions/visionConfig', { args: {} }).then(unwrap),
        saveVisionConfig: (input) => connection.rpc.call('/api', 'globalInstructions/saveVisionConfig', { args: { input } }).then(unwrap),
        saveUploadFile: (input) => connection.rpc.call('/api', 'globalInstructions/saveUploadFile', { args: { input } }).then(unwrap),
        copyFolderUpload: (input) => connection.rpc.call('/api', 'globalInstructions/copyFolderUpload', { args: { input } }).then(unwrap),
        pickFolderNative: () => connection.rpc.call('/api', 'globalInstructions/pickFolderNative', { args: {} }).then(unwrap),
        resolvePickFolder: (input) => connection.rpc.call('/api', 'globalInstructions/resolvePickFolder', { args: { input } }).then(unwrap),
        getFileIcon: (input) => connection.rpc.call('/api', 'globalInstructions/getFileIcon', { args: { input } }).then(unwrap),
        resolveFileIcon: (input) => connection.rpc.call('/api', 'globalInstructions/resolveFileIcon', { args: { input } }).then(unwrap),
      }

      // Binary attachments (paste/drop/menu) get persisted into the owning
      // session's folder ($DSH_HOME/sessions/<project>/<sessionId>/uploads/)
      // so they disappear with the session; the conversation serializer calls
      // this hook before sending. Returns { path, shortPath } or null.
      window.__DSH_SAVE_UPLOAD__ = async (file, sessionId) => {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer())
          let binary = ''
          const CHUNK = 0x8000
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
          }
          const result = await gateway.saveUploadFile({ name: file.name, data: btoa(binary), sessionId: String(sessionId ?? '') })
          if (result && result.ok === true && typeof result.path === 'string') return { path: result.path, shortPath: result.shortPath ?? result.path }
          return null
        } catch {
          return null
        }
      }

      // Native folder-pick answer bridge: the Electron shell injects the
      // dialog result into the page; forward it to the host pending request.
      window.__DSH_PICK_FOLDER_RESULT__ = (payload) => {
        try {
          void gateway.resolvePickFolder({ requestId: payload?.requestId, path: payload?.path ?? '' })
        } catch {
          /* bridge gone: host request times out on its own */
        }
      }

      // macOS file/folder icon bridge for message attachment cards, with a
      // per-path cache and in-flight dedupe (historical messages re-render
      // often; icons must not refetch every time).
      window.__DSH_FILE_ICON_RESULT__ = (payload) => {
        try {
          void gateway.resolveFileIcon({ requestId: payload?.requestId, dataUrl: payload?.dataUrl ?? '' })
        } catch {
          /* bridge gone: host request times out on its own */
        }
      }
      const _fileIconCache = new Map()
      const _fileIconInFlight = new Map()
      window.__DSH_GET_FILE_ICON__ = (filePath) => {
        if (typeof filePath !== 'string' || filePath === '') return Promise.resolve(null)
        const hit = _fileIconCache.get(filePath)
        if (hit !== undefined) return Promise.resolve(hit)
        const flying = _fileIconInFlight.get(filePath)
        if (flying !== undefined) return flying
        const pending = gateway.getFileIcon({ path: filePath }).then((r) => {
          const dataUrl = r && r.ok === true && typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:image') ? r.dataUrl : null
          _fileIconCache.set(filePath, dataUrl)
          _fileIconInFlight.delete(filePath)
          return dataUrl
        }).catch(() => {
          _fileIconCache.set(filePath, null)
          _fileIconInFlight.delete(filePath)
          return null
        })
        _fileIconInFlight.set(filePath, pending)
        return pending
      }

      // Small visible toast for upload errors (the shell has no toast seat
      // for this plugin, so it renders its own DOM overlay).
      const _uploadToast = (text) => {
        const el = document.createElement('div')
        el.textContent = text
        el.style.cssText = 'position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:#2a2f3a;color:#e8eaf0;border:1px solid rgba(140,150,170,0.35);border-radius:10px;padding:10px 18px;font-size:13px;z-index:2147483000;box-shadow:0 8px 28px rgba(0,0,0,0.45);max-width:min(70vw,520px);'
        document.body.appendChild(el)
        setTimeout(() => {
          el.style.transition = 'opacity 0.3s'
          el.style.opacity = '0'
          setTimeout(() => el.remove(), 320)
        }, 3600)
      }

      // — 统计行单位文案：tok → token ----------------------------------------
      // The shell's stats line abbreviates the unit to "tok" ("输入 3.2m tok
      // · 输出 45k tok"). Override the conversation namespace dictionaries so
      // it reads "token"; re-applied on every locale revision bump so a late
      // dictionary registration is picked up.
      const STATS_UNIT_PATCH = {
        zh: {
          'stats.tokens': '输入 {input} token · 输出 {output} token',
          'stats.tokensPerSecond': '{throughput} token/s',
        },
        en: {
          'stats.tokens': 'Input {input} token · Output {output} token',
          'stats.tokensPerSecond': '{throughput} token/s',
        },
      }
      const locale = ctx.get('locale')
      if (locale !== undefined && locale.dicts instanceof Map && typeof locale.subscribe === 'function') {
        const patchStatsUnits = () => {
          const entries = locale.dicts.get('conversation')
          if (entries === undefined) return
          for (const [localeId, patch] of Object.entries(STATS_UNIT_PATCH)) {
            const dict = entries.get(localeId)
            if (dict === undefined) continue
            for (const [key, value] of Object.entries(patch)) {
              if (key in dict) dict[key] = value
            }
          }
        }
        ctx.effect(() => {
          patchStatsUnits()
          const unsubscribe = locale.subscribe(patchStatsUnits)
          return () => unsubscribe()
        }, 'dsh-desktop: stats unit labels')
      }

      // — 任务完成即刷新（所有浏览器，含手机直连）-----------------------------
      // The Electron shell forwards agent-idle into its own window only; a
      // plain browser (phone on the LAN) has no shell. Watch the conversation
      // status row ("Deep diving…", role=status) instead: when the last open
      // turn closes, the row unmounts — that is the task-completed moment.
      // Debounced, so the usage panel and balance chip refresh once per
      // finished task in every browser.
      ctx.effect(() => {
        let lastHadStatus = document.querySelector('div[role="status"]') !== null
        let doneTimer = null
        const observer = new MutationObserver(() => {
          const has = document.querySelector('div[role="status"]') !== null
          if (lastHadStatus && !has) {
            if (doneTimer !== null) clearTimeout(doneTimer)
            doneTimer = setTimeout(() => {
              doneTimer = null
              window.dispatchEvent(new CustomEvent('dsh-desktop:agent-idle'))
            }, 600)
          }
          lastHadStatus = has
        })
        observer.observe(document.body, { childList: true, subtree: true })
        return () => {
          if (doneTimer !== null) clearTimeout(doneTimer)
          observer.disconnect()
        }
      }, 'dsh-desktop: task-done observer')

      // — ESC 停止当前任务 + 编辑按钮 -------------------------------------------
      // Global edit-after-cancel store: UserMessageNodeView (in node_modules)
      // subscribes to this via useSyncExternalStore to reactively show a pencil
      // icon on the last user message after the user presses ESC.
      let _editListeners = new Set()
      let _editSnapshot = null
      window.__dshEditStore = {
        subscribe(fn) {
          _editListeners.add(fn)
          return () => _editListeners.delete(fn)
        },
        getSnapshot() { return _editSnapshot },
      }
      function _setEditSnapshot(next) {
        _editSnapshot = next
        for (const fn of _editListeners) fn()
      }

      // In-place editor bridges: the conversation's UserMessageNodeView
      // renders the textarea + 取消/发送 buttons; these handlers execute
      // the outcome and clear the edit state.
      window.__dshEditSend__ = (text) => {
        _setEditSnapshot(null)
        const value = String(text ?? '').trim()
        if (value === '') return
        const ia = window.__dshInputActions
        if (ia && typeof ia.setDraft === 'function' && typeof ia.submit === 'function') {
          ia.setDraft(value)
          focusComposerAtEnd()
          ia.submit()
        } else {
          const textarea = document.querySelector('[data-composer-card] textarea')
          if (!(textarea instanceof HTMLTextAreaElement)) return
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
          if (nativeSetter) nativeSetter.call(textarea, value)
          else textarea.value = value
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
      window.__dshEditCancel__ = () => {
        _setEditSnapshot(null)
      }

      // Find the last user message key in the chat DOM so we can tell
      // UserMessageNodeView which row should show the edit button.
      function _findLastUserMessageKey() {
        const rows = document.querySelectorAll('[data-chat-flow-kind="user"]')
        if (rows.length === 0) return null
        return rows[rows.length - 1].dataset.chatFlowKey ?? null
      }

      // Find the text content of the last user message from the DOM bubble.
      function _findLastUserMessageText() {
        const rows = document.querySelectorAll('[data-chat-flow-kind="user"]')
        if (rows.length === 0) return ''
        const row = rows[rows.length - 1]
        const bubble = row.querySelector('[class*="bubble"]')
        if (bubble) return bubble.textContent ?? ''
        return row.textContent ?? ''
      }

      // ESC keydown handler: cancel the running task and show edit button on
      // the last user message.
      function _onEscKeydown(e) {
        if (e.key !== 'Escape' || e.defaultPrevented) return
        // Don't intercept ESC in input fields (e.g. closing a dropdown)
        // unless the agent is running (then we want to cancel).
        const statusEl = document.querySelector('div[role="status"]')
        if (statusEl === null) return // agent not running
        e.preventDefault()
        e.stopPropagation()
        // Click the stop button (already wired to the correct cancel function)
        const stopBtn = document.querySelector('button[aria-label="停止生成"], button[aria-label="Stop generating"]')
        if (stopBtn) {
          stopBtn.click()
        }
        // Activate edit button on the last user message after a short delay
        // (let the cancel settle).
        setTimeout(() => {
          const key = _findLastUserMessageKey()
          if (key === null) return
          _setEditSnapshot({
            lastUserKey: key,
            editing: null,
            onEdit: (text) => {
              // Switch the row into in-place editing mode; the conversation
              // package renders the textarea and 取消/发送 buttons.
              const editText = text || _findLastUserMessageText()
              _setEditSnapshot({
                lastUserKey: key,
                editing: { key, initialText: editText },
                onEdit: null,
              })
            },
          })
          // Auto-clear edit state when the agent starts running again.
          const clearOnRun = () => {
            _setEditSnapshot(null)
            observer2.disconnect()
          }
          const observer2 = new MutationObserver(() => {
            if (document.querySelector('div[role="status"]') !== null) clearOnRun()
          })
          observer2.observe(document.body, { childList: true, subtree: true })
        }, 300)
      }
      document.addEventListener('keydown', _onEscKeydown, { capture: true })

      ctx.effect(() => {
        return () => {
          document.removeEventListener('keydown', _onEscKeydown, { capture: true })
          _setEditSnapshot(null)
          delete window.__dshEditStore
          delete window.__dshEditSend__
          delete window.__dshEditCancel__
        }
      }, 'dsh-desktop: esc-cancel-edit')

      // — @会话 mention source (Codex-style cross-session references) ---------
      // Mirrors the slash-skill pipeline: typing '@' opens the trigger menu;
      // this source feeds it the user's other sessions, a pick inserts a chip
      // labeled with the session title, and submit serializes the chip to a
      // canonical `@[label](dsh-session:...)` mention that the host boundary
      // resolves into the referenced session's snapshot.
      const mentionSource = buildSessionMentionSource(ctx, gateway)
      if (mentionSource !== undefined) {
        ctx.effect(() => {
          const unregister = mentionSource.register()
          return () => {
            unregister()
            mentionSource.dispose()
          }
        }, 'dsh-desktop: @会话 source')
      }

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'global-instructions',
            order: 25,
            label: () => '全局约束规则',
            inject: () => ({ gateway }),
          },
          GlobalInstructionsSection,
        ),
      )
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'usage',
            order: 15,
            label: () => '用量',
            inject: () => ({ gateway }),
          },
          UsageSection,
        ),
      )
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'archives',
            order: 30,
            label: () => '归档管理',
            inject: () => ({ gateway }),
          },
          ArchivesSection,
        ),
      )
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'app',
            order: 45,
            label: () => '应用',
            inject: () => ({ gateway }),
          },
          DesktopSection,
        ),
      )
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'vision',
            order: 33,
            label: () => '看图工具',
            inject: () => ({ gateway }),
          },
          VisionBlock,
        ),
      )
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'extensions',
            order: 35,
            label: () => '扩展',
            inject: () => ({ gateway }),
          },
          ExtensionsSection,
        ),
      )
      ctx.slots.inject('conversation.session.header.utilities', () =>
        ctx.slots.register(
          {
            name: 'conversation.session.header.utilities',
            id: 'balance',
            order: 100,
            inject: () => ({ gateway }),
          },
          BalanceChip,
        ),
      )
      // Invisible current-session tracker for folder upload (renders null).
      ctx.slots.inject('conversation.session.header.utilities', () =>
        ctx.slots.register(
          {
            name: 'conversation.session.header.utilities',
            id: 'session-id-tracker',
            order: -100,
            inject: () => ({}),
          },
          SessionIdTracker,
        ),
      )
      // 历史 Prompt 时间轴：一条 prompt 一根小杠，悬停预览、点击填入。
      // Rendered as a fixed rail pinned to the conversation pane's left gutter
      // (Codex-style); the header slot is only the in-session anchor that
      // provides useInput/inputActions.
      ctx.slots.inject('conversation.session.header.utilities', () =>
        ctx.slots.register(
          {
            name: 'conversation.session.header.utilities',
            id: 'prompt-history',
            order: 90,
            inject: () => ({ gateway }),
          },
          PromptHistoryRail,
        ),
      )
      ctx.slots.inject('conversation.composer.dock', () =>
        ctx.slots.register(
          {
            name: 'conversation.composer.dock',
            id: 'stats-style',
            order: -10,
            inject: () => ({ gateway }),
          },
          StatsStyleChip,
        ),
      )
      // 高峰 / 非高峰时段提示：挂在输入卡底部工具行（uV2eYG_row）的 right
      // 席位，组件绝对定位在行中央（行级 position:relative 由注入样式提供），
      // 字号与行内其他控件一致（13px / 500 / 20px）。
      ctx.slots.inject('conversation.input.right', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.right',
            id: 'price-hours',
            order: 90,
          },
          PriceHoursHint,
        ),
      )
      // Take the named model seat: the whale rheostat replaces the shell's
      // model trigger and drives model + reasoning-effort selection through
      // the same session.selectModel wire the shell uses.
      ctx.slots.inject('conversation.input.model', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.model',
            id: 'model-rheostat',
            // single-seat election renders the LOWEST priority; the shell
            // occupies priority 0, so go below it to take the seat.
            priority: -10,
            inject: () => ({ connection, gateway }),
          },
          ModelRheostat,
        ),
      )


      // --- File / folder upload: inject into the "+" command menu ---
      // The command menu has class _3e4SsG_menu (from dsh-client-ui-input-trigger).
      // Watch for it to appear and inject upload items at the top of its viewport.
      const _fileInput = document.createElement('input')
      _fileInput.type = 'file'
      _fileInput.multiple = true
      _fileInput.style.display = 'none'
      document.body.appendChild(_fileInput)

      function _deliverFiles(files) {
        if (typeof window.__DSH_ADD_FILES__ === 'function') {
          window.__DSH_ADD_FILES__(files)
          return true
        }
        return false
      }

      function _triggerFileInput(input) {
        input.onchange = () => {
          if (!input.files || input.files.length === 0) return
          const files = Array.from(input.files)
          if (_deliverFiles(files)) {
            input.value = ''
            return
          }
          // The composer may still be mounting: retry for up to ~5s.
          let attempts = 0
          const timer = setInterval(() => {
            attempts += 1
            if (_deliverFiles(files) || attempts > 20) {
              clearInterval(timer)
              input.value = ''
            }
          }, 250)
        }
        input.click()
      }

      // Folder upload: Electron main-process native dialog (no TCC
      // automation permission needed); the host copies the WHOLE folder into
      // the session's uploads directory and the composer receives one
      // folder-attachment placeholder File carrying the saved path.
      function _triggerFolderUpload() {
        void (async () => {
          try {
            const picked = await gateway.pickFolderNative()
            if (!picked || picked.ok !== true) {
              _uploadToast(`文件夹选择失败：${String(picked?.error ?? '未知错误')}`)
              return
            }
            const dir = picked.path
            if (typeof dir !== 'string' || dir === '') return // 用户取消
            const sessionId = String(window.__dshCurrentSessionId__ ?? '')
            const result = await gateway.copyFolderUpload({ path: dir, sessionId })
            if (!result || result.ok !== true) {
              _uploadToast(`上传文件夹失败：${String(result?.error ?? '未知错误')}`)
              return
            }
            if ((result.files ?? 0) === 0) {
              _uploadToast('该文件夹没有可上传的文件')
              return
            }
            const folderFile = new File([''], result.name || 'folder', { type: 'application/x-directory' })
            try {
              Object.defineProperty(folderFile, '__dshFolderPath', { value: result.path, writable: false })
              Object.defineProperty(folderFile, '__dshFolderShortPath', { value: result.shortPath ?? result.path, writable: false })
              Object.defineProperty(folderFile, '__dshFolderStats', { value: { files: result.files ?? 0, totalBytes: result.totalBytes ?? 0 }, writable: false })
            } catch {
              /* properties already set: placeholder unusable */
            }
            if (!_deliverFiles([folderFile])) {
              let attempts = 0
              const timer = setInterval(() => {
                attempts += 1
                if (_deliverFiles([folderFile]) || attempts > 20) clearInterval(timer)
              }, 250)
            } else if (result.truncated) {
              _uploadToast('文件夹较大，仅复制了部分内容（上限 2000 个文件 / 总计 200MB）')
            }
          } catch (err) {
            _uploadToast(`文件夹上传失败：${String(err?.message ?? err)}`)
          }
        })()
      }

      // — Upload-only "+" menu -------------------------------------------------
      // Reuses the shell's menu visual classes so it looks native, but shows
      // only 上传文件 / 上传文件夹 (no command category — those stay under "/").
      let _uploadMenuEl = null
      const _closeUploadMenu = () => {
        if (_uploadMenuEl === null) return
        _uploadMenuEl.remove()
        _uploadMenuEl = null
        document.removeEventListener('pointerdown', _onUploadMenuPointerDown, true)
        document.removeEventListener('keydown', _onUploadMenuKeydown, true)
      }
      const _onUploadMenuPointerDown = (ev) => {
        if (!(ev.target instanceof Node)) return
        if (_uploadMenuEl?.contains(ev.target)) return
        _closeUploadMenu()
      }
      const _onUploadMenuKeydown = (ev) => {
        if (ev.key === 'Escape') _closeUploadMenu()
      }

      const _UPLOAD_FILE_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1v9M3.5 6.5L7 10l3.5-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10.5v1.5h10v-1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      const _UPLOAD_FOLDER_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1.5 3.5h4l1.5 2h5.5v7h-11z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 8v3M6.5 9.5H3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>'

      function _openUploadMenu() {
        if (_uploadMenuEl !== null) {
          _closeUploadMenu()
          return
        }
        const anchor = document.querySelector('button[aria-label="命令"], button[aria-label="Commands"]')
        if (!(anchor instanceof HTMLElement)) return
        const rect = anchor.getBoundingClientRect()
        const menu = document.createElement('div')
        menu.className = '_3e4SsG_menu'
        menu.setAttribute('role', 'listbox')
        menu.setAttribute('aria-label', '上传')
        menu.style.position = 'fixed'
        menu.style.left = `${Math.round(rect.left)}px`
        menu.style.bottom = `${Math.round(window.innerHeight - rect.top + 4)}px`
        menu.style.zIndex = '1000'

        const makeItem = (label, iconSvg, onClick) => {
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = '_3e4SsG_item'
          btn.setAttribute('role', 'option')
          btn.innerHTML = `<span class="_3e4SsG_itemIcon" aria-hidden="true">${iconSvg}</span><span class="_3e4SsG_itemName">${label}</span>`
          btn.addEventListener('mousedown', (e) => {
            e.preventDefault()
            e.stopPropagation()
          })
          btn.addEventListener('click', (e) => {
            e.stopPropagation()
            _closeUploadMenu()
            onClick()
          })
          return btn
        }
        menu.appendChild(makeItem('上传文件', _UPLOAD_FILE_ICON, () => _triggerFileInput(_fileInput)))
        menu.appendChild(makeItem('上传文件夹', _UPLOAD_FOLDER_ICON, () => _triggerFolderUpload()))
        document.body.appendChild(menu)
        _uploadMenuEl = menu
        document.addEventListener('pointerdown', _onUploadMenuPointerDown, true)
        document.addEventListener('keydown', _onUploadMenuKeydown, true)
      }
      // The composer "+" button prefers this bridge over the command menu.
      window.__DSH_OPEN_UPLOAD_MENU__ = _openUploadMenu
      ctx.effect(() => {
        return () => {
          _closeUploadMenu()
          if (window.__DSH_OPEN_UPLOAD_MENU__ === _openUploadMenu) delete window.__DSH_OPEN_UPLOAD_MENU__
          delete window.__DSH_PICK_FOLDER_RESULT__
          delete window.__DSH_FILE_ICON_RESULT__
          delete window.__DSH_GET_FILE_ICON__
        }
      }, 'dsh-desktop: upload-only plus menu')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
