// lib/api.ts — typed API client

import type {
  SearchResponse,
  PersonSearchResponse,
  SeriesDetail,
  GraphData,
  PersonDetail,
  SearchMode,
} from './types'
import {
  API_SEARCH_LIMIT,
  API_SEARCH_PERSONS_LIMIT,
  API_SIMILAR_LIMIT,
  API_NODE_GRAPH_LIMIT,
} from './constants'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api/backend'

export class ApiError extends Error {
  status: number
  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`)
    this.status = status
  }
}

/** "Search failed (HTTP 500), try again" — status omitted for network errors. */
export function failureMessage(what: string, e: unknown): string {
  const status = e instanceof ApiError ? ` (HTTP ${e.status})` : ''
  return `${what} failed${status}, try again`
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    next: { revalidate: 60 },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(res.status, text)
  }
  return res.json() as Promise<T>
}

export const api = {
  search(q: string, limit = API_SEARCH_LIMIT, mode: SearchMode = 'semantic') {
    const params = new URLSearchParams({ q, limit: String(limit), mode })
    return get<SearchResponse>(`/api/search?${params}`)
  },

  searchPersons(q: string, limit = API_SEARCH_PERSONS_LIMIT) {
    const params = new URLSearchParams({ q, limit: String(limit) })
    return get<PersonSearchResponse>(`/api/search/persons?${params}`)
  },

  series(id: string | number) {
    return get<SeriesDetail>(`/api/series/${id}`)
  },

  seriesGraph(id: string | number, depth: 1 | 2 = 1) {
    return get<GraphData>(`/api/graph/series/${id}?depth=${depth}`)
  },

  similar(id: string | number, mode: 'semantic' | 'hybrid' = 'hybrid', limit = API_SIMILAR_LIMIT) {
    const params = new URLSearchParams({ mode, limit: String(limit) })
    return get<SearchResponse>(`/api/series/${id}/similar?${params}`)
  },

  person(id: string | number) {
    return get<PersonDetail>(`/api/person/${id}`)
  },

  personGraph(id: string | number) {
    return get<GraphData>(`/api/person/${id}/graph`)
  },

  /** Hub graph: key is genre_id / keyword_id / network_id, or an ISO code for country / language. */
  nodeGraph(nodeType: string, key: string | number, limit = API_NODE_GRAPH_LIMIT) {
    return get<GraphData>(`/api/graph/node/${nodeType}/${encodeURIComponent(String(key))}?limit=${limit}`)
  },
}