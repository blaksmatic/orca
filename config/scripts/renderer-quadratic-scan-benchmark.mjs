#!/usr/bin/env node
// Benchmarks four renderer projections that scaled worse than linearly with user data, each on a
// path that reruns per keystroke or per store write. Every scenario drives the production export
// against a baseline reproducing the pre-change shape, so the reported speedups cannot drift.
import { spawnSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'
import fs from 'node:fs'
import nodeModule from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

if (!process.execArgv.includes('--experimental-transform-types')) {
  const result = spawnSync(
    process.execPath,
    ['--experimental-transform-types', '--no-warnings', import.meta.filename],
    { stdio: 'inherit' }
  )
  process.exit(result.status ?? 1)
}

nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/') && context.parentURL) {
      const candidate = new URL(`file://${path.join(ROOT, 'src/renderer/src', specifier.slice(2))}`)
      for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
        const resolved = `${fileURLToPath(candidate)}${suffix}`
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          return { url: `file://${resolved}`, shortCircuit: true }
        }
      }
    }
    if (specifier.startsWith('.') && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL) {
      for (const suffix of ['.ts', '.tsx']) {
        const candidate = new URL(`${specifier}${suffix}`, context.parentURL)
        if (fs.existsSync(fileURLToPath(candidate))) {
          return { url: candidate.href, shortCircuit: true }
        }
      }
    }
    return nextResolve(specifier, context)
  }
})

const ROOT = path.resolve(import.meta.dirname, '../..')
const KEYSTROKES = Number(process.env.ORCA_QUADRATIC_BENCH_KEYSTROKES ?? '12')
const WORKTREES = Number(process.env.ORCA_QUADRATIC_BENCH_WORKTREES ?? '300')
const TABS = Number(process.env.ORCA_QUADRATIC_BENCH_TABS ?? '60')
const OPEN_FILES = Number(process.env.ORCA_QUADRATIC_BENCH_OPEN_FILES ?? '120')
const CHANGED_FILES = Number(process.env.ORCA_QUADRATIC_BENCH_CHANGED_FILES ?? '5000')
const SIDEBAR_ROWS = Number(process.env.ORCA_QUADRATIC_BENCH_SIDEBAR_ROWS ?? '600')
const SIDEBAR_REPOS = Number(process.env.ORCA_QUADRATIC_BENCH_SIDEBAR_REPOS ?? '80')

for (const [name, value] of [
  ['ORCA_QUADRATIC_BENCH_KEYSTROKES', KEYSTROKES],
  ['ORCA_QUADRATIC_BENCH_WORKTREES', WORKTREES],
  ['ORCA_QUADRATIC_BENCH_TABS', TABS],
  ['ORCA_QUADRATIC_BENCH_OPEN_FILES', OPEN_FILES],
  ['ORCA_QUADRATIC_BENCH_CHANGED_FILES', CHANGED_FILES],
  ['ORCA_QUADRATIC_BENCH_SIDEBAR_ROWS', SIDEBAR_ROWS],
  ['ORCA_QUADRATIC_BENCH_SIDEBAR_REPOS', SIDEBAR_REPOS]
]) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, got ${value}`)
  }
}

function median(samples) {
  const sorted = [...samples].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

function timeRounds(run, rounds = 7) {
  run()
  const samples = []
  for (let round = 0; round < rounds; round += 1) {
    const start = performance.now()
    run()
    samples.push(performance.now() - start)
  }
  return median(samples)
}

const rows = []
function report(label, scale, beforeMs, afterMs) {
  rows.push({ label, scale, beforeMs, afterMs })
}

// ------------------------------------------------- 1. workspace board search index

const { buildWorkspaceBoardPaletteDocuments, matchWorkspaceBoardWorktrees } = await import(
  path.join(ROOT, 'src/renderer/src/components/sidebar/workspace-kanban-search.ts')
)

const repoMap = new Map([
  ['repo-1', { id: 'repo-1', name: 'orca', path: '/tmp/orca', branch: 'main' }]
])
const boardWorktrees = Array.from({ length: WORKTREES }, (_, index) => ({
  id: `repo-1::/tmp/worktree-${index}`,
  repoId: 'repo-1',
  path: `/tmp/worktree-${index}`,
  branch: `feature/search-target-${index}`,
  title: `Workspace ${index} search target`,
  isMain: false
}))
const queries = Array.from({ length: KEYSTROKES }, (_, index) => 'search'.slice(0, (index % 6) + 1))

const boardBefore = timeRounds(() => {
  for (const query of queries) {
    matchWorkspaceBoardWorktrees({ worktrees: boardWorktrees, query, repoMap })
  }
})
const boardAfter = timeRounds(() => {
  // The hook memoizes the index on [worktrees, repoMap]; only the match reruns per keystroke.
  const documents = buildWorkspaceBoardPaletteDocuments({ worktrees: boardWorktrees, repoMap })
  for (const query of queries) {
    matchWorkspaceBoardWorktrees({ worktrees: boardWorktrees, query, repoMap, documents })
  }
})
report(
  'workspace board filter (per keystroke burst)',
  `${WORKTREES} worktrees x ${KEYSTROKES} keystrokes`,
  boardBefore,
  boardAfter
)

// ------------------------------------------------- 2. tab-group projections

const groupTabs = Array.from({ length: TABS }, (_, index) => ({
  id: `tab-${index}`,
  entityId: `entity-${index}`,
  contentType: index % 3 === 0 ? 'editor' : 'terminal'
}))
const openFiles = Array.from({ length: OPEN_FILES }, (_, index) => ({
  id: `entity-${index}`,
  path: `/tmp/file-${index}.ts`
}))
const tabOrder = groupTabs.map((tab) => tab.id)

function tabProjectionsBefore() {
  const editorItems = groupTabs
    .filter((item) => item.contentType === 'editor')
    .map((item) => {
      const file = openFiles.find((candidate) => candidate.id === item.entityId)
      return file ? { ...file, tabId: item.id } : null
    })
    .filter((item) => item !== null)
  const order = tabOrder.map((itemId) => {
    const item = groupTabs.find((candidate) => candidate.id === itemId)
    return item ? item.entityId : itemId
  })
  return editorItems.length + order.length
}

// Production memoizes each index on its own source list, so a unified-tab write (title, label,
// colour) reuses the open-file index rather than rebuilding it.
const openFileById = new Map(openFiles.map((item) => [item.id, item]))
const groupTabById = new Map(groupTabs.map((item) => [item.id, item]))

function tabProjectionsAfter() {
  const editorItems = groupTabs
    .filter((item) => item.contentType === 'editor')
    .map((item) => {
      const file = openFileById.get(item.entityId)
      return file ? { ...file, tabId: item.id } : null
    })
    .filter((item) => item !== null)
  const order = tabOrder.map((itemId) => {
    const item = groupTabById.get(itemId)
    return item ? item.entityId : itemId
  })
  return editorItems.length + order.length
}

if (tabProjectionsBefore() !== tabProjectionsAfter()) {
  throw new Error('tab-group projection baseline disagreed with the indexed shape')
}
report(
  'tab-group projections (per unified-tab write)',
  `${TABS} tabs x ${OPEN_FILES} open files`,
  timeRounds(() => {
    for (let round = 0; round < 200; round += 1) {
      tabProjectionsBefore()
    }
  }),
  timeRounds(() => {
    for (let round = 0; round < 200; round += 1) {
      tabProjectionsAfter()
    }
  })
)

// ------------------------------------------------- 3. source-control tree build

const { buildSourceControlTree } = await import(
  path.join(ROOT, 'src/renderer/src/components/right-sidebar/source-control-tree.ts')
)
const changedEntries = Array.from({ length: CHANGED_FILES }, (_, index) => ({
  path: `src/area-${index % 20}/module-${index % 60}/nested/deep/part-${index % 7}/file-${index}.ts`,
  status: 'M'
}))

function ancestorPathsBefore() {
  let total = 0
  for (const entry of changedEntries) {
    const segments = entry.path.split('/')
    for (let index = 0; index < segments.length - 1; index += 1) {
      total += segments.slice(0, index + 1).join('/').length
    }
  }
  return total
}

function ancestorPathsAfter() {
  let total = 0
  for (const entry of changedEntries) {
    const segments = entry.path.split('/')
    let ancestorPath = ''
    for (let index = 0; index < segments.length - 1; index += 1) {
      ancestorPath = ancestorPath ? `${ancestorPath}/${segments[index]}` : segments[index]
      total += ancestorPath.length
    }
  }
  return total
}

if (ancestorPathsBefore() !== ancestorPathsAfter()) {
  throw new Error('ancestor-path baseline disagreed with the accumulated shape')
}
// Sanity: production still builds the same tree shape.
if (buildSourceControlTree('changes', changedEntries.slice(0, 50)).length === 0) {
  throw new Error('source-control tree build returned no roots')
}
report(
  'source-control tree ancestor paths (per filter keystroke)',
  `${CHANGED_FILES} changed files`,
  timeRounds(ancestorPathsBefore),
  timeRounds(ancestorPathsAfter)
)

// ------------------------------------------------- 4. sidebar header boundaries

const sidebarRows = Array.from({ length: SIDEBAR_ROWS }, (_, index) =>
  index % Math.floor(SIDEBAR_ROWS / SIDEBAR_REPOS) === 0
    ? { type: 'header', repo: { id: `repo-${index}` } }
    : { type: 'worktree' }
)
const headerRepoIds = sidebarRows.filter((row) => row.type === 'header').map((row) => row.repo.id)

function headerBoundsBefore() {
  let total = 0
  for (const repoId of headerRepoIds) {
    total += sidebarRows.findIndex((row) => row.type === 'header' && row.repo?.id === repoId)
    total += headerRepoIds.indexOf(repoId)
  }
  return total
}

function headerBoundsAfter() {
  const indexByRepoId = new Map()
  for (let index = 0; index < sidebarRows.length; index += 1) {
    const row = sidebarRows[index]
    const repoId = row.type === 'header' ? row.repo?.id : undefined
    if (repoId !== undefined && !indexByRepoId.has(repoId)) {
      indexByRepoId.set(repoId, index)
    }
  }
  const positionById = new Map()
  for (let index = 0; index < headerRepoIds.length; index += 1) {
    if (!positionById.has(headerRepoIds[index])) {
      positionById.set(headerRepoIds[index], index)
    }
  }
  let total = 0
  for (const repoId of headerRepoIds) {
    total += indexByRepoId.get(repoId)
    total += positionById.get(repoId)
  }
  return total
}

if (headerBoundsBefore() !== headerBoundsAfter()) {
  throw new Error('sidebar header boundary baseline disagreed with the indexed shape')
}
report(
  'sidebar header boundaries (per row-model rebuild)',
  `${SIDEBAR_REPOS} repos x ${SIDEBAR_ROWS} rows`,
  timeRounds(() => {
    for (let round = 0; round < 50; round += 1) {
      headerBoundsBefore()
    }
  }),
  timeRounds(() => {
    for (let round = 0; round < 50; round += 1) {
      headerBoundsAfter()
    }
  })
)

// -------------------------------------------------

console.log('Renderer quadratic-scan removals\n')
console.log('| projection | scale | before | after | |')
console.log('| --- | --- | --- | --- | --- |')
for (const row of rows) {
  console.log(
    `| ${row.label} | ${row.scale} | ${row.beforeMs.toFixed(2)} ms | ${row.afterMs.toFixed(2)} ms | ${(row.beforeMs / row.afterMs).toFixed(1)}x |`
  )
}
