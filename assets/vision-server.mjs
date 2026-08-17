/**
 * Vision MCP server — a "look at images" tool for DeepSeek Harness.
 *
 * Exposes the `describe_image` tool over stdio MCP. The tool reads a local
 * image file, sends it to a vision model, and returns a text description.
 * The harness's own model never needs image capability: it calls this tool
 * and receives text.
 *
 * Runtime configuration (dsh-desktop-vision-config):
 *   - Reads `vision.config.json` beside this script on every call. Fields:
 *     `model` (vision model name), `baseUrl` (OpenAI-compatible API base,
 *     e.g. https://token-plan-cn.xiaomimimo.com/v1), `apiKey` (optional
 *     API key override). Missing/empty fields fall back to the defaults
 *     below or the credential store, so the script keeps working without
 *     any config file.
 *   - API key resolution order: vision.config.json `apiKey` -> environment
 *     `XIAOMI_TOKEN_PLAN_CN_API_KEY` -> `$DSH_HOME/.credentials.yaml` key
 *     `XIAOMI_TOKEN_PLAN_CN_API_KEY`.
 *   - The desktop app's settings (扩展 → 看图工具) edits this config.
 *
 * Run: node vision-server.mjs
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFile } from 'node:fs/promises'
import { stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { parseDocument } from 'yaml'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = join(SCRIPT_DIR, 'vision.config.json')

const DEFAULT_BASE_URL = 'https://token-plan-cn.xiaomimimo.com/v1'
const DEFAULT_MODEL = 'mimo-v2.5'
const API_KEY_REF = 'XIAOMI_TOKEN_PLAN_CN_API_KEY'
/** Reject absurd inputs before the request; most endpoints cap ~20MB. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

/** Detect the supported raster media type from bytes, including extensionless attachment objects. */
function detectMediaType(bytes) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 6) {
    const signature = bytes.subarray(0, 6).toString('ascii')
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif'
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp'
  return null
}

/** Read vision.config.json; missing or malformed files read as empty. */
async function readRuntimeConfig() {
  try {
    const parsed = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** Resolve the API key: runtime config first, then env, then the dsh credentials store. */
async function resolveApiKey(runtime) {
  if (typeof runtime.apiKey === 'string' && runtime.apiKey.length > 0) {
    return runtime.apiKey
  }
  if (process.env[API_KEY_REF] && process.env[API_KEY_REF].length > 0) {
    return process.env[API_KEY_REF]
  }
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const credentialPath = join(home, '.credentials.yaml')
  let text
  try {
    text = await readFile(credentialPath, 'utf8')
  } catch {
    throw new Error(
      `vision MCP: no API key — set it in the desktop settings (扩展 → 看图工具), ` +
      `the ${API_KEY_REF} environment variable, or ${credentialPath}`,
    )
  }
  const doc = parseDocument(text)
  const value = doc.get(API_KEY_REF)
  if (typeof value === 'string' && value.length > 0) return value
  throw new Error(
    `vision MCP: ${API_KEY_REF} not found in ${credentialPath}, the environment, or the runtime config`,
  )
}

/** Ask the configured vision model to describe an image's base64 payload. */
async function describeWithModel(base64, mediaType, prompt) {
  const runtime = await readRuntimeConfig()
  const baseUrl = (typeof runtime.baseUrl === 'string' && runtime.baseUrl.length > 0
    ? runtime.baseUrl
    : DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = typeof runtime.model === 'string' && runtime.model.length > 0
    ? runtime.model
    : DEFAULT_MODEL
  const key = await resolveApiKey(runtime)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: `data:${mediaType};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`vision MCP: provider returned HTTP ${response.status}: ${body.slice(0, 500)}`)
    }
    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      throw new Error('vision MCP: provider returned no text content')
    }
    return content
  } finally {
    clearTimeout(timeout)
  }
}

const server = new McpServer(
  { name: 'vision', version: '1.1.0' },
  { capabilities: { tools: { listChanged: false } } },
)

server.registerTool(
  'describe_image',
  {
    title: 'Describe Image',
    description:
      'Read a local image file (PNG/JPEG/WebP/GIF) and return a text description of its contents using a vision model. ' +
      'Use this whenever the user asks what is in an image, needs a screenshot analyzed, or references a picture by path. ' +
      'The description is plain text, so it works regardless of whether the current model supports image input.',
    inputSchema: {
      path: z.string().describe('Absolute path of the image file to describe'),
      prompt: z
        .string()
        .optional()
        .describe('Optional instruction for what to look for; defaults to a general detailed description'),
    },
  },
  async ({ path, prompt }) => {
    const target = path.trim()
    const info = await stat(target).catch(() => null)
    if (info === null || !info.isFile()) {
      return {
        content: [{ type: 'text', text: `cannot read "${target}": no such file` }],
        isError: true,
      }
    }
    if (info.size > MAX_IMAGE_BYTES) {
      return {
        content: [{ type: 'text', text: `cannot read "${target}": file is ${info.size} bytes (limit ${MAX_IMAGE_BYTES})` }],
        isError: true,
      }
    }
    try {
      const bytes = await readFile(target)
      const mediaType = detectMediaType(bytes)
      if (mediaType === null) {
        return {
          content: [{ type: 'text', text: `cannot read "${target}": bytes are not a supported PNG/JPEG/WebP/GIF image` }],
          isError: true,
        }
      }
      const base64 = bytes.toString('base64')
      const text = await describeWithModel(
        base64,
        mediaType,
        prompt ?? 'Describe this image in detail: what is depicted, the layout, colors, and any visible text.',
      )
      return { content: [{ type: 'text', text }] }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `failed to describe "${target}": ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      }
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
