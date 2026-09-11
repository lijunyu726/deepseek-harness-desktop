/**
 * Apply the desktop enhancement overlays to the installed upstream packages.
 *
 * The upstream packages are NOT built here — they arrive as npm dependencies.
 * This repository ships the enhanced full files under `patches/` and this
 * script overlays them onto the repo's node_modules before electron-builder
 * packages them. Full-file overlays (not string surgery) because the
 * enhancement set is too large for fragile in-place edits, and because a
 * `.upstream-backup` next to each target makes the applied delta auditable.
 *
 * The 0.1.5 line split what the 0.1.1 line kept in one package, so one 0.1.1
 * overlay can now belong to several targets:
 *
 *   0.1.1 target                          →  0.1.5 target(s)
 *   dsh-host-apiproxy/lib/index.js        →  dsh-api-session-controller/lib/index.js
 *                                            dsh-api-workspace-controller/lib/index.js
 *   dsh-client-ui-conversation/lib/client.js → dsh-client-ui-chat/lib/client.js
 *                                              dsh-client-ui-conversation/lib/client.js
 *   dsh-agent-loop/lib/index.js           →  dsh-agent-loop/lib/index.js   (unchanged)
 *
 * Every overlay is idempotent and keeps the upstream original as
 * `<file>.upstream-backup`. A bundle with a syntax error would ship a broken
 * DMG, so each overlay is syntax-checked before it is accepted.
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

/**
 * One overlay: a file under patches/ replacing one installed upstream file.
 * `markers` are the strings that must exist in the applied result — they are
 * what proving the overlay actually landed means, and they catch an upstream
 * rewrite that silently dropped the seat the enhancement was written against.
 */
const OVERLAYS = [
  {
    patch: 'agent-loop-index.js',
    target: 'dsh-agent-loop/lib/index.js',
    // Strips delegated image blocks at the request boundary for text-only models.
    markers: ['stripDelegatedImages', 'DESKTOP_VISION_BRIDGE_TEXT'],
  },
  {
    patch: 'session-controller-index.js',
    target: 'dsh-api-session-controller/lib/index.js',
    // Prompt admission: desktop metadata file blocks bypass the official
    // receipt path, and text-only models delegate their images to the vision
    // MCP through the attachment seam's imageHostPath.
    markers: ['desktopFileContent', 'desktopVisionMcpContent', 'isDesktopMetadataFile', 'imageHostPath'],
  },
  {
    patch: 'workspace-controller-index.js',
    target: 'dsh-api-workspace-controller/lib/index.js',
    // Workspace deletion cascades to each of its sessions before it unregisters.
    markers: ['teardownSessionForDelete'],
  },
  {
    patch: 'chat-client.js',
    target: 'dsh-client-ui-chat/lib/client.js',
    // Transcript rendering: file chips, vision-bridge text suppression, the
    // in-place edit editor, and the history-rail prompt navigation.
    markers: ['DESKTOP_VISION_BRIDGE_DISPLAY', 'normalizeFileBlock', 'data-dsh-edit-editor', 'promptTargetKey'],
  },
  {
    patch: 'conversation-client.js',
    target: 'dsh-client-ui-conversation/lib/client.js',
    // Composer side: draft attachment classification and prompt serialization
    // for images, files, and folders.
    markers: ['__DSH_SAVE_UPLOAD__', 'isImageFile', 'serializeImages'],
  },
]

function resolveTarget(overlay) {
  return path.join(nm, ...overlay.target.split('/'))
}

/** Overlay one file, keeping the upstream original as <file>.upstream-backup. */
function overlay(entry) {
  const patchFile = path.join(patchesDir, entry.patch)
  const target = resolveTarget(entry)
  if (!existsSync(patchFile)) throw new Error(`missing patch file: ${patchFile}`)
  if (!existsSync(target)) throw new Error(`target missing (upstream version drift?): ${target}`)
  const backup = `${target}.upstream-backup`
  if (!existsSync(backup)) copyFileSync(target, backup)
  copyFileSync(patchFile, target)
  execFileSync(process.execPath, ['--check', target], { stdio: 'inherit' })
  console.log(`[upload-apply] ${entry.patch} → ${entry.target}`)
}

function check() {
  let ok = true
  for (const entry of OVERLAYS) {
    const target = resolveTarget(entry)
    const source = existsSync(target) ? readFileSync(target, 'utf8') : ''
    const missing = entry.markers.filter((marker) => !source.includes(marker))
    const applied = missing.length === 0
    console.log(`[upload-check] ${applied ? 'OK     ' : 'MISSING'} ${entry.target}`)
    if (!applied) {
      for (const marker of missing) console.log(`               missing marker: ${marker}`)
      ok = false
    }
  }
  if (!ok) throw new Error('upload enhancements not fully applied — run `npm run upload:prepare`')
}

if (checkOnly) {
  check()
} else {
  // Refuse to start unless every overlay can actually be applied: a run that
  // dies halfway leaves node_modules carrying some overlays and not others,
  // which reads as success to the next `upload:check`.
  const missing = OVERLAYS
    .map((entry) => ({ entry, patchFile: path.join(patchesDir, entry.patch) }))
    .filter(({ patchFile }) => !existsSync(patchFile))
  if (missing.length > 0) {
    for (const { entry, patchFile } of missing) console.error(`[upload-apply] not yet ported: ${path.relative(root, patchFile)} (targets ${entry.target})`)
    throw new Error(`${missing.length} overlay(s) missing — port them before packaging`)
  }
  for (const entry of OVERLAYS) overlay(entry)
  check()
}
