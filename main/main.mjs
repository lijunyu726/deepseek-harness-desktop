/**
 * DeepSeek Harness desktop shell — Electron main process.
 *
 * Boot order: single-instance lock → Codex-style splash window → spawn the
 * dsh web server (child process on Electron's bundled Node) → once ready,
 * fade the splash out and load the app. Closing the window keeps the app
 * alive (tray / Dock); quitting tears the server down gracefully.
 * @module main/main
 */

import { app, BrowserWindow, dialog, Menu, nativeImage, Notification, session, shell, Tray } from 'electron'
import { existsSync, readFileSync, readlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMenu } from './menu.mjs'
import { buildPathEnv, DshServer } from './server.mjs'
import { createTray } from './tray.mjs'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = path.join(moduleDir, '..', 'assets')
const SPLASH_PATH = path.join(ASSET_DIR, 'splash.html')
const PATCH_PATH = path.join(ASSET_DIR, 'desktop.patch.yml')
const MIN_SPLASH_MS = 2000

app.setName('DeepSeek Harness')

// Test aid: DSH_USER_DATA_DIR=<dir> isolates this instance's profile (lock,
// cache, logs) so a dev run can coexist with a user's installed app.
if (process.env.DSH_USER_DATA_DIR) {
  app.setPath('userData', process.env.DSH_USER_DATA_DIR)
}

/**
 * Acquire the single-instance lock, recovering from a stale lock left behind
 * by a force-killed instance (macOS lock symlink points at hostname-pid).
 */
function acquireInstanceLock() {
  if (app.requestSingleInstanceLock()) return true
  // The lock may be stale: check the target pid and retry once after unlinking.
  try {
    const lockPath = path.join(app.getPath('userData'), 'SingletonLock')
    const target = readlinkSync(lockPath)
    const pid = Number(/[^\d](\d+)$/.exec(target)?.[1])
    if (Number.isInteger(pid) && pid > 0) {
      let alive = true
      try {
        process.kill(pid, 0)
      } catch (err) {
        alive = err.code !== 'ESRCH'
      }
      if (!alive) {
        for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
          try {
            unlinkSync(path.join(app.getPath('userData'), name))
          } catch {
            /* not present */
          }
        }
        return app.requestSingleInstanceLock()
      }
    }
  } catch {
    /* not a stale lock we understand — fall through */
  }
  return false
}

if (!acquireInstanceLock()) {
  // A live instance is already running; focus it on next activation instead of opening a second server.
  app.quit()
} else {
  main()
}

let win = null
let splash = null
let tray = null
let server = null
let quitting = false
let logPath = ''
let pendingNotifications = 0
let desktopConfig = {}
let serverHost = '127.0.0.1'
let restarting = false
let restartRequested = false

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Apply the shell's desktop config: notification gating, launch-at-login,
 * and the proxy used by shell-side fetches (updater). The dsh server child
 * receives the proxy via its environment at spawn, so proxy changes take
 * effect on the next service start.
 */
function applyDesktopConfig(next) {
  desktopConfig = next && typeof next === 'object' ? next : {}
  if (app.isPackaged) {
    const want = desktopConfig.launchAtLogin === true
    if (app.getLoginItemSettings().openAtLogin !== want) {
      app.setLoginItemSettings({ openAtLogin: want })
    }
  }
  try {
    const proxyUrl = typeof desktopConfig.proxyUrl === 'string' ? desktopConfig.proxyUrl.trim() : ''
    void session.defaultSession.setProxy(proxyUrl ? { proxyRules: proxyUrl } : { mode: 'direct' })
  } catch {
    /* session proxy is best-effort */
  }
  // LAN access: the dsh child binds 0.0.0.0 (LAN) or 127.0.0.1 (local). A
  // change restarts the service so the new bind takes effect immediately.
  const wantHost = desktopConfig.lanAccess === true ? '0.0.0.0' : '127.0.0.1'
  if (server && serverHost !== wantHost) {
    serverHost = wantHost
    void restartServer()
    return
  }
  serverHost = wantHost
  installMenu()
}

/**
 * Desktop events emitted by the dsh plugin (agent lifecycle markers on the
 * server stdout): macOS notification + Dock badge while the window is
 * unfocused; new work clears the badge.
 */
function handleDesktopEvent(event) {
  if (!event || typeof event.kind !== 'string') return
  if (event.kind === 'agent-running') {
    pendingNotifications = 0
    app.dock.setBadge('')
    return
  }
  if (event.kind === 'desktop-config') {
    applyDesktopConfig(event.config)
    return
  }
  if (event.kind === 'agent-idle' || event.kind === 'agent-error') {
    // Push a page event so balance/usage surfaces refresh after each task.
    const target = win
    if (target && !target.isDestroyed()) {
      void target.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('dsh-desktop:agent-idle'))`).catch(() => {})
    }
  }
  if (event.kind === 'desktop-action') {
    if (event.action === 'restart-server') {
      void restartServer()
      return
    }
    if ((event.action === 'open-storage-dir' || event.action === 'open-path') && typeof event.path === 'string') {
      const home = app.getPath('home')
      if (event.path === home || event.path.startsWith(`${home}${path.sep}`)) {
        void shell.openPath(event.path)
      }
      return
    }
    return
  }
  if (desktopConfig.notifications === false) return
  const focused = win !== null && !win.isDestroyed() && win.isFocused()
  if (focused || event.kind !== 'agent-idle' && event.kind !== 'agent-error') return
  pendingNotifications += 1
  app.dock.setBadge(String(pendingNotifications))
  const body = event.kind === 'agent-error'
    ? `任务出错：${String(event.message ?? '').slice(0, 120)}`
    : '任务已完成'
  const notification = new Notification({ title: 'DeepSeek Harness', body, silent: true })
  notification.on('click', () => void showWindow())
  notification.show()
}

/** Resolve the dsh server entry. DSH_DEV_BIN points at a checkout build for hacking on dsh itself. */
function resolveServerTarget(appPath) {
  const devBin = process.env.DSH_DEV_BIN
  if (devBin && existsSync(devBin)) {
    return { binPath: devBin, useSystemNode: true }
  }
  return {
    binPath: path.join(appPath, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    useSystemNode: false,
  }
}

/**
 * Open the shell window. `target` is 'splash' for the boot animation or a
 * server URL for a direct load (server already running).
 */
async function openWindow(target) {
  const window = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    title: app.name,
    backgroundColor: '#0B0D13',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Open target="_blank" and external links in the default browser; never in-app.
  window.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:/.test(targetUrl)) void shell.openExternal(targetUrl)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (server?.url && !targetUrl.startsWith(server.url)) {
      event.preventDefault()
      if (/^https?:/.test(targetUrl)) void shell.openExternal(targetUrl)
    }
  })

  window.once('ready-to-show', () => window.show())
  window.on('focus', () => {
    pendingNotifications = 0
    app.dock.setBadge('')
  })
  window.on('closed', () => {
    if (win === window) win = null
  })

  win = window
  if (target === 'splash') {
    await window.loadFile(SPLASH_PATH, { query: { version: app.getVersion() } })
  } else {
    await window.loadURL(target)
  }
  if (!window.isDestroyed() && !window.isVisible()) window.show()
  return window
}

/** Run a splash hook in the renderer; the hooks return promises that resolve after their fade-out. */
async function splashSignal(window, fn, args = []) {
  if (!window || window.isDestroyed()) return
  try {
    await window.webContents.executeJavaScript(`${fn}(${JSON.stringify(args).slice(1, -1)})`)
  } catch {
    /* splash already gone */
  }
}

async function showWindow() {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    return win
  }
  if (splash?.window && !splash.window.isDestroyed()) {
    splash.window.show()
    splash.window.focus()
    return splash.window
  }
  if (server?.url) return openWindow(server.url)
  return null
}

/** Cold start: splash window up immediately, server boots behind it, then cross-fade to the app. */
async function boot() {
  const window = await openWindow('splash')
  splash = { window, startedAt: Date.now() }

  // Debug aid: DSH_SPLASH_CAPTURE=<dir> writes splash frames for visual inspection.
  if (process.env.DSH_SPLASH_CAPTURE) {
    const { writeFile } = await import('node:fs/promises')
    const grab = async (name) => {
      try {
        const img = await window.webContents.capturePage()
        await writeFile(`${process.env.DSH_SPLASH_CAPTURE}/${name}`, img.toPNG())
      } catch {
        /* window may be gone */
      }
    }
    void (async () => {
      await sleep(1300)
      await grab('splash-t1.png')
      await sleep(1600)
      await grab('splash-t2.png')
    })()
  }

  try {
    await server.start()
  } catch (err) {
    await splashSignal(window, '__splashFail', [String(err?.message ?? err)])
    dialog.showErrorBox('DeepSeek Harness 启动失败', String(err?.message ?? err))
    app.exit(1)
    return
  }

  // Let the animation breathe even when the server is unusually fast.
  const remain = MIN_SPLASH_MS - (Date.now() - splash.startedAt)
  if (remain > 0) await sleep(remain)
  await splashSignal(window, '__splashReady')
  splash = null
  if (!window.isDestroyed()) await window.loadURL(server.url)
}

async function restartServer() {
  if (!server) return
  if (restarting) {
    restartRequested = true
    return
  }
  restarting = true
  try {
    do {
      restartRequested = false
      const previousUrl = server.url
      server.host = serverHost
      try {
        await server.start()
      } catch (err) {
        dialog.showErrorBox('服务重启失败', String(err?.message ?? err))
        return
      }
      // Same URL (same port): leave the window alone — the shell's connection
      // client reconnects in place, so open views (e.g. the settings page while
      // toggling LAN access) survive the restart. Only a changed URL needs a
      // reload, and only a missing window needs opening.
      if (win && !win.isDestroyed()) {
        if (server.url !== previousUrl) await win.loadURL(server.url)
      } else {
        await openWindow(server.url)
      }
    } while (restartRequested && !quitting)
  } finally {
    restarting = false
  }
}

function handleUnexpectedExit({ code }) {
  if (quitting || !server) return
  const buttons = ['重新启动服务', '退出']
  void dialog
    .showMessageBox({
      type: 'error',
      title: app.name,
      message: 'DeepSeek Harness 服务已停止',
      detail: `服务进程意外退出（退出码 ${code ?? '未知'}）。重启会打开新的会话视图；日志位于：\n${logPath}`,
      buttons,
      defaultId: 0,
      cancelId: 1,
    })
    .then(({ response }) => {
      if (response === 0) void restartServer()
      else app.quit()
    })
}

function quitApp() {
  if (quitting) return
  quitting = true
  if (server?.running) {
    void server.stop().finally(() => app.quit())
  } else {
    app.quit()
  }
}

/** Desktop-shell persistent config (userData/desktop-config.json). */
function desktopConfigPath() {
  return path.join(app.getPath('userData'), 'desktop-config.json')
}

function readDesktopConfig() {
  try {
    const raw = JSON.parse(readFileSync(desktopConfigPath(), 'utf8'))
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function writeDesktopConfig() {
  try {
    writeFileSync(desktopConfigPath(), `${JSON.stringify(desktopConfig, null, 2)}\n`, 'utf8')
  } catch {
    /* best-effort */
  }
}

function installMenu() {
  Menu.setApplicationMenu(
    buildMenu({ app, dialog, Menu, shell }, {
      onQuit: quitApp,
      onOpenLog: () => void shell.openPath(logPath),
      isLoginItemEnabled: () => app.getLoginItemSettings().openAtLogin,
      onToggleLoginItem: () => void toggleLoginItem(),
    }),
  )
}

function toggleLoginItem() {
  if (!app.isPackaged) {
    void dialog.showMessageBox({
      type: 'info',
      title: app.name,
      message: '开发模式下不可设置开机自启',
      detail: '打包安装后该选项才生效（登录项必须指向已安装的 .app）。',
      buttons: ['好'],
    })
    return
  }
  const next = !app.getLoginItemSettings().openAtLogin
  desktopConfig = { ...desktopConfig, launchAtLogin: next }
  writeDesktopConfig()
  applyDesktopConfig(desktopConfig)
}async function main() {
  app.on('second-instance', () => void showWindow())
  app.on('activate', () => void showWindow())
  // macOS convention: closing the last window keeps the app alive (tray + Dock).
  app.on('window-all-closed', () => {})
  app.on('before-quit', (event) => {
    if (quitting || !server?.running) return
    event.preventDefault()
    quitApp()
  })

  await app.whenReady()

  const appPath = app.getAppPath()
  logPath = path.join(app.getPath('logs'), 'server.log')
  const target = resolveServerTarget(appPath)
  desktopConfig = readDesktopConfig()
  applyDesktopConfig(desktopConfig)
  const env = {
    PATH: await buildPathEnv(process.env.PATH ?? '', app.getPath('home')),
    DSH_DESKTOP: '1',
    DSH_DESKTOP_CONFIG: desktopConfigPath(),
    ...(typeof desktopConfig.proxyUrl === 'string' && desktopConfig.proxyUrl.trim().length > 0
      ? { HTTPS_PROXY: desktopConfig.proxyUrl.trim(), HTTP_PROXY: desktopConfig.proxyUrl.trim() }
      : {}),
    ...(target.useSystemNode && process.env.DSH_DEV_NODE
      ? { DSH_DEV_NODE: process.env.DSH_DEV_NODE }
      : {}),
  }
  server = new DshServer({
    binPath: target.binPath,
    useSystemNode: target.useSystemNode,
    logPath,
    env,
    patchPath: PATCH_PATH,
    pluginPath: path.join(appPath, 'node_modules', '@deepseek-ai', 'dsh-desktop'),
    host: serverHost,
    // Persisted port: keeps the LAN address (and the phone's saved link /
    // home-screen icon) stable across app relaunches — the desktop is
    // "mapped" at a fixed http://<ip>:<port>.
    preferredPort: Number.isInteger(desktopConfig.serverPort) && desktopConfig.serverPort > 0
      ? desktopConfig.serverPort
      : null,
    onDesktopEvent: handleDesktopEvent,
  })
  server.onUnexpectedExit = handleUnexpectedExit

  /** Remember the port the server actually bound, so the next launch reuses it. */
  const rememberPort = () => {
    if (server && Number.isInteger(server.port) && desktopConfig.serverPort !== server.port) {
      desktopConfig = { ...desktopConfig, serverPort: server.port }
      writeDesktopConfig()
    }
  }
  server.onReady = rememberPort

  installMenu()

  try {
    await boot()
  } catch (err) {
    dialog.showErrorBox('DeepSeek Harness 启动失败', String(err?.message ?? err))
    app.exit(1)
  }

  if (!tray) {
    tray = createTray({ Menu, nativeImage, Tray }, {
      iconDir: ASSET_DIR,
      onShow: () => void showWindow(),
      onQuit: quitApp,
    })
  }
}
