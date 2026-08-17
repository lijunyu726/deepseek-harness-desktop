/**
 * @deepseek-ai/dsh-desktop-instructions — host half.
 *
 * A dedicated Typert remote (`globalInstructions`) that reads and writes the
 * dsh user-global instruction file `$DSH_HOME/AGENTS.md` — the file dsh
 * injects into every session (the Codex "custom instructions" equivalent).
 * The file is the single source of truth; the browser settings category
 * calls these two methods over the gateway (SRC reflection mode — no
 * typert-generated artifacts required).
 */

import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { homedir, networkInterfaces } from 'node:os'
import path from 'node:path'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { parse as parseYaml, stringify as yamlStringify } from 'yaml'
import SessionReferenceResolver, { parseSessionReferenceText } from '@deepseek-ai/dsh-session-reference'
import QRCode from 'qrcode'
import { fileURLToPath } from 'node:url'
import { registerMobileRoute } from './mobile.js'
import { registerWhaleSpriteRoutes } from './whale-sprites.js'

/** Real path of this module (symlink-resolved), used to locate app assets. */
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Prefix marker of the canonical session-mention URI (see dsh-session-reference). */
const SESSION_URI_PREFIX = 'dsh-session:'

export const name = 'desktop'

const MAX_CONTENT_BYTES = 256 * 1024

/** Parse the YAML frontmatter of a SKILL.md file; null when absent/malformed. */
function readSkillFrontmatter(file) {
  try {
    const text = readFileSync(file, 'utf8')
    if (!text.startsWith('---')) return null
    const end = text.indexOf('\n---', 3)
    if (end === -1) return null
    const parsed = parseYaml(text.slice(3, end))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** FiberState numeric enum → stable phase labels (mirrors the plugin inventory). */
const FIBER_PHASE = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: 'disposed',
  5: 'unloading',
}

/** Recursive directory size in bytes (bounded walk, no symlink follow). */
function dirSizeSync(dir) {
  let total = 0
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      try {
        if (entry.isDirectory()) stack.push(full)
        else if (entry.isFile()) total += lstatSync(full).size
      } catch {
        /* skip unreadable entries */
      }
    }
  }
  return total
}

/** Absolute path of the user-global instruction file. */
export function instructionsFilePath() {
  const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
  return path.join(home, 'AGENTS.md')
}

/**
 * Live LAN state for the settings surface: whether the config asks for LAN
 * access, whether the running web server is actually bound to all
 * interfaces, the reachable IPv4 URLs, and a QR data URL for the mobile
 * page on the first reachable address.
 */
/**
 * Usable phone-reachable IPv4 addresses on this machine: real LAN NICs and
 * Tailscale, but NOT virtual point-to-point tunnels (VPN/proxy TUN interfaces
 * like 198.18.x are unreachable from the phone and only confuse the list),
 * link-local (169.254.x), or loopback. Ranked: home/office LAN (RFC1918)
 * first, then Tailscale (100.64/10), then anything else.
 */
export function lanIpv4Addresses() {
  const seen = new Set()
  const out = []
  const rank = (parts) => {
    if (parts[0] === 192 && parts[1] === 168) return 0
    if (parts[0] === 10) return 0
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return 0
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return 1
    return 2
  }
  const unusable = (parts) => {
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true
    if (parts[0] === 169 && parts[1] === 254) return true
    if (parts[0] === 0 || parts[0] >= 224) return true
    return false
  }
  for (const infos of Object.values(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      const parts = info.address.split('.').map(Number)
      if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) continue
      if (unusable(parts) || seen.has(info.address)) continue
      seen.add(info.address)
      out.push(info.address)
    }
  }
  out.sort((a, b) => {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    return rank(pa) - rank(pb) || a.localeCompare(b)
  })
  return out
}

async function lanState(ctx, config) {
  const enabled = config.lanAccess === true
  const webServer = ctx.get('webServer')
  const bound = webServer !== undefined && webServer.host === '0.0.0.0'
  const port = webServer !== undefined && Number.isSafeInteger(webServer.port) ? webServer.port : null
  if (!enabled || !bound || port === null) {
    return { enabled, bound, port, urls: [], qr: null }
  }
  const urls = lanIpv4Addresses().map((address) => `http://${address}:${port}`)
  let qr = null
  if (urls.length > 0) {
    try {
      qr = await QRCode.toDataURL(`${urls[0]}`, {
        margin: 1,
        width: 240,
        color: { dark: '#000000', light: '#ffffff' },
      })
    } catch {
      /* QR is cosmetic; the URL text remains */
    }
  }
  return { enabled, bound, port, urls, qr }
}

function zeroTotals() {
  return {
    inputTokens: 0, outputTokens: 0, uncachedInputTokens: 0,
    cacheReadTokens: 0, cacheWriteTokens: 0, turns: 0, steps: 0, llmMs: 0, toolMs: 0,
  }
}

/** Local-timezone day key (usage panels read "today" in the user's zone). */
function localDayKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function zeroDays(dayMap) {
  const days = []
  for (let i = 364; i >= 0; i--) {
    const key = localDayKey(Date.now() - i * 86_400_000)
    const hit = dayMap.get(key)
    days.push(hit
      ? { day: key, inputTokens: hit.inputTokens, outputTokens: hit.outputTokens }
      : { day: key, inputTokens: 0, outputTokens: 0 })
  }
  return days
}

// — Per-day usage scan (durable session JSONL) -------------------------------
// Aggregates every `assistant/message` frame's usage by local calendar day.
// Electron's embedded Node (ELECTRON_RUN_AS_NODE) intermittently SIGTRAPs
// inside native zstd code on EVERY in-process decode path, so all
// decompression lives in a separate scanner child (assets/usage-scan.mjs).
//
// Two layers keep the settings panel fast:
//   1. The per-file scan cache (mtime+size+frameEnd+days) PERSISTS to
//      `$DSH_HOME/desktop/usage-scan-cache.json`, so an app restart never
//      rescans unchanged logs — the first usage view is instant.
//   2. Scans are INCREMENTAL: only frames appended after the cached frame
//      boundary are decoded (session logs are append-only zstd frame
//      streams), so refreshing while a conversation is active re-reads just
//      the new batches instead of the whole file.

/** mtime+size-keyed scan cache; persisted across restarts. */
const USAGE_SCAN_CACHE = new Map()

/** Skip absurdly large logs; they are never the current interactive session. */
const MAX_SCAN_FILE_BYTES = 512 * 1024 * 1024

/** One in-flight scan at a time; concurrent callers share the result. */
let usageScanInFlight = null

let usageScanCacheLoaded = false
let usageScanCacheDirty = false

/** Persistent cache file (plugin-owned namespace under the dsh home). */
function usageScanCachePath(home) {
  return path.join(home, 'desktop', 'usage-scan-cache.json')
}

/** Load the persisted per-file cache once per process. */
function loadUsageScanCache(home) {
  if (usageScanCacheLoaded) return
  usageScanCacheLoaded = true
  try {
    const parsed = JSON.parse(readFileSync(usageScanCachePath(home), 'utf8'))
    const files = parsed?.files
    if (files === null || typeof files !== 'object' || Array.isArray(files)) return
    for (const [file, entry] of Object.entries(files)) {
      if (entry === null || typeof entry !== 'object') continue
      const dayMap = new Map()
      const days = entry.days
      if (days !== null && typeof days === 'object' && !Array.isArray(days)) {
        for (const [key, value] of Object.entries(days)) {
          if (value === null || typeof value !== 'object') continue
          dayMap.set(key, {
            inputTokens: Number(value.inputTokens ?? 0),
            outputTokens: Number(value.outputTokens ?? 0),
          })
        }
      }
      USAGE_SCAN_CACHE.set(file, {
        mtimeMs: Number(entry.mtimeMs ?? 0),
        size: Number(entry.size ?? 0),
        frameEnd: Number(entry.frameEnd ?? 0),
        dayMap,
      })
    }
  } catch {
    /* first run or unreadable cache: start empty */
  }
}

/** Debounced write-back of the scan cache. */
let usageScanSaveTimer = null
function scheduleUsageScanSave(home) {
  usageScanCacheDirty = true
  if (usageScanSaveTimer !== null) return
  usageScanSaveTimer = setTimeout(() => {
    usageScanSaveTimer = null
    if (!usageScanCacheDirty) return
    usageScanCacheDirty = false
    try {
      const files = {}
      for (const [file, entry] of USAGE_SCAN_CACHE) {
        const days = {}
        for (const [key, value] of entry.dayMap) days[key] = value
        files[file] = { mtimeMs: entry.mtimeMs, size: entry.size, frameEnd: entry.frameEnd ?? 0, days }
      }
      const file = usageScanCachePath(home)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, `${JSON.stringify({ version: 1, files })}\n`, 'utf8')
    } catch {
      /* cache write failure is non-fatal */
    }
  }, 1500)
}

/** Bundled scanner script location (dev checkout and packaged app layouts). */
function usageScannerPath() {
  const candidates = [
    path.resolve(MODULE_DIR, '../../../../assets/usage-scan.mjs'),
    path.resolve(path.dirname(process.execPath), '../Resources/app/assets/usage-scan.mjs'),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

/** Merge one file's per-day map into the aggregate. */
function mergeDayMap(merged, dayMap) {
  for (const [key, value] of dayMap) {
    const hit = merged.get(key)
    if (hit === undefined) merged.set(key, { ...value })
    else {
      hit.inputTokens += value.inputTokens
      hit.outputTokens += value.outputTokens
    }
  }
}

/**
 * Run the scanner child for one batch of incremental jobs. Returns the
 * parsed `{ results: { <file>: { frames, frameEnd, days } } }` payload, or
 * null when the child cannot run, crashes, times out, or produces invalid
 * output — every failure degrades to cached data instead of touching the
 * server.
 */
function runUsageScanner(scannerPath, home, jobs) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(
        process.execPath,
        ['--expose-internals', scannerPath, '--home', home, '--jobs', JSON.stringify(jobs)],
        {
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
    } catch {
      resolve(null)
      return
    }
    const chunks = []
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* already gone */
      }
      finish(null)
    }, 120_000)
    child.stdout.on('data', (chunk) => {
      if (chunks.length < 1024) chunks.push(chunk)
    })
    child.stderr.resume()
    child.on('error', () => finish(null))
    child.on('close', (code) => {
      if (code !== 0) {
        finish(null)
        return
      }
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        const line = text.trim().split(/\r?\n/).pop() ?? ''
        const parsed = JSON.parse(line)
        if (parsed === null || typeof parsed !== 'object' || parsed.ok !== true || typeof parsed.results !== 'object') {
          finish(null)
          return
        }
        finish(parsed)
      } catch {
        finish(null)
      }
    })
  })
}

/**
 * Scan `$DSH_HOME/sessions/**\/session.jsonl.zstd` per-day usage, merging
 * every log into one map. Unchanged files come from the (persisted) cache;
 * changed files are decoded INCREMENTALLY by the isolated scanner child, so
 * a native zstd abort can never take the server down with it, and repeated
 * panel refreshes only re-read the frames appended since the last scan.
 */
export function scanJsonlDays(home) {
  if (usageScanInFlight !== null) return usageScanInFlight
  const task = (async () => {
    loadUsageScanCache(home)
    const merged = new Map()
    for (const cached of USAGE_SCAN_CACHE.values()) mergeDayMap(merged, cached.dayMap)
    const dir = path.join(home, 'sessions')
    let entries = []
    try {
      entries = await readdir(dir, { recursive: true, withFileTypes: true })
    } catch {
      return merged
    }
    // Drop cache entries for deleted logs; collect changed files with their
    // incremental offsets.
    const present = new Set()
    const jobs = []
    for (const entry of entries) {
      if (!entry?.isFile() || entry.name !== 'session.jsonl.zstd') continue
      const file = path.join(entry.parentPath ?? dir, entry.name)
      present.add(file)
      let info
      try {
        info = await stat(file)
      } catch {
        continue
      }
      if (info.size === 0 || info.size > MAX_SCAN_FILE_BYTES) continue
      const cached = USAGE_SCAN_CACHE.get(file)
      if (cached !== undefined && cached.mtimeMs === info.mtimeMs && cached.size === info.size) continue
      const offset = cached !== undefined && cached.size <= info.size
        ? (Number(cached.frameEnd) || 0)
        : 0
      jobs.push({ file, offset, mtimeMs: info.mtimeMs, size: info.size })
    }
    for (const file of [...USAGE_SCAN_CACHE.keys()]) {
      if (!present.has(file)) USAGE_SCAN_CACHE.delete(file)
    }
    if (jobs.length === 0) return merged
    const scannerPath = usageScannerPath()
    if (scannerPath === undefined) return merged
    const payload = await runUsageScanner(scannerPath, home, jobs.map((job) => ({ file: job.file, offset: job.offset })))
    if (payload === null) return merged
    for (const job of jobs) {
      const result = payload.results[job.file]
      if (result === undefined || typeof result.days !== 'object') continue
      const previous = USAGE_SCAN_CACHE.get(job.file)
      const base = job.offset > 0 && previous !== undefined ? previous.dayMap : new Map()
      const dayMap = new Map()
      for (const [key, value] of base) dayMap.set(key, { ...value })
      for (const [key, value] of Object.entries(result.days)) {
        if (value === null || typeof value !== 'object') continue
        const input = Number(value.inputTokens ?? 0)
        const output = Number(value.outputTokens ?? 0)
        if (input === 0 && output === 0) continue
        const hit = dayMap.get(key)
        if (hit === undefined) dayMap.set(key, { inputTokens: input, outputTokens: output })
        else {
          hit.inputTokens += input
          hit.outputTokens += output
        }
      }
      USAGE_SCAN_CACHE.set(job.file, {
        mtimeMs: job.mtimeMs,
        size: job.size,
        frameEnd: Number(result.frameEnd ?? 0),
        dayMap,
      })
      mergeDayMap(merged, dayMap)
      if (job.offset === 0) {
        // full rescan replaced the base; undo the stale pre-merge
        // contribution for this file by rebuilding the aggregate below
      }
    }
    if (jobs.some((job) => job.offset === 0)) {
      const rebuilt = new Map()
      for (const cached of USAGE_SCAN_CACHE.values()) mergeDayMap(rebuilt, cached.dayMap)
      merged.clear()
      for (const [key, value] of rebuilt) merged.set(key, value)
    }
    scheduleUsageScanSave(home)
    return merged
  })()
  usageScanInFlight = task
  task.finally(() => {
    if (usageScanInFlight === task) usageScanInFlight = null
  })
  return usageScanInFlight
}

// Plain-JS emulation of `@Remote(name)`: the decorator is a factory that
// consumes a TS decorator context; we fake the context, capture the marker
// initializers, and replay them on construction exactly like the real
// decorator would.
const REMOTE_INITIALIZERS = []
function markRemote(method) {
  Remote(method)(null, {
    private: false,
    static: false,
    name: method,
    addInitializer: (fn) => {
      REMOTE_INITIALIZERS.push(fn)
    },
  })
}
markRemote('load')
markRemote('save')
markRemote('balance')
markRemote('usage')
markRemote('unarchiveSession')
markRemote('listSessionCandidates')
markRemote('desktopConfig')
markRemote('saveDesktopConfig')
markRemote('desktopAction')
markRemote('storageUsage')
markRemote('listSkills')
markRemote('listMcpServers')
markRemote('mcpTemplates')
markRemote('addMcpServer')
markRemote('toggleMcpServer')
markRemote('skillTemplates')
markRemote('createSkill')
markRemote('toggleSkill')
markRemote('removeMcpServer')
markRemote('removeSkill')
markRemote('visionConfig')
markRemote('saveVisionConfig')

export class GlobalInstructionsGateway extends TypertRemoteService {
  static inject = ['agents', 'settings', 'loader']

  constructor(ctx) {
    super(ctx, 'globalInstructions')
    for (const init of REMOTE_INITIALIZERS) init.call(this)
    installNotificationEmitter(ctx)
    installSessionMentionPipeline(ctx)
    registerMobileRoute(ctx)
    registerWhaleSpriteRoutes(ctx)
    ensureVisionCommand(ctx)
    installConnectionTrustHeal(ctx)
  }

  /** Read the current instruction file; a missing file reads as empty. */
  load() {
    const file = instructionsFilePath()
    try {
      return { ok: true, path: file, content: readFileSync(file, 'utf8') }
    } catch (err) {
      if (err?.code === 'ENOENT') return { ok: true, path: file, content: '' }
      return { ok: false, path: file, content: '', error: String(err?.message ?? err) }
    }
  }

  /** Replace the instruction file content (UTF-8, trailing newline ensured). */
  save(text) {
    const file = instructionsFilePath()
    try {
      if (typeof text !== 'string' || text.length > MAX_CONTENT_BYTES) {
        throw new Error(`全局约束规则内容过大（上限 ${MAX_CONTENT_BYTES / 1024}KB）`)
      }
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
      return { ok: true, path: file }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Query the DeepSeek account balance server-side with the user's own
   * credential (the same reference the llm-deepseek adapter resolves), so
   * the key never crosses into browser code.
   */
  async balance() {
    try {
      const settings = this.ctx.get('settings')
      const cfg = settings?.get('llm-deepseek') ?? {}
      const ref = typeof cfg.apiKeyEnv === 'string' && cfg.apiKeyEnv.length > 0
        ? cfg.apiKeyEnv
        : 'DEEPSEEK_API_KEY'
      let key = ''
      const credentials = this.ctx.get('credentials')
      if (credentials !== undefined) {
        const hit = await credentials.resolve(ref)
        key = typeof hit?.value === 'string' ? hit.value : ''
      }
      if (!key && typeof process.env[ref] === 'string') key = process.env[ref]
      if (!key) {
        return { ok: false, error: '未配置 API Key（在设置 → 模型中填写）' }
      }
      const base = (typeof cfg.baseURL === 'string' && cfg.baseURL.length > 0
        ? cfg.baseURL
        : 'https://api.deepseek.com'
      ).replace(/\/+$/, '')
      const res = await fetch(`${base}/user/balance`, {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        return { ok: false, error: `余额查询失败：HTTP ${res.status}` }
      }
      const data = await res.json()
      if (!Array.isArray(data?.balance_infos)) {
        return { ok: false, error: '余额响应格式异常' }
      }
      return { ok: true, infos: data.balance_infos }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Aggregate token usage from the local session projection cache
   * (`$DSH_HOME/storages/session_projcache.json`) for stable totals plus a
   * per-day breakdown scanned from the durable session JSONL logs (async
   * zstd — see scanJsonlDays). The projection cache owns stable aggregate
   * values; the log scan is what makes "today" real-time and accurate.
   */
  async usage() {
    try {
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const file = path.join(home, 'storages', 'session_projcache.json')
      if (!existsSync(file)) {
        return { ok: true, totals: zeroTotals(), sessions: [], byDay: [], days: zeroDays(new Map()) }
      }
      const doc = JSON.parse(readFileSync(file, 'utf8'))
      const sessions = doc?.tables?.sessions ?? {}
      const rows = []
      const totals = zeroTotals()
      for (const [id, entry] of Object.entries(sessions)) {
        const t = entry?.rows?.tokenUsage?.val?.totals
        const stats = entry?.rows?.sessionStats?.val
        const title = entry?.rows?.title?.val
        const createdAt = entry?.identity?.createdAt
        const input = (t?.uncachedInputTokens ?? 0) + (t?.cacheReadTokens ?? 0) + (t?.cacheWriteTokens ?? 0)
        const output = t?.outputTokens ?? 0
        if (input === 0 && output === 0) continue
        totals.inputTokens += input
        totals.outputTokens += output
        totals.uncachedInputTokens += t?.uncachedInputTokens ?? 0
        totals.cacheReadTokens += t?.cacheReadTokens ?? 0
        totals.cacheWriteTokens += t?.cacheWriteTokens ?? 0
        totals.turns += stats?.turns ?? 0
        totals.steps += stats?.steps ?? 0
        totals.llmMs += stats?.llmMs ?? 0
        totals.toolMs += stats?.toolMs ?? 0
        rows.push({
          id,
          title: typeof title === 'string' ? title : '',
          createdAt: typeof createdAt === 'number' ? createdAt : null,
          inputTokens: input,
          outputTokens: output,
          turns: stats?.turns ?? 0,
        })
      }
      rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      // Per-day breakdown: async log scan (zstd decoding isolated in the
      // scanner child process — see scanJsonlDays).
      const dayMap = new Map()
      if (usageScannerPath() !== undefined) {
        const scanned = await scanJsonlDays(home)
        for (const [key, value] of scanned) dayMap.set(key, value)
      }
      const byDay = [...dayMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([day, v]) => ({ day, inputTokens: v.inputTokens, outputTokens: v.outputTokens }))
      return {
        ok: true,
        totals,
        sessions: rows.slice(0, 50),
        byDay,
        days: zeroDays(dayMap),
      }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Read the shell's desktop config file. The path is injected by the shell
   * via DSH_DESKTOP_CONFIG; without it the remote reports unconfigured. The
   * response additionally carries the live LAN state (bind host, port,
   * reachable URLs and a QR data URL) so the settings surface can show the
   * phone connection target without a second round trip.
   */
  desktopConfig() {
    const file = process.env.DSH_DESKTOP_CONFIG
    if (!file) return { ok: false, error: 'DSH_DESKTOP_CONFIG 未设置' }
    try {
      const raw = existsSync(file) ? readFileSync(file, 'utf8') : '{}'
      const parsed = JSON.parse(raw)
      const config = parsed && typeof parsed === 'object' ? parsed : {}
      return lanState(this.ctx, config).then(lan => ({ ok: true, config, lan }))
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Merge a patch into the shell's desktop config file, then emit a marker
   * line so the Electron shell re-reads and applies it (notifications,
   * launch-at-login, proxy, update URL).
   */
  saveDesktopConfig(patch) {
    const file = process.env.DSH_DESKTOP_CONFIG
    if (!file) return { ok: false, error: 'DSH_DESKTOP_CONFIG 未设置' }
    try {
      if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
        throw new Error('patch 必须是对象')
      }
      const current = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
      const allowed = ['notifications', 'launchAtLogin', 'proxyUrl', 'updateUrl', 'statsExpanded', 'statsStyle', 'lanAccess']
      for (const key of Object.keys(patch)) {
        if (!allowed.includes(key)) throw new Error(`未知配置项：${key}`)
        current[key] = patch[key]
      }
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
      emitDesktopEvent({ kind: 'desktop-config', config: current })
      return { ok: true, config: current }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Ask the Electron shell to perform a desktop action via the marker
   * protocol: `open-storage-dir` reveals the dsh home directory in Finder,
   * `open-path` opens a specific path, `restart-server` restarts the service.
   */
  desktopAction(action, path) {
    if (action === 'open-storage-dir' || action === 'open-path') {
      const target = typeof path === 'string' && path.length > 0
        ? path
        : process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      emitDesktopEvent({ kind: 'desktop-action', action, path: target })
      return { ok: true }
    }
    if (action === 'restart-server') {
      emitDesktopEvent({ kind: 'desktop-action', action })
      return { ok: true }
    }
    return { ok: false, error: `未知操作：${String(action)}` }
  }

  /** Total on-disk footprint of the dsh home (sessions, storages, profiles). */
  storageUsage() {
    try {
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const dirs = ['sessions', 'storages', 'profiles']
      const details = []
      let total = 0
      for (const name of dirs) {
        const dir = path.join(home, name)
        if (!existsSync(dir)) continue
        const size = dirSizeSync(dir)
        total += size
        details.push({ name, bytes: size })
      }
      return { ok: true, home, totalBytes: total, details }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Remove one session from the registry-global archive set (idempotent).
   * The workspace registry owns durability and write serialization; the
   * host stream then pushes `host/archived-sessions-changed`, so every
   * browser surface restores the session without a reload.
   */
  async unarchiveSession(sessionId) {
    try {
      const id = String(sessionId ?? '')
      if (id.length === 0) return { ok: false, error: '缺少会话 id' }
      const registry = this.ctx.get('workspaceRegistry')
      if (registry === undefined) {
        return { ok: false, error: 'workspaceRegistry 服务不可用' }
      }
      await registry.unarchiveSession(id)
      return { ok: true, archivedSessionIds: [...registry.archivedSessionIds] }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * `@会话` mention candidates for the composer: every other session the
   * user can pull context from, labeled by its latest title (fallback: the
   * session id). Resolves through the session-reference resolver when the
   * calling session has a live agent (cwd-affinity ranking); otherwise the
   * query engine lists newest-first with a simple substring filter.
   */
  async listSessionCandidates(sessionId, query, limit) {
    try {
      const self = String(sessionId ?? '')
      const needle = String(query ?? '')
      const cap = Number.isSafeInteger(limit) && limit > 0 ? limit : 20
      // A session can be listed once per workspace/context by the query
      // engine; the mention picker must show each session exactly once, so
      // dedupe by id (first occurrence keeps the best ranking).
      const seen = new Set()
      const dedupe = (sessions) => sessions.filter((entry) => {
        const id = String(entry.sessionId)
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      const resolver = this.ctx.get('sessionReferenceResolver')
      const agent = self.length > 0 ? this.ctx.agents.get(self) : undefined
      if (resolver !== undefined && agent !== undefined) {
        const candidates = await resolver.listCandidates(agent, needle, cap)
        return {
          ok: true,
          sessions: dedupe(candidates.map(entry => ({
            sessionId: String(entry.sessionId),
            label: String(entry.label ?? entry.sessionId),
            ...entry.cwd === undefined ? {} : { cwd: String(entry.cwd) },
            ...entry.createdAt === undefined ? {} : { createdAt: Number(entry.createdAt) },
          }))),
        }
      }
      const queryEngine = this.ctx.get('sessionQuery')
      if (queryEngine === undefined) {
        return { ok: false, error: '会话查询服务不可用' }
      }
      const records = await queryEngine.listSessions()
      const others = records.filter(record => String(record.header.id) !== self)
      const pool = others.slice(0, Math.max(cap * 4, 40))
      const observations = await queryEngine.readTitleSnapshots(pool.map(record => record.header.id))
      const sessions = []
      for (let index = 0; index < pool.length; index += 1) {
        const record = pool[index]
        const observation = observations[index]
        const label = observation?.status === 'fulfilled' && observation.value.title?.title
          ? observation.value.title.title
          : String(record.header.id)
        if (needle.length > 0
          && !String(record.header.id).toLowerCase().includes(needle.toLowerCase())
          && !label.toLowerCase().includes(needle.toLowerCase())
          && !(typeof record.header.cwd === 'string' && record.header.cwd.toLowerCase().includes(needle.toLowerCase()))) {
          continue
        }
        sessions.push({
          sessionId: String(record.header.id),
          label,
          ...record.header.cwd === undefined ? {} : { cwd: String(record.header.cwd) },
          ...record.header.createdAt === undefined ? {} : { createdAt: Number(record.header.createdAt) },
        })
        if (sessions.length >= cap) break
      }
      return { ok: true, sessions: dedupe(sessions) }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * List installed user skills by reading the standard skill roots directly
   * ($DSH_HOME/skills and ~/.agents/skills). The live skill registry is
   * gated behind the fs service's observation model, which denies unobserved
   * paths outside agent sessions — a direct read follows the same directory
   * conventions without that gate.
   */
  listSkills() {
    try {
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const roots = [
        { dir: path.join(home, 'skills'), source: 'user-dsh' },
        { dir: path.join(homedir(), '.agents', 'skills'), source: 'user-agents' },
      ]
      const rows = []
      for (const { dir, source } of roots) {
        let entries = []
        try {
          entries = readdirSync(dir, { withFileTypes: true })
        } catch {
          continue
        }
        for (const entry of entries) {
          try {
            let file
            if (entry.isDirectory()) {
              file = path.join(dir, entry.name, 'SKILL.md')
              if (!existsSync(file)) continue
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
              file = path.join(dir, entry.name)
            } else {
              continue
            }
            const frontmatter = readSkillFrontmatter(file)
            if (frontmatter === null) continue
            rows.push({
              name: frontmatter.name ?? '',
              description: frontmatter.description ?? '',
              provider: source,
              source,
              file,
              modelInvocable: frontmatter.invocation?.modelInvocable !== false && frontmatter['disable-model-invocation'] !== true,
            })
          } catch {
            /* skip unreadable entries */
          }
        }
      }
      rows.sort((a, b) => a.name.localeCompare(b.name))
      return { ok: true, skills: rows }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * List MCP servers configured in the composition: each server is one
   * `@deepseek-ai/dsh-mcp-client` loader row with its own config.
   */
  listMcpServers() {
    try {
      const servers = []
      for (const entry of this.ctx.loader.entries()) {
        if (entry.options?.name !== '@deepseek-ai/dsh-mcp-client') continue
        const config = entry.options?.config ?? {}
        servers.push({
          entryId: entry.id,
          serverName: typeof config.serverName === 'string' ? config.serverName : '',
          transport: typeof config.transport === 'string' ? config.transport : 'stdio',
          target: config.transport === 'streamable-http'
            ? String(config.url ?? '')
            : `${String(config.command ?? '')} ${(config.args ?? []).join(' ')}`.trim(),
          disabled: entry.disabled === true,
          fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state] ?? null,
        })
      }
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      return { ok: true, servers, patchFile: path.join(home, 'cordis.patch.yml') }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /** Built-in MCP server templates (one-click starters). */
  mcpTemplates() {
    return {
      ok: true,
      templates: [
        { id: 'filesystem', name: 'Filesystem（文件系统）', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/你的用户名/Documents'], description: '读写本机文件目录（把路径换成你的目录）' },
        { id: 'fetch', name: 'Fetch（网页抓取）', transport: 'stdio', command: 'uvx', args: ['mcp-server-fetch'], description: '抓取网页内容' },
        { id: 'github', name: 'GitHub', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], description: '仓库 / Issue / PR 操作（需要 GITHUB_TOKEN 环境变量）' },
        { id: 'memory', name: 'Memory（知识图谱记忆）', transport: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], description: '持久化知识图谱记忆' },
      ],
    }
  }

  /**
   * Add an MCP server by writing a managed block into
   * `$DSH_HOME/cordis.patch.yml` (user content is never touched). The new
   * server takes effect on the next service start.
   */
  addMcpServer(input) {
    try {
      const name = String(input?.name ?? '').trim()
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) {
        return { ok: false, error: '服务器名称必须是 1-32 位字母/数字/下划线/连字符' }
      }
      let row
      const template = this.mcpTemplates().templates.find((t) => t.id === input?.templateId)
      if (template !== undefined && !input?.command && !input?.url) {
        row = {
          transport: template.transport,
          serverName: name,
          command: template.command,
          args: template.args,
        }
      } else if (input?.transport === 'streamable-http' || (!input?.command && typeof input?.url === 'string' && input.url.length > 0)) {
        const url = String(input?.url ?? '').trim()
        if (!/^https?:\/\//.test(url)) return { ok: false, error: 'HTTP 传输需要以 http(s):// 开头的 URL' }
        row = { transport: 'streamable-http', serverName: name, url }
      } else {
        const command = String(input?.command ?? '').trim()
        if (command.length === 0) return { ok: false, error: '需要命令或 URL' }
        const [cmd, ...rest] = command.split(/\s+/)
        row = { transport: 'stdio', serverName: name, command: cmd, args: rest }
      }
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const file = path.join(home, 'cordis.patch.yml')
      const entry = {
        id: `mcp-${name}`,
        name: '@deepseek-ai/dsh-mcp-client',
        config: row,
      }
      const { before, rows } = readManagedBlock(file)
      if (rows.some((r) => r?.id === entry.id)) {
        return { ok: false, error: `服务器 ${name} 已存在` }
      }
      writeManagedBlock(file, before, [...rows, entry])
      return { ok: true, restartRequired: true, path: file }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /** Built-in Skill skeleton templates. */
  skillTemplates() {
    return {
      ok: true,
      templates: [
        { id: 'blank', name: '空白模板', description: '最小结构，自己写正文' },
        { id: 'code-review', name: '代码审查', description: '审查标准、检查清单、输出格式' },
        { id: 'doc-writer', name: '文档写作', description: 'README/设计文档的写作规范' },
        { id: 'web-research', name: '网页研究', description: '检索、比对来源、出结论' },
        { id: 'translator', name: '翻译润色', description: '中英互译与润色规范' },
      ],
    }
  }

  /** Create a new user skill under $DSH_HOME/skills/<name>/SKILL.md. */
  createSkill(input) {
    try {
      const name = String(input?.name ?? '').trim()
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(name)) {
        return { ok: false, error: '名称需为小写 kebab-case（如 code-review）' }
      }
      const description = String(input?.description ?? '').trim()
      if (description.length === 0) {
        return { ok: false, error: '请填写一句话描述' }
      }
      const template = this.skillTemplates().templates.find((t) => t.id === input?.templateId) ?? this.skillTemplates().templates[0]
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const dir = path.join(home, 'skills', name)
      const file = path.join(dir, 'SKILL.md')
      if (existsSync(file)) {
        return { ok: false, error: `skill ${name} 已存在` }
      }
      mkdirSync(dir, { recursive: true })
      const body = buildSkillBody(template.id, name, description)
      writeFileSync(file, body, 'utf8')
      return { ok: true, path: file }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Enable/disable an MCP server: applies immediately through the loader
   * entry update and persists the `disabled` flag into the managed patch
   * block so the choice survives restarts.
   */
  toggleMcpServer(entryId, enabled) {
    try {
      const id = String(entryId ?? '')
      if (id.length === 0) return { ok: false, error: '缺少服务器 id' }
      const wantDisabled = enabled !== true
      this.ctx.loader.update(id, { disabled: wantDisabled })
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const file = path.join(home, 'cordis.patch.yml')
      const { before, rows } = readManagedBlock(file)
      const rowId = id.replace(/^include:/, '')
      const row = rows.find((r) => r?.id === rowId)
      if (row !== undefined) {
        row.disabled = wantDisabled
        writeManagedBlock(file, before, rows)
      }
      return { ok: true, disabled: wantDisabled }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Enable/disable a user skill by editing the canonical frontmatter key
   * `disable-model-invocation` in its SKILL.md (the same field the skill
   * filesystem parses). Other frontmatter content is preserved.
   */
  toggleSkill(name, enabled) {
    try {
      const skillName = String(name ?? '').trim()
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(skillName)) {
        return { ok: false, error: '无效的 skill 名称' }
      }
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const candidates = [
        path.join(home, 'skills', skillName, 'SKILL.md'),
        path.join(homedir(), '.agents', 'skills', skillName, 'SKILL.md'),
      ]
      const file = candidates.find((p) => existsSync(p))
      if (file === undefined) {
        return { ok: false, error: `skill ${skillName} 不在用户目录中（内置 skill 不可禁用）` }
      }
      const text = readFileSync(file, 'utf8')
      if (!text.startsWith('---')) {
        return { ok: false, error: 'SKILL.md 缺少 frontmatter' }
      }
      const end = text.indexOf('\n---', 3)
      if (end === -1) {
        return { ok: false, error: 'SKILL.md frontmatter 格式异常' }
      }
      const parsed = parseYaml(text.slice(3, end))
      const data = parsed && typeof parsed === 'object' ? parsed : {}
      if (enabled === true) {
        delete data['disable-model-invocation']
      } else {
        data['disable-model-invocation'] = true
      }
      const next = `---\n${yamlStringify(data)}---${text.slice(end + 4)}`
      writeFileSync(file, next, 'utf8')
      return { ok: true, disabled: enabled !== true, path: file }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /** Remove an MCP server: unmounts it immediately and drops its managed row. */
  removeMcpServer(entryId) {
    try {
      const id = String(entryId ?? '')
      if (id.length === 0) return { ok: false, error: '缺少服务器 id' }
      this.ctx.loader.remove(id)
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const file = path.join(home, 'cordis.patch.yml')
      const { before, rows } = readManagedBlock(file)
      const rowId = id.replace(/^include:/, '')
      const next = rows.filter((r) => r?.id !== rowId)
      if (next.length !== rows.length) writeManagedBlock(file, before, next)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /** Delete a user skill directory (from whichever user root it lives in). */
  removeSkill(name) {
    try {
      const skillName = String(name ?? '').trim()
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(skillName)) {
        return { ok: false, error: '无效的 skill 名称' }
      }
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const candidates = [
        path.join(home, 'skills', skillName),
        path.join(homedir(), '.agents', 'skills', skillName),
      ]
      const dir = candidates.find((p) => existsSync(p))
      if (dir === undefined) {
        return { ok: false, error: `skill ${skillName} 不在用户目录中（内置 skill 不可删除）` }
      }
      rmSync(dir, { recursive: true, force: true })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  // — 看图工具 (vision MCP) 模型配置 ----------------------------------------

  /**
   * Locate the vision MCP loader row (`serverName: 'vision'`) and its server
   * script path. The script path comes from the row's stdio args; when the
   * row is absent or has no args, fall back to the standard profile location.
   */
  findVisionEntry() {
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options?.name !== '@deepseek-ai/dsh-mcp-client') continue
      const config = entry.options?.config ?? {}
      if (config.serverName !== 'vision') continue
      const args = Array.isArray(config.args) ? config.args : []
      const scriptArg = args.find((arg) => typeof arg === 'string' && arg.endsWith('.mjs'))
      const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
      const serverPath = scriptArg ?? path.join(home, 'profiles', 'web', 'mcp-servers', 'vision', 'vision-server.mjs')
      return { entryId: entry.id, serverName: config.serverName, serverPath }
    }
    return null
  }

  /**
   * Read the vision tool's effective runtime config: the user-overridable
   * `vision.config.json` beside the server script, merged over the built-in
   * defaults. The API key is never sent back to the browser — only whether
   * one is stored.
   */
  visionConfig() {
    try {
      const vision = this.findVisionEntry()
      if (vision === null) {
        return { ok: false, error: '未找到看图工具（vision MCP 服务器）配置' }
      }
      const configPath = path.join(path.dirname(vision.serverPath), 'vision.config.json')
      let stored = {}
      try {
        stored = JSON.parse(readFileSync(configPath, 'utf8'))
        if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) stored = {}
      } catch {
        stored = {}
      }
      const model = typeof stored.model === 'string' && stored.model.trim().length > 0
        ? stored.model.trim()
        : VISION_DEFAULTS.model
      const baseUrl = typeof stored.baseUrl === 'string' && stored.baseUrl.trim().length > 0
        ? stored.baseUrl.trim()
        : VISION_DEFAULTS.baseUrl
      const hasApiKey = typeof stored.apiKey === 'string' && stored.apiKey.trim().length > 0
      return {
        ok: true,
        entryId: vision.entryId,
        serverPath: vision.serverPath,
        configPath,
        config: { model, baseUrl },
        hasApiKey,
        serverUpdated: visionServerIsCurrent(vision.serverPath),
      }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }

  /**
   * Save the vision tool's model / endpoint / API key. Empty model or URL
   * resets that field to the default; an empty API key keeps the existing
   * key (use 恢复默认 to clear). The server script is migrated to the
   * config-reading template when it is still the hardcoded version, and the
   * MCP row is restarted so the change takes effect immediately.
   */
  async saveVisionConfig(input) {
    try {
      const vision = this.findVisionEntry()
      if (vision === null) {
        return { ok: false, error: '未找到看图工具（vision MCP 服务器）配置' }
      }
      const model = String(input?.model ?? '').trim()
      const baseUrl = String(input?.baseUrl ?? '').trim()
      const apiKey = String(input?.apiKey ?? '')
      if (model.length > 0 && model.length > 64) return { ok: false, error: '模型名不能超过 64 个字符' }
      if (model.length > 0 && /[\r\n]/.test(model)) return { ok: false, error: '模型名不能包含换行' }
      if (baseUrl.length > 0 && !/^https?:\/\/[^\s]+$/i.test(baseUrl)) {
        return { ok: false, error: '调用地址需要以 http(s):// 开头' }
      }
      if (apiKey.length > 1024) return { ok: false, error: 'API Key 过长' }
      const configPath = path.join(path.dirname(vision.serverPath), 'vision.config.json')
      let previous = null
      try {
        previous = this.visionConfig()
      } catch {
        previous = null
      }
      let current = {}
      try {
        current = JSON.parse(readFileSync(configPath, 'utf8'))
        if (current === null || typeof current !== 'object' || Array.isArray(current)) current = {}
      } catch {
        current = {}
      }
      if (model.length > 0) current.model = model
      else delete current.model
      if (baseUrl.length > 0) current.baseUrl = baseUrl
      else delete current.baseUrl
      if (apiKey.length > 0) current.apiKey = apiKey
      // Empty apiKey keeps the stored key; 恢复默认 passes apiKey:null to clear.
      else if (input !== null && typeof input === 'object' && 'apiKey' in input && input.apiKey === null) {
        delete current.apiKey
      }
      mkdirSync(path.dirname(configPath), { recursive: true })
      writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
      try {
        chmodSync(configPath, 0o600)
      } catch {
        /* best-effort on platforms without chmod */
      }
      // Migrate the server script to the config-reading template if needed,
      // then restart the MCP row so the running child picks everything up.
      let migrated = false
      let restarted = false
      if (!visionServerIsCurrent(vision.serverPath)) {
        migrated = ensureVisionServerTemplate(vision.serverPath)
      }
      if (migrated || previous === null || previous.ok !== true) {
        restarted = await restartLoaderEntry(this.ctx, vision.entryId)
      }
      return {
        ok: true,
        configPath,
        serverPath: vision.serverPath,
        migrated,
        restarted,
        model: typeof current.model === 'string' ? current.model : VISION_DEFAULTS.model,
        baseUrl: typeof current.baseUrl === 'string' ? current.baseUrl : VISION_DEFAULTS.baseUrl,
      }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    }
  }
}

// — Managed patch-block helpers ----------------------------------------------
const MANAGED_BEGIN = '# === dsh-desktop managed: MCP servers (begin) ==='
const MANAGED_END = '# === dsh-desktop managed: MCP servers (end) ==='

/** Split a patch file into pre-block content and the managed rows between the markers. */
function readManagedBlock(file) {
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return { before: '', rows: [] }
  }
  const begin = text.indexOf(MANAGED_BEGIN)
  const end = text.indexOf(MANAGED_END)
  if (begin === -1 || end === -1 || end <= begin) {
    return { before: text.replace(/\s+$/, '') ? `${text.replace(/\s+$/, '')}\n` : '', rows: [] }
  }
  const inner = text.slice(begin + MANAGED_BEGIN.length, end)
  let parsed = []
  try {
    parsed = parseYaml(inner)
  } catch {
    parsed = []
  }
  const rows = []
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (entry && typeof entry === 'object' && Array.isArray(entry.insert)) {
        rows.push(...entry.insert)
      } else if (entry && typeof entry === 'object') {
        rows.push(entry)
      }
    }
  }
  return {
    before: text.slice(0, begin),
    rows,
  }
}

/**
 * Write the managed block back; user content outside the markers is
 * preserved. The block is an `insert:` overlay — the user patch layer is an
 * overlay over the composed tree, so new rows must be inserted explicitly.
 */
function writeManagedBlock(file, before, rows) {
  const block = [
    before.replace(/\s+$/, '') ? `${before.replace(/\s+$/, '')}\n` : '',
    `${MANAGED_BEGIN}\n`,
    yamlStringify([{ insert: rows }]),
    `${MANAGED_END}\n`,
  ].join('')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, block, 'utf8')
}

/** Skill skeleton bodies per template. */
function buildSkillBody(templateId, name, description) {
  const header = `---\nname: ${name}\ndescription: ${description}\n---\n`
  switch (templateId) {
    case 'code-review':
      return `${header}# ${name}\n\n## 审查流程\n1. 通读改动，理解意图\n2. 检查正确性、边界与错误处理\n3. 检查安全与性能\n\n## 检查清单\n- [ ] 类型与空值\n- [ ] 并发与竞态\n- [ ] 敏感信息与凭据\n\n## 输出格式\n- 结论先行（通过 / 需修改）\n- 问题分级：🔴 阻断 / 🟡 建议 / 🔵 提示\n`
    case 'doc-writer':
      return `${header}# ${name}\n\n## 目标\n为项目生成清晰、准确、可执行的文档。\n\n## 规范\n- 先写用途与边界，再写安装/使用\n- 命令必须真实可运行\n- 不存在的能力标注为「未实现」，不虚构\n\n## 结构\n1. 概述\n2. 快速开始\n3. 详细说明\n4. 常见问题\n`
    case 'web-research':
      return `${header}# ${name}\n\n## 方法\n1. 先明确问题与证据标准\n2. 多来源交叉验证，标注来源 URL\n3. 区分事实、推断与待确认\n\n## 输出\n- 结论\n- 关键证据（带链接）\n- 分歧点与不确定性\n`
    case 'translator':
      return `${header}# ${name}\n\n## 原则\n- 忠实原文，术语一致\n- 中文输出自然、不机翻腔\n\n## 流程\n1. 直译保意\n2. 调整语序与表达\n3. 校对术语与专名\n`
    default:
      return `${header}# ${name}\n\n## 适用场景\n（何时使用这个 skill）\n\n## 工作步骤\n1. \n2. \n\n## 注意事项\n- \n`
  }
}



export default GlobalInstructionsGateway

// — 看图工具 (vision MCP) 配置模板 --------------------------------------------

/** Built-in vision runtime defaults (mirrored by the bundled server script). */
const VISION_DEFAULTS = {
  model: 'mimo-v2.5',
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
}

/** Marker comment identifying the config-reading server template. */
const VISION_SERVER_MARKER = 'dsh-desktop-vision-config'

/** True when the server script is the config-reading template. */
function visionServerIsCurrent(serverPath) {
  try {
    return readFileSync(serverPath, 'utf8').includes(VISION_SERVER_MARKER)
  } catch {
    return false
  }
}

/** Bundled template location (dev checkout and packaged app layouts). */
function visionTemplatePath() {
  const candidates = [
    path.resolve(MODULE_DIR, '../../../../assets/vision-server.mjs'),
    path.resolve(path.dirname(process.execPath), '../Resources/app/assets/vision-server.mjs'),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

/** Replace the server script with the bundled config-reading template. */
function ensureVisionServerTemplate(serverPath) {
  const template = visionTemplatePath()
  if (template === undefined) return false
  const source = readFileSync(template, 'utf8')
  if (!source.includes(VISION_SERVER_MARKER)) return false
  mkdirSync(path.dirname(serverPath), { recursive: true })
  writeFileSync(serverPath, source, 'utf8')
  try {
    chmodSync(serverPath, 0o755)
  } catch {
    /* best-effort */
  }
  return true
}

/**
 * Rewrite the vision MCP row's `command` from a system binary (`node`,
 * `npx`) to the app's own Electron binary running in Node mode, so the
 * vision tool works on machines without a system Node.js installation.
 * A previously written app-binary path is refreshed when the app moved or
 * the path no longer exists. The update persists into the row's patch layer
 * and restarts the MCP row once.
 */
function ensureVisionCommand(ctx) {
  const loader = ctx.get('loader')
  if (loader === undefined || typeof loader.entries !== 'function') return
  const settle = typeof loader.await === 'function' ? loader.await() : undefined
  const task = Promise.resolve(settle).then(() => {
    for (const entry of loader.entries()) {
      if (entry.options?.name !== '@deepseek-ai/dsh-mcp-client') continue
      const config = entry.options?.config ?? {}
      if (config.serverName !== 'vision') continue
      const command = String(config.command ?? '')
      const args = Array.isArray(config.args) ? config.args : []
      const scriptArg = args.find((arg) => typeof arg === 'string' && arg.endsWith('.mjs'))
      if (scriptArg === undefined) continue
      const isAppBinary = command.includes('.app/Contents/MacOS/')
      const needsRewrite = (command === 'node' || command === 'npx')
        || (isAppBinary && (!existsSync(command) || command !== process.execPath))
      if (!needsRewrite) continue
      const next = {
        ...config,
        command: process.execPath,
        env: { ...(config.env ?? {}), ELECTRON_RUN_AS_NODE: '1' },
      }
      try {
        loader.update(entry.id, { config: next })
      } catch {
        /* update failure leaves the old row running */
      }
    }
  })
  task.catch(() => {})
}

/**
 * Self-heal the LAN trust fence. dsh-web-app snapshots the trusted-host set
 * ONCE at boot from the live network interfaces; a boot that races a Wi-Fi /
 * VPN / Tailscale change captures an empty set, after which every /api call
 * from the phone is rejected with 403 until the server restarts. This keeps
 * the connection row's trustedHosts in sync with the CURRENT non-internal
 * IPv4 addresses: applied once after the loader settles, then re-checked on
 * an interval (entry.update restarts the connection plugin only when the set
 * actually changed). In-process only — no patch file is written.
 */
/**
 * Run the trust self-heal once after the loader settles, then keep watching
 * on a 30s interval (network changes while the app stays open).
 */
function installConnectionTrustHeal(ctx) {
  const settle = typeof ctx.loader?.await === 'function' ? ctx.loader.await() : undefined
  const tick = () => {
    try {
      refreshConnectionTrust(ctx)
    } catch {
      /* interval keeps running */
    }
  }
  Promise.resolve(settle).then(tick).catch(() => {})
  ctx.effect(() => {
    const timer = setInterval(tick, 30_000)
    return () => clearInterval(timer)
  }, 'dsh-desktop: connection trust heal')
}

function refreshConnectionTrust(ctx) {
  const ips = lanIpv4Addresses()
  if (ips.length === 0) return
  let entry
  for (const candidate of ctx.loader.entries()) {
    if (candidate.options?.name === '@deepseek-ai/dsh-client-connection') {
      entry = candidate
      break
    }
  }
  if (entry === undefined) return
  const config = entry.options?.config ?? {}
  const current = Array.isArray(config.trustedHosts) ? config.trustedHosts : []
  const currentSet = new Set(current)
  if (ips.every((ip) => currentSet.has(ip))) return
  const trustedHosts = [...new Set([...current, ...ips])]
  try {
    // entry.update merges options and restarts the fiber; unlike
    // loader.update it never writes a patch tree.
    entry.update({ config: { ...config, trustedHosts } }, false, true)
  } catch {
    /* keep the previous trust set on failure */
  }
}

/**
 * Restart one loader entry's fiber in place (no config change, no patch-file
 * write) so a running stdio MCP child re-reads its script and config.
 */
async function restartLoaderEntry(ctx, entryId) {
  try {
    const entry = ctx.loader.resolve(String(entryId))
    if (entry === undefined || entry === null) return false
    const fiber = entry.fiber
    if (fiber === undefined || fiber === null) return false
    if (fiber.state !== 2 || typeof fiber.restart !== 'function') return false
    await fiber.restart()
    return true
  } catch {
    return false
  }
}

// — Desktop notification emitter ---------------------------------------------
// Prints marker lines on the server's stdout; the desktop shell parses them
// and turns them into macOS notifications + Dock badge updates.

function emitDesktopEvent(payload) {
  console.log(`[desktop-event] ${JSON.stringify(payload)}`)
}

/**
 * Track root-agent lifecycle and emit `agent-running` / `agent-idle` /
 * `agent-error` desktop events. Mirrors the schedule plugin's pattern:
 * root `agent/created` + per-agent `agent.ctx.on(...)` listeners; subagents
 * are filtered out so background child work never spams notifications.
 */
function installNotificationEmitter(ctx) {
  const tracked = new Map()
  ctx.on('agent/created', ({ agent }) => {
    if (!agent || !ctx.agents.roots().includes(agent)) return
    const sid = String(agent.id ?? '')
    let last = agent.status
    tracked.set(sid, last)
    agent.ctx.on('agent/status', ({ status }) => {
      const prev = tracked.get(sid) ?? last
      tracked.set(sid, status)
      last = status
      if (status === 'running' && prev !== 'running') {
        emitDesktopEvent({ kind: 'agent-running', sessionId: sid })
      } else if (status === 'idle' && prev === 'running') {
        emitDesktopEvent({ kind: 'agent-idle', sessionId: sid })
      }
    })
    agent.ctx.on('agent/error', (payload) => {
      emitDesktopEvent({
        kind: 'agent-error',
        sessionId: sid,
        message: String(payload?.error?.message ?? payload?.error ?? '').slice(0, 200),
      })
    })
  })
}

// — @会话 mention pipeline (Codex-style cross-session references) -----------
// Mirrors the slash-skill mechanism: the browser inserts a canonical mention
// URI (`@[label](dsh-session:<base64url-id>)`) as a chip; this host boundary
// recognizes the mentions in a claimed user message at `agent/pre-step` and
// injects the referenced sessions' current surface as durable recall context
// (the session-reference resolver owns snapshotting, budgets, and rendering).
// A mention that fails to resolve never blocks the turn — the readable
// mention text still reaches the model.

/**
 * Collect `{ sessionId, label }` mentions from the claimed batch's own user
 * text (never from injected context rows). Malformed URIs degrade to plain
 * text and are skipped.
 */
function collectSessionMentions(messages) {
  const refs = []
  for (const message of messages ?? []) {
    if ((message?.source?.kind) !== 'user') continue
    for (const block of message.content ?? []) {
      if (block?.type !== 'text' || typeof block.text !== 'string') continue
      // Fast path: a mention-free block needs no parse.
      if (!block.text.includes(SESSION_URI_PREFIX)) continue
      let parsed
      try {
        parsed = parseSessionReferenceText(block.text)
      } catch {
        continue
      }
      for (const ref of parsed.references) {
        if (!refs.some(existing => existing.sessionId === ref.sessionId)) {
          refs.push({ sessionId: String(ref.sessionId), label: String(ref.label ?? ref.sessionId) })
        }
      }
    }
  }
  return refs
}

/**
 * Mount the session-reference resolver (the web profile ships its query
 * backend but not this consumer) and the pre-step injection listener.
 * Root agents only: delegated child steps never carry user mention chips.
 */
function installSessionMentionPipeline(ctx) {
  ctx.plugin(SessionReferenceResolver)
  ctx.on('agent/pre-step', async ({ agent, messages, signal }, next) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    if (!ctx.agents.roots().includes(agent)) return decision
    const refs = collectSessionMentions(messages).slice(0, 3)
    if (refs.length === 0) return decision
    const resolver = ctx.get('sessionReferenceResolver')
    if (resolver === undefined) return decision
    try {
      const content = []
      for (const message of messages ?? []) {
        if (message?.source?.kind === 'user') content.push(...(message.content ?? []))
      }
      const prepared = await resolver.prepare(agent, content, refs, signal)
      if (prepared.additionalContext === undefined) return decision
      emitDesktopEvent({ kind: 'mention-injected', sessionId: String(agent.id ?? ''), count: refs.length })
      return { kind: 'enter', messages: [...decision.messages, prepared.additionalContext] }
    } catch {
      // Unresolvable session / budget overflow: keep the readable mention
      // text as-is and proceed — a reference must never block the turn.
      return decision
    }
  })
  // Note: delegated vision-bridge images are NOT stripped here — pre-step
  // messages are appended durably, so stripping would erase the image block
  // from the transcript. The strip happens later, at the model-request
  // boundary inside dsh-agent-loop (see scripts/apply-vision-bridge.mjs).
}
