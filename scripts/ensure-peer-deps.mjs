/**
 * ensure-peer-deps — pin every runtime peerDependency into the desktop
 * package.json `dependencies` so electron-builder stops pruning them.
 *
 * electron-builder packs only the production dependency tree; peer
 * dependencies (which npm hoists but the tree-walker ignores) get dropped
 * from the .app. On this dev machine the bundled app still boots because the
 * release folder happens to sit inside the monorepo, where Node's upward
 * module resolution borrows the missing packages — on a foreign machine
 * there is no upstream node_modules and boot fails with
 * ERR_MODULE_NOT_FOUND. This script makes the bundle self-contained.
 *
 * Excluded: @types/* (compile-time only), ws's optional native accelerators
 * (bufferutil / utf-8-validate — ws falls back gracefully), and the
 * electron-builder toolchain's own peers (dmg-builder,
 * electron-builder-squirrel-windows, app-builder-lib).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeModules = path.join(root, 'node_modules')

const EXCLUDE = new Set([
  'bufferutil',
  'utf-8-validate',
  'dmg-builder',
  'electron-builder-squirrel-windows',
  'app-builder-lib',
])

function walkPackageJsons(dir, depth = 0) {
  const out = []
  if (depth > 3) return out
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.startsWith('@') || depth > 0) out.push(...walkPackageJsons(full, depth + 1))
      else out.push(...walkPackageJsons(full, depth + 1))
    } else if (entry.name === 'package.json') {
      out.push(full)
    }
  }
  return out
}

const needed = new Map()
for (const file of walkPackageJsons(nodeModules).filter((f) => !f.includes('/node_modules/') || f.split('/node_modules/')[1].split('/').length <= 3)) {
  let pkg
  try {
    pkg = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    continue
  }
  for (const [name, spec] of Object.entries(pkg.peerDependencies ?? {})) {
    if (name.startsWith('@types/') || EXCLUDE.has(name)) continue
    if (needed.has(name)) continue
    const segments = name.startsWith('@') ? name.split('/') : [name]
    const dir = path.join(nodeModules, ...segments)
    if (!existsSync(path.join(dir, 'package.json'))) continue
    let version
    try {
      version = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).version
    } catch {
      continue
    }
    needed.set(name, `^${version}`)
  }
}

const manifestPath = path.join(root, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
let changed = 0
for (const [name, version] of needed) {
  if (manifest.dependencies[name] === undefined) {
    manifest.dependencies[name] = version
    changed += 1
  }
}
if (changed > 0) {
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`[ensure-peer-deps] pinned ${changed} peer dependencies into package.json`)
} else {
  console.log('[ensure-peer-deps] nothing to pin')
}
