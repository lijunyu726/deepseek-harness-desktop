/** Guard the Codex-style edit-after-interrupt flow against bundle regressions. */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const sourceConversation = path.join(root, 'patches', 'chat-client.js')
const sourcePlugin = path.join(root, 'packages', 'dsh-desktop', 'lib', 'client.js')

function fail(message) {
  throw new Error(`[edit-prompt-check] ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function read(file) {
  if (!existsSync(file)) fail(`missing file: ${file}`)
  return readFileSync(file, 'utf8')
}

/** Match runtime sanitization without weakening equality for executable code. */
function canonicalBuildPaths(source) {
  const marker = '//#region \\0dsh-css:'
  return source.split('\n').map((line) => {
    const at = line.indexOf(marker)
    if (at < 0) return line
    const start = at + marker.length
    const value = line.slice(start)
    const packages = value.indexOf('/packages/')
    if ((value.startsWith('/home/') || value.startsWith('/Users/') || value.startsWith('/virtual/')) && packages >= 0) {
      return `${line.slice(0, start)}/virtual/deepseek-harness${value.slice(packages)}`
    }
    return line
  }).join('\n')
}

function validate(label, conversation, plugin) {
  assert(
    conversation.includes('const messageText = contentParts(data.content).text;'),
    `${label}: message text is not derived from the durable message content`,
  )
  // The plugin renders the edit entry point itself, so the renderer has no
  // action button handing text to onEdit any more: it only has to swap the
  // bubble for a textarea while the plugin's edit state targets this row.
  assert(
    conversation.includes('editState.editing !== null && editState.editing.key === node.key'),
    `${label}: the in-place editor does not follow the plugin's editing state`,
  )
  assert(
    !conversation.includes('editState.onEdit(text);'),
    `${label}: undefined action-callback text regression is present`,
  )
  assert(
    conversation.includes('if (e.key === "Escape")')
      && conversation.includes('if (e.key === "Enter" && !e.shiftKey && !composing'),
    `${label}: Codex-style Escape/Enter/Shift+Enter keyboard behavior is incomplete`,
  )

  const sendStart = plugin.indexOf('window.__dshEditSend__ = (text) => {')
  const sendEnd = plugin.indexOf('window.__dshEditCancel__ = () => {', sendStart)
  assert(sendStart >= 0 && sendEnd > sendStart, `${label}: edit send bridge is missing`)
  const sendBody = plugin.slice(sendStart, sendEnd)
  const setDraft = sendBody.indexOf('ia.setDraft(value)')
  const submit = sendBody.indexOf('ia.submit()')
  const clear = sendBody.indexOf('_setEditSnapshot(null)')
  assert(
    setDraft >= 0 && submit > setDraft && clear > submit,
    `${label}: edit resend must use inputActions setDraft -> submit before clearing state`,
  )
  console.log(`[edit-prompt-check] OK ${label}`)
}

const sourceConversationText = read(sourceConversation)
const sourcePluginText = read(sourcePlugin)
validate('sources', sourceConversationText, sourcePluginText)

if (args.includes('--installed')) {
  const installedConversation = path.join(root, 'node_modules', '@deepseek-ai', 'dsh-client-ui-chat', 'lib', 'client.js')
  const installedPlugin = path.join(root, 'node_modules', '@deepseek-ai', 'dsh-desktop', 'lib', 'client.js')
  const installedConversationText = read(installedConversation)
  const installedPluginText = read(installedPlugin)
  assert(canonicalBuildPaths(installedConversationText) === canonicalBuildPaths(sourceConversationText), 'installed chat bundle differs from patches/chat-client.js')
  assert(installedPluginText === sourcePluginText, 'installed desktop plugin differs from packages/dsh-desktop/lib/client.js')
  validate('installed runtime', installedConversationText, installedPluginText)
}

const appFlag = args.indexOf('--app')
if (appFlag >= 0) {
  const appDir = args[appFlag + 1]
  if (!appDir) fail('--app requires a .app directory path')
  const appRoot = path.join(path.resolve(appDir), 'Contents', 'Resources', 'app', 'node_modules', '@deepseek-ai')
  const appConversationText = read(path.join(appRoot, 'dsh-client-ui-chat', 'lib', 'client.js'))
  const appPluginText = read(path.join(appRoot, 'dsh-desktop', 'lib', 'client.js'))
  assert(canonicalBuildPaths(appConversationText) === canonicalBuildPaths(sourceConversationText), 'packaged conversation bundle differs from source patch')
  assert(appPluginText === sourcePluginText, 'packaged desktop plugin differs from source package')
  validate('packaged app', appConversationText, appPluginText)
}
