'use client'

// lib/exploreStore.ts — persistent "explore list" (bookmarks) + explore graph state.
//
// Two independent localStorage concerns:
//   • tvkg-explore-list  — the user-curated set of series to explore (survives clear graph)
//   • tvkg-explore-graph — the actual rendered graph (nodes/edges/positions + expanded set)
//
// clear_graph wipes only the graph, never the list.

import { useEffect, useState } from 'react'
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '@/lib/constants'
import { nodeId } from '@/lib/nodeId'

export interface ExploreItem {
  // Globally unique graph node id ("series:1399", "person:1399", "country:US") — same as
  // GraphNode.id. Native TMDB keys of different labels overlap, so a bare id is not unique.
  // Use keyOfNodeId() from lib/nodeId to get the key for API calls and routes.
  id: string
  name: string
  type?: 'series' | 'person' | 'genre' | 'keyword' | 'network' | 'country' | 'language'
}

export const seriesItem = (tmdbId: number | string, name: string): ExploreItem =>
  ({ id: nodeId('Series', tmdbId), name, type: 'series' })

export const personItem = (personId: number | string, name: string): ExploreItem =>
  ({ id: nodeId('Person', personId), name, type: 'person' })

const LIST_KEY  = STORAGE_KEYS.exploreList
const GRAPH_KEY = STORAGE_KEYS.exploreGraph
const LIST_EVENT = 'tvkg-explore-list-changed'

// Ids changed from Wikidata Q-ids to "label:key" node ids — persisted state from the old
// schema can no longer be resolved, so drop it instead of showing dead entries.
if (typeof window !== 'undefined') {
  try {
    LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}

// ── Explore list ──────────────────────────────────────────────────────────────

export function getExploreList(): ExploreItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LIST_KEY)
    return raw ? (JSON.parse(raw) as ExploreItem[]) : []
  } catch {
    return []
  }
}

function saveExploreList(list: ExploreItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota errors */
  }
  window.dispatchEvent(new CustomEvent(LIST_EVENT))
}

export function isInExploreList(id: string): boolean {
  return getExploreList().some(i => i.id === id)
}

export function addToExploreList(item: ExploreItem) {
  const list = getExploreList()
  if (!list.some(i => i.id === item.id)) saveExploreList([...list, item])
}

export function removeFromExploreList(id: string) {
  saveExploreList(getExploreList().filter(i => i.id !== id))
}

/** Toggle membership; returns the new membership state (true = now in list). */
export function toggleExploreList(item: ExploreItem): boolean {
  if (isInExploreList(item.id)) {
    removeFromExploreList(item.id)
    return false
  }
  addToExploreList(item)
  return true
}

export function clearExploreList() {
  saveExploreList([])
}

/** Subscribe to list changes (same tab via CustomEvent, other tabs via storage). */
export function onExploreListChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const local = () => cb()
  const cross = (e: StorageEvent) => {
    if (e.key === LIST_KEY) cb()
  }
  window.addEventListener(LIST_EVENT, local)
  window.addEventListener('storage', cross)
  return () => {
    window.removeEventListener(LIST_EVENT, local)
    window.removeEventListener('storage', cross)
  }
}

/** React hook: the current explore list, kept in sync with storage. */
export function useExploreList(): ExploreItem[] {
  const [list, setList] = useState<ExploreItem[]>([])
  useEffect(() => {
    setList(getExploreList())
    return onExploreListChange(() => setList(getExploreList()))
  }, [])
  return list
}

// ── Explore graph persistence ──────────────────────────────────────────────────

export interface ExploreGraphState {
  // Flat array of Cytoscape element JSONs (from cy.elements().jsons()).
  elements: any[]
  expanded: string[]
}

export function loadExploreGraph(): ExploreGraphState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(GRAPH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ExploreGraphState
    if (!parsed || !Array.isArray(parsed.elements)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveExploreGraph(state: ExploreGraphState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GRAPH_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota errors */
  }
}

export function clearExploreGraph() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(GRAPH_KEY)
  } catch {
    /* ignore */
  }
}
