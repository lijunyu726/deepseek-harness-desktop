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

    function cwdLabel(cwd) {
      if (typeof cwd !== 'string' || cwd.length === 0) return '—'
      const parts = cwd.split('/').filter(Boolean)
      return parts.length > 0 ? parts[parts.length - 1] : cwd
    }

    /**
     * 设置 → 归档管理：列出注册表级归档集合中的会话并提供「取消归档」。
     * 列表数据全部来自标准 hook（useWorkspaces 的 archivedSessionIds +
     * useSessions 的会话行），取消归档走 host remote；成功后宿主流会推送
     * host/archived-sessions-changed，列表与侧边栏自动恢复，无需刷新。
     */
    function ArchivesSection({ gateway, useSessions, useWorkspaces }) {
      const [notice, setNotice] = react.useState({ text: '', kind: '' })
      const [busyId, setBusyId] = react.useState(null)
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
        if (busyId !== null) return
        setBusyId(id)
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

      return react.createElement(
        'div',
        { style: SEC_WRAP },
        react.createElement(
          'div',
          { style: ARCH_HINT },
          '已归档的会话会从侧边栏分组视图中隐藏，但会话日志与工作区记账都完整保留。取消归档后，会话会回到它原来的分组位置。',
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
          'table',
          { style: { ...TABLE, marginTop: '6px' } },
          react.createElement(
            'thead',
            null,
            react.createElement(
              'tr',
              null,
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
                react.createElement('td', { style: TD, title: row.id }, row.title.slice(0, 48)),
                react.createElement('td', { style: TD, title: row.cwd ?? '' }, cwdLabel(row.cwd)),
                react.createElement('td', { style: TD }, fmtDay(row.updatedAt)),
                react.createElement('td', { style: TD },
                  react.createElement('button', {
                    style: SMALL_BTN,
                    disabled: busyId !== null,
                    onClick: () => unarchive(row.id),
                  }, busyId === row.id ? '处理中…' : '取消归档'),
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

    function BalanceChip({ gateway }) {
      const [state, setState] = react.useState({ loading: true, infos: null, error: '' })
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
          style: CHIP,
          title,
          onClick: openRecharge,
        },
        react.createElement('span', null, '余额'),
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
                  ? { text: '局域网访问已开启 ✓（手机访问根地址，自动适配手机）', kind: 'ok' }
                  : want
                    ? { text: '服务重启失败，请重试', kind: 'err' }
                    : { text: '局域网访问已关闭', kind: 'ok' })
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
            react.createElement('span', { style: { fontWeight: 600 } }, '局域网访问（手机端）'),
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
                  setNotice({ text: '正在重启服务以应用局域网设置…', kind: 'ok' })
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
            src: lan.qr, alt: '局域网访问二维码', width: 172, height: 172,
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
          '正在重启服务以应用局域网设置，请稍候…',
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

    // — 历史 Prompt -----------------------------------------------------------
    // Accepted user prompts are recorded by the host at agent/pre-step. This
    // button reads that shared history and restores entries through the
    // conversation input machine's public setDraft action, so desktop and
    // mobile use the same data and preserve input-machine invariants.

    const PROMPT_HISTORY_CSS = [
      // Bare timeline rail: ticks only, no pill shell. z-index stays below
      // the shell's overlay layer (settings panel = 1000), so the rail never
      // floats above settings or other panels.
      '.dsh-prompt-rail { position: fixed; z-index: 12; display: flex; flex-direction: column; align-items: center; gap: 0; padding: 2px 0; background: none; border: none; max-height: 56vh !important; overflow-y: auto !important; scrollbar-width: none; }',
      '.dsh-prompt-rail::-webkit-scrollbar { display: none; }',
      // Visual bar 10x2.5px; the padding gives every tick a generous
      // invisible hit area (~14x12.5px) so selection doesn't need pixel aim.
      '.dsh-prompt-rail-tick { display: block; box-sizing: border-box; width: 14px; height: 12.5px; padding: 5px 2px; background-clip: content-box; background-color: rgba(190,200,220,0.4); border-radius: 999px; cursor: pointer; transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.16s ease, opacity 0.16s ease; }',
      '.dsh-prompt-rail-tick:hover { background-color: rgba(255,255,255,0.95); }',
      '.dsh-prompt-rail-pop { position: fixed; z-index: 13; width: min(340px, calc(100vw - 90px)); max-height: 260px; display: flex; flex-direction: column; border: 1px solid rgba(128,140,160,0.34); border-radius: 10px; background: rgba(18,21,30,0.97); box-shadow: 0 12px 36px rgba(0,0,0,0.5); backdrop-filter: blur(16px); animation: dsh-prompt-rail-pop-in 0.14s ease-out; }',
      '.dsh-prompt-rail-pop::before { content: ""; position: absolute; left: -6px; top: 16px; width: 12px; height: 12px; background: rgba(18,21,30,0.97); border-left: 1px solid rgba(128,140,160,0.34); border-bottom: 1px solid rgba(128,140,160,0.34); transform: rotate(45deg); }',
      '@keyframes dsh-prompt-rail-pop-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }',
      '.dsh-prompt-rail-pop-head { display: flex; justify-content: space-between; gap: 10px; padding: 9px 12px 7px; border-bottom: 1px solid rgba(128,140,160,0.16); font-size: 10.5px; color: rgba(220,225,238,0.6); }',
      '.dsh-prompt-rail-pop-text { overflow: auto; padding: 9px 12px 11px; font-size: 12px; line-height: 1.55; color: rgba(243,245,250,0.94); white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }',
      '@media (max-width:700px) { .dsh-prompt-rail { padding: 2px 0; } .dsh-prompt-rail-tick { width: 12px; height: 11px; padding: 4px 2px; } }',
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

    function PromptHistoryRail({ useInput, inputActions, gateway }) {
      const input = typeof useInput === 'function' ? useInput((state) => state) : null
      const [items, setItems] = react.useState([])
      const [mouseY, setMouseY] = react.useState(null)
      const [paneLeft, setPaneLeft] = react.useState(null)
      const itemsRef = react.useRef(items)
      const inputRef = react.useRef(input)
      const leaveTimerRef = react.useRef(null)
      const railRef = react.useRef(null)
      const measureRef = react.useRef({ firstTop: 0, step: 9.5 })
      itemsRef.current = items
      inputRef.current = input

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
        let step = 9.5
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

      const load = react.useCallback(() => gateway.promptHistory(100).then((result) => {
        const next = result && result.ok && Array.isArray(result.items) ? result.items : []
        setItems(next)
        itemsRef.current = next
        return next
      }).catch(() => []), [gateway])

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
          let left = cardRect.left - 24
          while (el) {
            const r = el.getBoundingClientRect()
            if (r.width > cardRect.width + 300 && r.left > 0) {
              left = r.left + 6
              break
            }
            el = el.parentElement
          }
          setPaneLeft(left)
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
      // Continuous fisheye: the nearest tick to the cursor is the active one,
      // and every tick scales by its PIXEL distance from the cursor (clamped
      // at the default length, so far ticks never shrink below normal).
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
        left: Math.min(paneLeft + 26, window.innerWidth - 356),
        top: Math.min(Math.max(measure.firstTop + hovered * measure.step - 26, 70), Math.max(70, window.innerHeight - 300)),
      }
      const entry = hovered !== null ? items[hovered] : null
      const tickStyle = (index) => {
        if (mouseY === null) return null
        const distance = Math.abs(measure.firstTop + index * measure.step - mouseY)
        // Wide symmetric dome: the bulge spans ~±2-3 ticks around the cursor,
        // so the column reads as one regular swell instead of a lone long bar.
        const scale = Math.min(1.5, Math.max(1, 1.5 - distance * 0.02))
        const opacity = Math.min(1, Math.max(0.6, 1 - distance * 0.008))
        return { transform: `scaleX(${scale})`, opacity }
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
          items.map((item, index) => react.createElement('span', {
            key: index,
            className: 'dsh-prompt-rail-tick',
            role: 'option',
            'aria-selected': index === hovered,
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
            onMouseEnter: cancelLeave,
            onMouseLeave: scheduleLeave,
          },
          react.createElement(
            'div',
            { className: 'dsh-prompt-rail-pop-head' },
            react.createElement('span', null, `历史 Prompt · ${hovered + 1}/${items.length}`),
            react.createElement('span', null, entry.createdAt ? new Date(entry.createdAt).toLocaleString('zh-CN') : ''),
          ),
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
      '.dsh-rheo-pop { position: absolute; right: 0; bottom: calc(100% + 10px); z-index: 30; width: 300px; padding: 12px 8px; border: 1px solid rgba(128,140,160,0.3); border-radius: 16px; background: rgba(18,21,30,0.97); box-shadow: 0 16px 44px rgba(0,0,0,0.45); backdrop-filter: blur(20px); animation: dsh-rheo-pop-in 0.16s ease-out; }',
      '@keyframes dsh-rheo-pop-in { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }',
      // 高级 accordion toggle (triangle rotates when expanded).
      '.dsh-rheo-adv-toggle { display: flex; align-items: center; gap: 6px; width: 100%; border: none; background: transparent; color: rgba(232,236,246,0.9); font: inherit; font-size: 12.5px; cursor: pointer; padding: 2px 6px 8px; text-align: left; }',
      '.dsh-rheo-adv-toggle:hover { color: #fff; }',
      '.dsh-rheo-adv-tri { display: inline-flex; color: rgba(220,225,238,0.55); transition: transform 0.15s ease; }',
      '.dsh-rheo-adv-toggle.open .dsh-rheo-adv-tri { transform: rotate(90deg); }',
      '.dsh-rheostat-track { position: relative; width: 100%; height: 44px !important; min-height: 44px !important; border-radius: 999px; background: rgba(128,140,160,0.15); border: 1px solid rgba(128,140,160,0.26); cursor: pointer; touch-action: none; user-select: none; overflow: hidden; transition: border-color 0.2s ease, box-shadow 0.2s ease; }',
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
      '.dsh-rheostat-whale { position: absolute; top: 50%; width: 36px !important; height: 28px !important; z-index: 3; pointer-events: auto; cursor: grab; transform: translate(-50%, -50%) scaleX(-1); transition: left 0.22s ease; filter: drop-shadow(0 2px 3px rgba(8,16,32,0.45)) drop-shadow(0 0 8px rgba(122,172,255,0.45)); }',
      '.dsh-rheostat-whale.dragging { cursor: grabbing; }',
      // Advanced mode: the original two-level model menu (models → efforts),
      // styled like the shell's native selector.
      '.dsh-rheo-adv { display: flex; flex-direction: column; gap: 2px; }',
      '.dsh-rheo-adv-cell { width: 100%; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: none; background: transparent; border-radius: 10px; color: var(--dsw-alias-label-primary, #F9FAFB); font: inherit; font-size: 14px; line-height: 22px; cursor: pointer; text-align: left; }',
      '.dsh-rheo-adv-cell:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128,140,160,0.16)); }',
      '.dsh-rheo-adv-cell-label { flex: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
      // Advanced mode: the original two-level model menu (model → effort),
      // Codex-style rows: label + current value + chevron, divider, section.
      '.dsh-rheo-adv-cell-value { flex: none; min-width: 0; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(220,225,238,0.55); }',
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
        return efforts.map((effort) => ({
          provider: group.id,
          model: model.id,
          effort: effort.id,
          modelName: model.name ?? model.id,
          effortName: effort.name ?? effort.id,
          modelLabel: model.name ?? model.id,
          sprite: 'pro-off',
          duration: 2.2,
        }))
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
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* pointer capture is best-effort */
        }
        draggingRef.current = true
        setDragging(true)
        select(stopFromEvent(e.clientX))
      }
      const onPointerMove = (e) => {
        if (!draggingRef.current) return
        select(stopFromEvent(e.clientX))
      }
      const onPointerUp = () => {
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
      const THUMB = 18 // half of the whale width; the whale IS the thumb
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
                style: { height: 44, minHeight: 44 },
                onPointerDown,
                onPointerMove,
                onPointerUp,
                onPointerCancel: onPointerUp,
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
        promptHistory: (limit = 50) => connection.rpc.call('/api', 'globalInstructions/promptHistory', { args: { limit } }).then(unwrap),
        desktopConfig: () => connection.rpc.call('/api', 'globalInstructions/desktopConfig', { args: {} }).then(unwrap),
        saveDesktopConfig: (patch) => connection.rpc.call('/api', 'globalInstructions/saveDesktopConfig', { args: { patch } }).then(unwrap),
        desktopAction: (action, path) => connection.rpc.call('/api', 'globalInstructions/desktopAction', { args: { action, path } }).then(unwrap),
        storageUsage: () => connection.rpc.call('/api', 'globalInstructions/storageUsage', { args: {} }).then(unwrap),
        unarchiveSession: (sessionId) => connection.rpc.call('/api', 'globalInstructions/unarchiveSession', { args: { sessionId } }).then(unwrap),
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
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
