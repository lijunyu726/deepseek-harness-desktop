/** Guard history-Prompt navigation and scroll-triggered older-page loading. */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

function fail(message) {
  throw new Error(`[history-navigation-check] ${message}`)
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

function validate(label, conversation, pluginClient, pluginHost) {
  assert(
    pluginHost.includes("rememberPrompt(String(agent.id ?? ''), String(message?.id ?? ''), text)"),
    `${label}: accepted Prompt history does not retain its durable message id`,
  )
  assert(
    pluginHost.includes("messageId: typeof item.messageId === 'string' ? item.messageId : ''"),
    `${label}: legacy-safe message-id history decoding is missing`,
  )
  assert(
    pluginClient.includes("new CustomEvent('dsh-desktop:navigate-prompt'")
      && pluginClient.includes("title: '历史 Prompt：悬停预览 · 点击定位到原消息'"),
    `${label}: the history rail does not dispatch navigation targets`,
  )
  assert(
    !pluginClient.includes('inputActions.setDraft(entry.text)'),
    `${label}: history rail still prefills the composer`,
  )
  assert(
    conversation.includes('function promptTargetKey(order, nodes, target)')
      && conversation.includes('data.messageId === messageId')
      && conversation.includes('contentParts(data.content).text.trim() === text'),
    `${label}: durable-id and legacy text/time target resolution is incomplete`,
  )
  assert(
    conversation.includes('window.addEventListener("dsh-desktop:navigate-prompt", onNavigatePrompt)')
      && conversation.includes('revealPromptRow(local, key)'),
    `${label}: the conversation view does not consume and reveal history targets`,
  )
  assert(
    conversation.includes('if (hasMore && !loadingOlder && el.scrollTop <= 48) loadOlderAnchored();')
      && conversation.includes('if (el.scrollHeight <= el.clientHeight + 1) loadOlderAnchored();'),
    `${label}: older pages are not loaded automatically at the top or in a short viewport`,
  )
  assert(
    conversation.includes('loadOlder: () => scoped.loadOlder()'),
    `${label}: older-page promise is not returned to the single-flight loader`,
  )
  assert(
    !conversation.includes('onClick: loadOlderAnchored'),
    `${label}: the manual Load earlier button is still rendered`,
  )
  console.log(`[history-navigation-check] OK ${label}`)
}

const sourceConversation = read(path.join(root, 'patches', 'conversation-client.js'))
const sourcePluginClient = read(path.join(root, 'packages', 'dsh-desktop', 'lib', 'client.js'))
const sourcePluginHost = read(path.join(root, 'packages', 'dsh-desktop', 'lib', 'index.js'))
validate('sources', sourceConversation, sourcePluginClient, sourcePluginHost)

if (args.includes('--installed')) {
  const scope = path.join(root, 'node_modules', '@deepseek-ai')
  const installedConversation = read(path.join(scope, 'dsh-client-ui-conversation', 'lib', 'client.js'))
  const installedPluginClient = read(path.join(scope, 'dsh-desktop', 'lib', 'client.js'))
  const installedPluginHost = read(path.join(scope, 'dsh-desktop', 'lib', 'index.js'))
  assert(canonicalBuildPaths(installedConversation) === canonicalBuildPaths(sourceConversation), 'installed conversation bundle differs from source patch')
  assert(installedPluginClient === sourcePluginClient, 'installed plugin client differs from package source')
  assert(installedPluginHost === sourcePluginHost, 'installed plugin host differs from package source')
  validate('installed runtime', installedConversation, installedPluginClient, installedPluginHost)
}

const appFlag = args.indexOf('--app')
if (appFlag >= 0) {
  const appDir = args[appFlag + 1]
  if (!appDir) fail('--app requires a .app directory path')
  const scope = path.join(path.resolve(appDir), 'Contents', 'Resources', 'app', 'node_modules', '@deepseek-ai')
  const appConversation = read(path.join(scope, 'dsh-client-ui-conversation', 'lib', 'client.js'))
  const appPluginClient = read(path.join(scope, 'dsh-desktop', 'lib', 'client.js'))
  const appPluginHost = read(path.join(scope, 'dsh-desktop', 'lib', 'index.js'))
  assert(canonicalBuildPaths(appConversation) === canonicalBuildPaths(sourceConversation), 'packaged conversation bundle differs from source patch')
  assert(appPluginClient === sourcePluginClient, 'packaged plugin client differs from package source')
  assert(appPluginHost === sourcePluginHost, 'packaged plugin host differs from package source')
  validate('packaged app', appConversation, appPluginClient, appPluginHost)
}
