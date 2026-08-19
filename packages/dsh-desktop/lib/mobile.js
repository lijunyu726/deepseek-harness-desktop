/**
 * @deepseek-ai/dsh-desktop — host half of the LAN remote-access helpers.
 *
 * The phone gets the FULL native Web shell (same service, same sessions,
 * same tasks — zero sync layer). Two pieces make that pleasant on a phone:
 *
 *  1. `/desktop` — resolves the desktop's current conversation and redirects
 *     to `/?session=<id>`.
 *  2. An index.html boot helper (tapIndex) that, on fresh clients:
 *     - polyfills crypto.randomUUID (insecure-origin LAN HTTP lacks it and
 *       the directory picker crashes without it);
 *     - nudges the workspace registry (the host stream has no initial
 *       replay) and auto-selects the first workspace, so the sidebar shows
 *       all sessions immediately;
 *     - honors ?session= deep links (opens the matching session);
 *     - on narrow/touch screens, restyles the shell into an app-like
 *       layout: the sidebar becomes a slide-in drawer with a hamburger
 *       button and scrim, the conversation takes the full width, and the
 *       details pane is hidden.
 */

/** Resolve the desktop's current session id (running agent → newest session). */
async function resolveCurrentSession(webCtx) {
  try {
    const agents = webCtx.get('agents')
    const roots = agents !== undefined && typeof agents.roots === 'function' ? agents.roots() : []
    const running = roots.find(agent => agent?.status === 'running')
    if (running !== undefined) return String(running.id ?? '')
    if (roots.length > 0) return String(roots[0].id ?? '')
    const query = webCtx.get('sessionQuery')
    const records = query !== undefined ? await query.listSessions() : []
    if (records.length > 0) return String(records[0].header.id)
  } catch {
    /* best-effort */
  }
  return ''
}

const BOOT_HELPER_ID = 'dsh-desktop-boot-helper'

/**
 * html → html transform: prepends the boot-helper script to the shell index.
 * Written without backticks / template escapes on purpose.
 */
function INDEX_BOOT_HELPER(html) {
  if (html.includes(BOOT_HELPER_ID)) return html
  const script = [
    '<script id="' + BOOT_HELPER_ID + '">(function(){',
    '  "use strict";',
    '  if (!window.crypto.randomUUID) {',
    '    window.crypto.randomUUID = function () {',
    '      var b = new Uint8Array(16); window.crypto.getRandomValues(b);',
    '      b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;',
    '      var h = [];',
    '      for (var i = 0; i < 16; i++) h.push(b[i].toString(16).padStart(2, "0"));',
    '      return h.join("");',
    '    };',
    '  }',
    '  var deepSession = null;',
    '  try { deepSession = new URLSearchParams(location.search).get("session"); } catch (e) {}',
    '  var phase = "init"; var ticks = 0; var target = null; var deepTitle = null; var openedPicker = false;',
    '  function post(endpoint, payload) {',
    '    return fetch("/api/" + endpoint, { method: "POST", headers: { "content-type": "application/json" },',
    '      body: JSON.stringify({ type: "client-request", rpcId: "dsh-boot-" + window.crypto.randomUUID(), method: endpoint, payload: payload }) })',
    '      .then(function (r) { return r.json(); });',
    '  }',
    '  function pickerVisible() { return !!document.querySelector(\'button[aria-label="选择工作区"]\'); }',
    '  function rowByTitle(title, root) {',
    '    if (!title) return null;',
    '    var nodes = (root || document).querySelectorAll("button, [role=\\"treeitem\\"], [role=\\"option\\"], li, div");',
    '    for (var i = 0; i < nodes.length; i++) {',
    '      var el = nodes[i];',
    '      if (el.children.length !== 0 && el.tagName !== "BUTTON") continue;',
    '      var t = (el.textContent || "").trim();',
    '      if (t === title || t.indexOf(title) === 0) return el;',
    '    }',
    '    return null;',
    '  }',
    '  var timer = setInterval(function () {',
    '    ticks += 1;',
    '    if (ticks > 90) { clearInterval(timer); return; }',
    '    if (phase === "init") {',
    '      post("workspace.list", {}).then(function (full) {',
    '        var items = (full && full.result && full.result.ok && full.result.value && full.result.value.items) || [];',
    '        if (items.length === 0) { clearInterval(timer); return; }',
    '        target = { title: items[0].title, path: items[0].path, workspaceId: items[0].workspaceId };',
    '        phase = "wait";',
    '      }).catch(function () {});',
    '      phase = "boot";',
    '      return;',
    '    }',
    '    if (phase === "boot") return;',
    '    if (!pickerVisible()) { clearInterval(timer); return; }',
    '    if (phase === "wait") {',
    '      if (!target) { clearInterval(timer); return; }',
    '      post("workspace.create", { path: target.path }).catch(function () {});',
    '      phase = "select";',
    '      return;',
    '    }',
    '    if (phase === "select") {',
    '      var pickerBtn = document.querySelector(\'button[aria-label="选择工作区"]\');',
    '      if (!pickerBtn) return;',
    '      if (!openedPicker) { openedPicker = true; pickerBtn.click(); return; }',
    '      var wsRow = rowByTitle(target.title);',
    '      if (wsRow) { wsRow.click(); phase = "session"; }',
    '      return;',
    '    }',
    '    if (phase === "session") {',
    '      if (!deepSession) { clearInterval(timer); return; }',
    '      if (!deepTitle) {',
    '        post("session.list", {}).then(function (full) {',
    '          var items = (full && full.result && full.result.ok && full.result.value && full.result.value.items) || [];',
    '          for (var i = 0; i < items.length; i++) {',
    '            if (items[i].sessionId === deepSession) {',
    '              var p = items[i].projections;',
    '              deepTitle = (p && p.values && typeof p.values.title === "string" && p.values.title) || items[i].sessionId;',
    '              break;',
    '            }',
    '          }',
    '        }).catch(function () {});',
    '        return;',
    '      }',
    '      var row = rowByTitle(deepTitle);',
    '      if (row) { row.click(); clearInterval(timer); return; }',
    '      clearInterval(timer);',
    '    }',
    '  }, 800);',
    '  var narrow = window.matchMedia("(max-width: 760px), (pointer: coarse) and (max-width: 960px)");',
    '  var layoutInstalled = false;',
    '  var layoutTicks = 0;',
    '  function applyDrawer(open) {',
    '    // The shell renders the settings overlay INSIDE the sidebar column,',
    '    // and a transformed ancestor becomes the containing block of its',
    '    // position:fixed panel — which is why the settings used to be',
    '    // squeezed into the drawer. Hide the drawer with `left` only, so the',
    '    // column never carries a transform.',
    '    var col = document.querySelector(".pI_x6G_sidebarCol");',
    '    if (col) col.style.setProperty("left", open ? "0px" : "calc(-1 * min(82vw, 320px) - 12px)", "important");',
    '  }',
    '  function settingsOpen() { return !!document.querySelector(".VOzbGW_panel"); }',
    '  function closeSettings() {',
    '    var btn = document.querySelector(".VOzbGW_close");',
    '    if (btn) { btn.click(); return; }',
    '    var nav = document.querySelector(".VOzbGW_nav");',
    '    if (nav) {',
    '      var buttons = nav.querySelectorAll("button");',
    '      var last = buttons[buttons.length - 1];',
    '      if (last) last.click();',
    '    }',
    '  }',
    '  function enforceLayout() {',
    '    var frame = document.querySelector(".pI_x6G_frame");',
    '    if (frame) frame.style.setProperty("grid-template-columns", "0px minmax(0, 1fr) 0px", "important");',
    '    var details = document.querySelector(".pI_x6G_detailsCol");',
    '    if (details) details.style.setProperty("display", "none", "important");',
    '    var handle = document.querySelector(".pI_x6G_handle");',
    '    if (handle) handle.style.setProperty("display", "none", "important");',
    '    var center = document.querySelector(".pI_x6G_centerCol");',
    '    if (center) {',
    '      center.style.setProperty("width", "100vw", "important");',
    '      center.style.setProperty("min-width", "0", "important");',
    '    }',
    '    applyDrawer(document.body.classList.contains("dsh-mobile-nav-open"));',
    '  }',
    '  function installPhoneLayout() {',
    '    if (!narrow.matches || layoutInstalled) return;',
    '    layoutInstalled = true;',
    '    if (!document.body) { layoutInstalled = false; return; }',
    '    // The media-query change listener re-enters this function whenever the',
    '    // viewport crosses the breakpoint (e.g. phone rotation, devtools',
    '    // emulation). Without this guard every re-entry appended a second',
    '    // style sheet, scrim and hamburger button on top of the first ones.',
    '    if (document.getElementById("dsh-mobile-style") !== null) { enforceLayout(); return; }',
    '    var css = [',
    '      ".pI_x6G_sidebarCol { position: fixed !important; left: 0 !important; top: 0 !important; bottom: 0 !important; z-index: 2000 !important; width: min(82vw, 320px) !important; min-width: 0 !important; background: #1b1b1c; box-shadow: 12px 0 32px rgba(0,0,0,0.45); pointer-events: none; transition: left 0.18s ease !important; }",',
    '      "body.dsh-mobile-nav-open .pI_x6G_sidebarCol { pointer-events: auto; }",',
    '      ".pI_x6G_sidebarCol > div { height: 100%; }",',
    '      ".pI_x6G_sidebarCol .hHd-Xa_root { width: 100% !important; }",',
    '      ".hHd-Xa_toggle { display: none !important; }",',
    '      "#dsh-mobile-scrim { display: none; position: fixed; inset: 0; z-index: 1990; background: rgba(0,0,0,0.45); }",',
    '      "body.dsh-mobile-nav-open #dsh-mobile-scrim { display: block; }",',
    '      "#dsh-mobile-menu { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 10px); left: 10px; z-index: 2100; width: 38px; height: 38px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(27,27,28,0.85); color: #f9fafb; display: flex; align-items: center; justify-content: center; }",',
    '      ".wSkVaW_header { padding-left: 56px !important; }",',
    '      // Settings panel restructure for narrow screens: the shell renders',
    '      // the panel as nav + content columns (188px + flex) inside the',
    '      // sidebar column; on a phone the nav becomes a slim icon rail so',
    '      // the content gets the full width instead of being squeezed into',
    '      // a thin strip. The panel fills the viewport (the overlay is',
    '      // position:fixed and, without the column transform, anchors to the',
    '      // screen instead of the drawer).',
    '      "body .VOzbGW_panel { width: 100vw !important; max-width: 100vw !important; height: 100vh !important; border-radius: 0 !important; }",',
    '      "body .VOzbGW_nav { width: 64px !important; padding: 8px 4px !important; gap: 6px !important; }",',
    '      "body .VOzbGW_navTitle { display: none !important; }",',
    '      "body .VOzbGW_navList { gap: 2px !important; }",',
    '      "body .VOzbGW_navCell { flex-direction: column !important; justify-content: center !important; gap: 1px !important; height: auto !important; padding: 7px 2px !important; border-radius: 10px !important; }",',
    '      "body .VOzbGW_navIcon { margin: 0 !important; }",',
    '      "body .VOzbGW_navLabel { flex: none !important; font-size: 10px !important; line-height: 12px !important; text-align: center !important; max-width: 60px !important; }",',
    '      "body .VOzbGW_header { padding: 12px 10px 6px 6px !important; }",',
    '      "body .VOzbGW_options { padding: 0 14px 20px !important; }",',
    '      // Session log hide + two-line title wrap live in the client bundle',
    '      // (client.js installHeaderCompactStyle) so phone pages pick them up',
    '      // on reload without waiting for an app restart.',
    '      // Session rows reveal their "…" menu (归档/删除/重命名/分叉) only on',
    '      // hover, which touch screens never have — the archive feature was',
    '      // unreachable on the phone. Show the ellipsis permanently on the',
    '      // phone layout and drop the relative-time label to make room.',
    '      ".S-h-AW_sessionRow .S-h-AW_rowActions { display: inline-flex !important; }",',
    '      ".S-h-AW_sessionRow .S-h-AW_time { display: none !important; }",',
    '      // The settings overlay fills the viewport but lives inside the',
    '      // sidebar column (z-index 2000), while the hamburger sits at 2100 —',
    '      // it used to float on top of the panel\'s nav rail. Hide it while',
    '      // the overlay is open. :has() covers all modern phone browsers; the',
    '      // MutationObserver below is the fallback for older ones.',
    '      "body:has(.VOzbGW_overlay) #dsh-mobile-menu { display: none !important; }",',
    '    ].join("\\n");',
    '    var style = document.createElement("style");',
    '    style.id = "dsh-mobile-style";',
    '    style.textContent = css;',
    '    document.head.appendChild(style);',
    '    var scrim = document.createElement("div");',
    '    scrim.id = "dsh-mobile-scrim";',
    '    document.body.appendChild(scrim);',
    '    var menu = document.createElement("button");',
    '    menu.id = "dsh-mobile-menu";',
    '    menu.setAttribute("aria-label", "会话列表");',
    '    menu.innerHTML = \'<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>\';',
    '    document.body.appendChild(menu);',
    '    // Fallback for browsers without :has(): keep the hamburger hidden',
    '    // while the settings overlay is open (see the CSS rule above). The',
    '    // check is one querySelector per DOM change, so the observer stays',
    '    // cheap even on the chatty conversation page.',
    '    if (window.MutationObserver) {',
    '      var overlayState = false;',
    '      var overlayObs = new MutationObserver(function () {',
    '        var menuEl = document.getElementById("dsh-mobile-menu");',
    '        if (!menuEl) return;',
    '        var open = settingsOpen();',
    '        if (open === overlayState) return;',
    '        overlayState = open;',
    '        menuEl.style.setProperty("display", open ? "none" : "flex", "important");',
    '      });',
    '      overlayObs.observe(document.body, { childList: true, subtree: true });',
    '    }',
    '    function closeNav() { document.body.classList.remove("dsh-mobile-nav-open"); applyDrawer(false); }',
    '    function expandRail() {',
    '      var root = document.querySelector(".hHd-Xa_root");',
    '      if (!root) return;',
    '      if (!root.classList.contains("hHd-Xa_collapsed")) return;',
    '      var btn = root.querySelector(".hHd-Xa_toggle");',
    '      if (btn) btn.click();',
    '    }',
    '    menu.addEventListener("click", function (e) {',
    '      e.stopPropagation();',
    '      // Opening the drawer always means "back to the session list": if',
    '      // the settings panel is open, close it first so the drawer shows',
    '      // sessions instead of a squeezed settings view.',
    '      if (settingsOpen()) closeSettings();',
    '      expandRail();',
    '      var open = document.body.classList.toggle("dsh-mobile-nav-open");',
    '      applyDrawer(open);',
    '    });',
    '    scrim.addEventListener("click", closeNav);',
    '    document.addEventListener("click", function (e) {',
    '      if (document.body.classList.contains("dsh-mobile-nav-open") &&',
    '          (e.target.closest && e.target.closest(".pI_x6G_sidebarCol"))) closeNav();',
    '    });',
    '    window.addEventListener("resize", enforceLayout);',
    '    var keep = setInterval(function () {',
    '      expandRail();',
    '      enforceLayout();',
    '      layoutTicks += 1;',
    '      if (layoutTicks > 40) clearInterval(keep);',
    '    }, 1000);',
    '    enforceLayout();',
    '  }',
    '  var bootLayout = setInterval(function () {',
    '    installPhoneLayout();',
    '    if (layoutInstalled) clearInterval(bootLayout);',
    '  }, 400);',
    '  if (narrow.addEventListener) narrow.addEventListener("change", function () {',
    '    layoutInstalled = false;',
    '    installPhoneLayout();',
    '  });',
    '})();</script>',
  ].join('\n')
  const marker = '</head>'
  return html.replace(marker, `${script}\n${marker}`)
}

/**
 * Mount the desktop remote-access helpers: the `/desktop` deep link and the
 * shell index boot helper (fresh-client workspace selection + phone layout).
 * @param ctx - the plugin's host context.
 */
export function registerMobileRoute(ctx) {
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: '/desktop',
      handler: async (_req, res) => {
        const sessionId = await resolveCurrentSession(webCtx)
        const target = sessionId.length > 0 ? `/?session=${encodeURIComponent(sessionId)}` : '/'
        res.writeHead(302, { location: target, 'cache-control': 'no-store' })
        res.end()
      },
    }), 'dsh-desktop: /desktop route')

    webCtx.effect(() => webCtx.webServer.tapIndex(INDEX_BOOT_HELPER), 'dsh-desktop: index boot helper')
  })
}
