/**
 * Apply the desktop upload enhancements to the installed upstream packages.
 *
 * The three upstream packages (dsh-client-ui-conversation,
 * dsh-host-apiproxy and dsh-agent-loop) are NOT built here — they arrive as
 * npm dependencies. This repository ships the enhanced full files under
 * patches/ and this script overlays them onto the repo's node_modules before
 * electron-builder packages them (same reproducible-patch pattern as
 * apply-vision-bridge.mjs, but full-file overlays because the enhancement
 * set is too large for fragile string surgery).
 *
 * Overlays (idempotent; originals kept as <file>.upstream-backup):
 *   patches/conversation-client.js  → dsh-client-ui-conversation/lib/client.js
 *   patches/apiproxy-index.js       → dsh-host-apiproxy/lib/index.js
 *   patches/agent-loop-index.js     → dsh-agent-loop/lib/index.js
 *
 * The rc.2 workspace and web-frontend bundles are deliberately left native:
 * their attachment slots and archive lifecycle replaced the rc.6 surfaces
 * that the former desktop overlays targeted.
 */

import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')
const patchesDir = path.join(root, 'patches')
const nm = path.join(root, 'node_modules', '@deepseek-ai')

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')

const CONVERSATION_TARGET = path.join(nm, 'dsh-client-ui-conversation', 'lib', 'client.js')
const APIPROXY_TARGET = path.join(nm, 'dsh-host-apiproxy', 'lib', 'index.js')
const AGENT_LOOP_TARGET = path.join(nm, 'dsh-agent-loop', 'lib', 'index.js')

/** Overlay one file, keeping the upstream original as <file>.upstream-backup. */
function overlay(patchFile, target) {
  if (!existsSync(patchFile)) throw new Error(`missing patch file: ${patchFile}`)
  if (!existsSync(target)) throw new Error(`target missing (upstream version drift?): ${target}`)
  const backup = `${target}.upstream-backup`
  if (!existsSync(backup)) copyFileSync(target, backup)
  copyFileSync(patchFile, target)
  // A bundle with a syntax error ships a broken DMG: refuse.
  execFileSync(process.execPath, ['--check', target], { stdio: 'inherit' })
  console.log(`[upload-apply] ${path.relative(root, target)}`)
}

const MARKERS = {
  [CONVERSATION_TARGET]: ['__DSH_SAVE_UPLOAD__', 'dsh-desktop:navigate-prompt', 'data-dsh-edit-editor', 'DESKTOP_VISION_BRIDGE_DISPLAY'],
  [APIPROXY_TARGET]: ['desktopFileContent', 'admitEncodedImages', 'desktopVisionMcpContent', 'decodeBase64'],
  [AGENT_LOOP_TARGET]: ['stripDelegatedImages'],
}

function check() {
  let ok = true
  for (const [target, markers] of Object.entries(MARKERS)) {
    const source = existsSync(target) ? readFileSync(target, 'utf8') : ''
    const applied = markers.every((marker) => source.includes(marker))
    console.log(`[upload-check] ${applied ? 'OK' : 'MISSING'} ${path.relative(root, target)}`)
    if (!applied) ok = false
  }
  if (!ok) throw new Error('upload enhancements not fully applied — run `npm run upload:prepare`')
}

if (checkOnly) {
  check()
} else {
  overlay(path.join(patchesDir, 'conversation-client.js'), CONVERSATION_TARGET)
  overlay(path.join(patchesDir, 'apiproxy-index.js'), APIPROXY_TARGET)
  overlay(path.join(patchesDir, 'agent-loop-index.js'), AGENT_LOOP_TARGET)
  check()
}
