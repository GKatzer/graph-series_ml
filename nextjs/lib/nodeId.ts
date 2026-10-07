// lib/nodeId.ts — graph node ids and display names for the TMDB schema.
//
// Native keys of different labels overlap (Series 1399 and Person 1399 are different
// nodes), so the backend gives every graph node a globally unique id "<label>:<key>"
// ("series:1399", "person:1399", "country:US") plus the native `key`. Everything that
// needs identity across labels (Cytoscape/force-graph ids, the explore list) uses the
// prefixed id; API calls and page routes use the native key.

export function nodeId(label: string, key: number | string): string {
  return `${label.toLowerCase()}:${key}`
}

/** Native key of a prefixed node id: "series:1399" → "1399", "country:US" → "US". */
export function keyOfNodeId(id: string): string {
  const i = id.indexOf(':')
  return i < 0 ? id : id.slice(i + 1)
}

// Country / Language nodes carry only the ISO code (no name) — map to a display name here.
const displayNamesCache: Partial<Record<'region' | 'language', Intl.DisplayNames | null>> = {}

function displayNames(type: 'region' | 'language'): Intl.DisplayNames | null {
  if (!(type in displayNamesCache)) {
    try {
      displayNamesCache[type] = new Intl.DisplayNames(['en'], { type })
    } catch {
      displayNamesCache[type] = null
    }
  }
  return displayNamesCache[type] ?? null
}

function isoName(type: 'region' | 'language', code: string): string {
  try {
    return displayNames(type)?.of(code) ?? code
  } catch {
    return code
  }
}

/** Human-readable name for a graph node; falls back to the backend-provided name. */
export function nodeDisplayName(label: string, key: number | string, name: string): string {
  if (label === 'Country') return isoName('region', String(key))
  if (label === 'Language') return isoName('language', String(key))
  return name
}
