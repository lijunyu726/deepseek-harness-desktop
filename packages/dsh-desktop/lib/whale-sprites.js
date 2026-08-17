/**
 * Same-origin HTTP routes for the six whale rheostat sprite atlases.
 *
 * Each atlas is a lossless WebP with a strict 6 x 4 grid (24 frames). The
 * browser client animates it with background-position; fixed exact routes
 * avoid path traversal and work for both the desktop window and LAN clients.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROUTE_PREFIX = '/dsh-desktop/whale-sprites'
const SPRITE_NAMES = [
  'flash-off',
  'flash-high',
  'flash-max',
  'pro-off',
  'pro-high',
  'pro-max',
]

const SPRITES = SPRITE_NAMES.map((name) => ({
  name,
  body: readFileSync(path.join(MODULE_DIR, 'whale-sprites', `${name}.webp`)),
}))

export function registerWhaleSpriteRoutes(ctx) {
  ctx.inject(['webServer'], (webCtx) => {
    for (const sprite of SPRITES) {
      const routePath = `${ROUTE_PREFIX}/${sprite.name}.webp`
      webCtx.effect(() => webCtx.webServer.register({
        kind: 'exact',
        path: routePath,
        handler: (_req, res) => {
          res.writeHead(200, {
            'content-type': 'image/webp',
            'content-length': sprite.body.byteLength,
            // Assets are local and small. Revalidation prevents an older
            // renderer cache from surviving an app update with new frames.
            'cache-control': 'no-cache',
          })
          res.end(sprite.body)
        },
      }), `dsh-desktop: ${routePath}`)
    }
  })
}
