/** Verify the official rc.2 runtime capabilities this desktop build depends on. */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appFlag = process.argv.indexOf('--app')
const app = appFlag >= 0 ? process.argv[appFlag + 1] : null
const runtime = app === null
  ? root
  : path.join(path.resolve(app), 'Contents', 'Resources', 'app')

function source(relative) {
  const target = path.join(runtime, relative)
  if (!existsSync(target)) throw new Error(`rc.2 runtime file missing: ${target}`)
  return readFileSync(target, 'utf8')
}

const dshPackage = JSON.parse(source('node_modules/@deepseek-ai/dsh/package.json'))
const deepseekPackage = JSON.parse(source('node_modules/@deepseek-ai/dsh-llm-deepseek/package.json'))
if (dshPackage.version !== '0.1.1-rc.2' || deepseekPackage.version !== '0.1.1-rc.2') {
  throw new Error(`expected official 0.1.1-rc.2 runtime, found dsh=${dshPackage.version}, llm-deepseek=${deepseekPackage.version}`)
}

const deepseek = source('node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js')
for (const marker of [
  'deepseek-v4-flash-vision-exp',
  'inputModalities: ["text", "image"]',
  'DeepSeek Files API',
  'this.request("/files"',
]) {
  if (!deepseek.includes(marker)) throw new Error(`official multimodal marker missing: ${marker}`)
}

const terminal = source('node_modules/@deepseek-ai/dsh-terminal-bash/lib/index.js')
const persistent = source('node_modules/@deepseek-ai/dsh-tool-bash-persistent/lib/index.js')
for (const marker of ['const CONTROLLED_PROMPT = "dsh> "', 'PROMPT_COMMAND:', 'this.settleActive("stdin_read")']) {
  if (!terminal.includes(marker)) throw new Error(`official persistent Bash marker missing: ${marker}`)
}
for (const marker of ['text: "stty -echo"', 'result.waitReason === "stdin_read"']) {
  if (!persistent.includes(marker)) throw new Error(`official Bash tool marker missing: ${marker}`)
}

console.log(`[rc2-check] OK official dsh ${dshPackage.version}: native vision Files API + persistent Bash fast path`)
