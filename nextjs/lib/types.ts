// lib/types.ts — shared TypeScript types
// Mirrors the FastAPI backend (TMDB schema): tmdb_id / person_id keys, overview, prefixed graph node ids.

export interface SeriesResult {
  tmdb_id: number
  name: string
  start_year: number | null
  end_year: number | null
  episode_count: number | null
  season_count: number | null
  overview: string | null
  poster_path: string | null        // https://image.tmdb.org/t/p/w500{poster_path}
  vote_average: number | null
  vote_count: number | null
  popularity: number | null
  score: number
  shared_actors: number | null
  shared_countries: number | null
  source: 'vector' | 'graph'        // where the candidate came from
}

export interface SearchResponse {
  query: string
  mode: 'semantic' | 'structural' | 'hybrid'
  results: SeriesResult[]
  total: number
}

export interface PersonRef {
  person_id: number
  name: string
}

export interface NetworkRef {
  network_id: number
  name: string
  country: string | null
}

export interface SeriesDetail {
  tmdb_id: number
  name: string
  original_name: string | null
  // Cross-refs: null when TMDB has none
  imdb_id: string | null
  wikidata_id: string | null
  tvdb_id: number | null
  start_year: number | null
  end_year: number | null
  status: string | null
  type: string | null
  in_production: boolean | null
  original_language: string | null  // ISO 639-1
  season_count: number | null
  episode_count: number | null
  episode_runtime: number | null
  popularity: number | null
  vote_average: number | null
  vote_count: number | null
  us_content_rating: string | null
  overview: string | null
  tagline: string | null
  homepage: string | null
  poster_path: string | null
  genres: string[]                  // names as stored (English in the deployment checked)
  keywords: string[]                // English tags
  countries: string[]               // ISO 3166-1 alpha-2 codes
  languages: string[]               // ISO 639-1 codes, all languages of the show
  networks: NetworkRef[]
  cast_count: number | null
  creators: PersonRef[]
  directors: PersonRef[]
}

export interface SeriesRef {
  tmdb_id: number
  name: string
  start_year: number | null
  role: 'ACTED_IN' | 'CREATED' | 'DIRECTED'
}

export interface PersonDetail {
  person_id: number
  name: string
  series: SeriesRef[]
}

export type NodeLabel = 'Series' | 'Person' | 'Genre' | 'Keyword' | 'Network' | 'Country' | 'Language'

export interface GraphNode {
  id: string                        // globally unique: "<label>:<key>" (see lib/nodeId.ts)
  key: number | string              // native key: tmdb_id / person_id / … / ISO code
  label: NodeLabel
  name: string                      // for Country / Language this is the ISO code
  properties: Record<string, unknown>
}

export interface GraphEdge {
  source: string                    // node id
  target: string                    // node id
  type: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export type SearchMode = 'semantic' | 'structural' | 'hybrid'

export interface PersonSearchResult {
  person_id: number
  name: string
  score: number
  series_count: number
}

export interface PersonSearchResponse {
  query: string
  results: PersonSearchResult[]
  total: number
}
