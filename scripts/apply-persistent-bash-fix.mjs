/**
 * Backport DeepSeek Harness rc.7's persistent-bash prompt-readiness fix onto
 * the rc.6 runtime consumed by this desktop shell.
 *
 * Official fix: deepseek-ai/deepseek-harness@a8dc6f9776d20d2e846e8373628ffd1a03808c84
 * The patch deliberately covers both sides of the protocol: terminal-bash
 * re-asserts its controlled PS1, while tool-bash-persistent stops owning PS1.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

const terminalTarget = path.join(
  root,
  'node_modules',
  '@deepseek-ai',
  'dsh-terminal-bash',
  'lib',
  'index.js',
)
const persistentToolTarget = path.join(
  root,
  'node_modules',
  '@deepseek-ai',
  'dsh-tool-bash-persistent',
  'lib',
  'index.js',
)

function count(source, needle) {
  return source.split(needle).length - 1
}

function replaceOnce(source, before, after, label) {
  const matches = count(source, before)
  if (matches !== 1) throw new Error(`${label}: expected one match, found ${matches}`)
  return source.replace(before, after)
}

function replaceFunction(source, name, replacement) {
  const start = `function ${name}(`
  const startIndex = source.indexOf(start)
  if (startIndex === -1 || source.indexOf(start, startIndex + 1) !== -1) {
    throw new Error(`${name}: expected one function declaration`)
  }
  const nextIndex = source.indexOf('\nfunction ', startIndex + start.length)
  if (nextIndex === -1) throw new Error(`${name}: next function boundary was not found`)
  return `${source.slice(0, startIndex)}${replacement}${source.slice(nextIndex + 1)}`
}

async function patchTerminal() {
  let source = await readFile(terminalTarget, 'utf8')
  const before = '\t\tPROMPT_COMMAND: "printf \\"\\\\033]133;D;%s\\\\007\\" \\"$?\\"",'
  const after = "\t\tPROMPT_COMMAND: `printf \"\\\\033]133;D;%s\\\\007\" \"$?\"; PS1='${CONTROLLED_PROMPT}'`,"

  if (source.includes(after)) {
    if (source.includes(before)) throw new Error('terminal-bash contains both old and fixed PROMPT_COMMAND forms')
    console.log(`persistent bash terminal fix already applied: ${terminalTarget}`)
    return
  }
  if (checkOnly) throw new Error(`persistent bash terminal fix is not applied: ${terminalTarget}`)
  source = replaceOnce(source, before, after, 'terminal-bash PROMPT_COMMAND')
  await writeFile(terminalTarget, source, 'utf8')
  console.log(`persistent bash terminal fix applied: ${terminalTarget}`)
}

async function patchPersistentTool() {
  let source = await readFile(persistentToolTarget, 'utf8')
  const fixed = [
    'function trimTrailingNewline(text) {',
    '\t\t\t\t\ttext: "stty -echo",',
    '\t\t\tif (result.waitReason === "stdin_read") return renderCaptured(',
  ]
  const oldPrompt = 'const SHELL_PROMPT = "__DSH_PERSISTENT_BASH_PROMPT__ ";\n'

  if (fixed.every((marker) => source.includes(marker)) && !source.includes(oldPrompt)) {
    console.log(`persistent bash tool fix already applied: ${persistentToolTarget}`)
    return
  }
  if (checkOnly) throw new Error(`persistent bash tool fix is not applied: ${persistentToolTarget}`)

  source = replaceOnce(source, oldPrompt, '', 'persistent tool private prompt constant')
  source = replaceFunction(
    source,
    'stripPrompt',
    'function trimTrailingNewline(text) {\n\treturn text.replace(/\\r?\\n$/, "");\n}\n',
  )
  source = replaceOnce(
    source,
    '\t\ttext: stripPrompt((fallbackEnd < 0 ? afterStart : afterStart.slice(0, fallbackEnd)).replaceAll(SHELL_PROMPT, "")),',
    '\t\ttext: trimTrailingNewline(fallbackEnd < 0 ? afterStart : afterStart.slice(0, fallbackEnd)),',
    'persistent tool fallback output',
  )
  const stripCalls = count(source, 'stripPrompt(')
  if (stripCalls !== 2) throw new Error(`persistent tool output cleanup: expected two remaining calls, found ${stripCalls}`)
  source = source.replaceAll('stripPrompt(', 'trimTrailingNewline(')
  source = replaceFunction(source, 'promptCompleted', '')
  source = replaceOnce(
    source,
    '\t\t\t\t\ttext: ' + '`stty -echo; PS1=${quoteForBash(SHELL_PROMPT)}`' + ',',
    '\t\t\t\t\ttext: "stty -echo",',
    'persistent tool shell initialization',
  )
  source = replaceOnce(
    source,
    '\t\t\tif (promptCompleted(result)) return renderCaptured(',
    '\t\t\tif (result.waitReason === "stdin_read") return renderCaptured(',
    'persistent tool stdin-read fallback',
  )
  if (source.includes('SHELL_PROMPT') || source.includes('promptCompleted(') || source.includes('stripPrompt(')) {
    throw new Error('persistent tool patch left obsolete prompt coupling behind')
  }
  await writeFile(persistentToolTarget, source, 'utf8')
  console.log(`persistent bash tool fix applied: ${persistentToolTarget}`)
}

await patchTerminal()
await patchPersistentTool()
