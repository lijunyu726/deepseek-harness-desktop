#!/usr/bin/env node

import { createRequire } from 'node:module'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'

const projectRoot = resolve(import.meta.dirname, '..')
const defaultApp = join(projectRoot, 'release', 'mac-arm64', 'DeepSeek Harness.app')
const appPath = resolve(process.argv[2] ?? defaultApp)
const appRoot = join(appPath, 'Contents', 'Resources', 'app')
const appRequire = createRequire(join(appRoot, 'package.json'))

async function importFromApp(specifier) {
  return import(pathToFileURL(appRequire.resolve(specifier)).href)
}

const [
  { Context },
  { default: Loader },
  { default: Include },
  { CallId },
  { Session, SessionId },
  { default: AgentRegistry, Inbox },
  { default: TerminalSessionService },
  TerminalBash,
  { default: SandboxProvider },
  { default: SandboxPolicyService },
  { default: LocalSubprocessRuntime },
  { default: SystemPrompt },
  { default: ToolRuntime },
  ToolBashPersistent,
] = await Promise.all([
  importFromApp('@deepseek-ai/cordis'),
  importFromApp('@deepseek-ai/cordis-plugin-loader'),
  importFromApp('@deepseek-ai/cordis-plugin-include'),
  importFromApp('@deepseek-ai/dsh-llm'),
  importFromApp('@deepseek-ai/dsh-session'),
  importFromApp('@deepseek-ai/dsh-agent'),
  importFromApp('@deepseek-ai/dsh-terminal'),
  importFromApp('@deepseek-ai/dsh-terminal-bash'),
  importFromApp('@deepseek-ai/dsh-sandbox'),
  importFromApp('@deepseek-ai/dsh-sandbox-policy'),
  importFromApp('@deepseek-ai/dsh-subprocess-local'),
  importFromApp('@deepseek-ai/dsh-system-prompt'),
  importFromApp('@deepseek-ai/dsh-tools'),
  importFromApp('@deepseek-ai/dsh-tool-bash-persistent'),
])

class PassthroughSandbox extends SandboxProvider {
  confine(argv) {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

function createAgent(ctx, cwd) {
  const id = SessionId('desktop-release-persistent-bash-benchmark')
  const scope = ctx.plugin(() => {})
  const session = Session.create(id, [], { version: 0, id, createdAt: 0, cwd })
  const value = {
    id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted() {}, discarded() {}, claimed() {} }),
    status: 'idle',
    ctx: scope.ctx,
    send() {},
    followup() {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' }) }),
    inject() {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function resultText(result) {
  return result.content
    .filter(block => block.type === 'text')
    .map(block => block.text ?? '')
    .join('')
}

const root = await mkdtemp(join(tmpdir(), 'dsh-release-bash-benchmark-'))
const configPath = join(root, 'cordis.yml')
let context

try {
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-terminal'",
    "- name: '@deepseek-ai/dsh-test-sandbox'",
    "- name: '@deepseek-ai/dsh-sandbox-policy'",
    '  config:',
    '    mode: danger-full-access',
    `    workspaceRoot: ${JSON.stringify(root)}`,
    "- name: '@deepseek-ai/dsh-subprocess-local'",
    "- name: '@deepseek-ai/dsh-terminal-bash'",
    '  config:',
    '    pollIntervalMs: 10',
    '    exactProbeAfterMs: 20',
    '    idleSilenceMs: 30000',
    '    handoffGraceMs: 100',
    '    scrollbackLines: 20000',
    '    timeoutMs: 2000',
    '    disposeGraceMs: 500',
    "- name: '@deepseek-ai/dsh-tool-bash-persistent'",
    '  config:',
    '    timeoutMs: 5000',
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map([
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-terminal', TerminalSessionService],
    ['@deepseek-ai/dsh-test-sandbox', PassthroughSandbox],
    ['@deepseek-ai/dsh-sandbox-policy', SandboxPolicyService],
    ['@deepseek-ai/dsh-subprocess-local', LocalSubprocessRuntime],
    ['@deepseek-ai/dsh-terminal-bash', TerminalBash],
    ['@deepseek-ai/dsh-tool-bash-persistent', ToolBashPersistent],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  }
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()

  const owner = createAgent(context, root)
  const signal = new AbortController().signal
  let callNumber = 0
  async function execute(command) {
    const started = performance.now()
    const result = await context.tools.execute({
      signal,
      callId: CallId(`release-bash-benchmark-${++callNumber}`),
      name: 'bash',
      arguments: { command },
      agent: owner,
    })
    const elapsedMs = Math.round((performance.now() - started) * 10) / 10
    if (result.isError) throw new Error(`bash call failed after ${elapsedMs} ms: ${resultText(result)}`)
    return { elapsedMs, text: resultText(result) }
  }

  const state = await execute('export DSH_RELEASE_BENCHMARK=ok; mkdir -p nested; cd nested')
  const samples = []
  for (let index = 1; index <= 5; index += 1) {
    const sample = await execute(`printf "sample=${index} cwd=%s state=%s\\n" "$PWD" "$DSH_RELEASE_BENCHMARK"`)
    if (!sample.text.includes(`sample=${index}`) || !sample.text.includes('state=ok')) {
      throw new Error(`unexpected command output: ${JSON.stringify(sample.text)}`)
    }
    if (sample.text.includes('DSH_PERSISTENT_BASH_PROMPT')) {
      throw new Error('private persistent Bash prompt leaked into command output')
    }
    samples.push(sample.elapsedMs)
  }

  const maximumMs = Math.max(...samples)
  if (maximumMs >= 1000) {
    throw new Error(`controlled-prompt fast path failed: maximum repeated-call latency was ${maximumMs} ms`)
  }

  const averageMs = Math.round((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 10) / 10
  process.stdout.write(`${JSON.stringify({
    appPath,
    startupAndStateMs: state.elapsedMs,
    repeatedCommandMs: samples,
    averageMs,
    maximumMs,
    controlledPromptFastPath: true,
  }, null, 2)}\n`)
} finally {
  await context?.fiber.dispose()
  await rm(root, { recursive: true, force: true })
}
