// lib/constants.ts — single source of truth for all design and configuration constants.
// Change a value here; every file that imports it picks up the change automatically.

// ── Node colors ───────────────────────────────────────────────────────────────

export const NODE_COLORS: Record<string, string> = {
  Series:   '#7c3aed',
  Person:   '#e2e8f0',
  Genre:    '#f59e0b',
  Keyword:  '#ec4899',
  Network:  '#3b82f6',
  Country:  '#10b981',
  Language: '#06b6d4',
}

export const NODE_COLOR_FALLBACK = '#475569'

// ── Edge/link colors ──────────────────────────────────────────────────────────

export const LINK_COLORS: Record<string, string> = {
  ACTED_IN:          '#334155',
  CREATED:           '#4c1d95',
  DIRECTED:          '#1e3a5f',
  HAS_GENRE:         '#78350f',
  HAS_KEYWORD:       '#831843',
  AIRED_ON:          '#1e3a8a',
  PRODUCED_IN:       '#064e3b',
  HAS_LANGUAGE:      '#164e63',
}

export const LINK_COLOR_FALLBACK = '#334155'

// ── Node type sets ────────────────────────────────────────────────────────────

/** All node labels that can be expanded via the backend to load more connections. */
export const EXPANDABLE_LABELS = new Set(['Series', 'Person', 'Genre', 'Keyword', 'Network', 'Country', 'Language'])

/** L1 hierarchy grouping labels (top level in Graph Node Navigator). */
export const L1_LABELS = ['Genre', 'Keyword', 'Network', 'Country', 'Language']

/** Maps node labels to their API path segment used for generic node graph requests. */
export const NODE_TYPE_MAP: Record<string, string> = {
  Genre:    'genre',
  Keyword:  'keyword',
  Network:  'network',
  Country:  'country',
  Language: 'language',
}

// ── Cytoscape node sizes (px) ─────────────────────────────────────────────────

export const CY_NODE_SIZE = {
  default:  12,
  series:   18,
  person:   10,
  genre:    10,
  keyword:  10,
  network:  10,
  country:  10,
  language: 10,
} as const

// ── Cytoscape color tokens ────────────────────────────────────────────────────

export const CY_COLORS = {
  nodeLabel:           '#94a3b8',
  edgeLine:            '#1e293b',
  expandableBorder:    '#fbbf24',
  expandableUnderlay:  '#fbbf24',
  selectedBorder:      '#a78bfa',
  hoveredBorder:       '#e2e8f0',
  hoveredUnderlay:     '#e2e8f0',
} as const

// ── Cytoscape font ────────────────────────────────────────────────────────────

export const CY_FONT = {
  size:     7,
  family:   'monospace',
  maxWidth: 60,
} as const

// ── Cytoscape edge style ──────────────────────────────────────────────────────

export const CY_EDGE = {
  width:          1,
  opacity:        0.6,
  arrowScale:     0.4,
  highlightWidth: 2,
  dimmedOpacity:  0.06,
} as const

// ── Cytoscape expandable node style ──────────────────────────────────────────

export const CY_EXPANDABLE = {
  borderWidth:     2,
  borderOpacity:   0.95,
  underlayOpacity: 0.22,
  underlayPadding: 6,
} as const

// ── Cytoscape selected node style ─────────────────────────────────────────────

export const CY_SELECTED = {
  borderWidth:  3,
  borderOpacity: 1,
} as const

// ── Cytoscape hovered node style ──────────────────────────────────────────────

export const CY_HOVERED = {
  borderWidth:     2,
  borderOpacity:   1,
  underlayOpacity: 0.25,
  underlayPadding: 5,
} as const

// ── Force Graph 2D — physics simulation ───────────────────────────────────────

export const FG2D_PHYSICS = {
  chargeStrength: -300,
  linkDistance:   90,
  linkStrength:   0.4,
  cooldownTicks:  200,
  alphaDecay:     0.015,
  velocityDecay:  0.25,
} as const

// ── Force Graph 2D — node rendering ──────────────────────────────────────────

export const FG2D_NODE = {
  radiusMult:        3,      // actual_r = sqrt(val) * radiusMult
  centerVal:         6,      // fixed val for the root/center node
  minVal:            0.5,
  maxVal:            3,
  valPerDegree:      0.5,
  glowRadius:        3,      // extra px beyond r for the glow arc
  hoverOutlineExtra: 1.5,    // extra px beyond r for hover ring
  hoverStrokeWidth:  0.8,
  labelFontCenter:   5,      // px, larger font for center node
  labelFontDefault:  3.5,    // px, font for all other visible nodes
  labelMaxChars:     22,     // truncate names longer than this
  dimmedAlpha:       0.15,
} as const

// ── Force Graph 2D — link rendering ──────────────────────────────────────────

export const FG2D_LINK = {
  connectedAlpha: 1,
  dimmedAlpha:    0.08,
  hoverWidth:     1.5,
  normalWidth:    0.8,
} as const

// ── Force Graph 2D — colors ───────────────────────────────────────────────────

export const FG2D_COLORS = {
  centerGlow:   'rgba(124,58,237,0.25)',
  hoverGlow:    'rgba(226,232,240,0.2)',
  hoverStroke:  '#a78bfa',
  labelBg:      'rgba(2,6,23,0.85)',
  labelCenter:  '#a78bfa',
  labelHovered: '#ffffff',
  labelDefault: '#e2e8f0',
} as const

// ── Cytoscape layout options ──────────────────────────────────────────────────

export const FORCE_LAYOUT_OPTS: Record<string, any> = {
  name:                 'cola',
  animate:              true,
  infinite:             false,
  fit:                  false,
  randomize:            false,
  handleDisconnected:   true,
  avoidOverlap:         true,
  nodeSpacing:          10,
  edgeLength:           90,
  maxSimulationTime:    1400,
  convergenceThreshold: 0.01,
}

export const FORCE_SETTLE_OPTS: Record<string, any> = {
  ...FORCE_LAYOUT_OPTS,
  maxSimulationTime: 400,
}

export const DAGRE_LAYOUT_OPTS: Record<string, any> = {
  name:              'dagre',
  animate:           true,
  animationDuration: 500,
  rankDir:           'TB',
  nodeSep:           60,
  rankSep:           80,
}

export const CIRCLE_LAYOUT_OPTS: Record<string, any> = {
  name:              'circle',
  animate:           true,
  animationDuration: 400,
  avoidOverlap:      true,
}

export const CONCENTRIC_LAYOUT_OPTS: Record<string, any> = {
  name:              'concentric',
  animate:           true,
  animationDuration: 400,
  concentric:        (n: any) => n.degree(),
  levelWidth:        () => 2,
  minNodeSpacing:    40,
}

// ── Zoom limits ───────────────────────────────────────────────────────────────

export const ZOOM_MIN = 0.05
export const ZOOM_MAX = 6

// ── Zoom fit / pan ────────────────────────────────────────────────────────────

export const ZOOM_FIT_PADDING         = 20   // padding (px) for zoomFit()
export const ZOOM_FIT_INITIAL_PADDING = 50   // padding for the very first auto-fit after graph loads
export const ZOOM_FIT_DELAY_MS        = 800  // delay before the first auto-fit fires

export const PAN_ANIMATION_MS = 300  // duration of smooth pan-to-node animation

// ── API query limits ──────────────────────────────────────────────────────────

export const API_SEARCH_LIMIT         = 20
export const API_SEARCH_PERSONS_LIMIT = 10
export const API_SIMILAR_LIMIT        = 20
export const API_NODE_GRAPH_LIMIT     = 50
export const EXPLORE_SEARCH_LIMIT     = 8   // results shown in the explore sidebar dropdown

// ── TMDB ──────────────────────────────────────────────────────────────────────

export const TMDB_IMAGE_BASE  = 'https://image.tmdb.org/t/p'   // + /w185|w342|w500|original + poster_path
export const TMDB_TV_URL      = 'https://www.themoviedb.org/tv' // + /{tmdb_id}
export const TMDB_URL         = 'https://www.themoviedb.org'
// Required attribution text on public surfaces (together with the TMDB logo).
export const TMDB_ATTRIBUTION =
  'This site uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.'

// ── Timing ────────────────────────────────────────────────────────────────────

export const SEARCH_DEBOUNCE_MS    = 250  // delay before firing a search API call
export const DROPDOWN_CLOSE_DELAY_MS = 150 // blur-to-close delay so mousedown can fire first
export const TOAST_DURATION_MS     = 1800

// ── localStorage keys ─────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  // Explore store — v2: ids are "label:key" node ids since the TMDB migration
  exploreList:  'tvkg-explore-list-v2',
  exploreGraph: 'tvkg-explore-graph-v2',
  // Panel widths — prefix only; ResizablePanel appends persistKey
  panelPrefix:  'tvkg-panel-',
  // Top bar collapsed state — prefix only; CollapsibleTopBar appends persistKey
  topBarPrefix: 'tvkg-topbar-',
  // Explore page UI settings
  layout:       'explore-layout',
  filters:      'explore-filters',
  is3d:         'explore-is3d',
  nodesView:    'explore-nodes-view',
  sortName:     'explore-sort-name',
  sortDegree:   'explore-sort-degree',
  navOpen:      'explore-nav-open',
} as const

/** Pre-TMDB keys (Wikidata Q-ids inside) — purged on load, see lib/exploreStore.ts. */
export const LEGACY_STORAGE_KEYS = ['tvkg-explore-list', 'tvkg-explore-graph'] as const

// ── ResizablePanel size configs ───────────────────────────────────────────────

export const PANEL_SIZES = {
  exploreLeft:    { defaultWidth: 260, minWidth: 200, maxWidth: 420 },
  exploreRight:   { defaultWidth: 272, minWidth: 220, maxWidth: 440 },
  searchResults:  { defaultWidth: 420, minWidth: 260, maxWidth: 620 },
  seriesInfo:     { defaultWidth: 420, minWidth: 300, maxWidth: 620 },
  personInfo:     { defaultWidth: 420, minWidth: 300, maxWidth: 620 },
  similarResults: { defaultWidth: 420, minWidth: 280, maxWidth: 620 },
} as const
