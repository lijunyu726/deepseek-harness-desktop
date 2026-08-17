/**
 * usage-scan — standalone session-log usage scanner (child process).
 *
 * Scans `session.jsonl.zstd` logs for `assistant/message` usage frames and
 * aggregates tokens per local calendar day. It exists as a SEPARATE process
 * because Electron's embedded Node (ELECTRON_RUN_AS_NODE) intermittently
 * SIGTRAPs inside native zstd code on every in-process decode path (verified
 * against the full session corpus). A child process isolates that crash: if
 * this scanner dies, the desktop plugin keeps serving cached usage data.
 *
 * Decoding uses the streaming Transform API per frame — the only path that
 * survived repeated stress runs.
 *
 * Usage:
 *   node usage-scan.mjs --home <dsh-home> [file1 file2 ...]
 *     Scan the given files fully (offset 0). When no files are given, scan
 *     every file under <home>/sessions.
 *   node usage-scan.mjs --home <dsh-home> --jobs <json>
 *     json = [{"file": "/abs/path", "offset": 12345}, ...] — `offset` is a
 *     previously verified FRAME boundary; frames before it are skipped so
 *     only appended batches are decoded (incremental refresh).
 * Output: one JSON line on stdout:
 *   {"ok":true,"ms":123,"results":{"<file>":{"frames":N,"frameEnd":<int>,"days":{"YYYY-MM-DD":{"inputTokens":N,"outputTokens":N}}}}}
 * `frameEnd` = byte offset after the last COMPLETE frame the scanner decoded
 * (callers persist it as the next incremental offset). Days are the
 * contribution of the scanned frames only.
 * Exit code 0 on success, non-zero on failure (stderr carries the error).
 */

import { createZstdDecompress } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
let home = ''
let jobsJson = null
const positional = []
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--home') home = argv[++i] ?? ''
  else if (argv[i] === '--jobs') jobsJson = argv[++i] ?? null
  else positional.push(argv[i])
}
if (home.length === 0) {
  console.error('usage-scan: --home <dir> is required')
  process.exit(2)
}

const ZSTD_MAGIC = 4247762216
const MAX_FILE_BYTES = 512 * 1024 * 1024

/** Split concatenated zstd frames on structural boundaries (mirrors dsh-session-persistence-jsonl). */
function scanZstdFrames(buffer) {
  const frames = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) return frames
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) return frames
    offset += 4
    if (offset === buffer.length) return frames
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) return frames
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) return frames
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return frames
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) return frames
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return frames
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return frames
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

/** Decode ONE complete zstd frame through the streaming Transform API. */
function decodeFrame(frame) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let stream
    try {
      stream = createZstdDecompress()
    } catch (err) {
      reject(err)
      return
    }
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    stream.on('error', reject)
    stream.end(frame)
  })
}

/** Local-timezone day key. */
function localDayKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Aggregate assistant/message usage frames from one decompressed JSONL text. */
function parseUsageLines(text) {
  const map = new Map()
  let pos = 0
  while (pos < text.length) {
    const nl = text.indexOf('\n', pos)
    const end = nl === -1 ? text.length : nl
    const line = text.slice(pos, end)
    pos = end + 1
    if (!line.includes('"assistant/message"')) continue
    let frame
    try {
      frame = JSON.parse(line)
    } catch {
      continue
    }
    const usage = frame?.data?.usage
    const time = frame?.time
    if (usage === undefined || typeof usage !== 'object' || typeof time !== 'number') continue
    const input = (usage.inputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
    const output = usage.outputTokens ?? 0
    if (input === 0 && output === 0) continue
    const key = localDayKey(time)
    const hit = map.get(key)
    if (hit === undefined) map.set(key, { inputTokens: input, outputTokens: output })
    else {
      hit.inputTokens += input
      hit.outputTokens += output
    }
  }
  return map
}

async function scanFile(file, offset) {
  const info = statSync(file)
  if (info.size === 0 || info.size > MAX_FILE_BYTES) return null
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > info.size) offset = 0
  const buffer = readFileSync(file)
  // The cached offset must be a verified frame boundary; a rewrite leaves
  // stale bytes there, so fall back to a full scan when the magic is gone.
  if (offset > 0) {
    if (offset + 4 > buffer.length || buffer.readUInt32LE(offset) !== ZSTD_MAGIC) offset = 0
  }
  const tail = offset > 0 ? buffer.subarray(offset) : buffer
  const frames = scanZstdFrames(tail).map((frame) => ({ start: frame.start + offset, end: frame.end + offset }))
  if (frames.length === 0) return { frames: 0, frameEnd: offset, days: {} }
  const parts = []
  for (const frame of frames) {
    parts.push(await decodeFrame(buffer.subarray(frame.start, frame.end)))
  }
  const dayMap = parseUsageLines(parts.join(''))
  const days = {}
  for (const [key, value] of dayMap) days[key] = value
  return { frames: frames.length, frameEnd: frames[frames.length - 1].end, days }
}

function defaultJobs() {
  const dir = path.join(home, 'sessions')
  const jobs = []
  try {
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true })
    for (const entry of entries) {
      if (entry?.isFile() && entry.name === 'session.jsonl.zstd') {
        jobs.push({ file: path.join(entry.parentPath ?? dir, entry.name), offset: 0 })
      }
    }
  } catch {
    /* empty */
  }
  return jobs
}

const started = Date.now()
let jobs = []
if (jobsJson !== null) {
  try {
    const parsed = JSON.parse(jobsJson)
    if (Array.isArray(parsed)) jobs = parsed.filter((job) => job && typeof job.file === 'string')
  } catch {
    console.error('usage-scan: --jobs must be a JSON array')
    process.exit(2)
  }
} else {
  jobs = positional.length > 0
    ? positional.map((file) => ({ file, offset: 0 }))
    : defaultJobs()
}

const results = {}
let scanned = 0
for (const job of jobs) {
  try {
    const result = await scanFile(job.file, Number(job.offset ?? 0))
    if (result !== null) {
      results[job.file] = result
      scanned += 1
    }
  } catch {
    /* skip unreadable/corrupt file */
  }
}
process.stdout.write(`${JSON.stringify({ ok: true, ms: Date.now() - started, scanned, results })}\n`)
process.exit(0)
