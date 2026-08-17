/**
 * macOS application menu. The Edit roles matter: they wire Cmd+C/V/X/A into
 * the web content, which a chat UI lives on.
 *
 * Note: the `electron` builtin is only reliably importable from the entry
 * module under Electron's ESM loader, so the required API pieces are passed
 * in from main.mjs instead of being imported here.
 * @module main/menu
 */

const GITHUB_URL = 'https://github.com/deepseek-ai/deepseek-harness'
const DOCS_URL = 'https://deepseek-ai.github.io/deepseek-harness/'

function showAbout({ app, dialog }) {
  dialog.showMessageBox({
    type: 'info',
    title: `关于 ${app.name}`,
    message: app.name,
    detail: [
      `桌面壳版本：${app.getVersion()}`,
      `DSH 服务：0.1.0-rc.6（npm @deepseek-ai/dsh）`,
      'Electron 外壳 · 服务运行于本机 127.0.0.1',
    ].join('\n'),
    buttons: ['好'],
  })
}

/**
 * @param {{ app: object, dialog: object, Menu: object, shell: object }} api
 * @param {{ onQuit: () => void, onOpenLog: () => void, isLoginItemEnabled: () => boolean, onToggleLoginItem: () => void }} handlers
 */
export function buildMenu({ app, dialog, Menu, shell }, { onQuit, onOpenLog, isLoginItemEnabled, onToggleLoginItem }) {
  const template = [
    {
      label: app.name,
      submenu: [
        { label: `关于 ${app.name}`, click: () => showAbout({ app, dialog }) },
        { type: 'separator' },
        { label: '开机时自动启动', type: 'checkbox', checked: isLoginItemEnabled(), click: onToggleLoginItem },
        { type: 'separator' },
        { role: 'hide', label: `隐藏 ${app.name}` },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { label: `退出 ${app.name}`, accelerator: 'Cmd+Q', click: onQuit },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '拷贝' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新载入' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' },
        { type: 'separator' },
        { label: '打开服务日志', click: onOpenLog },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { role: 'front', label: '前置全部窗口' },
        { type: 'separator' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: 'DeepSeek Harness 文档', click: () => shell.openExternal(DOCS_URL) },
        { label: 'GitHub 仓库', click: () => shell.openExternal(GITHUB_URL) },
      ],
    },
  ]
  return Menu.buildFromTemplate(template)
}
