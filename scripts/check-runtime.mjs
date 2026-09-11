/**
 * Verify the official dsh runtime capabilities this desktop build depends on.
 *
 * Version-agnostic by name on purpose: the pinned upstream version lives in
 * EXPECTED_RUNTIME below, and bumping it is a deliberate edit here rather
 * than a filename change scattered across package.json and the docs.
 *
 * Run against the repo (`node_modules/`) or against a packaged build
 * (`--app "<path>/DeepSeek Harness.app"`); `audit:release` re-checks the
 * final .app so a release cannot ship a drifted dependency tree.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** The pinned upstream runtime this desktop build is written against. */
const EXPECTED_RUNTIME = '0.1.5-rc.2'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appFlag = process.argv.indexOf('--app')
const app = appFlag >= 0 ? process.argv[appFlag + 1] : null
const runtime = app === null
  ? root
  : path.join(path.resolve(app), 'Contents', 'Resources', 'app')

function source(relative) {
  const target = path.join(runtime, relative)
  if (!existsSync(target)) throw new Error(`runtime file missing: ${target} (upstream drift?)`)
  return readFileSync(target, 'utf8')
}

function packageVersion(name) {
  return JSON.parse(source(`node_modules/${name}/package.json`)).version
}

// 1. Every runtime package the build patches or composes must be the pinned
//    version. A silent minor drift is exactly how a full-file overlay ends up
//    replacing a file it was never written for.
for (const name of [
  '@deepseek-ai/dsh',
  '@deepseek-ai/dsh-llm-deepseek',
  '@deepseek-ai/dsh-agent-loop',
  '@deepseek-ai/dsh-api-session-controller',
  '@deepseek-ai/dsh-api-workspace-controller',
  '@deepseek-ai/dsh-attachment-local',
  '@deepseek-ai/dsh-client-ui-chat',
  '@deepseek-ai/dsh-client-ui-conversation',
]) {
  const found = packageVersion(name)
  if (found !== EXPECTED_RUNTIME) {
    throw new Error(`expected runtime ${EXPECTED_RUNTIME}, found ${name}=${found}`)
  }
}

// 2. Packages the 0.1.5 line removed must be gone: leaving one behind means a
//    stale lockfile still satisfies a dependency nothing composes any more.
for (const name of ['@deepseek-ai/dsh-host-apiproxy', '@deepseek-ai/dsh-client-runtime']) {
  if (existsSync(path.join(runtime, 'node_modules', name, 'package.json'))) {
    throw new Error(`removed upstream package still installed: ${name}`)
  }
}

// 3. The unified model: `deepseek-flash` (DeepSeek-V4.1-Flash) must be
//    published natively as text+image. This is what retires the desktop
//    image-delegation workaround for the default model.
const deepseek = source('node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js')
for (const marker of [
  'id: "deepseek-flash"',
  'inputModalities: ["text", "image"]',
  'DeepSeek Files API',
  'this.request("/files"',
]) {
  if (!deepseek.includes(marker)) throw new Error(`official multimodal marker missing: ${marker}`)
}

// 4. The desktop vision bridge (see AGENTS.md § 图片双路径) resolves the local
//    normalized-image object through this seam method rather than rebuilding
//    the path from a root property the 0.1.5 attachment store no longer
//    exposes.
// Assert against the runtime implementation, not the `.d.ts`: electron-builder's
// runtime whitelist ships no type declarations, and the abstract seam's empty
// body would not prove the local backend can actually resolve a path.
const attachmentLocal = source('node_modules/@deepseek-ai/dsh-attachment-local/lib/index.js')
if (!attachmentLocal.includes('imageHostPath(ref)')) {
  throw new Error('local attachment backend is missing imageHostPath(ref) — the vision bridge cannot resolve local image objects')
}

// 5. Persistent Bash stays the official implementation (no prompt surgery).
const terminal = source('node_modules/@deepseek-ai/dsh-terminal-bash/lib/index.js')
const persistent = source('node_modules/@deepseek-ai/dsh-tool-bash-persistent/lib/index.js')
for (const marker of ['const CONTROLLED_PROMPT = "dsh> "', 'PROMPT_COMMAND:', 'this.settleActive("stdin_read")']) {
  if (!terminal.includes(marker)) throw new Error(`official persistent Bash marker missing: ${marker}`)
}
for (const marker of ['text: "stty -echo"', 'result.waitReason === "stdin_read"']) {
  if (!persistent.includes(marker)) throw new Error(`official Bash tool marker missing: ${marker}`)
}

console.log(`[runtime-check] OK official dsh ${EXPECTED_RUNTIME}: deepseek-flash native vision + attachment imageHostPath + persistent Bash fast path`)
