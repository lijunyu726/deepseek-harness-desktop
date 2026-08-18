/** Fail a release build that contains local user data, credentials, or build paths. */

import { lstat, opendir, readFile, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.resolve(process.argv[2] ?? path.join(root, 'release', 'mac-arm64', 'DeepSeek Harness.app'))
const resources = path.join(appDir, 'Contents', 'Resources', 'app')
const allowedTopLevel = new Set(['assets', 'main', 'node_modules', 'package.json'])
const forbiddenNames = new Set([
  '.credentials.yaml',
  '.env',
  'vision.config.json',
  'prompt-history.json',
  'usage-scan-cache.json',
  'credentials.json',
  'Cookies',
  'History',
  'Login Data',
])
const textExtensions = new Set(['.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.md', '.html', '.css', '.txt', '.xml'])
const secretPatterns = [
  ['OpenAI-style key', /sk-(?:proj-|ant-api03-)?[A-Za-z0-9_]{20,}/g],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{20,}/g],
  ['AWS access key', /AKIA[0-9A-Z]{16}/g],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/g],
  ['private key material', /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/=]{40,}\r?\n){2,}/g],
]

async function *walk(dir) {
  for await (const entry of await opendir(dir)) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield *walk(full)
    else if (entry.isFile()) yield full
  }
}

await lstat(resources)
const findings = []
for (const entry of await readdir(resources)) {
  if (!allowedTopLevel.has(entry)) findings.push(`unexpected packaged top-level entry: ${entry}`)
}

const localPaths = [os.homedir(), root, '/Volumes/S690']
let scannedFiles = 0
for await (const file of walk(resources)) {
  const base = path.basename(file)
  if (forbiddenNames.has(base) || base.startsWith('.env.')) findings.push(`forbidden user/config file: ${file}`)
  if (!textExtensions.has(path.extname(file))) continue
  const stat = await lstat(file)
  if (stat.size > 32 * 1024 * 1024) continue
  const source = await readFile(file, 'utf8')
  scannedFiles += 1
  for (const localPath of localPaths) {
    if (localPath.length > 1 && source.includes(localPath)) findings.push(`build-machine path in ${file}: ${localPath}`)
  }
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0
    if (pattern.test(source)) findings.push(`${label} pattern in ${file}`)
  }
}

if (findings.length > 0) {
  throw new Error(`release purity audit failed:\n${[...new Set(findings)].join('\n')}`)
}
console.log(`[audit-release] passed: ${appDir}; ${scannedFiles} text files scanned; no user data, credentials, or build paths`)
