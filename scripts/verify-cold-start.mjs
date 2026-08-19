#!/usr/bin/env node

import { createWriteStream } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import net from 'node:net'

const projectRoot = resolve(import.meta.dirname, '..')
const sourceApp = resolve(process.argv[2] ?? join(projectRoot, 'release', 'mac-arm64', 'DeepSeek Harness.app'))
const coldRoot = await mkdtemp(join(tmpdir(), 'dsh-cold-start-'))
const coldApp = join(coldRoot, 'DeepSeek Harness.app')
const dshHome = join(coldRoot, 'dsh-home')
const userData = join(coldRoot, 'profile')
const stdoutPath = join(coldRoot, 'electron.out')

const delay = milliseconds => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds))

async function freePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : undefined
  server.close()
  await once(server, 'close')
  if (!Number.isInteger(port)) throw new Error('failed to allocate a loopback debugging port')
  return port
}

async function waitFor(predicate, attempts, delayMs, description) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await predicate()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await delay(delayMs)
  }
  throw new Error(`timed out waiting for ${description}`, { cause: lastError })
}

async function evaluateRenderer(debugPort) {
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
  const page = targets.find(target => target.type === 'page' && /^http:\/\/127\.0\.0\.1:/.test(target.url))
  if (!page) return undefined
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await Promise.race([
    new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener('open', resolveOpen, { once: true })
      socket.addEventListener('error', rejectOpen, { once: true })
    }),
    delay(2_000).then(() => { throw new Error('CDP websocket open timeout') }),
  ])
  try {
    const response = new Promise((resolveResponse, rejectResponse) => {
      socket.addEventListener('message', event => resolveResponse(JSON.parse(String(event.data))), { once: true })
      socket.addEventListener('error', rejectResponse, { once: true })
    })
    socket.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `({
          url: location.href,
          title: document.title,
          readyState: document.readyState,
          failedPluginBanner: document.body?.innerText.includes('Failed to load plugins') ?? false,
          bodyTextLength: document.body?.innerText.length ?? 0
        })`,
        returnByValue: true,
      },
    }))
    const message = await response
    return message.result?.result?.value
  } finally {
    socket.close()
  }
}

await mkdir(dshHome, { recursive: true })
await mkdir(userData, { recursive: true })
await cp(sourceApp, coldApp, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true })
const debugPort = await freePort()
const output = createWriteStream(stdoutPath, { flags: 'wx', mode: 0o600 })
await once(output, 'open')
const childEnv = {
  ...process.env,
  DSH_HOME: dshHome,
  DSH_USER_DATA_DIR: userData,
}
// When this script runs from inside the desktop's Electron-as-Node context
// (e.g. the app's own terminal), the leaked ELECTRON_RUN_AS_NODE makes the
// app binary boot as plain Node and reject the Chrome debugging flags below.
delete childEnv.ELECTRON_RUN_AS_NODE
const child = spawn(join(coldApp, 'Contents', 'MacOS', 'DeepSeek Harness'), [
  '--remote-debugging-address=127.0.0.1',
  `--remote-debugging-port=${debugPort}`,
], {
  env: childEnv,
  stdio: ['ignore', output, output],
})

let failure
try {
  const serverPort = await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`desktop process exited with code ${child.exitCode}`)
    let config
    try {
      config = JSON.parse(await readFile(join(userData, 'desktop-config.json'), 'utf8'))
    } catch {
      return undefined
    }
    if (!Number.isInteger(config.serverPort)) return undefined
    const response = await fetch(`http://127.0.0.1:${config.serverPort}/`, { signal: AbortSignal.timeout(2_000) })
    return response.ok ? config.serverPort : undefined
  }, 120, 500, 'isolated desktop server readiness')

  const renderer = await waitFor(
    async () => {
      const current = await evaluateRenderer(debugPort)
      return current?.readyState === 'complete' ? current : undefined
    },
    40,
    250,
    'desktop renderer CDP target',
  )
  if (renderer.readyState !== 'complete' || renderer.failedPluginBanner || renderer.bodyTextLength < 1) {
    throw new Error(`renderer verification failed: ${JSON.stringify(renderer)}`)
  }

  output.end()
  await once(output, 'close')
  const launchOutput = await readFile(stdoutPath, 'utf8')
  const failurePattern = /Failed to load plugins|loaded without registering|ERR_MODULE_NOT_FOUND|Cannot find module/i
  if (failurePattern.test(launchOutput)) throw new Error(`plugin/module failure in desktop output:\n${launchOutput}`)

  process.stdout.write(`${JSON.stringify({
    sourceApp,
    copiedOutsideProject: coldApp,
    serverUrl: `http://127.0.0.1:${serverPort}`,
    debugPort,
    renderer,
    isolatedDshHome: true,
    isolatedUserData: true,
    pluginLoadFailureDetected: false,
  }, null, 2)}\n`)
} catch (error) {
  failure = error
  output.end()
  await Promise.race([once(output, 'close'), delay(1_000)])
  try {
    const launchOutput = await readFile(stdoutPath, 'utf8')
    if (launchOutput.trim()) process.stderr.write(`desktop output:\n${launchOutput}\n`)
  } catch {
    // The original verification error is more useful than a missing log.
  }
} finally {
  if (child.exitCode === null) child.kill('SIGTERM')
  await Promise.race([once(child, 'exit'), delay(5_000)])
  await rm(coldRoot, { recursive: true, force: true })
}

if (failure) throw failure
