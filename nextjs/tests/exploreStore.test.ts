import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from '@/lib/constants'

async function load() {
  vi.resetModules()
  return import('@/lib/exploreStore')
}

const series = (id: number, name = `S${id}`) => ({ id: `series:${id}`, name, type: 'series' as const })

beforeEach(() => {
  localStorage.clear()
})

describe('explore list', () => {
  it('starts empty', async () => {
    const s = await load()
    expect(s.getExploreList()).toEqual([])
  })

  it('adds an item once and keeps the order', async () => {
    const s = await load()
    s.addToExploreList(series(1))
    s.addToExploreList(series(2))
    s.addToExploreList(series(1))
    expect(s.getExploreList().map(i => i.id)).toEqual(['series:1', 'series:2'])
  })

  it('toggle returns the new membership state', async () => {
    const s = await load()
    expect(s.toggleExploreList(series(1))).toBe(true)
    expect(s.isInExploreList('series:1')).toBe(true)
    expect(s.toggleExploreList(series(1))).toBe(false)
    expect(s.isInExploreList('series:1')).toBe(false)
  })

  it('a series and a person with the same key are different items', async () => {
    const s = await load()
    s.addToExploreList(s.seriesItem(1399, 'Game of Thrones'))
    s.addToExploreList(s.personItem(1399, 'Someone'))
    expect(s.getExploreList()).toHaveLength(2)
  })

  it('removes one item and clears all', async () => {
    const s = await load()
    s.addToExploreList(series(1))
    s.addToExploreList(series(2))
    s.removeFromExploreList('series:1')
    expect(s.getExploreList().map(i => i.id)).toEqual(['series:2'])
    s.clearExploreList()
    expect(s.getExploreList()).toEqual([])
  })

  it('persists under the versioned key', async () => {
    const s = await load()
    s.addToExploreList(series(7, 'Seven'))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.exploreList)!)).toEqual([series(7, 'Seven')])
  })

  it('notifies same-tab subscribers on change and stops after unsubscribe', async () => {
    const s = await load()
    const cb = vi.fn()
    const off = s.onExploreListChange(cb)
    s.addToExploreList(series(1))
    expect(cb).toHaveBeenCalledTimes(1)
    off()
    s.addToExploreList(series(2))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('notifies on a storage event for its key from another tab, ignores other keys', async () => {
    const s = await load()
    const cb = vi.fn()
    s.onExploreListChange(cb)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.exploreList }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('returns an empty list when the stored value is not valid JSON', async () => {
    localStorage.setItem(STORAGE_KEYS.exploreList, '{not json')
    const s = await load()
    expect(s.getExploreList()).toEqual([])
  })
})

describe('explore graph', () => {
  it('saves and loads the graph state', async () => {
    const s = await load()
    const state = { elements: [{ group: 'nodes', data: { id: 'series:1' } }], expanded: ['series:1'] }
    s.saveExploreGraph(state)
    expect(s.loadExploreGraph()).toEqual(state)
  })

  it('rejects stored data without an elements array', async () => {
    localStorage.setItem(STORAGE_KEYS.exploreGraph, JSON.stringify({ expanded: [] }))
    const s = await load()
    expect(s.loadExploreGraph()).toBeNull()
  })

  it('clearing the graph does not touch the explore list', async () => {
    const s = await load()
    s.addToExploreList(series(1))
    s.saveExploreGraph({ elements: [], expanded: [] })
    s.clearExploreGraph()
    expect(s.loadExploreGraph()).toBeNull()
    expect(s.getExploreList()).toHaveLength(1)
  })
})

describe('legacy keys', () => {
  it('are removed when the module loads', async () => {
    for (const k of LEGACY_STORAGE_KEYS) localStorage.setItem(k, 'old')
    await load()
    for (const k of LEGACY_STORAGE_KEYS) expect(localStorage.getItem(k)).toBeNull()
  })
})
