/**
 * DshServer — manages the DeepSeek Harness web server as a child process.
 *
 * The child is spawned with ELECTRON_RUN_AS_NODE=1 on Electron's own binary,
 * so the packaged app needs no system Node installation (Electron 39 ships
 * Node 22.22.1, which satisfies dsh's `^22.19.0 || >=24` engine range).
 *
 * @module main/server
 */

import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import net from 'node:net'
import { homedir, tmpdir as osTmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Port the GUI normally lives on; probed first so the desktop app can "take over" it. */
const DEFAULT_PORT = 3080

/** Preload that terminates the service if its owning Electron process dies. */
const CHILD_GUARD_PATH = fileURLToPath(new URL('./child-guard.mjs', import.meta.url))

/** URL line printed by `dsh web` once listening, e.g. `dsh web: http://127.0.0.1:32768`. */
const URL_LINE = /dsh web:\s+http:\/\/(127\.0\.0\.1|localhost):(\d+)/

/** Directories always offered on PATH, independent of what the login shell reports. */
const STATIC_PATH_DIRS = [
  '/opt/homebrew/bin', '/opt/homebrew/sbin',
  '/usr/local/bin', '/usr/local/sbin',
  '/usr/bin', '/bin', '/usr/sbin', '/sbin',
  '/Library/Apple/usr/bin',
  '~/bin', '~/.local/bin', '~/.cargo/bin',
]

/**
 * Ask the user's login shell for its PATH. GUI-launched apps start with a
 * bare PATH (`/usr/bin:/bin:...`), so tools like Homebrew git/ripgrep would be
 * invisible to the server. The shell is asked interactively because that is
 * where users put their PATH exports; a timeout protects startup against slow
 * shell rc files, and static fallbacks cover the rest.
 */
function loginShellPath(timeoutMs = 2500) {
  return new Promise((resolve) => {
    let settled = false
    let out = ''
    let child
    try {
      child = spawn('/bin/zsh', ['-lic', 'printf %s "$PATH"'], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      resolve('')
      return
    }
    const done = (value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const lines = String(value ?? '').trim().split('\n').filter((l) => l.length > 0)
      resolve(lines.length > 0 ? lines[lines.length - 1] : '')
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      done('')
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      out += chunk
    })
    child.on('close', () => done(out))
    child.on('error', () => done(''))
  })
}

/** Merge login-shell PATH, the inherited PATH, and static fallbacks (deduped, existing only). */
export async function buildPathEnv(existing = process.env.PATH ?? '', home) {
  const fromShell = await loginShellPath()
  const parts = []
  for (const source of [fromShell, existing]) {
    if (typeof source === 'string') parts.push(...source.split(':'))
  }
  parts.push(...STATIC_PATH_DIRS)
  const seen = new Set()
  const kept = []
  for (let part of parts) {
    if (!part) continue
    if (part === '~' || part.startsWith('~/')) part = path.join(home, part.slice(1))
    if (!existsSync(part)) continue
    if (seen.has(part)) continue
    seen.add(part)
    kept.push(part)
  }
  return kept.join(':')
}

function probePort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', (err) => {
      resolve(err.code === 'EADDRINUSE' ? false : true)
    })
    probe.once('listening', () => {
      probe.close(() => resolve(true))
    })
    probe.listen(port, '127.0.0.1')
  })
}

export class DshServer {
  /** @param {{ binPath: string, useSystemNode: boolean, logPath: string, env: object, patchPath: string|null, pluginPath: string|null, host: string, preferredPort: number|null, onDesktopEvent: ((event: object) => void)|null }} options */
  constructor({ binPath, useSystemNode = false, logPath, env = {}, patchPath = null, pluginPath = null, host = '127.0.0.1', preferredPort = null, onDesktopEvent = null }) {
    this.binPath = binPath
    this.useSystemNode = useSystemNode
    this.logPath = logPath
    this.env = env
    this.patchPath = patchPath
    this.pluginPath = pluginPath
    this.host = host === '0.0.0.0' ? '0.0.0.0' : '127.0.0.1'
    this.preferredPort = Number.isInteger(preferredPort) && preferredPort > 0 ? preferredPort : null
    this.onDesktopEvent = onDesktopEvent
    this.child = null
    this.url = null
    this.port = null
    this.lastPort = null
    this.stopped = false
    this.logTail = []
    this.onUnexpectedExit = null
    this.onReady = null
  }

  get running() {
    return this.child !== null && this.child.exitCode === null
  }

  /**
   * Link the desktop plugin package into the profile's healed module
   * fallback (`$DSH_HOME/profiles/node_modules/…`) so both the host Loader
   * and the client-modules scan resolve it. dsh's own boot heal only links
   * the anchor's dependency closure; the same ensureSymlink it uses treats
   * an existing link with this target as a no-op, so pre-creating is safe.
   */
  ensurePluginFallback() {
    if (!this.pluginPath || !existsSync(this.pluginPath)) return
    const home = process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh')
    const link = path.join(home, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-desktop')
    try {
      const stat = lstatSync(link)
      if (!stat.isSymbolicLink()) return // user-owned entry — never clobber
      if (readlinkSync(link) === this.pluginPath) return
      unlinkSync(link) // stale link; the boot heal would replace it anyway
    } catch {
      /* link absent */
    }
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(this.pluginPath, link, 'dir')
  }

  /**
   * Write the LAN bind overlay patch: replaces the webserver row's config so
   * the server listens on all interfaces. Static content, regenerated on
   * every LAN start (the file is cheap and never goes stale).
   * @returns the overlay path, or null when the write fails (LAN mode then
   *   falls back to the loopback bind).
   */
  writeLanPatch() {
    try {
      const dir = path.join(osTmpdir(), 'dsh-desktop')
      mkdirSync(dir, { recursive: true })
      const file = path.join(dir, 'lan.patch.yml')
      writeFileSync(file, [
        '# Generated by the DeepSeek Harness desktop shell (LAN access setting):',
        '# binds the web server to all interfaces so the phone client can connect.',
        '- id: webserver',
        '  config:',
        '    host: 0.0.0.0',
        '    port: !!js ctx.webStartup.port ?? 3080',
        '',
      ].join('\n'), 'utf8')
      return file
    } catch {
      return null
    }
  }

  async start() {
    // A restart must fully stop the previous child BEFORE spawning the next:
    // the old server still holds the port for a moment after SIGTERM, so a
    // same-port respawn would otherwise hit EADDRINUSE (and a random-port
    // fallback would orphan the old server and change the shell URL).
    if (this.child && this.child.exitCode === null) {
      await this.stop()
    }
    this.stopped = false
    this.logTail = []
    this.ensurePluginFallback()
    await mkdir(path.dirname(this.logPath), { recursive: true })
    const logStream = createWriteStream(this.logPath, { flags: 'a' })

    // Restarts reuse the port the previous child released (we just stopped
    // it), so the shell URL — and everything loaded on it, e.g. an open
    // settings page — survives the restart without a reload. First boot
    // prefers the persisted port (stable phone mapping), then the default
    // port, then an OS-assigned one. `lastPort` is never cleared
    // mid-restart, so even a stop that nulls `port` right before a new start
    // keeps the address stable.
    let desired = this.lastPort
    if (desired === null && this.preferredPort !== null) {
      desired = await probePort(this.preferredPort) ? this.preferredPort : null
    }
    if (desired === null) desired = await probePort(DEFAULT_PORT) ? DEFAULT_PORT : 0
    // --expose-internals: the loader's HMR service needs the Node internal
    // module loader. The `node-addon-require-builtin` fallback does not work
    // inside Electron's Node build (no compatible V8 embedder symbol), but
    // the flag path does — and system node accepts the same flag.
    const args = ['--expose-internals', '--import', CHILD_GUARD_PATH, this.binPath, '--profile', 'web']
    if (this.patchPath) args.push('--patch', this.patchPath)
    // LAN mode: the shipped CLI refuses `--host 0.0.0.0` outright, but the
    // composition supports overriding the webserver row's config via a patch
    // overlay — the sanctioned path around the guard. The generated overlay
    // keeps the CLI's own --port resolution.
    if (this.host === '0.0.0.0') {
      const lanPatch = this.writeLanPatch()
      if (lanPatch !== null) args.push('--patch', lanPatch)
    }
    args.push('--port', String(desired))
    const childEnv = {
      ...process.env,
      ...this.env,
      ...(this.useSystemNode ? {} : { ELECTRON_RUN_AS_NODE: '1' }),
      DSH_DESKTOP_PARENT_PID: String(process.pid),
    }
    // Session-scoped variables from a surrounding harness/shell run must not
    // leak into the desktop app's own server instance: they can pin it to a
    // foreign port, session id, or shell mode.
    for (const key of ['DSH_SESSION_ID', 'DSH_SESSION_JSONL', 'DSH_WEB_URL', 'DSH_SHELL']) {
      delete childEnv[key]
    }
    const child = spawn(this.useSystemNode ? this.env.DSH_DEV_NODE || 'node' : process.execPath, args, {
      env: childEnv,
      cwd: process.env.HOME ?? process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child
    this.url = null
    this.port = null

    const stamp = () => new Date().toISOString()
    const write = (line) => {
      const row = `${stamp()} ${line}`
      logStream.write(row + '\n')
      this.logTail.push(row)
      if (this.logTail.length > 400) this.logTail.shift()
    }
    let pending = ''
    const feed = (chunk, label) => {
      // A superseded child (from an earlier start) must not claim the url/
      // port of the current boot, nor write into the current log stream.
      if (this.child !== child) return
      pending += chunk.toString()
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        write(`[${label}] ${line}`)
        const match = URL_LINE.exec(line)
        if (match && this.port === null) {
          this.port = Number(match[2])
          this.lastPort = Number(match[2])
          this.url = `http://127.0.0.1:${this.port}`
        }
        if (line.startsWith('[desktop-event] ') && typeof this.onDesktopEvent === 'function') {
          try {
            this.onDesktopEvent(JSON.parse(line.slice('[desktop-event] '.length)))
          } catch {
            /* malformed marker — ignore */
          }
        }
      }
    }
    child.stdout.on('data', (c) => feed(c, 'out'))
    child.stderr.on('data', (c) => feed(c, 'err'))

    const exited = new Promise((resolve) => {
      child.on('exit', (code, signal) => resolve({ code, signal }))
    })

    // Wait for the URL line, then poll readiness; reject on early exit or timeout.
    const urlDeadline = Date.now() + 60_000
    while (this.url === null && !child.exitCode && Date.now() < urlDeadline) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (this.url === null) {
      if (child.exitCode !== null) {
        throw new Error(`dsh 服务启动即退出（退出码 ${child.exitCode}）。最近日志：\n${this.logTail.slice(-12).join('\n')}`)
      }
      throw new Error(`dsh 服务未在 60 秒内报告监听地址。日志：\n${this.logTail.slice(-12).join('\n')}`)
    }

    const readyDeadline = Date.now() + 30_000
    for (;;) {
      if (child.exitCode !== null) {
        throw new Error(`dsh 服务在就绪前退出（退出码 ${child.exitCode}）。最近日志：\n${this.logTail.slice(-12).join('\n')}`)
      }
      try {
        const res = await fetch(this.url, { signal: AbortSignal.timeout(1500) })
        if (res.status < 500) break
      } catch {
        /* not up yet */
      }
      if (Date.now() > readyDeadline) {
        throw new Error(`dsh 服务 30 秒内未就绪。最近日志：\n${this.logTail.slice(-12).join('\n')}`)
      }
      await new Promise((r) => setTimeout(r, 250))
    }

    // Watch for unexpected death once we are running.
    exited.then(({ code, signal }) => {
      logStream.end()
      if (this.child === child && !this.stopped && typeof this.onUnexpectedExit === 'function') {
        this.onUnexpectedExit({ code, signal })
      }
    })

    write('[desktop] server ready')
    if (typeof this.onReady === 'function') {
      try {
        this.onReady()
      } catch {
        /* ready hook is best-effort */
      }
    }
    return { url: this.url, port: this.port }
  }

  async stop() {
    this.stopped = true
    const child = this.child
    if (!child || child.exitCode !== null) {
      this.child = null
      return
    }
    await new Promise((resolve) => {
      const kill = setTimeout(() => child.kill('SIGKILL'), 8000)
      child.once('exit', () => {
        clearTimeout(kill)
        resolve()
      })
      child.kill('SIGTERM')
    })
    this.child = null
  }
}
