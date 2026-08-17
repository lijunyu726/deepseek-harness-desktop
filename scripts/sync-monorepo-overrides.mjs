/**
 * Copy the locally built session-deletion feature into the desktop dependency
 * tree while preserving the installed rc.6 package manifests.
 *
 * The desktop shell consumes published Harness packages. Product changes made
 * in this checkout therefore do not reach electron-builder unless their built
 * runtime files are overlaid before the desktop-only vision patch is applied.
 */

import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoDir = path.dirname(desktopDir)
const installedScope = path.join(desktopDir, 'node_modules', '@deepseek-ai')

const packages = [
  ['packages/client/connection', 'dsh-client-connection'],
  ['packages/client/runtime', 'dsh-client-runtime'],
  ['packages/client/ui-workspace', 'dsh-client-ui-workspace'],
  ['packages/extensions/cordis-client-runner', 'dsh-cordis-client-runner'],
  ['packages/extensions/tool-cordis', 'dsh-tool-cordis'],
  ['packages/host/apiproxy', 'dsh-host-apiproxy'],
  ['packages/session/session-persistence', 'dsh-session-persistence'],
  ['packages/session/session-persistence-jsonl', 'dsh-session-persistence-jsonl'],
  ['packages/workspace/workspace', 'dsh-workspace'],
]

for (const [sourcePackage, installedName] of packages) {
  const source = path.join(repoDir, sourcePackage, 'lib')
  const target = path.join(installedScope, installedName, 'lib')
  if (!existsSync(source)) throw new Error(`local build output is missing: ${source}`)
  if (!existsSync(target)) throw new Error(`desktop dependency is missing: ${target}`)
  cpSync(source, target, { recursive: true, force: true })
  console.log(`[monorepo-overlay] ${installedName}`)
}

const webSource = path.join(repoDir, 'apps', 'web', 'dist')
const webTarget = path.join(installedScope, 'dsh-web-frontend', 'dist')
if (!existsSync(webSource)) throw new Error(`local web build output is missing: ${webSource}`)
if (!existsSync(webTarget)) throw new Error(`desktop web dependency is missing: ${webTarget}`)
cpSync(webSource, webTarget, { recursive: true, force: true })
console.log('[monorepo-overlay] dsh-web-frontend')
