/**
 * Re-pack the dual-face desktop plugin into its npm tarball and refresh the
 * installed copy under node_modules/@deepseek-ai/dsh-desktop so
 * electron-builder ships the current lib/ code. Run before every build.
 */
import { execSync } from 'node:child_process'
import { existsSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = path.join(root, 'packages', 'dsh-desktop')
const scopedDir = path.join(root, 'node_modules', '@deepseek-ai')
const target = path.join(scopedDir, 'dsh-desktop')
const extracted = path.join(scopedDir, 'package')
const tarball = path.join(pkgDir, 'deepseek-ai-dsh-desktop-0.1.0.tgz')

execSync('npm pack --pack-destination .', { cwd: pkgDir, stdio: 'inherit' })
if (!existsSync(tarball)) throw new Error(`pack produced no tarball at ${tarball}`)

rmSync(target, { recursive: true, force: true })
rmSync(extracted, { recursive: true, force: true })
execSync(`tar -xzf ${JSON.stringify(tarball)} -C ${JSON.stringify(scopedDir)}`, { stdio: 'inherit' })
renameSync(extracted, target)
console.log(`[pack-plugin] installed ${target}`)
