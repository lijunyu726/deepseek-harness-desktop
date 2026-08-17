/**
 * Apply the desktop-only GUI-image-to-vision-MCP bridge.
 *
 * DeepSeek chat-completions models remain truthfully text-only. For those
 * models, GUI image parts are committed to Harness's native local attachment
 * store and replaced with an instruction that makes the agent call the
 * configured `vision` MCP tool with the immutable object path. The MCP result
 * returns as text through the ordinary tool loop.
 *
 * This script is the reproducible source of the packaged dependency patch.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const desktopDir = path.dirname(scriptDir)
const defaultTarget = path.join(
  desktopDir,
  'node_modules',
  '@deepseek-ai',
  'dsh-host-apiproxy',
  'lib',
  'index.js',
)

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const targetIndex = args.indexOf('--target')
const target = targetIndex === -1 ? defaultTarget : path.resolve(args[targetIndex + 1] ?? '')

if (targetIndex !== -1 && !args[targetIndex + 1]) {
  throw new Error('--target requires a file path')
}

const marker = 'const DESKTOP_VISION_MCP_TOOL ='

const bridgeSource = `/** Desktop-only delegation from GUI image parts to the configured vision MCP. */
const DESKTOP_VISION_MCP_TOOL = "mcp__vision__describe_image";
const DESKTOP_VISION_BRIDGE_TEXT = "[The user attached ";
const DESKTOP_ATTACHMENT_ID = /^sha256:([a-f0-9]{64})$/;
function desktopVisionMcpContent(ctx, content) {
\tconst root = ctx.attachments.root;
\tif (typeof root !== "string" || root.length === 0) throw new AttachmentError("GUI image delegation requires the local Harness attachment store.", "VISION_MCP_LOCAL_STORE_REQUIRED");
\treturn content.flatMap((block) => {
\t\tif (block.type !== "image") return [block];
\t\tconst attachment = block.attachment;
\t\tconst match = DESKTOP_ATTACHMENT_ID.exec(String(attachment.attachmentId));
\t\tif (match === null) throw new AttachmentError("GUI image delegation received an unsupported attachment identifier.", "VISION_MCP_ATTACHMENT_ID_UNSUPPORTED");
\t\tconst digest = match[1];
\t\tconst objectPath = \`\${root}/objects/\${digest.slice(0, 2)}/\${digest}\`;
\t\tconst label = attachment.name === void 0 ? "an image" : \`the image named \"\${attachment.name}\"\`;
\t\treturn [
\t\t\tblock,
\t\t\t{
\t\t\t\ttype: "text",
\t\t\t\ttext: \`[The user attached \${label} (\${attachment.mediaType}, \${attachment.width}x\${attachment.height}). It is stored locally at \${JSON.stringify(objectPath)}. You do not see the image directly. Before answering the user's request, call \${DESKTOP_VISION_MCP_TOOL} with this exact absolute path, then use the tool result as image evidence. Do not claim the tool result is a direct visual capability of the current model.]\`
\t\t\t}
\t\t];
\t});
}
function desktopVisionMcpMessagesCanDelegate(messages) {
\treturn messages.every((message) => !contentHasImage(message.content) || message.source?.kind === "user" && message.content.some((block) => block.type === "text" && typeof block.text === "string" && block.text.startsWith(DESKTOP_VISION_BRIDGE_TEXT)));
}
`

/** The pre-1.2.2 delegation body: replaced image blocks with the text (no image kept). */

const originalPrompt = `\t\t\tasync prompt(request) {
\t\t\t\tconst { sessionId, mode, content, clientTimeZone } = request.payload;`

const patchedPrompt = `\t\t\tasync prompt(request, signal) {
\t\t\t\tconst { sessionId, mode, content, clientTimeZone } = request.payload;
\t\t\t\tsignal?.throwIfAborted();`

const originalAdmission = `\t\t\t\tconst admit = async () => {
\t\t\t\t\ttry {
\t\t\t\t\t\tif (hasImage) {
\t\t\t\t\t\t\tconst current = selectionFor(agent).current;
\t\t\t\t\t\t\tconst modelInfo = await ctx.llm.resolveModelInfo(current.provider, current.model);
\t\t\t\t\t\t\tif (modelInfo.inputModalities !== void 0 && !modelInfo.inputModalities.includes("image")) return err(request, {
\t\t\t\t\t\t\t\tcode: "attachment-error",
\t\t\t\t\t\t\t\tmessage: \`Model "\${current.model}" does not support image input.\`,
\t\t\t\t\t\t\t\tdetails: { reason: "MODEL_DOES_NOT_SUPPORT_IMAGES" }
\t\t\t\t\t\t\t});
\t\t\t\t\t\t}
\t\t\t\t\t\tconst message = createUserMessage({
\t\t\t\t\t\t\tcontent: await durablePromptContent(ctx, content),
\t\t\t\t\t\t\tsource
\t\t\t\t\t\t});`

const patchedAdmission = `\t\t\t\tconst admit = async () => {
\t\t\t\t\ttry {
\t\t\t\t\t\tlet delegateToVisionMcp = false;
\t\t\t\t\t\tif (hasImage) {
\t\t\t\t\t\t\tconst current = selectionFor(agent).current;
\t\t\t\t\t\t\tconst modelInfo = await ctx.llm.resolveModelInfo(current.provider, current.model);
\t\t\t\t\t\t\tdelegateToVisionMcp = !modelInfo.inputModalities?.includes("image");
\t\t\t\t\t\t}
\t\t\t\t\t\tsignal?.throwIfAborted();
\t\t\t\t\t\tconst durableContent = await durablePromptContent(ctx, content);
\t\t\t\t\t\tsignal?.throwIfAborted();
\t\t\t\t\t\tconst message = createUserMessage({
\t\t\t\t\t\t\tcontent: delegateToVisionMcp ? desktopVisionMcpContent(ctx, durableContent) : durableContent,
\t\t\t\t\t\t\tsource
\t\t\t\t\t\t});`

const originalRoute = `\t\tinvoke: (api, r) => api.sessions.prompt(r)`
const patchedRoute = `\t\tinvoke: (api, r, signal) => api.sessions.prompt(r, signal)`

const originalSelectionGate = `\t\t\t\t\t\tif ([...found.agent.inbox.nextTurn, ...found.agent.inbox.nextStep].some((message) => contentHasImage(message.content)) || messagesHaveImage(found.agent.session.deriveMessages())) {`
const patchedSelectionGate = `\t\t\t\t\t\tconst desktopVisionMessages = [...found.agent.inbox.nextTurn, ...found.agent.inbox.nextStep, ...found.agent.session.deriveMessages()];
\t\t\t\t\t\tif (messagesHaveImage(desktopVisionMessages) && !desktopVisionMcpMessagesCanDelegate(desktopVisionMessages)) {`

// — Second target: dsh-agent-loop request boundary --------------------------
// The durable message keeps the image block (transcript renders it), so the
// image must be removed AFTER the durable append but BEFORE the model request.
// `buildRequest` assembles the frozen request from the boundary messages —
// this patch projects delegated images out at exactly that boundary. (A
// pre-step strip would run before the agent appends decision.messages
// durably and would erase the image from the transcript.)
const agentLoopTarget = path.join(
  desktopDir,
  'node_modules',
  '@deepseek-ai',
  'dsh-agent-loop',
  'lib',
  'index.js',
)

const agentLoopHelper = `
/** Desktop vision bridge: strip delegated image blocks before a text-only request. */
const DESKTOP_VISION_BRIDGE_TEXT = /\\[The user attached /;
function stripDelegatedImages(messages) {
\tlet changed = false;
\tconst out = [];
\tfor (const message of messages ?? []) {
\t\tconst content = message?.content;
\t\tif ((message?.source?.kind) !== "user" || !Array.isArray(content)) { out.push(message); continue; }
\t\tconst hasBridge = content.some((block) => block?.type === "text" && typeof block.text === "string" && DESKTOP_VISION_BRIDGE_TEXT.test(block.text));
\t\tif (!hasBridge) { out.push(message); continue; }
\t\tchanged = true;
\t\tout.push({ ...message, content: content.filter((block) => block.type !== "image") });
\t}
\treturn changed ? out : messages;
}
`

const agentLoopAnchor = 'import { TOOL_ABORTED_BEFORE_DISPATCH, TOOL_RUNTIME_SCHEDULER } from "@deepseek-ai/dsh-tools";'
const agentLoopRequestBefore = `\t\t\trequest: markAgentLoopRequest(deepFreeze({
\t\t\t\t...header.config,
\t\t\t\tmessages: boundaryMessages,`
const agentLoopRequestAfter = `\t\t\trequest: markAgentLoopRequest(deepFreeze({
\t\t\t\t...header.config,
\t\t\t\tmessages: stripDelegatedImages(boundaryMessages),`

// — Third target: shell transcript display ----------------------------------
// The bridge description text rides the durable user message (the model's
// text-only form), but the transcript must show ONLY the image. The shell's
// `contentParts` joins every text block into the bubble — this patch drops
// the marker-prefixed description block from display. Multiple image blocks
// are untouched and all render.
const shellClientTarget = path.join(
  desktopDir,
  'node_modules',
  '@deepseek-ai',
  'dsh-client-ui-conversation',
  'lib',
  'client.js',
)
const shellDisplayMarker = 'const DESKTOP_VISION_BRIDGE_DISPLAY = "[The user attached ";'
const shellContentPartsBefore = `\t\t\t\tif (b.type === "text" && typeof b.text === "string") texts.push(b.text);`
const shellContentPartsAfter = `\t\t\t\tif (b.type === "text" && typeof b.text === "string" && !b.text.startsWith(DESKTOP_VISION_BRIDGE_DISPLAY)) texts.push(b.text);`
const shellHelperAnchor = `function contentParts(content) {`

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected one clean match, found ${count}`)
  return source.replace(before, after)
}

let source = await readFile(target, 'utf8')
if (source.includes(marker)) {
  if (!source.includes(patchedPrompt) || !source.includes(patchedAdmission) || !source.includes(patchedRoute)) {
    throw new Error(`vision MCP bridge marker exists but ${target} is only partially patched`)
  }
  // The delegation body changed in 1.2.2 (keep the image block + append the
  // description text, so the transcript renders the image natively). Rewrite
  // the WHOLE injected block — the known previous versions are the old
  // map-replace body and the transitional flatMap-header mix; a current body
  // rewrites identically (idempotent no-op in effect).
  const injected = /\/\*\* Desktop-only delegation from GUI image parts[\s\S]*?\}\n(?=\/\*\* Search durable content)/.exec(source)
  if (injected === null) {
    throw new Error(`vision MCP bridge marker exists but the injected block was not found: ${target}`)
  }
  if (injected[0] !== bridgeSource) {
    source = source.replace(injected[0], bridgeSource)
    await writeFile(target, source, 'utf8')
    console.log(`vision MCP bridge body upgraded (image kept): ${target}`)
  } else {
    console.log(`vision MCP bridge already applied (current): ${target}`)
  }
} else {
  if (source.includes('const DESKTOP_VISION_BRIDGE_ENDPOINT =')) {
    throw new Error(
      `obsolete direct-provider vision bridge found in ${target}; restore the clean dependency before applying this patch`,
    )
  }

  if (checkOnly) throw new Error(`vision MCP bridge is not applied: ${target}`)

  source = replaceOnce(
    source,
    '/** Search durable content for an image reference, including nested tool results. */',
    `${bridgeSource}/** Search durable content for an image reference, including nested tool results. */`,
    'bridge insertion',
  )
  source = replaceOnce(source, originalPrompt, patchedPrompt, 'prompt cancellation')
  source = replaceOnce(source, originalAdmission, patchedAdmission, 'image admission')
  source = replaceOnce(source, originalRoute, patchedRoute, 'fetch cancellation')

  await writeFile(target, source, 'utf8')
  console.log(`vision MCP bridge applied: ${target}`)
}

// The native model-selection guard sees durable image blocks before the
// request-boundary strip. Let a text-only model through only when every image
// has the bridge companion that makes the later strip and MCP call safe.
if (!source.includes(patchedSelectionGate)) {
  if (checkOnly) throw new Error(`vision MCP bridge model-selection gate is not applied: ${target}`)
  source = replaceOnce(source, originalSelectionGate, patchedSelectionGate, 'model-selection image gate')
  await writeFile(target, source, 'utf8')
  console.log(`vision MCP bridge model-selection gate applied: ${target}`)
} else {
  console.log(`vision MCP bridge model-selection gate already applied: ${target}`)
}

// Apply (or verify) the agent-loop request-boundary strip.
let agentLoopSource = await readFile(agentLoopTarget, 'utf8')
if (!agentLoopSource.includes('function stripDelegatedImages(')) {
  if (checkOnly) throw new Error(`vision MCP bridge agent-loop strip is not applied: ${agentLoopTarget}`)
  agentLoopSource = replaceOnce(
    agentLoopSource,
    agentLoopAnchor,
    `${agentLoopAnchor}${agentLoopHelper}`,
    'agent-loop helper insertion',
  )
  agentLoopSource = replaceOnce(
    agentLoopSource,
    agentLoopRequestBefore,
    agentLoopRequestAfter,
    'agent-loop request strip',
  )
  await writeFile(agentLoopTarget, agentLoopSource, 'utf8')
  console.log(`vision MCP bridge agent-loop strip applied: ${agentLoopTarget}`)
} else {
  console.log(`vision MCP bridge agent-loop strip already applied: ${agentLoopTarget}`)
}

// Apply (or verify) the shell transcript display filter.
let shellClientSource = await readFile(shellClientTarget, 'utf8')
if (!shellClientSource.includes(shellDisplayMarker)) {
  if (checkOnly) throw new Error(`vision MCP bridge shell display filter is not applied: ${shellClientTarget}`)
  shellClientSource = replaceOnce(
    shellClientSource,
    shellHelperAnchor,
    `${shellDisplayMarker}\n\t\t${shellHelperAnchor}`,
    'shell display marker insertion',
  )
  shellClientSource = replaceOnce(
    shellClientSource,
    shellContentPartsBefore,
    shellContentPartsAfter,
    'shell contentParts filter',
  )
  await writeFile(shellClientTarget, shellClientSource, 'utf8')
  console.log(`vision MCP bridge shell display filter applied: ${shellClientTarget}`)
} else {
  console.log(`vision MCP bridge shell display filter already applied: ${shellClientTarget}`)
}
