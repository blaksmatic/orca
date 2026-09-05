import { estimateRenderRowSize } from './worktree-list/viewport/virtual-rows'
import type { RenderRow } from './worktree-list/listing/render-row'

function getEstimatedRenderRowStarts(
  rows: readonly RenderRow[],
  firstHeaderIndex: number
): number[] {
  const starts: number[] = []
  let offset = 0
  for (let index = 0; index < rows.length; index++) {
    starts[index] = offset
    offset += estimateRenderRowSize(rows, index, firstHeaderIndex, null)
  }
  starts[rows.length] = offset
  return starts
}

// Why indexed once instead of a findIndex per header: both boundary passes ran a full row scan
// for every header row, so the sidebar row model cost O(headers x rows) on every rebuild — and it
// rebuilds on agent-status ticks, not just on drag.
function indexRepoHeaderRenderRows(rows: readonly RenderRow[]): Map<string, number> {
  const indexByRepoId = new Map<string, number>()
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    const repoId = row?.type === 'header' ? row.repo?.id : undefined
    // First match wins, matching findIndex.
    if (repoId !== undefined && !indexByRepoId.has(repoId)) {
      indexByRepoId.set(repoId, index)
    }
  }
  return indexByRepoId
}

function indexProjectGroupHeaderRenderRows(rows: readonly RenderRow[]): Map<string, number> {
  const indexByGroupId = new Map<string, number>()
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]
    if (row?.type !== 'header' || row.repo || typeof row.projectGroup?.id !== 'string') {
      continue
    }
    if (!indexByGroupId.has(row.projectGroup.id)) {
      indexByGroupId.set(row.projectGroup.id, index)
    }
  }
  return indexByGroupId
}

/** Successor lookup for a bucket ordering, built once instead of an indexOf per header. */
function indexBucketSuccessors(
  bucketsById: ReadonlyMap<string, readonly string[]>
): Map<string, string | undefined> {
  const successorById = new Map<string, string | undefined>()
  for (const ids of bucketsById.values()) {
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index]
      // indexOf is first-wins, so keep the first occurrence's successor.
      if (id !== undefined && !successorById.has(id)) {
        successorById.set(id, ids[index + 1])
      }
    }
  }
  return successorById
}

function findNextHeaderRenderRowIndex(rows: readonly RenderRow[], startIndex: number): number {
  for (let index = startIndex; index < rows.length; index++) {
    const row = rows[index]
    if (row?.type === 'header' || row?.type === 'host-header') {
      return index
    }
  }
  return rows.length
}

function findProjectGroupSectionEndIndex(
  rows: readonly RenderRow[],
  startIndex: number,
  depth: number
): number {
  for (let index = startIndex; index < rows.length; index++) {
    const row = rows[index]
    if (!row) {
      continue
    }
    if (row.type === 'host-header') {
      return index
    }
    if (row.type !== 'header') {
      continue
    }
    const rowDepth = row.projectGroupDepth ?? 0
    if (rowDepth <= depth || (!row.repo && !row.projectGroup)) {
      return index
    }
  }
  return rows.length
}

export function getRepoHeaderSectionEndByRepoId(args: {
  rows: readonly RenderRow[]
  firstHeaderIndex: number
  sidebarRepoHeaderIdsByBucket: ReadonlyMap<string, readonly string[]>
  repoHeaderBucketByRepoId: ReadonlyMap<string, string>
}): Map<string, number> {
  const rowStarts = getEstimatedRenderRowStarts(args.rows, args.firstHeaderIndex)
  const repoHeaderIndexByRepoId = indexRepoHeaderRenderRows(args.rows)
  const repoSuccessorById = indexBucketSuccessors(args.sidebarRepoHeaderIdsByBucket)
  const sectionEndByRepoId = new Map<string, number>()
  for (let index = 0; index < args.rows.length; index++) {
    const row = args.rows[index]
    const repoId = row?.type === 'header' ? row.repo?.id : undefined
    if (!repoId) {
      continue
    }
    const bucketKey = args.repoHeaderBucketByRepoId.get(repoId)
    const nextRepoId =
      bucketKey && args.sidebarRepoHeaderIdsByBucket.has(bucketKey)
        ? repoSuccessorById.get(repoId)
        : undefined
    const endIndex = nextRepoId
      ? (repoHeaderIndexByRepoId.get(nextRepoId) ?? -1)
      : findNextHeaderRenderRowIndex(args.rows, index + 1)
    sectionEndByRepoId.set(
      repoId,
      rowStarts[endIndex >= 0 ? endIndex : args.rows.length] ?? rowStarts[args.rows.length] ?? 0
    )
  }
  return sectionEndByRepoId
}

export function getProjectGroupHeaderSectionEndByGroupId(args: {
  rows: readonly RenderRow[]
  firstHeaderIndex: number
  sidebarProjectGroupHeaderIdsByBucket: ReadonlyMap<string, readonly string[]>
  projectGroupHeaderBucketByGroupId: ReadonlyMap<string, string>
}): Map<string, number> {
  const rowStarts = getEstimatedRenderRowStarts(args.rows, args.firstHeaderIndex)
  const projectGroupHeaderIndexByGroupId = indexProjectGroupHeaderRenderRows(args.rows)
  const groupSuccessorById = indexBucketSuccessors(args.sidebarProjectGroupHeaderIdsByBucket)
  const sectionEndByGroupId = new Map<string, number>()
  for (let index = 0; index < args.rows.length; index++) {
    const row = args.rows[index]
    const projectGroupHeader =
      row?.type === 'header' &&
      !row.repo &&
      row.projectGroup &&
      typeof row.projectGroup.id === 'string'
        ? { row, groupId: row.projectGroup.id }
        : null
    const groupId = projectGroupHeader?.groupId
    if (!groupId) {
      continue
    }
    const bucketKey = args.projectGroupHeaderBucketByGroupId.get(groupId)
    const nextGroupId =
      bucketKey && args.sidebarProjectGroupHeaderIdsByBucket.has(bucketKey)
        ? groupSuccessorById.get(groupId)
        : undefined
    const depth = projectGroupHeader.row.projectGroupDepth ?? 0
    const endIndex = nextGroupId
      ? (projectGroupHeaderIndexByGroupId.get(nextGroupId) ?? -1)
      : findProjectGroupSectionEndIndex(args.rows, index + 1, depth)
    sectionEndByGroupId.set(
      groupId,
      rowStarts[endIndex >= 0 ? endIndex : args.rows.length] ?? rowStarts[args.rows.length] ?? 0
    )
  }
  return sectionEndByGroupId
}
