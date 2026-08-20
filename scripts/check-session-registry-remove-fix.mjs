/** Exercise the force-remove methods from the installed or packaged runtime. */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const appFlag = args.indexOf('--app')
const appDir = appFlag >= 0 ? args[appFlag + 1] : undefined
if (appFlag >= 0 && !appDir) throw new Error('--app requires a .app directory path')

const appRoot = appDir
  ? path.join(path.resolve(appDir), 'Contents', 'Resources', 'app')
  : root
const scope = path.join(appRoot, 'node_modules', '@deepseek-ai')

const agentModule = await import(pathToFileURL(path.join(scope, 'dsh-agent', 'lib', 'index.js')).href)
const sessionModule = await import(pathToFileURL(path.join(scope, 'dsh-session', 'lib', 'index.js')).href)

function exerciseRemove(Registry, busyFields, label) {
  if (typeof Registry.prototype.remove !== 'function') throw new Error(`${label}.remove is missing`)

  const registry = Object.create(Registry.prototype)
  registry.store = new Map()

  if (registry.remove('missing') !== false) throw new Error(`${label}.remove must return false for a missing id`)

  const normal = {
    id: 'normal',
    session: {},
    announcing: false,
    announced: false,
    appending: false,
    detachRequested: false,
  }
  registry.store.set(normal.id, normal)
  if (registry.remove(normal.id) !== true || registry.store.has(normal.id)) {
    throw new Error(`${label}.remove must delete a normal live entry from the real registry store`)
  }

  for (const busyField of busyFields) {
    const busy = {
      id: busyField,
      session: {},
      announcing: false,
      announced: false,
      appending: false,
      detachRequested: false,
    }
    busy[busyField] = true
    registry.store.set(busy.id, busy)
    if (registry.remove(busy.id) !== true || busy.detachRequested !== true || !registry.store.has(busy.id)) {
      throw new Error(`${label}.remove must defer while ${busyField} is active`)
    }
    busy[busyField] = false
    registry.detachEntered(busy)
    if (registry.store.has(busy.id)) {
      throw new Error(`${label}.remove must complete after ${busyField} becomes inactive`)
    }
  }
}

exerciseRemove(agentModule.AgentRegistry, ['announcing'], 'AgentRegistry')
exerciseRemove(sessionModule.SessionStore, ['announcing', 'appending'], 'SessionStore')

const apiproxy = readFileSync(path.join(scope, 'dsh-host-apiproxy', 'lib', 'index.js'), 'utf8')
if (!apiproxy.includes('ctx.agents.remove?.(sessionId);') || !apiproxy.includes('ctx.sessions.remove?.(sessionId);')) {
  throw new Error('apiproxy deletion teardown is not wired to both force-remove methods')
}

console.log(`[registry-remove-check] passed: ${appDir ? path.resolve(appDir) : 'installed node_modules'}`)
