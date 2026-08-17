/**
 * Menu-bar tray: keeps the agent host reachable while the window is closed,
 * with Show / Quit actions. The template image follows the menu bar's
 * light/dark appearance automatically.
 *
 * Note: the `electron` builtin is only reliably importable from the entry
 * module under Electron's ESM loader, so the required API pieces are passed
 * in from main.mjs instead of being imported here.
 * @module main/tray
 */

import path from 'node:path'

/**
 * @param {{ Menu: object, nativeImage: object, Tray: object }} api
 * @param {{ iconDir: string, onShow: () => void, onQuit: () => void }} options
 */
export function createTray({ Menu, nativeImage, Tray }, { iconDir, onShow, onQuit }) {
  const icon1x = nativeImage.createFromPath(path.join(iconDir, 'trayTemplate.png'))
  const icon2x = nativeImage.createFromPath(path.join(iconDir, 'trayTemplate@2x.png'))
  if (icon1x.isEmpty()) return null
  icon1x.setTemplateImage(true)
  if (!icon2x.isEmpty()) {
    icon1x.addRepresentation({ scaleFactor: 2, buffer: icon2x.toPNG() })
  }
  const tray = new Tray(icon1x)
  tray.setToolTip('DeepSeek Harness')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示 DeepSeek Harness', click: onShow },
      { type: 'separator' },
      { label: '退出', click: onQuit },
    ]),
  )
  tray.on('click', onShow)
  return tray
}
