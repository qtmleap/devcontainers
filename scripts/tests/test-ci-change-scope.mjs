// Executes the inline github-script classifier from ci-change-scope.yaml.
// Run: node --test scripts/tests/test-ci-change-scope.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const WORKFLOW = fileURLToPath(new URL('../../.github/workflows/ci-change-scope.yaml', import.meta.url))
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

const yaml = readFileSync(WORKFLOW, 'utf8')

const extractScript = (text) => {
  const lines = text.split('\n')
  const starts = lines.flatMap((l, i) => (/^\s+script: \|$/.test(l) ? [i] : []))
  assert.equal(starts.length, 1, 'exactly one inline script block')
  const indent = lines[starts[0]].match(/^\s*/)[0].length
  const body = []
  for (const l of lines.slice(starts[0] + 1)) {
    if (l.trim() !== '' && l.match(/^\s*/)[0].length <= indent) break
    body.push(l.slice(indent + 2))
  }
  return body.join('\n')
}
const script = extractScript(yaml)

const SHA = (c) => c.repeat(40)
const BASE = SHA('a')
const HEAD = SHA('b')
const ZERO = SHA('0')
const ALLOW_PATHS = JSON.stringify(['README.md', 'LICENSE'])
const ALLOW_PREFIXES = JSON.stringify(['docs/'])

const file = (filename, status = 'modified') => ({ filename, status, sha: HEAD })

const makeCore = ({ summaryFails = false } = {}) => {
  const out = { outputs: {}, warnings: [], blocks: [], summaryWrites: 0 }
  const summary = {
    addHeading: () => summary,
    addRaw: (t) => (out.blocks.push(String(t)), summary),
    addCodeBlock: (t) => (out.blocks.push(String(t)), summary),
    write: async () => {
      out.summaryWrites++
      if (summaryFails) throw new Error('summary boom')
    },
  }
  out.core = {
    setOutput: (k, v) => {
      out.outputs[k] = v
    },
    warning: (m) => out.warnings.push(String(m)),
    info: () => {},
    notice: () => {},
    summary,
  }
  return out
}

const prEvent = (over = {}) => ({
  eventName: 'pull_request',
  repo: { owner: 'o', repo: 'r' },
  payload: {
    action: 'synchronize',
    pull_request: { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: 1 },
    ...over,
  },
})

const prGithub = ({ files, immutableFiles = files, compare = {}, compareError } = {}) => {
  const calls = { compare: [] }
  return {
    calls,
    rest: {
      repos: {
        compareCommitsWithBasehead: async (params) => {
          calls.compare.push(params)
          if (compareError) throw new Error('immutable compare unavailable')
          return { data: {
            status: 'ahead', base_commit: { sha: BASE }, merge_base_commit: { sha: BASE },
            total_commits: 1, commits: [{ sha: HEAD }], files: immutableFiles, ...compare,
          } }
        },
      },
    },
  }
}

const pushEvent = (over = {}) => ({
  eventName: 'push',
  ref: 'refs/heads/main',
  repo: { owner: 'o', repo: 'r' },
  payload: { ref: 'refs/heads/main', before: BASE, after: HEAD, forced: false, ...over },
})

const compareData = (over = {}) => ({
  status: 'ahead',
  total_commits: 1,
  merge_base_commit: { sha: BASE },
  base_commit: { sha: BASE },
  commits: [{ sha: HEAD }],
  files: [file('README.md')],
  ...over,
})

const pushGithub = (data, { error } = {}) => ({
  rest: {
    pulls: {},
    repos: {
      compareCommitsWithBasehead: async () => {
        if (error) throw new Error('api down')
        return { data }
      },
    },
  },
})

const run = async ({ context, github, env = {}, coreOpts }) => {
  const c = makeCore(coreOpts)
  const penv = { DOC_PATHS: ALLOW_PATHS, DOC_PREFIXES: ALLOW_PREFIXES, FORCE_HEAVY: 'false', ...env }
  const fn = new AsyncFunction('github', 'context', 'core', 'process', script)
  await fn(github ?? {}, context, c.core, { env: penv })
  return c
}

const assertHeavy = (c, pattern) => {
  assert.equal(c.outputs.docs_only, 'false')
  if (pattern) assert.match(c.outputs.reason, pattern)
}

test('workflow shape: reusable, least privilege, no checkout/secrets/concurrency', () => {
  assert.match(yaml, /^on:\s*\n\s+workflow_call:/m)
  assert.match(yaml, /permissions:\s*\n\s+contents: read/)
  assert.doesNotMatch(yaml, /pull-requests:/)
  assert.doesNotMatch(yaml, /actions\/checkout|secrets\.|^\s*concurrency:|continue-on-error/m)
  assert.doesNotMatch(script, /\$\{\{/, 'no expression interpolation inside script')
  assert.match(yaml, /actions\/github-script@v7/)
})

test('PR: docs-only allowlisted exact path and prefix markdown => true', async () => {
  const files = [file('README.md'), file('docs/guide/a.md', 'added')]
  const c = await run({ context: prEvent({ pull_request: { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: 2 } }), github: prGithub({ files }) })
  assert.equal(c.outputs.docs_only, 'true')
  assert.ok(c.blocks.join('\n').includes('docs/guide/a.md'))
})

test('PR: adopted hidden-directory iOS instructions can be explicitly allowlisted', async () => {
  const name = '.agents/skills/ios-development/references/testing-policy.md'
  const c = await run({ context: prEvent(), github: prGithub({ files: [file(name)] }),
    env: { DOC_PATHS: JSON.stringify([name]), DOC_PREFIXES: '[]' } })
  assert.equal(c.outputs.docs_only, 'true')
})

test('PR: immutable source changes cannot be confused with mutable documentation pages', async () => {
  const c = await run({ context: prEvent(), github: prGithub({
    files: [file('README.md')], immutableFiles: [file('src/main.ts')],
  }) })
  assertHeavy(c)
})

test('PR: missing or malformed immutable file identities run heavy', async () => {
  for (const sha of [undefined, null, '', 'invalid']) {
    assertHeavy(await run({ context: prEvent(), github: prGithub({ files: [{ ...file('README.md'), sha }] }) }))
  }
})

test('PR: a complete 100-commit comparison is allowed, 101 is conservative', async () => {
  const commits = Array.from({ length: 100 }, (_, i) => ({ sha: (i + 1).toString(16).padStart(40, '0') }))
  commits[99] = { sha: HEAD }
  const hundred = prGithub({ files: [file('README.md')], compare: { total_commits: 100, commits } })
  assert.equal((await run({ context: prEvent(), github: hundred })).outputs.docs_only, 'true')
  assertHeavy(await run({ context: prEvent(), github: prGithub({ files: [file('README.md')], compare: { total_commits: 101, commits } }) }))
})

test('PR: incomplete or mismatched immutable comparisons never exempt tests', async () => {
  for (const compare of [
    { status: 'behind' }, { status: 'identical' }, { base_commit: { sha: SHA('c') } },
    { merge_base_commit: null }, { total_commits: 101 }, { total_commits: 2 },
    { commits: [{ sha: SHA('c') }] }, { files: [] }, { files: null },
    { files: [file('README.md', 'removed')] },
    { files: [{ ...file('README.md'), previous_filename: 'old.md' }] },
  ]) assertHeavy(await run({ context: prEvent(), github: prGithub({ files: [file('README.md')], compare }) }))
  assertHeavy(await run({ context: prEvent(), github: prGithub({ files: [file('README.md')], compareError: true }) }))
  const g = prGithub({ files: [file('README.md')] })
  assert.equal((await run({ context: prEvent(), github: g })).outputs.docs_only, 'true')
  assert.equal(g.calls.compare[0].basehead, `${BASE}...${HEAD}`)
  assert.equal(g.calls.compare[0].page, 1)
  // Files are first-page-only, up to 300 for the whole comparison; per_page limits commits.
  assert.equal(g.calls.compare[0].per_page, 100)
})

test('PR: source, assets, lockfile, CI mix => heavy', async () => {
  for (const bad of ['src/main.ts', 'docs/logo.png', 'bun.lock', '.github/workflows/x.yaml', '.devcontainer/devcontainer.json', 'Package.resolved']) {
    const files = [file('README.md'), file(bad)]
    const c = await run({ context: prEvent({ pull_request: { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: 2 } }), github: prGithub({ files }) })
    assertHeavy(c)
  }
})

test('PR: markdown outside allowlist is not exempt (no extension-wide Markdown)', async () => {
  const c = await run({ context: prEvent(), github: prGithub({ files: [file('CHANGELOG.md')] }) })
  assertHeavy(c)
})

test('allowlist malformed or unsafe => heavy', async () => {
  const bads = [
    { DOC_PATHS: 'not json' },
    { DOC_PATHS: '{"a":1}' },
    { DOC_PATHS: '[1]' },
    { DOC_PATHS: '["../README.md"]' },
    { DOC_PATHS: '["/README.md"]' },
    { DOC_PATHS: '[".github/README.md"]' },
    { DOC_PATHS: '["src/x.md"]' },
    { DOC_PREFIXES: '["docs"]' },
    { DOC_PREFIXES: '["docs/../"]' },
    { DOC_PREFIXES: '["/"]' },
    { DOC_PREFIXES: '[""]' },
    { DOC_PREFIXES: '[".github/"]' },
    { DOC_PREFIXES: '[".devcontainer/"]' },
    { DOC_PREFIXES: '["src/docs/"]' },
    { DOC_PREFIXES: '[]', DOC_PATHS: '[]' },
  ]
  for (const env of bads) {
    const c = await run({ context: prEvent(), github: prGithub({ files: [file('README.md')] }), env })
    assertHeavy(c)
  }
})

test('PR: filename injection and traversal => heavy', async () => {
  const names = ['docs/../src/a.md', 'docs/a.md\n::set-output', 'docs/$(id).md', 'docs/`x`.md', 'docs//a.md', 'docs/./a.md', 'docs\\a.md', '/docs/a.md', 'docs/a b.md', 'docs/a.md ', 'docs/%2e%2e/a.md']
  for (const n of names) {
    const c = await run({ context: prEvent(), github: prGithub({ files: [file(n)] }) })
    assertHeavy(c)
    assert.doesNotMatch(c.outputs.reason, /[\n\r]/)
  }
})

test('PR: rename, removal, copy, unknown status => heavy', async () => {
  for (const status of ['renamed', 'removed', 'copied', 'changed', 'unchanged', 'weird', undefined]) {
    const c = await run({ context: prEvent(), github: prGithub({ files: [{ filename: 'README.md', status }] }) })
    assertHeavy(c)
  }
  const c = await run({ context: prEvent(), github: prGithub({ files: [{ filename: 'README.md', status: 'modified', previous_filename: 'x.md' }] }) })
  assertHeavy(c)
})

test('PR: API errors => heavy with explanation, never throws', async () => {
  const c = await run({ context: prEvent(), github: prGithub({ files: [file('README.md')], compareError: true }) })
  assertHeavy(c, /error|unavailable/i)
  assert.ok(c.outputs.reason.length > 0)
})

test('PR: first comparison page contains files beyond the commit page size', async () => {
  const n = 250
  const docs = Array.from({ length: n }, (_, i) => file(`docs/p${i}.md`, 'added'))
  const ctx = prEvent({ pull_request: { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: n } })
  const g = prGithub({ files: docs })
  const c = await run({ context: ctx, github: g })
  assert.equal(c.outputs.docs_only, 'true')
  assert.equal(g.calls.compare.length, 1)
  // a non-doc file on the last page must be seen
  const files = [...docs.slice(0, 249), file('src/last.ts')]
  const c2 = await run({ context: ctx, github: prGithub({ files }) })
  assertHeavy(c2)
})

test('PR: missing or malformed event snapshots => heavy without mutable endpoints', async () => {
  const files = [file('README.md')]
  const ok = { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: 1 }
  for (const payload of [
    { ...ok, head: {} }, { ...ok, base: {} }, { ...ok, changed_files: undefined },
    { ...ok, changed_files: 2 }, { ...ok, number: undefined },
  ]) {
    const c = await run({ context: prEvent({ pull_request: payload }), github: prGithub({ files }) })
    assertHeavy(c)
  }
  // The immutable comparison's last commit disagrees with the event head.
  const c = await run({ context: prEvent({ pull_request: { number: 7, head: { sha: SHA('d') }, base: { sha: BASE }, changed_files: 1 } }), github: prGithub({ files }) })
  assertHeavy(c)
})

test('PR: file count cap and mismatch => heavy', async () => {
  const mk = (changed, files) => ({ ctx: prEvent({ pull_request: { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: changed } }), files })
  for (const { ctx, files } of [
    mk(0, []),
    mk(3000, Array.from({ length: 3000 }, (_, i) => file(`docs/${i}.md`))),
    mk(2, [file('README.md')]),
    mk(1, [file('README.md'), file('docs/a.md')]),
    mk(undefined, [file('README.md')]),
  ]) {
    const c = await run({ context: ctx, github: prGithub({ files }) })
    assertHeavy(c)
  }
})

test('PR: non-qualifying actions => heavy without API use', async () => {
  for (const action of ['closed', 'edited', 'labeled', 'converted_to_draft', undefined]) {
    const g = prGithub({ files: [file('README.md')] })
    const c = await run({ context: prEvent({ action }), github: g })
    assertHeavy(c)
    assert.equal(g.calls.compare.length, 0)
  }
  for (const action of ['opened', 'synchronize', 'reopened', 'ready_for_review']) {
    const c = await run({ context: prEvent({ action }), github: prGithub({ files: [file('README.md')] }) })
    assert.equal(c.outputs.docs_only, 'true')
  }
})

test('push: valid docs-only compare => true', async () => {
  const c = await run({ context: pushEvent(), github: pushGithub(compareData()) })
  assert.equal(c.outputs.docs_only, 'true')
})

test('push: mismatches, truncation, merge-base, forced, zero, tag => heavy', async () => {
  const many = Array.from({ length: 300 }, (_, i) => file(`docs/${i}.md`))
  const cases = [
    ['base mismatch', pushEvent(), compareData({ base_commit: { sha: SHA('c') } })],
    ['last sha mismatch', pushEvent(), compareData({ commits: [{ sha: SHA('c') }] })],
    ['merge base mismatch', pushEvent(), compareData({ merge_base_commit: { sha: SHA('c') } })],
    ['diverged', pushEvent(), compareData({ status: 'diverged' })],
    ['behind', pushEvent(), compareData({ status: 'behind' })],
    ['identical', pushEvent(), compareData({ status: 'identical' })],
    ['total 0', pushEvent(), compareData({ total_commits: 0, commits: [] })],
    ['commit truncation', pushEvent(), compareData({ total_commits: 101, commits: Array.from({ length: 100 }, () => ({ sha: HEAD })) })],
    ['total != commits.length', pushEvent(), compareData({ total_commits: 2 })],
    ['files truncated 300', pushEvent(), compareData({ files: many })],
    ['no files', pushEvent(), compareData({ files: [] })],
    ['removed file', pushEvent(), compareData({ files: [file('README.md', 'removed')] })],
    ['renamed file', pushEvent(), compareData({ files: [file('README.md', 'renamed')] })],
    ['source file', pushEvent(), compareData({ files: [file('src/a.ts')] })],
    ['forced', pushEvent({ forced: true }), compareData()],
    ['zero before', pushEvent({ before: ZERO }), compareData()],
    ['zero after', pushEvent({ after: ZERO }), compareData()],
    ['bad sha', pushEvent({ before: 'abc' }), compareData()],
    ['tag', { ...pushEvent({ ref: 'refs/tags/v1' }), ref: 'refs/tags/v1' }, compareData()],
  ]
  for (const [name, ctx, data] of cases) {
    const c = await run({ context: ctx, github: pushGithub(data) })
    assert.equal(c.outputs.docs_only, 'false', name)
  }
  const e = await run({ context: pushEvent(), github: pushGithub(compareData(), { error: true }) })
  assertHeavy(e, /api|error|fail/i)
})

test('manual, schedule, merge_group, release, unknown events => heavy', async () => {
  for (const eventName of ['workflow_dispatch', 'schedule', 'merge_group', 'release', 'workflow_run', 'pull_request_target', '']) {
    const c = await run({ context: { eventName, payload: {}, repo: { owner: 'o', repo: 'r' } }, github: {} })
    assertHeavy(c)
  }
})

test('force-heavy overrides an otherwise docs-only change', async () => {
  const c = await run({ context: prEvent(), github: prGithub({ files: [file('README.md')] }), env: { FORCE_HEAVY: 'true' } })
  assertHeavy(c, /force/i)
  const d = await run({ context: prEvent(), github: prGithub({ files: [file('README.md')] }), env: { FORCE_HEAVY: 'maybe' } })
  assertHeavy(d)
})

test('summary write failure only warns and cannot change the result', async () => {
  const heavy = await run({ context: prEvent(), github: prGithub({ files: [file('src/a.ts')] }), coreOpts: { summaryFails: true } })
  assert.equal(heavy.outputs.docs_only, 'false')
  assert.ok(heavy.warnings.some((w) => /summary/i.test(w)))
  const docs = await run({ context: prEvent(), github: prGithub({ files: [file('README.md')] }), coreOpts: { summaryFails: true } })
  assert.equal(docs.outputs.docs_only, 'true')
  assert.ok(docs.warnings.some((w) => /summary/i.test(w)))
})

test('summary caps large file lists and emits names as code, not markup', async () => {
  const files = Array.from({ length: 250 }, (_, i) => file(`docs/f${i}.md`, 'added'))
  const ctx = prEvent({ pull_request: { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: 250 } })
  const c = await run({ context: ctx, github: prGithub({ files }) })
  const text = c.blocks.join('\n')
  assert.ok(text.length < 20000)
  assert.match(text, /more|truncated|omitted/i)
  const evil = await run({ context: prEvent(), github: prGithub({ files: [file('<script>alert(1)</script>.md')] }) })
  assert.equal(evil.outputs.docs_only, 'false')
  assert.doesNotMatch(evil.blocks.join('\n'), /<script>/)
  assert.match(evil.blocks.join('\n'), /&lt;script&gt;/)
})

test('PR: immutable comparison limit is conservative even for all-documentation pages', async () => {
  const files = Array.from({ length: 300 }, (_, i) => file(`docs/f${i}.md`))
  const ctx = prEvent({ pull_request: { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: 300 } })
  assertHeavy(await run({ context: ctx, github: prGithub({ files }) }), /out of range|300-file/)
})

test('audited prefixes cannot exempt denied path segments, including mixed case', async () => {
  for (const name of ['docs/src/a.md', 'docs/Src/a.md', 'docs/tests/a.md', 'docs/Examples/a.md']) {
    assertHeavy(await run({ context: prEvent(), github: prGithub({ files: [file(name)] }) }))
  }
})

test('PR: 299 complete documentation files can be exempted at the boundary', async () => {
  const files = Array.from({ length: 299 }, (_, i) => file(`docs/f${i}.md`))
  const context = prEvent({ pull_request: { number: 7, head: { sha: HEAD }, base: { sha: BASE }, changed_files: 299 } })
  assert.equal((await run({ context, github: prGithub({ files }) })).outputs.docs_only, 'true')
})

test('push: 99 complete files can be exempted, 100 remains conservative', async () => {
  for (const n of [99, 100]) {
    const files = Array.from({ length: n }, (_, i) => file(`docs/f${i}.md`))
    const result = await run({ context: pushEvent(), github: pushGithub(compareData({ files })) })
    assert.equal(result.outputs.docs_only, n === 99 ? 'true' : 'false')
  }
})
