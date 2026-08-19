/**
 * Apply the desktop upload enhancements to the installed upstream packages.
 *
 * The three upstream packages (dsh-client-ui-conversation, dsh-host-apiproxy,
 * dsh-web-frontend) are NOT built here — they arrive as npm dependencies.
 * This repository ships the enhanced full files under patches/ and this
 * script overlays them onto the repo's node_modules before electron-builder
 * packages them (same reproducible-patch pattern as apply-vision-bridge.mjs,
 * but full-file overlays because the enhancement set is too large for
 * fragile string surgery).
 *
 * Overlays (idempotent; originals kept as <file>.upstream-backup):
 *   patches/conversation-client.js  → dsh-client-ui-conversation/lib/client.js
 *   patches/apiproxy-index.js       → dsh-host-apiproxy/lib/index.js
 *   patches/workspace-client.js     → dsh-client-ui-workspace/lib/client.js
 *   patches/web-frontend-bundle.js  → dsh-web-frontend/dist/assets/index-<hash>.js
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
const WORKSPACE_CLIENT_TARGET = path.join(nm, 'dsh-client-ui-workspace', 'lib', 'client.js')

function frontendTarget() {
  const dist = path.join(nm, 'dsh-web-frontend', 'dist')
  const html = path.join(dist, 'index.html')
  if (!existsSync(html)) return null
  const match = /assets\/index-[A-Za-z0-9_-]+\.js/.exec(readFileSync(html, 'utf8'))
  return match === null ? null : path.join(dist, match[0])
}

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
  [CONVERSATION_TARGET]: '__DSH_SAVE_UPLOAD__',
  [APIPROXY_TARGET]: 'desktopFileContent',
  [WORKSPACE_CLIENT_TARGET]: 'permanently deletes all of its sessions',
}

function check() {
  let ok = true
  for (const [target, marker] of Object.entries(MARKERS)) {
    const applied = existsSync(target) && readFileSync(target, 'utf8').includes(marker)
    console.log(`[upload-check] ${applied ? 'OK' : 'MISSING'} ${path.relative(root, target)}`)
    if (!applied) ok = false
  }
  const fe = frontendTarget()
  const feApplied = fe !== null && readFileSync(fe, 'utf8').includes('isImage===!1')
  console.log(`[upload-check] ${feApplied ? 'OK' : 'MISSING'} ${fe === null ? 'dsh-web-frontend/dist/assets/index-<hash>.js (unresolved)' : path.relative(root, fe)}`)
  if (!feApplied) ok = false
  if (!ok) throw new Error('upload enhancements not fully applied — run `npm run upload:prepare`')
}

if (checkOnly) {
  check()
} else {
  overlay(path.join(patchesDir, 'conversation-client.js'), CONVERSATION_TARGET)
  overlay(path.join(patchesDir, 'apiproxy-index.js'), APIPROXY_TARGET)
  overlay(path.join(patchesDir, 'workspace-client.js'), WORKSPACE_CLIENT_TARGET)
  const fe = frontendTarget()
  if (fe === null) throw new Error('cannot resolve dsh-web-frontend main bundle from dist/index.html')
  overlay(path.join(patchesDir, 'web-frontend-bundle.js'), fe)
  check()
}
