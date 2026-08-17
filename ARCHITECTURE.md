# DeepSeek Harness Desktop Architecture

## Runtime

Electron starts the packaged `dsh web` entry with Electron's bundled Node runtime. The child binds only to `127.0.0.1`; the Electron window loads that local URL. The main process owns startup, logs, restart, and graceful shutdown. Harness data and credentials remain under `$DSH_HOME` (normally `~/.dsh`).

The service preloads `main/child-guard.mjs`, which terminates it when the owning Electron PID disappears. Exit callbacks are scoped to the exact child that registered them, and restart requests received during an active restart are serialized afterward. Aggregate usage comes from the projection cache. Per-day usage is decoded only in the isolated `assets/usage-scan.mjs` child because Electron's in-process zstd path can abort the service; scanner failure leaves the service alive with cached data.

Before a desktop launch or build, the root monorepo is built and `scripts/sync-monorepo-overrides.mjs` overlays the runtime files needed by the local session-deletion feature onto the published rc.6 dependency tree. Package manifests remain those of the installed desktop dependencies. The vision bridge is applied after this overlay so a rebuilt host package cannot erase the desktop patch.

## Desktop plugin layer

`assets/desktop.patch.yml` inserts `@deepseek-ai/dsh-desktop-instructions`. Its host half reads and writes `$DSH_HOME/AGENTS.md`; its browser half contributes the global-instructions settings section. `DshServer.ensurePluginFallback()` links the packaged plugin into the profile module fallback before boot.

The user's Web profile separately mounts the `vision` MCP server. Its `describe_image` tool accepts a local image path and returns a MiMo-generated text description to the agent.

## GUI image bridge

DeepSeek V4 is kept as a text-only model. `scripts/apply-vision-bridge.mjs` deterministically patches the packaged `@deepseek-ai/dsh-host-apiproxy` dependency before development launch or distribution:

1. The ordinary prompt admission path detects an image sent to a model whose resolved `inputModalities` excludes `image`.
2. Harness decodes, validates, and commits every image to its native content-addressed local attachment store.
3. The durable message keeps each image for transcript rendering and adds text containing its immutable object path and an explicit call to `mcp__vision__describe_image`.
4. Model selection permits a text-only model only when every image on the current model surface carries that bridge companion text.
5. The agent-loop request boundary removes the paired image blocks before dispatch; DeepSeek invokes the tool through the ordinary tool loop, and the separately mounted `vision` MCP sends the bytes to MiMo and returns plain text.
6. The carrier cancellation signal reaches prompt admission. Visual request timeout and error reporting remain owned by the MCP tool call.

Models that declare native image support bypass the bridge. The model capability declaration therefore remains truthful: it describes the selected provider endpoint rather than the desktop preprocessing layer.

The patch script is the source of truth for this desktop-specific adaptation. Generated files in `node_modules` and `release/*.app` are artifacts and must not be edited manually. The script requires exact clean or already-patched anchors so an upstream dependency change fails visibly instead of receiving a partial patch.

## Credentials and data flow

The host bridge handles no visual-provider credential and performs no visual network call. It stores image bytes under `$DSH_HOME/attachments/v1/objects/<prefix>/<sha256>` and puts that absolute path in the model-visible user message. The `vision` MCP resolves `XIAOMI_TOKEN_PLAN_CN_API_KEY`, reads the path, detects the image format from its bytes, and calls the Xiaomi endpoint. Images therefore leave the machine only when the agent invokes the MCP. DeepSeek credentials and availability remain independent, but a DeepSeek request is still required before and after the tool call.

## Validation and rollback

- `npm run vision:check` verifies the dependency patch and JavaScript syntax.
- `npm run dist:dir` rebuilds an unpacked arm64 application for launch testing.
- The existing server log remains `~/Library/Logs/DeepSeek Harness/server.log`.
- Reinstalling the desktop dependencies restores the upstream dependency artifact. The clean `/Applications/DeepSeek Harness.app` can also serve as an executable baseline, but it has no automatic text-model-to-MCP image delegation.
