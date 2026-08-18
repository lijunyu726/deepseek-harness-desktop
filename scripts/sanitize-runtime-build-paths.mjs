/** Remove build-machine paths that bundlers leave in source-region comments. */

import { opendir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scopeRoot = path.join(root, 'node_modules', '@deepseek-ai')
const textExtensions = new Set(['.js', '.mjs', '.cjs'])
const marker = '//#region \\0dsh-css:'

async function *walk(dir) {
  for await (const entry of await opendir(dir)) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield *walk(full)
    else if (entry.isFile()) yield full
  }
}

function sanitizeRegion(line) {
  const markerIndex = line.indexOf(marker)
  if (markerIndex === -1) return line
  const pathStart = markerIndex + marker.length
  const sourcePath = line.slice(pathStart)
  const unixPackages = sourcePath.indexOf('/packages/')
  if ((sourcePath.startsWith('/Users/') || sourcePath.startsWith('/home/')) && unixPackages !== -1) {
    return `${line.slice(0, pathStart)}/virtual/deepseek-harness${sourcePath.slice(unixPackages)}`
  }
  const windowsPackages = sourcePath.toLowerCase().indexOf('\\packages\\')
  if (/^[A-Za-z]:\\Users\\/i.test(sourcePath) && windowsPackages !== -1) {
    return `${line.slice(0, pathStart)}C:\\virtual\\deepseek-harness${sourcePath.slice(windowsPackages)}`
  }
  return line
}

let filesChanged = 0
let pathsRemoved = 0
const files = []
for await (const file of walk(scopeRoot)) {
  if (!textExtensions.has(path.extname(file))) continue
  files.push(file)
  const source = await readFile(file, 'utf8')
  const lines = source.split('\n')
  let changed = false
  const next = lines.map((line) => {
    const sanitized = sanitizeRegion(line)
    if (sanitized !== line) {
      changed = true
      pathsRemoved += 1
    }
    return sanitized
  }).join('\n')
  if (changed) {
    await writeFile(file, next, 'utf8')
    filesChanged += 1
  }
}

const forbidden = [os.homedir(), root]
const leftovers = []
for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const value of forbidden) {
    if (value.length > 1 && source.includes(value)) leftovers.push(`${file}: ${value}`)
  }
}
if (leftovers.length > 0) {
  throw new Error(`runtime still contains build-machine paths:\n${leftovers.join('\n')}`)
}

console.log(`[sanitize-runtime] removed ${pathsRemoved} build paths from ${filesChanged} files; audit passed`)
