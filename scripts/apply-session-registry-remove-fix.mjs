/**
 * Reapply the live-registry force-remove seam used by durable session deletion.
 *
 * The rc.6 apiproxy teardown already calls `ctx.agents.remove?.()` and
 * `ctx.sessions.remove?.()`, but the published rc.6 registry bundles do not
 * expose those methods. A previous installed app carried the compiled methods
 * directly; this script makes that repair deterministic and rebuildable.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scope = path.join(root, 'node_modules', '@deepseek-ai')
const checkOnly = process.argv.includes('--check')

const agentRuntimeMethod = [
  '\t/** Force-remove one exact registered agent by id during deletion teardown. */',
  '\tremove(id) {',
  '\t\tconst entry = this.store.get(id);',
  '\t\tif (entry === void 0) return false;',
  '\t\tif (entry.announcing) {',
  '\t\t\tentry.detachRequested = true;',
  '\t\t\treturn true;',
  '\t\t}',
  '\t\tthis.detachEntered(entry);',
  '\t\treturn true;',
  '\t}',
  '',
].join('\n')

const agentTypesRuntimeMethod = [
  '    /** Force-remove one exact registered agent by id during deletion teardown. */',
  '    remove(id) {',
  '        const entry = this.store.get(id);',
  '        if (entry === undefined)',
  '            return false;',
  '        if (entry.announcing) {',
  '            entry.detachRequested = true;',
  '            return true;',
  '        }',
  '        this.detachEntered(entry);',
  '        return true;',
  '    }',
  '',
].join('\n')

const sessionRuntimeMethod = [
  '\t/** Force-remove one exact live session by id during deletion teardown. */',
  '\tremove(id) {',
  '\t\tconst entry = this.store.get(id);',
  '\t\tif (entry === void 0) return false;',
  '\t\tif (entry.announcing || entry.appending) {',
  '\t\t\tentry.detachRequested = true;',
  '\t\t\treturn true;',
  '\t\t}',
  '\t\tthis.detachEntered(entry);',
  '\t\treturn true;',
  '\t}',
  '',
].join('\n')

const sessionTypesRuntimeMethod = [
  '    /** Force-remove one exact live session by id during deletion teardown. */',
  '    remove(id) {',
  '        const entry = this.store.get(id);',
  '        if (entry === undefined)',
  '            return false;',
  '        if (entry.announcing || entry.appending) {',
  '            entry.detachRequested = true;',
  '            return true;',
  '        }',
  '        this.detachEntered(entry);',
  '        return true;',
  '    }',
  '',
].join('\n')

const targets = [
  {
    packageName: 'dsh-agent',
    relativeFile: 'lib/index.js',
    marker: '/** Force-remove one exact registered agent by id during deletion teardown. */',
    anchor: '\t/** Emit the paired disposal edge through the entry\'s stable carrier. */',
    insertion: agentRuntimeMethod,
  },
  {
    packageName: 'dsh-agent',
    relativeFile: 'lib/types/index.js',
    marker: '/** Force-remove one exact registered agent by id during deletion teardown. */',
    anchor: '    /** Emit the paired disposal edge through the entry\'s stable carrier. */',
    insertion: agentTypesRuntimeMethod,
  },
  {
    packageName: 'dsh-agent',
    relativeFile: 'lib/types/index.d.ts',
    marker: 'remove(id: SessionId): boolean;',
    anchor: '    /** Emit the paired disposal edge through the entry\'s stable carrier. */',
    insertion: [
      '    /** Force-remove one exact registered agent by id during deletion teardown. */',
      '    remove(id: SessionId): boolean;',
      '',
    ].join('\n'),
  },
  {
    packageName: 'dsh-session',
    relativeFile: 'lib/index.js',
    marker: '/** Force-remove one exact live session by id during deletion teardown. */',
    anchor: '\t/** Emit `session/created` exactly once for an {@link enter}ed session (with',
    insertion: sessionRuntimeMethod,
  },
  {
    packageName: 'dsh-session',
    relativeFile: 'lib/types/index.js',
    marker: '/** Force-remove one exact live session by id during deletion teardown. */',
    anchor: '    /** Emit `session/created` exactly once for an {@link enter}ed session (with',
    insertion: sessionTypesRuntimeMethod,
  },
  {
    packageName: 'dsh-session',
    relativeFile: 'lib/types/index.d.ts',
    marker: 'remove(id: SessionId): boolean;',
    anchor: '    /** Emit `session/created` exactly once for an {@link enter}ed session (with',
    insertion: [
      '    /** Force-remove one exact live session by id during deletion teardown. */',
      '    remove(id: SessionId): boolean;',
      '',
    ].join('\n'),
  },
]

function assertRc6(packageName) {
  const manifest = JSON.parse(readFileSync(path.join(scope, packageName, 'package.json'), 'utf8'))
  if (manifest.version !== '0.1.0-rc.6') {
    throw new Error(`unsupported @deepseek-ai/${packageName} version: ${manifest.version}`)
  }
}
for (const packageName of new Set(targets.map((target) => target.packageName))) assertRc6(packageName)

for (const target of targets) {
  const file = path.join(scope, target.packageName, target.relativeFile)
  const source = readFileSync(file, 'utf8')
  if (source.includes(target.marker)) {
    console.log(`[registry-remove] OK @deepseek-ai/${target.packageName}/${target.relativeFile}`)
    continue
  }
  if (checkOnly) throw new Error(`registry remove fix missing: ${file}`)
  const anchorCount = source.split(target.anchor).length - 1
  if (anchorCount !== 1) {
    throw new Error(`registry remove anchor drift in ${file}: expected 1, found ${anchorCount}`)
  }
  writeFileSync(file, source.replace(target.anchor, `${target.insertion}${target.anchor}`))
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' })
  console.log(`[registry-remove] APPLIED @deepseek-ai/${target.packageName}/${target.relativeFile}`)
}
