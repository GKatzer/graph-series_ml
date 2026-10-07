'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api, failureMessage } from '@/lib/api'
import type { GraphData, SeriesResult, PersonSearchResult } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  NODE_COLORS,
  LINK_COLORS,
  NODE_COLOR_FALLBACK,
  LINK_COLOR_FALLBACK,
  EXPANDABLE_LABELS,
  L1_LABELS,
  NODE_TYPE_MAP,
  CY_NODE_SIZE,
  CY_COLORS,
  CY_FONT,
  CY_EDGE,
  CY_EXPANDABLE,
  CY_SELECTED,
  CY_HOVERED,
  FORCE_LAYOUT_OPTS,
  FORCE_SETTLE_OPTS,
  DAGRE_LAYOUT_OPTS,
  CIRCLE_LAYOUT_OPTS,
  CONCENTRIC_LAYOUT_OPTS,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_FIT_PADDING,
  ZOOM_FIT_INITIAL_PADDING,
  ZOOM_FIT_DELAY_MS,
  PAN_ANIMATION_MS,
  EXPLORE_SEARCH_LIMIT,
  SEARCH_DEBOUNCE_MS,
  DROPDOWN_CLOSE_DELAY_MS,
  TOAST_DURATION_MS,
  STORAGE_KEYS,
  PANEL_SIZES,
} from '@/lib/constants'
import { ResizablePanel } from '@/components/ResizablePanel'
import {
  type ExploreItem,
  getExploreList,
  onExploreListChange,
  loadExploreGraph,
  saveExploreGraph,
  clearExploreGraph,
  toggleExploreList,
} from '@/lib/exploreStore'
import { nodeId as makeNodeId, keyOfNodeId, nodeDisplayName } from '@/lib/nodeId'

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────

type LayoutName = 'force' | 'dagre' | 'circle' | 'concentric'

interface NodeTypeFilter {
  Series: boolean
  Person: boolean
  Genre: boolean
  Keyword: boolean
  Network: boolean
  Country: boolean
  Language: boolean
}

interface FgNode { id: string; name: string; label: string; color: string; val: number }
interface FgLink { source: string; target: string; type: string; color: string }

interface SelectedInfo {
  id: string
  name: string
  label: string
  neighbors: Array<{ id: string; name: string; label: string; edgeType: string }>
}

interface GraphNodeInfo {
  id: string
  name: string
  label: string
  color: string
  degree: number
  expandable: boolean
}

type SortDir = 'asc' | 'desc' | null
type NodesViewMode = 'list' | 'hierarchy'

// ── Layout options ────────────────────────────────────────────────────────────

const LAYOUT_LABELS: Record<LayoutName, string> = {
  force: 'force',
  dagre: 'hierarchy',
  circle: 'circle',
  concentric: 'concentric',
}

const LAYOUT_OPTIONS: Record<LayoutName, Record<string, any>> = {
  force:     FORCE_LAYOUT_OPTS,
  dagre:     DAGRE_LAYOUT_OPTS,
  circle:    CIRCLE_LAYOUT_OPTS,
  concentric: CONCENTRIC_LAYOUT_OPTS,
}

// ── Cytoscape stylesheet ───────────────────────────────────────────────────────

const CY_STYLE: any[] = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      label: 'data(name)',
      color: CY_COLORS.nodeLabel,
      'font-size': CY_FONT.size,
      'font-family': CY_FONT.family,
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 3,
      'text-wrap': 'ellipsis',
      'text-max-width': CY_FONT.maxWidth,
      width: CY_NODE_SIZE.default,
      height: CY_NODE_SIZE.default,
    },
  },
  { selector: 'node[label="Series"]',   style: { width: CY_NODE_SIZE.series,   height: CY_NODE_SIZE.series } },
  { selector: 'node[label="Person"]',   style: { width: CY_NODE_SIZE.person,   height: CY_NODE_SIZE.person } },
  { selector: 'node[label="Genre"]',    style: { width: CY_NODE_SIZE.genre,    height: CY_NODE_SIZE.genre } },
  { selector: 'node[label="Keyword"]',  style: { width: CY_NODE_SIZE.keyword,  height: CY_NODE_SIZE.keyword } },
  { selector: 'node[label="Network"]',  style: { width: CY_NODE_SIZE.network,  height: CY_NODE_SIZE.network } },
  { selector: 'node[label="Country"]',  style: { width: CY_NODE_SIZE.country,  height: CY_NODE_SIZE.country } },
  { selector: 'node[label="Language"]', style: { width: CY_NODE_SIZE.language, height: CY_NODE_SIZE.language } },
  {
    selector: 'node.expandable',
    style: {
      'border-width':     CY_EXPANDABLE.borderWidth,
      'border-color':     CY_COLORS.expandableBorder,
      'border-opacity':   CY_EXPANDABLE.borderOpacity,
      'underlay-color':   CY_COLORS.expandableUnderlay,
      'underlay-opacity': CY_EXPANDABLE.underlayOpacity,
      'underlay-padding': CY_EXPANDABLE.underlayPadding,
      'underlay-shape':   'ellipse',
    },
  },
  {
    selector: 'node:selected',
    style: { 'border-width': CY_SELECTED.borderWidth, 'border-color': CY_COLORS.selectedBorder, 'border-opacity': CY_SELECTED.borderOpacity },
  },
  {
    selector: 'edge',
    style: {
      'line-color':          CY_COLORS.edgeLine,
      width:                 CY_EDGE.width,
      'curve-style':         'bezier',
      'target-arrow-shape':  'triangle',
      'target-arrow-color':  CY_COLORS.edgeLine,
      'arrow-scale':         CY_EDGE.arrowScale,
      opacity:               CY_EDGE.opacity,
    },
  },
  ...Object.entries(LINK_COLORS).map(([type, color]) => ({
    selector: `edge[type="${type}"]`,
    style: { 'line-color': color, 'target-arrow-color': color },
  })),
  { selector: '.dimmed',          style: { opacity: CY_EDGE.dimmedOpacity } },
  { selector: 'edge.highlighted', style: { opacity: 1, width: CY_EDGE.highlightWidth } },
  {
    selector: 'node.hovered',
    style: {
      'border-width':     CY_HOVERED.borderWidth,
      'border-color':     CY_COLORS.hoveredBorder,
      'border-opacity':   CY_HOVERED.borderOpacity,
      'underlay-color':   CY_COLORS.hoveredUnderlay,
      'underlay-opacity': CY_HOVERED.underlayOpacity,
      'underlay-padding': CY_HOVERED.underlayPadding,
    },
  },
]

// ── Plugin registration (once per browser session) ────────────────────────────

let pluginsRegistered = false
async function ensurePlugins() {
  if (pluginsRegistered) return
  const [cy, dagre, cola] = await Promise.all([
    import('cytoscape').then(m => m.default),
    import('cytoscape-dagre').then(m => m.default),
    import('cytoscape-cola').then(m => m.default),
  ])
  cy.use(dagre)
  cy.use(cola)
  pluginsRegistered = true
}

// ── Zoom helpers (logarithmic scale 0.05x – 6x) ──────────────────────────────

const LOG_ZOOM_MIN = Math.log(ZOOM_MIN)
const LOG_ZOOM_MAX = Math.log(ZOOM_MAX)

function zoomToSlider(z: number): number {
  const c = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
  return Math.round((Math.log(c) - LOG_ZOOM_MIN) / (LOG_ZOOM_MAX - LOG_ZOOM_MIN) * 100)
}

function sliderToZoom(s: number): number {
  return Math.exp(LOG_ZOOM_MIN + (s / 100) * (LOG_ZOOM_MAX - LOG_ZOOM_MIN))
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const router = useRouter()

  // Cytoscape
  const cyContainerRef = useRef<HTMLDivElement>(null)
  const cyRef          = useRef<any>(null)
  const expandedRef    = useRef(new Set<string>())
  const runningLayoutRef = useRef<any>(null)
  const didFitRef      = useRef(false)
  const lastTapRef     = useRef<{ id: string; time: number } | null>(null)

  // Selection history (for prev/next navigation)
  const selHistoryRef = useRef<SelectedInfo[]>([])
  const histIdxRef    = useRef(-1)

  // 3D mode
  const [is3D, setIs3D]       = useState(false)
  const graph3DRef = useRef<HTMLDivElement>(null)
  const [dims3D, setDims3D] = useState({ width: 800, height: 600 })
  const [fgNodes, setFgNodes] = useState<FgNode[]>([])
  const [fgLinks, setFgLinks] = useState<FgLink[]>([])

  // UI
  const [layout, setLayout]   = useState<LayoutName>('force')
  const layoutRef = useRef<LayoutName>('force')
  const [filters, setFilters] = useState<NodeTypeFilter>({
    Series: true, Person: true, Genre: true, Keyword: true, Network: true, Country: true, Language: true,
  })
  const [selected, setSelected]   = useState<SelectedInfo | null>(null)
  const [expanding, setExpanding] = useState<string | null>(null)
  const [stats, setStats]         = useState({ nodes: 0, edges: 0 })

  // Left panel search
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState<SeriesResult[]>([])
  const [showDropdown, setShowDropdown]   = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError]   = useState<string | null>(null)
  const [exploreSearchType, setExploreSearchType] = useState<'series' | 'person'>('series')
  const [exploreSearchMode, setExploreSearchMode] = useState<'structural' | 'semantic'>('structural')
  const [personSearchResults, setPersonSearchResults] = useState<PersonSearchResult[]>([])
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Explore list (bookmarks)
  const [exploreList, setExploreList] = useState<ExploreItem[]>([])

  // Graph node navigator
  const [graphNodeList, setGraphNodeList] = useState<GraphNodeInfo[]>([])
  const [navOpen, setNavOpen]           = useState(false)
  const [nodeFilter, setNodeFilter]     = useState('')
  const [nodesViewMode, setNodesViewMode]     = useState<NodesViewMode>('list')
  const [nodesSortName, setNodesSortName]     = useState<SortDir>(null)
  const [nodesSortDegree, setNodesSortDegree] = useState<SortDir>(null)
  const [expandedHierarchy, setExpandedHierarchy] = useState<Set<string>>(new Set())
  const [gnSelectedId, setGnSelectedId] = useState<string | null>(null)
  const [gnTreeMode, setGnTreeMode] = useState(false)

  // Stable ref for GN navigation callbacks (avoids stale closures in keyboard handler)
  const gnNavRef = useRef({ up: () => {}, down: () => {}, scrollPrev: () => {}, scrollNext: () => {}, home: () => {}, tree: () => {} })
  // Saves view state before "Up" navigation so "Back" can restore it
  const preUpStateRef = useRef<{ viewMode: NodesViewMode; filter: string } | null>(null)
  // Current position in the flat linearised hierarchy (for duplicate-safe Down navigation)
  const gnHierarchyIdxRef = useRef(-1)
  // Scroll container ref for auto-scroll-to-selected
  const nodeListRef = useRef<HTMLDivElement>(null)
  // Target node of the currently running pan animation (for snap-on-interrupt)
  const panTargetRef = useRef<string | null>(null)

  // Zoom level display
  const [zoomLevel, setZoomLevel] = useState(1)

  // History nav display state (mirrors refs for rendering)
  const [histIdx, setHistIdx] = useState(-1)
  const [histLen, setHistLen] = useState(0)

  useEffect(() => { document.title = 'Explore Graph Page' }, [])

  // ── Cytoscape init ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cy: any = null

    const init = async () => {
      if (!cyContainerRef.current) return
      await ensurePlugins()
      const cytoscape = (await import('cytoscape')).default

      cy = cytoscape({
        container: cyContainerRef.current,
        elements: [],
        style: CY_STYLE,
        layout: { name: 'preset' },
        minZoom: ZOOM_MIN,
        maxZoom: ZOOM_MAX,
      })
      cyRef.current = cy

      cy.on('tap', 'node', (evt: any) => {
        const node = evt.target
        const nodeId = node.id()
        setGnSelectedId(nodeId)
        const neighbors: SelectedInfo['neighbors'] = []
        cy.edges().forEach((e: any) => {
          if (e.source().id() === nodeId || e.target().id() === nodeId) {
            const other = e.source().id() === nodeId ? e.target() : e.source()
            neighbors.push({ id: other.id(), name: other.data('name'), label: other.data('label'), edgeType: e.data('type') })
          }
        })
        selectNodeInfo({ id: nodeId, name: node.data('name'), label: node.data('label'), neighbors })

        // Manual double-tap detection — cytoscape's own dblclick/dbltap is unreliable
        // (especially on touch), so we detect two taps on the same node ourselves.
        const now = Date.now()
        const last = lastTapRef.current
        if (last && last.id === nodeId && now - last.time < 350) {
          lastTapRef.current = null
          const label = node.data('label')
          const canExpand = EXPANDABLE_LABELS.has(label) && !expandedRef.current.has(nodeId)
          if (canExpand) {
            expandNode(nodeId, label)
          } else {
            // Already-expanded / non-expandable node: open its page if it has one.
            if (label === 'Series') router.push(`/series/${keyOfNodeId(nodeId)}`)
            else if (label === 'Person') router.push(`/person/${keyOfNodeId(nodeId)}`)
          }
        } else {
          lastTapRef.current = { id: nodeId, time: now }
        }
      })

      cy.on('dragfree', 'node', () => {
        persistGraph(cy)
        runLayout(cy, layoutRef.current, true)
      })

      cy.on('mouseover', 'node', (evt: any) => {
        const hovered = evt.target
        const neighborhood = hovered.closedNeighborhood()
        cy.elements().not(neighborhood).addClass('dimmed')
        neighborhood.edges().addClass('highlighted')
        hovered.addClass('hovered')
      })

      cy.on('mouseout', 'node', () => {
        cy.elements().removeClass('dimmed hovered highlighted')
      })

      cy.on('zoom', () => {
        setZoomLevel(Math.round(cy.zoom() * 100) / 100)
      })

      // Restore persisted graph (survives reloads; only clearGraph() wipes it)
      const saved = loadExploreGraph()
      if (saved && saved.elements.length) {
        cy.add(saved.elements)
        expandedRef.current = new Set(saved.expanded ?? [])
        applyExpandable(cy)
        syncFromCy(cy)
        runLayout(cy, layoutRef.current)
      }
    }

    init()
    return () => { cy?.destroy(); cyRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Restore persisted UI settings ──────────────────────────────────────────

  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem(STORAGE_KEYS.layout) as LayoutName | null
      if (savedLayout && LAYOUT_OPTIONS[savedLayout]) {
        setLayout(savedLayout)
        layoutRef.current = savedLayout
      }
      const savedFilters = JSON.parse(localStorage.getItem(STORAGE_KEYS.filters) ?? 'null')
      if (savedFilters && typeof savedFilters === 'object') {
        // Only known labels — older versions persisted a "Work" toggle that no longer exists.
        setFilters(f => {
          const next = { ...f }
          ;(Object.keys(f) as Array<keyof NodeTypeFilter>).forEach(k => {
            if (typeof savedFilters[k] === 'boolean') next[k] = savedFilters[k]
          })
          return next
        })
      }
      if (localStorage.getItem(STORAGE_KEYS.is3d) === 'true') setIs3D(true)
      const savedNodesView = localStorage.getItem(STORAGE_KEYS.nodesView) as NodesViewMode | null
      if (savedNodesView === 'list' || savedNodesView === 'hierarchy') setNodesViewMode(savedNodesView)
      const savedSortName = localStorage.getItem(STORAGE_KEYS.sortName)
      if (savedSortName === 'asc' || savedSortName === 'desc') setNodesSortName(savedSortName)
      const savedSortDegree = localStorage.getItem(STORAGE_KEYS.sortDegree)
      if (savedSortDegree === 'asc' || savedSortDegree === 'desc') setNodesSortDegree(savedSortDegree)
      if (localStorage.getItem(STORAGE_KEYS.navOpen) === 'true') setNavOpen(true)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.filters, JSON.stringify(filters)) } catch {}
  }, [filters])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.is3d, String(is3D)) } catch {}
  }, [is3D])

  // ── Keep explore list display in sync ───────────────────────────────────────

  useEffect(() => {
    setExploreList(getExploreList())
    return onExploreListChange(() => setExploreList(getExploreList()))
  }, [])

  // ── Dropdown close (click outside + ESC) ───────────────────────────────────

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!searchContainerRef.current?.contains(e.target as Node)) setShowDropdown(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDropdown(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // ── Filters sync ───────────────────────────────────────────────────────────

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    Object.entries(filters).forEach(([label, visible]) => {
      visible ? cy.$(`node[label="${label}"]`).show() : cy.$(`node[label="${label}"]`).hide()
    })
  }, [filters])

  // ForceGraph3D sizes itself to the window by default; feed it the panel size instead.
  useEffect(() => {
    const el = graph3DRef.current
    if (!is3D || !el) return
    const ro = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect
      if (w > 0 && h > 0) setDims3D({ width: Math.floor(w), height: Math.floor(h) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [is3D])

  // ── Search effect ──────────────────────────────────────────────────────────

  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchResults([]); setPersonSearchResults([]); setSearchError(null); setShowDropdown(false); return
    }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      setSearchError(null)
      try {
        if (exploreSearchType === 'person') {
          const res = await api.searchPersons(q, EXPLORE_SEARCH_LIMIT)
          setPersonSearchResults(res.results)
          setSearchResults([])
          setShowDropdown(res.results.length > 0)
        } else {
          const res = await api.search(q, EXPLORE_SEARCH_LIMIT, exploreSearchMode)
          setSearchResults(res.results)
          setPersonSearchResults([])
          setShowDropdown(res.results.length > 0)
        }
      } catch (e) {
        setSearchResults([]); setPersonSearchResults([])
        setSearchError(failureMessage('Search', e))
        setShowDropdown(true)
      } finally {
        setSearchLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery, exploreSearchType, exploreSearchMode])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const TRANSIENT = new Set(['dimmed', 'hovered', 'highlighted'])

  function applyExpandable(cy: any) {
    cy.nodes().removeClass('expandable')
    cy.nodes().forEach((n: any) => {
      if (EXPANDABLE_LABELS.has(n.data('label')) && !expandedRef.current.has(n.id())) {
        n.addClass('expandable')
      }
    })
  }

  function syncFromCy(cy: any) {
    const nodes: FgNode[] = []
    const graphNodes: GraphNodeInfo[] = []

    cy.nodes().forEach((n: any) => {
      nodes.push({
        id: n.id(), name: n.data('name'), label: n.data('label'),
        color: n.data('color'), val: n.data('label') === 'Series' ? 4 : 1,
      })
      graphNodes.push({
        id: n.id(), name: n.data('name'), label: n.data('label'),
        color: n.data('color'), degree: n.degree(),
        expandable: n.hasClass('expandable'),
      })
    })

    const links: FgLink[] = cy.edges().map((e: any) => ({
      source: e.source().id(), target: e.target().id(),
      type: e.data('type'), color: LINK_COLORS[e.data('type')] ?? LINK_COLOR_FALLBACK,
    }))

    setFgNodes(nodes)
    setFgLinks(links)
    setGraphNodeList(graphNodes)
    setStats({ nodes: cy.nodes().length, edges: cy.edges().length })
  }

  function persistGraph(cy: any) {
    const elements = cy.elements().jsons().map((el: any) => {
      if (typeof el.classes === 'string' && el.classes) {
        el.classes = el.classes.split(/\s+/).filter((c: string) => !TRANSIENT.has(c)).join(' ')
      }
      return el
    })
    saveExploreGraph({ elements, expanded: [...expandedRef.current] })
  }

  function runLayout(cy: any, layoutName: LayoutName, settle = false) {
    if (runningLayoutRef.current) {
      try { runningLayoutRef.current.stop() } catch { /* ignore */ }
      runningLayoutRef.current = null
    }
    if (cy.nodes().empty()) return
    const opts = layoutName === 'force' && settle
      ? FORCE_SETTLE_OPTS
      : (LAYOUT_OPTIONS[layoutName] ?? LAYOUT_OPTIONS.force)
    const l = cy.layout(opts)
    l.run()
    runningLayoutRef.current = l
  }

  function mergeToCy(cy: any, data: GraphData) {
    const wasEmpty = cy.nodes().empty()
    const existingNodes = new Set(cy.nodes().map((n: any) => n.id()))
    const existingEdges = new Set(cy.edges().map((e: any) => e.id()))
    const elements: any[] = []

    const ext = cy.nodes().nonempty() ? cy.extent() : null
    const cx = ext ? (ext.x1 + ext.x2) / 2 : 0
    const cyy = ext ? (ext.y1 + ext.y2) / 2 : 0

    data.nodes.forEach(n => {
      if (!existingNodes.has(n.id)) {
        elements.push({
          group: 'nodes',
          data: { id: n.id, name: nodeDisplayName(n.label, n.key, n.name), label: n.label, color: NODE_COLORS[n.label] ?? NODE_COLOR_FALLBACK },
          position: { x: cx + (Math.random() - 0.5) * 240, y: cyy + (Math.random() - 0.5) * 240 },
        })
      }
    })
    data.edges.forEach(e => {
      const eid = `${e.source}__${e.type}__${e.target}`
      if (!existingEdges.has(eid)) {
        elements.push({ group: 'edges', data: { id: eid, source: e.source, target: e.target, type: e.type } })
      }
    })

    if (elements.length) cy.add(elements)

    applyExpandable(cy)
    syncFromCy(cy)
    persistGraph(cy)

    if (wasEmpty && cy.nodes().nonempty() && !didFitRef.current) {
      didFitRef.current = true
      setTimeout(() => { try { cy.fit(undefined, ZOOM_FIT_INITIAL_PADDING) } catch { /* ignore */ } }, ZOOM_FIT_DELAY_MS)
    }
  }

  async function expandNode(nodeId: string, nodeLabel: string) {
    if (expandedRef.current.has(nodeId)) return
    if (!EXPANDABLE_LABELS.has(nodeLabel)) return
    const cy = cyRef.current
    if (!cy) return
    setExpanding(nodeId)
    try {
      let data: GraphData
      const key = keyOfNodeId(nodeId)
      if (nodeLabel === 'Series') data = await api.seriesGraph(key, 1)
      else if (nodeLabel === 'Person') data = await api.personGraph(key)
      else data = await api.nodeGraph(NODE_TYPE_MAP[nodeLabel] ?? nodeLabel.toLowerCase(), key)
      expandedRef.current.add(nodeId)
      mergeToCy(cy, data)
      cy.getElementById(nodeId).removeClass('expandable')
      persistGraph(cy)
      refreshSelected(cy)
      runLayout(cy, layoutRef.current)
    } catch (e) {
      toast.error(failureMessage('Expanding node', e))
    } finally {
      setExpanding(null)
    }
  }

  // The load*ById helpers take a prefixed graph node id ("person:1399"), not a bare key.
  async function loadPersonById(personId: string) {
    const cy = cyRef.current
    if (!cy) return
    if (expandedRef.current.has(personId)) return
    setExpanding(personId)
    try {
      const data = await api.personGraph(keyOfNodeId(personId))
      expandedRef.current.add(personId)
      mergeToCy(cy, data)
      cy.getElementById(personId).removeClass('expandable')
      persistGraph(cy)
      runLayout(cy, layoutRef.current)
    } catch (e) {
      toast.error(failureMessage('Expanding node', e))
    } finally {
      setExpanding(null)
    }
  }

  async function loadSeriesById(seriesId: string) {
    const cy = cyRef.current
    if (!cy) return
    if (expandedRef.current.has(seriesId)) return
    setExpanding(seriesId)
    try {
      const data = await api.seriesGraph(keyOfNodeId(seriesId), 1)
      expandedRef.current.add(seriesId)
      mergeToCy(cy, data)
      cy.getElementById(seriesId).removeClass('expandable')
      persistGraph(cy)
      runLayout(cy, layoutRef.current)
    } catch (e) {
      toast.error(failureMessage('Expanding node', e))
    } finally {
      setExpanding(null)
    }
  }

  async function loadNodeById(nodeId: string, nodeLabel: string) {
    const cy = cyRef.current
    if (!cy) return
    if (expandedRef.current.has(nodeId)) return
    setExpanding(nodeId)
    try {
      const data = await api.nodeGraph(NODE_TYPE_MAP[nodeLabel] ?? nodeLabel.toLowerCase(), keyOfNodeId(nodeId))
      expandedRef.current.add(nodeId)
      mergeToCy(cy, data)
      cy.getElementById(nodeId).removeClass('expandable')
      persistGraph(cy)
      runLayout(cy, layoutRef.current)
    } catch (e) {
      toast.error(failureMessage('Expanding node', e))
    } finally {
      setExpanding(null)
    }
  }

  function removeNode(nodeId: string) {
    const cy = cyRef.current
    if (!cy) return
    const target = cy.getElementById(nodeId)
    if (target.empty()) return

    const neighborsBefore = target.neighborhood('node')
    target.connectedEdges().remove()
    target.remove()

    neighborsBefore.forEach((n: any) => {
      if (cy.getElementById(n.id()).nonempty() && n.degree() === 0) n.remove()
    })

    expandedRef.current.delete(nodeId)

    setSelected(prev => {
      if (!prev) return null
      if (prev.id === nodeId) return null
      const el = cy.getElementById(prev.id)
      if (el.empty()) return null
      const neighbors: SelectedInfo['neighbors'] = []
      cy.edges().forEach((e: any) => {
        if (e.source().id() === prev.id || e.target().id() === prev.id) {
          const other = e.source().id() === prev.id ? e.target() : e.source()
          neighbors.push({ id: other.id(), name: other.data('name'), label: other.data('label'), edgeType: e.data('type') })
        }
      })
      return { ...prev, neighbors }
    })

    applyExpandable(cy)
    syncFromCy(cy)
    persistGraph(cy)
  }

  function refreshSelected(cy: any) {
    setSelected(prev => {
      if (!prev) return null
      const el = cy.getElementById(prev.id)
      if (el.empty()) return null
      const neighbors: SelectedInfo['neighbors'] = []
      cy.edges().forEach((e: any) => {
        if (e.source().id() === prev.id || e.target().id() === prev.id) {
          const other = e.source().id() === prev.id ? e.target() : e.source()
          neighbors.push({ id: other.id(), name: other.data('name'), label: other.data('label'), edgeType: e.data('type') })
        }
      })
      return { ...prev, neighbors }
    })
  }

  function panToNode(nodeId: string, durationMs: number = PAN_ANIMATION_MS) {
    const cy = cyRef.current
    if (!cy) return
    const el = cy.getElementById(nodeId)
    if (el.empty()) return
    const container = cy.container()
    if (!container) return
    if (cy.animated() && panTargetRef.current) {
      cy.stop()
      const prevEl = cy.getElementById(panTargetRef.current)
      if (!prevEl.empty()) {
        const z = cy.zoom()
        const p = prevEl.position()
        cy.pan({ x: container.clientWidth / 2 - p.x * z, y: container.clientHeight / 2 - p.y * z })
      }
    }
    const nodePos = el.position()
    const z = cy.zoom()
    cy.animate({
      pan: { x: container.clientWidth / 2 - nodePos.x * z, y: container.clientHeight / 2 - nodePos.y * z },
      duration: durationMs,
    })
    panTargetRef.current = nodeId
  }

  function centerNode(nodeId: string) {
    const cy = cyRef.current
    if (!cy) return
    const el = cy.getElementById(nodeId)
    if (el.empty()) return
    gnHierarchyIdxRef.current = flatHierarchy.findIndex(n => n.id === nodeId)
    panToNode(nodeId)
    setGnSelectedId(nodeId)
    const neighbors: SelectedInfo['neighbors'] = []
    cy.edges().forEach((e: any) => {
      if (e.source().id() === nodeId || e.target().id() === nodeId) {
        const other = e.source().id() === nodeId ? e.target() : e.source()
        neighbors.push({ id: other.id(), name: other.data('name'), label: other.data('label'), edgeType: e.data('type') })
      }
    })
    selectNodeInfo({ id: nodeId, name: el.data('name'), label: el.data('label'), neighbors })
  }

  function selectNodeInfo(info: SelectedInfo) {
    const history = selHistoryRef.current.slice(0, histIdxRef.current + 1)
    // Skip duplicate consecutive entry
    if (history.length > 0 && history[history.length - 1].id === info.id) {
      setSelected(info)
      return
    }
    history.push(info)
    selHistoryRef.current = history
    histIdxRef.current = history.length - 1
    setHistIdx(histIdxRef.current)
    setHistLen(history.length)
    setSelected(info)
  }

  function navigateToHistory(idx: number) {
    const history = selHistoryRef.current
    if (idx < 0 || idx >= history.length) return
    const info = history[idx]
    histIdxRef.current = idx
    setHistIdx(idx)
    setGnSelectedId(info.id)
    const cy = cyRef.current
    if (cy) {
      const el = cy.getElementById(info.id)
      if (!el.empty()) {
        panToNode(info.id, 300)
        const neighbors: SelectedInfo['neighbors'] = []
        cy.edges().forEach((e: any) => {
          if (e.source().id() === info.id || e.target().id() === info.id) {
            const other = e.source().id() === info.id ? e.target() : e.source()
            neighbors.push({ id: other.id(), name: other.data('name'), label: other.data('label'), edgeType: e.data('type') })
          }
        })
        const updated = { ...info, neighbors }
        history[idx] = updated
        setSelected(updated)
        return
      }
    }
    setSelected(info)
  }

  function historyBack() {
    navigateToHistory(histIdxRef.current - 1)
    if (preUpStateRef.current) {
      const pre = preUpStateRef.current
      preUpStateRef.current = null
      setNodesViewModeAndSave(pre.viewMode)
      setNodeFilter(pre.filter)
    }
  }
  function historyForward() { navigateToHistory(histIdxRef.current + 1) }

  // Keyboard shortcuts — gnNavRef keeps callbacks fresh without adding deps to the effect
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.altKey) {
        if (e.key === 'ArrowLeft')  { e.preventDefault(); historyBack() }
        if (e.key === 'ArrowRight') { e.preventDefault(); historyForward() }
        return
      }
      if (e.key === 'ArrowUp')   { e.preventDefault(); gnNavRef.current.scrollPrev() }
      if (e.key === 'ArrowDown') { e.preventDefault(); gnNavRef.current.scrollNext() }
      if (e.key === 'Enter')     { e.preventDefault(); gnNavRef.current.down() }
      if (e.key === 'Escape')    { e.preventDefault(); gnNavRef.current.up() }
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); gnNavRef.current.home() }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); gnNavRef.current.tree() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── GN tree navigation ────────────────────────────────────────────────────

  function findParentInHierarchy(nodeId: string): string | null {
    for (const grp of hierarchyData.groups) {
      if (grp.children.some(sn => sn.id === nodeId)) return grp.id
      for (const sn of grp.children) {
        if (sn.persons.some(p => p.id === nodeId)) return sn.id
      }
    }
    for (const sn of hierarchyData.orphanSeries) {
      if (sn.persons.some(p => p.id === nodeId)) return sn.id
    }
    return null
  }

  function gnNavigateUp() {
    if (!navOpen) toggleNavOpen(true)
    if (!gnSelectedId) {
      const first = filteredNodes[0]
      if (first) { setGnSelectedId(first.id); centerNode(first.id) }
      return
    }
    // Save view state before switching to hierarchy
    if (nodesViewMode !== 'hierarchy') {
      preUpStateRef.current = { viewMode: nodesViewMode, filter: nodeFilter }
      setNodesViewModeAndSave('hierarchy')
    }
    const parentId = findParentInHierarchy(gnSelectedId)
    if (!parentId) return
    // Ensure the parent's ancestry is expanded so it's visible
    const toOpen: string[] = []
    for (const grp of hierarchyData.groups) {
      if (grp.id === parentId) break
      if (grp.children.some(sn => sn.id === parentId)) {
        if (!expandedHierarchy.has(grp.id)) toOpen.push(grp.id)
        break
      }
    }
    if (toOpen.length > 0) {
      setExpandedHierarchy(prev => { const next = new Set(prev); toOpen.forEach(id => next.add(id)); return next })
    }
    // Find the nearest preceding occurrence of the parent in the flat sequence
    let parentFlatIdx = -1
    for (let i = gnHierarchyIdxRef.current - 1; i >= 0; i--) {
      if (flatHierarchy[i]?.id === parentId) { parentFlatIdx = i; break }
    }
    if (parentFlatIdx === -1) parentFlatIdx = flatHierarchy.findIndex(n => n.id === parentId)
    centerNode(parentId)
    if (parentFlatIdx !== -1) gnHierarchyIdxRef.current = parentFlatIdx
  }

  function gnNavigateDown() {
    if (!navOpen) toggleNavOpen(true)

    if (nodesViewMode !== 'hierarchy') {
      // ── List mode ──────────────────────────────────────────────────────────
      if (!gnSelectedId) {
        const first = sortedListNodes[0]
        if (first) centerNode(first.id)
        return
      }
      const node = graphNodeList.find(n => n.id === gnSelectedId)
      if (node?.expandable) { expandNode(gnSelectedId, node.label); return }
      const idx = sortedListNodes.findIndex(n => n.id === gnSelectedId)
      if (idx !== -1 && idx + 1 < sortedListNodes.length) centerNode(sortedListNodes[idx + 1].id)
      return
    }

    // ── Hierarchy mode ────────────────────────────────────────────────────────
    if (!gnSelectedId) {
      const first = flatHierarchy[0]
      if (first) { gnHierarchyIdxRef.current = 0; centerNode(first.id) }
      return
    }

    const node = graphNodeList.find(n => n.id === gnSelectedId)
    if (!node) return

    // Priority 1: expand from backend (node has unexplored connections)
    if (node.expandable) { expandNode(gnSelectedId, node.label); return }

    // Priority 2: navigate into first child (open next level in the tree)
    const asL1 = hierarchyData.groups.find(g => g.id === gnSelectedId)
    if (asL1 && asL1.children.length > 0) {
      if (!expandedHierarchy.has(gnSelectedId)) {
        setExpandedHierarchy(prev => { const next = new Set(prev); next.add(gnSelectedId!); return next })
      }
      setNodesViewModeAndSave('hierarchy')
      const first = asL1.children[0]
      // Find the occurrence of this child that comes AFTER the current L1 position
      const afterIdx = flatHierarchy.findIndex((n, i) => i > gnHierarchyIdxRef.current && n.id === first.id)
      centerNode(first.id)
      if (afterIdx !== -1) gnHierarchyIdxRef.current = afterIdx
      return
    }
    const allSeries = [...hierarchyData.groups.flatMap(g => g.children), ...hierarchyData.orphanSeries]
    const asSeries = allSeries.find(s => s.id === gnSelectedId)
    if (asSeries && asSeries.persons.length > 0) {
      if (!expandedHierarchy.has(gnSelectedId)) {
        setExpandedHierarchy(prev => { const next = new Set(prev); next.add(gnSelectedId!); return next })
      }
      setNodesViewModeAndSave('hierarchy')
      const first = asSeries.persons[0]
      // Find the occurrence of this person that comes AFTER the current Series position
      const afterIdx = flatHierarchy.findIndex((n, i) => i > gnHierarchyIdxRef.current && n.id === first.id)
      centerNode(first.id)
      if (afterIdx !== -1) gnHierarchyIdxRef.current = afterIdx
      return
    }

    // Priority 3: linear navigation — next entry in the flat hierarchy sequence.
    // Using the stored index instead of findIndex(id) avoids jumping to the top
    // duplicate when the same node appears under multiple parent groups.
    const nextIdx = gnHierarchyIdxRef.current + 1
    if (nextIdx < flatHierarchy.length) {
      centerNode(flatHierarchy[nextIdx].id)
      gnHierarchyIdxRef.current = nextIdx   // override the first-occurrence default set by centerNode
    }
  }

  function getVisibleHierarchyNodes(): GraphNodeInfo[] {
    const result: GraphNodeInfo[] = []
    for (const l1n of hierarchyData.groups) {
      result.push(l1n)
      if (expandedHierarchy.has(l1n.id)) {
        for (const sn of l1n.children) {
          result.push(sn)
          if (expandedHierarchy.has(sn.id)) {
            for (const p of sn.persons) result.push(p)
          }
        }
      }
    }
    for (const sn of hierarchyData.orphanSeries) {
      result.push(sn)
      if (expandedHierarchy.has(sn.id)) {
        for (const p of sn.persons) result.push(p)
      }
    }
    for (const p of hierarchyData.orphanPersons) result.push(p)
    return result
  }

  function gnScrollPrev() {
    if (!navOpen) toggleNavOpen(true)
    if (nodesViewMode !== 'hierarchy') {
      if (!gnSelectedId) {
        const last = sortedListNodes[sortedListNodes.length - 1]
        if (last) centerNode(last.id)
        return
      }
      const idx = sortedListNodes.findIndex(n => n.id === gnSelectedId)
      if (idx > 0) centerNode(sortedListNodes[idx - 1].id)
      return
    }
    const visible = getVisibleHierarchyNodes()
    if (!gnSelectedId) {
      const last = visible[visible.length - 1]
      if (last) centerNode(last.id)
      return
    }
    const idx = visible.findIndex(n => n.id === gnSelectedId)
    if (idx > 0) centerNode(visible[idx - 1].id)
  }

  function gnScrollNext() {
    if (!navOpen) toggleNavOpen(true)
    if (nodesViewMode !== 'hierarchy') {
      if (!gnSelectedId) {
        const first = sortedListNodes[0]
        if (first) centerNode(first.id)
        return
      }
      const idx = sortedListNodes.findIndex(n => n.id === gnSelectedId)
      if (idx !== -1 && idx + 1 < sortedListNodes.length) centerNode(sortedListNodes[idx + 1].id)
      return
    }
    const visible = getVisibleHierarchyNodes()
    if (!gnSelectedId) {
      const first = visible[0]
      if (first) centerNode(first.id)
      return
    }
    const idx = visible.findIndex(n => n.id === gnSelectedId)
    if (idx !== -1 && idx + 1 < visible.length) centerNode(visible[idx + 1].id)
  }

  function gnHome() {
    setNodeFilter('')
    setNodesViewModeAndSave('list')
    setGnTreeMode(false)
    gnHierarchyIdxRef.current = -1
  }

  function gnToggleTree() {
    if (!gnSelectedId) return
    setGnTreeMode(prev => !prev)
  }

  function getTreeNodes() {
    if (!gnSelectedId) return null
    const allSeries = [...hierarchyData.groups.flatMap(g => g.children), ...hierarchyData.orphanSeries]
    const parents: GraphNodeInfo[] = []
    const siblings: GraphNodeInfo[] = []
    const children: GraphNodeInfo[] = []

    const asL1 = hierarchyData.groups.find(g => g.id === gnSelectedId)
    if (asL1) {
      children.push(...asL1.children)
      return { parents, siblings, children }
    }

    const asSeries = allSeries.find(s => s.id === gnSelectedId)
    if (asSeries) {
      for (const g of hierarchyData.groups) {
        if (g.children.some(s => s.id === gnSelectedId)) {
          parents.push(g)
          siblings.push(...g.children.filter(s => s.id !== gnSelectedId))
        }
      }
      children.push(...asSeries.persons)
      return { parents, siblings, children }
    }

    for (const s of allSeries) {
      if (s.persons.some(p => p.id === gnSelectedId)) {
        parents.push(s)
        siblings.push(...s.persons.filter(p => p.id !== gnSelectedId))
      }
    }
    return { parents, siblings, children }
  }

  function selectSearchResult(s: SeriesResult) {
    setShowDropdown(false)
    setSearchQuery(s.name)
    loadSeriesById(makeNodeId('Series', s.tmdb_id))
  }

  function changeLayout(l: LayoutName) {
    layoutRef.current = l
    setLayout(l)
    try { localStorage.setItem(STORAGE_KEYS.layout, l) } catch {}
    const cy = cyRef.current
    if (cy && cy.nodes().nonempty()) runLayout(cy, l)
  }

  function clearGraph() {
    const cy = cyRef.current
    if (runningLayoutRef.current) {
      try { runningLayoutRef.current.stop() } catch { /* ignore */ }
      runningLayoutRef.current = null
    }
    if (cy) cy.elements().remove()
    setFgNodes([]); setFgLinks([])
    setGraphNodeList([])
    setSelected(null)
    selHistoryRef.current = []
    histIdxRef.current = -1
    setHistIdx(-1)
    setHistLen(0)
    expandedRef.current.clear()
    didFitRef.current = false
    setSearchQuery('')
    setStats({ nodes: 0, edges: 0 })
    setExpandedHierarchy(new Set())
    clearExploreGraph()
  }

  // ── Zoom controls ─────────────────────────────────────────────────────────

  function zoomFit() { cyRef.current?.fit(undefined, ZOOM_FIT_PADDING) }

  // ── Nodes panel sort / hierarchy ─────────────────────────────────────────

  function cycleSortDir(cur: SortDir): SortDir {
    return cur === null ? 'asc' : cur === 'asc' ? 'desc' : null
  }
  function handleSortName() {
    const next = cycleSortDir(nodesSortName)
    setNodesSortName(next)
    try {
      if (next) localStorage.setItem(STORAGE_KEYS.sortName, next)
      else localStorage.removeItem(STORAGE_KEYS.sortName)
    } catch {}
  }
  function handleSortDegree() {
    const next = cycleSortDir(nodesSortDegree)
    setNodesSortDegree(next)
    try {
      if (next) localStorage.setItem(STORAGE_KEYS.sortDegree, next)
      else localStorage.removeItem(STORAGE_KEYS.sortDegree)
    } catch {}
  }
  function setNodesViewModeAndSave(m: NodesViewMode) {
    setNodesViewMode(m)
    try { localStorage.setItem(STORAGE_KEYS.nodesView, m) } catch {}
  }
  function toggleNavOpen(v: boolean) {
    setNavOpen(v)
    try { localStorage.setItem(STORAGE_KEYS.navOpen, String(v)) } catch {}
  }
  function toggleHierarchyNode(id: string) {
    setExpandedHierarchy(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Computed: node navigator ───────────────────────────────────────────────

  const nodeIdSet = new Set(graphNodeList.map(n => n.id))

  const isLabelVisible = (label: string) => filters[label as keyof NodeTypeFilter] !== false

  const sortIcon = (d: SortDir) => d === 'asc' ? '↑' : d === 'desc' ? '↓' : '—'

  const applySort = <T extends { name: string; degree: number }>(arr: T[]): T[] => {
    if (nodesSortName === null && nodesSortDegree === null) return arr
    return [...arr].sort((a, b) => {
      if (nodesSortName !== null) {
        const c = a.name.localeCompare(b.name)
        if (c !== 0) return nodesSortName === 'asc' ? c : -c
      }
      if (nodesSortDegree !== null) {
        const c = a.degree - b.degree
        return nodesSortDegree === 'asc' ? c : -c
      }
      return 0
    })
  }

  const filteredNodes = graphNodeList.filter(n =>
    isLabelVisible(n.label) &&
    (!nodeFilter || n.name.toLowerCase().includes(nodeFilter.toLowerCase()))
  )

  const sortedListNodes = applySort(filteredNodes)

  type SeriesWithPersons = GraphNodeInfo & { persons: GraphNodeInfo[] }
  type HierarchyGroup = GraphNodeInfo & { children: SeriesWithPersons[] }

  const hierarchyData: { groups: HierarchyGroup[]; orphanSeries: SeriesWithPersons[]; orphanPersons: GraphNodeInfo[] } = (() => {
    const empty = { groups: [] as HierarchyGroup[], orphanSeries: [] as SeriesWithPersons[], orphanPersons: [] as GraphNodeInfo[] }
    const cy = cyRef.current
    if (!cy) return empty
    const nodeMap = new Map(graphNodeList.map(n => [n.id, n]))

    const seriesWithL1 = new Set<string>()
    const personsWithSeries = new Set<string>()

    const collectPersons = (seriesId: string): GraphNodeInfo[] => {
      const result: GraphNodeInfo[] = []
      const seen = new Set<string>()
      cy.getElementById(seriesId).neighborhood('node').forEach((nb: any) => {
        const nbId = nb.id()
        if (!seen.has(nbId)) {
          seen.add(nbId)
          const info = nodeMap.get(nbId)
          if (info && info.label === 'Person' && isLabelVisible('Person')) {
            result.push(info)
            personsWithSeries.add(nbId)
          }
        }
      })
      return applySort(result)
    }

    // L1: Genre / Keyword / Network / Country / Language
    const l1Nodes = applySort(filteredNodes.filter(n => L1_LABELS.includes(n.label)))

    const groups: HierarchyGroup[] = l1Nodes.map(l1n => {
      const seen = new Set<string>()
      const children: SeriesWithPersons[] = []
      cy.getElementById(l1n.id).neighborhood('node').forEach((nb: any) => {
        const nbId = nb.id()
        if (!seen.has(nbId)) {
          seen.add(nbId)
          const info = nodeMap.get(nbId)
          if (info && info.label === 'Series' && isLabelVisible('Series') && !seriesWithL1.has(nbId)) {
            children.push({ ...info, persons: collectPersons(nbId) })
            seriesWithL1.add(nbId)
          }
        }
      })
      return { ...l1n, children: applySort(children) }
    })

    // Orphan Series: Series not connected to any L1 node in current graph
    const orphanSeries: SeriesWithPersons[] = applySort(
      filteredNodes.filter(n => n.label === 'Series' && !seriesWithL1.has(n.id))
    ).map(sn => ({ ...sn, persons: collectPersons(sn.id) }))

    // Orphan Persons: Persons not connected to any Series
    const orphanPersons = applySort(
      filteredNodes.filter(n => n.label === 'Person' && !personsWithSeries.has(n.id))
    )

    return { groups, orphanSeries, orphanPersons }
  })()

  // ── Flat hierarchy in display order ──────────────────────────────────────────
  // Includes duplicate entries when the same node appears under multiple parents.
  // Used by gnNavigateDown/Up for index-based sequential navigation so duplicates
  // don't cause jumps back to the first occurrence.
  const flatHierarchy: GraphNodeInfo[] = (() => {
    const result: GraphNodeInfo[] = []
    for (const group of hierarchyData.groups) {
      result.push(group)
      for (const series of group.children) {
        result.push(series)
        for (const person of series.persons) result.push(person)
      }
    }
    for (const series of hierarchyData.orphanSeries) {
      result.push(series)
      for (const person of series.persons) result.push(person)
    }
    for (const person of hierarchyData.orphanPersons) result.push(person)
    return result
  })()

  // Keep gnNavRef fresh so the keyboard handler always calls the latest closures
  gnNavRef.current = { up: gnNavigateUp, down: gnNavigateDown, scrollPrev: gnScrollPrev, scrollNext: gnScrollNext, home: gnHome, tree: gnToggleTree }

  // Auto-scroll selected node into view inside the list container
  useEffect(() => {
    if (!gnSelectedId || !nodeListRef.current) return
    const el = nodeListRef.current.querySelector<HTMLElement>(`[data-gnid="${gnSelectedId}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [gnSelectedId])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3rem)] flex overflow-hidden select-none">

      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <ResizablePanel
        side="left"
        persistKey="explore-left"
        defaultWidth={PANEL_SIZES.exploreLeft.defaultWidth}
        minWidth={PANEL_SIZES.exploreLeft.minWidth}
        maxWidth={PANEL_SIZES.exploreLeft.maxWidth}
        collapsedLabel="controls"
      >
        <div className="flex-1 overflow-y-auto">

          {/* Add series / person to graph */}
          <div className="p-3 border-b border-slate-800">
            <p className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-2">Start from</p>

            {/* Type + mode toggles */}
            <div className="flex items-center gap-1 mb-2 flex-wrap">
              <div className="flex gap-0.5 bg-slate-900 border border-slate-700 rounded p-0.5">
                {(['series', 'person'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setExploreSearchType(t); setSearchQuery(''); setShowDropdown(false) }}
                    className={cn(
                      'font-mono text-[10px] px-1.5 py-0.5 rounded transition-colors',
                      exploreSearchType === t ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {exploreSearchType === 'series' && (
                <div className="flex gap-0.5 bg-slate-900 border border-slate-700 rounded p-0.5">
                  {(['structural', 'semantic'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setExploreSearchMode(m)}
                      className={cn(
                        'font-mono text-[10px] px-1.5 py-0.5 rounded transition-colors',
                        exploreSearchMode === m ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={searchContainerRef}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => (searchResults.length > 0 || personSearchResults.length > 0) && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), DROPDOWN_CLOSE_DELAY_MS)}
                placeholder={exploreSearchType === 'series' ? 'Search series…' : 'Search person…'}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
              />
              {searchLoading && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-600">…</span>
              )}
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded shadow-xl z-30 max-h-56 overflow-y-auto">
                  {searchError && (
                    <p role="alert" className="px-3 py-2 text-xs font-mono text-red-400">{searchError}</p>
                  )}
                  {exploreSearchType === 'series' && searchResults.map(s => (
                    <button
                      key={s.tmdb_id}
                      onMouseDown={e => { e.preventDefault(); selectSearchResult(s) }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0"
                    >
                      <p className="text-xs text-slate-200 truncate">{s.name}</p>
                      {s.start_year && <p className="font-mono text-xs text-slate-600">{s.start_year}</p>}
                    </button>
                  ))}
                  {exploreSearchType === 'person' && personSearchResults.map(p => (
                    <button
                      key={p.person_id}
                      onMouseDown={e => {
                        e.preventDefault()
                        setSearchQuery(p.name)
                        setShowDropdown(false)
                        loadPersonById(makeNodeId('Person', p.person_id))
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors border-b border-slate-800/50 last:border-0"
                    >
                      <p className="text-xs text-slate-200 truncate">{p.name}</p>
                      <p className="font-mono text-xs text-slate-600">{p.series_count} series</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {expanding && <p className="font-mono text-xs text-slate-600 mt-1.5">loading…</p>}
          </div>

          {/* Node type filters — dot toggle buttons */}
          <div className="p-3 border-b border-slate-800">
            <p className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-2">Node types</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(filters) as Array<keyof NodeTypeFilter>).map(label => (
                <button
                  key={label}
                  onClick={() => setFilters(f => ({ ...f, [label]: !f[label] }))}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-xs transition-colors',
                    filters[label]
                      ? 'border-slate-600 text-slate-300 hover:border-slate-500'
                      : 'border-slate-800 text-slate-600 hover:border-slate-700',
                  )}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: NODE_COLORS[label] ?? NODE_COLOR_FALLBACK, opacity: filters[label] ? 1 : 0.3 }}
                  />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div className="p-3 border-b border-slate-800">
            <p className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-2">Layout</p>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(LAYOUT_LABELS) as LayoutName[]).map(l => (
                <button
                  key={l}
                  onClick={() => changeLayout(l)}
                  className={cn(
                    'font-mono text-xs px-2 py-1.5 rounded border transition-colors',
                    layout === l
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200',
                  )}
                >
                  {LAYOUT_LABELS[l]}
                </button>
              ))}
            </div>
          </div>

          {/* View 2D / 3D */}
          <div className="p-3 border-b border-slate-800">
            <p className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-2">View</p>
            <div className="flex gap-1">
              {(['2D', '3D'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setIs3D(mode === '3D')}
                  className={cn(
                    'flex-1 font-mono text-xs py-1.5 rounded border transition-colors',
                    (mode === '3D') === is3D
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Explore list — bookmarks; user adds items manually */}
          <div className="p-3 border-b border-slate-800">
            <p className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-2">
              Explore list ({exploreList.length})
            </p>
            {exploreList.length === 0 ? (
              <p className="font-mono text-xs text-slate-700">add series or persons from search</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {exploreList.map(item => {
                  const inGraph = nodeIdSet.has(item.id)
                  return (
                    <div key={item.id} className="flex items-center gap-1.5">
                      {item.type === 'person' && (
                        <span className="font-mono text-[9px] text-slate-700 shrink-0">P</span>
                      )}
                      <span
                        className={cn(
                          'flex-1 min-w-0 font-mono text-xs truncate',
                          inGraph
                            ? 'text-slate-300 cursor-pointer hover:text-violet-400 transition-colors'
                            : 'text-slate-500',
                        )}
                        title={item.name}
                        onClick={() => { if (inGraph) centerNode(item.id) }}
                      >
                        {item.name}
                      </span>
                      {inGraph ? (
                        <button
                          onClick={() => removeNode(item.id)}
                          className="shrink-0 font-mono text-[10px] text-slate-600 hover:text-red-400 transition-colors"
                          title="Remove from graph"
                        >
                          ✕
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (item.type === 'person') loadPersonById(item.id)
                            else if (item.type === 'country') loadNodeById(item.id, 'Country')
                            else if (item.type === 'language') loadNodeById(item.id, 'Language')
                            else if (item.type === 'genre') loadNodeById(item.id, 'Genre')
                            else if (item.type === 'keyword') loadNodeById(item.id, 'Keyword')
                            else if (item.type === 'network') loadNodeById(item.id, 'Network')
                            else loadSeriesById(item.id)
                          }}
                          className="shrink-0 font-mono text-[10px] px-1.5 py-0.5 border border-emerald-700 text-emerald-400 rounded hover:border-emerald-500 transition-colors"
                          title="Add to graph"
                        >
                          +
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Graph node navigator */}
          <div className="p-3 border-b border-slate-800">
            <button
              onClick={() => toggleNavOpen(!navOpen)}
              className="w-full flex items-center justify-between font-mono text-xs text-violet-400 tracking-widest uppercase"
            >
              <span>Graph nodes ({graphNodeList.length})</span>
              <span>{navOpen ? '▴' : '▾'}</span>
            </button>

            {navOpen && (
              <div className="mt-2 space-y-1.5">
                <input
                  type="text"
                  value={nodeFilter}
                  onChange={e => setNodeFilter(e.target.value)}
                  placeholder="Filter…"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-violet-500 font-mono"
                />

                {/* View mode + sort controls */}
                <div className="flex items-center gap-1 flex-wrap">
                  {/* Home */}
                  <div className="flex gap-0 border border-slate-800 rounded">
                    <button
                      onClick={gnHome}
                      title="Home — reset view (H)"
                      className="font-mono text-[11px] px-1 py-0.5 text-slate-500 hover:text-slate-200 transition-colors"
                    >⌂</button>
                  </div>
                  {/* Back / Forward */}
                  <div className="flex gap-0 border border-slate-800 rounded">
                    <button onClick={historyBack}    disabled={histIdx <= 0}            title="Back (Alt+←)"    className="font-mono text-[11px] px-1 py-0.5 text-slate-500 hover:text-slate-200 disabled:text-slate-800 disabled:cursor-default transition-colors">←</button>
                    <button onClick={historyForward} disabled={histIdx >= histLen - 1}  title="Forward (Alt+→)" className="font-mono text-[11px] px-1 py-0.5 text-slate-500 hover:text-slate-200 disabled:text-slate-800 disabled:cursor-default transition-colors">→</button>
                  </div>
                  {/* Prev / Next */}
                  <div className="flex gap-0 border border-slate-800 rounded">
                    <button onClick={gnScrollPrev} disabled={graphNodeList.length === 0} title="Prev (↑)" className="font-mono text-[11px] px-1 py-0.5 text-slate-500 hover:text-slate-200 disabled:text-slate-800 disabled:cursor-default transition-colors">↑</button>
                    <button onClick={gnScrollNext} disabled={graphNodeList.length === 0} title="Next (↓)" className="font-mono text-[11px] px-1 py-0.5 text-slate-500 hover:text-slate-200 disabled:text-slate-800 disabled:cursor-default transition-colors">↓</button>
                  </div>
                  {/* Parent / Child */}
                  <div className="flex gap-0 border border-slate-800 rounded">
                    <button onClick={gnNavigateUp}   disabled={!gnSelectedId} title="Parent (Esc)" className="font-mono text-[11px] px-1 py-0.5 text-slate-600 hover:text-slate-200 disabled:text-slate-800 disabled:cursor-default transition-colors">⤴</button>
                    <button onClick={gnNavigateDown} disabled={!gnSelectedId} title="Child (Enter)" className="font-mono text-[11px] px-1 py-0.5 text-slate-600 hover:text-slate-200 disabled:text-slate-800 disabled:cursor-default transition-colors">⤵</button>
                  </div>
                  {/* Tree */}
                  <div className="flex gap-0 border border-slate-800 rounded">
                    <button
                      onClick={gnToggleTree}
                      disabled={!gnSelectedId}
                      title="Tree view — show context of selected node (T)"
                      className={cn(
                        'font-mono text-[11px] px-1 py-0.5 disabled:text-slate-800 disabled:cursor-default transition-colors',
                        gnTreeMode ? 'text-violet-400' : 'text-slate-500 hover:text-slate-200',
                      )}
                    >⊞</button>
                  </div>
                  <div className="flex gap-0.5 bg-slate-900 border border-slate-700 rounded p-0.5">
                    {(['list', 'hierarchy'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setNodesViewModeAndSave(m)}
                        className={cn(
                          'font-mono text-[10px] px-1.5 py-0.5 rounded transition-colors',
                          nodesViewMode === m ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <span
                    onClick={handleSortName}
                    className={cn(
                      'font-mono text-[10px] cursor-pointer select-none',
                      nodesSortName !== null ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300',
                    )}
                  >
                    A Z {sortIcon(nodesSortName)}
                  </span>
                  <span
                    onClick={handleSortDegree}
                    className={cn(
                      'font-mono text-[10px] cursor-pointer select-none',
                      nodesSortDegree !== null ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300',
                    )}
                  >
                    0 ∞ {sortIcon(nodesSortDegree)}
                  </span>
                </div>

                {/* Node list */}
                <div ref={nodeListRef} className="max-h-56 overflow-y-auto space-y-px">
                  {gnTreeMode && (() => {
                    const tree = getTreeNodes()
                    if (!tree || !gnSelectedId) return <p className="font-mono text-xs text-slate-700 py-2 text-center">select a node</p>
                    const self = graphNodeList.find(n => n.id === gnSelectedId)
                    const NodeRow = ({ n, indent = 0 }: { n: GraphNodeInfo; indent?: number }) => (
                      <div
                        key={n.id}
                        data-gnid={n.id}
                        onClick={() => centerNode(n.id)}
                        style={{ paddingLeft: `${4 + indent * 12}px` }}
                        className={cn(
                          'flex items-center gap-1.5 py-0.5 pr-1 rounded hover:bg-slate-800/50 cursor-pointer border-l-2',
                          n.expandable ? 'border-amber-500/60' : 'border-transparent',
                          gnSelectedId === n.id && 'bg-slate-800/70',
                        )}
                      >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
                        <span className="flex-1 min-w-0 font-mono text-xs text-slate-400 truncate">{n.name}</span>
                      </div>
                    )
                    return (
                      <>
                        {tree.parents.length > 0 && <p className="font-mono text-[9px] text-slate-700 px-1 pt-1">parents</p>}
                        {tree.parents.map(n => <NodeRow key={n.id} n={n} />)}
                        {self && <NodeRow n={self} />}
                        {tree.siblings.length > 0 && <p className="font-mono text-[9px] text-slate-700 px-1 pt-1">siblings</p>}
                        {tree.siblings.map(n => <NodeRow key={n.id} n={n} indent={1} />)}
                        {tree.children.length > 0 && <p className="font-mono text-[9px] text-slate-700 px-1 pt-1">children</p>}
                        {tree.children.map(n => <NodeRow key={n.id} n={n} indent={1} />)}
                        {tree.parents.length === 0 && tree.siblings.length === 0 && tree.children.length === 0 && (
                          <p className="font-mono text-xs text-slate-700 py-1 text-center">no relatives in graph</p>
                        )}
                      </>
                    )
                  })()}
                  {!gnTreeMode && nodesViewMode === 'list' && sortedListNodes.map(n => (
                    <div
                      key={n.id}
                      data-gnid={n.id}
                      onClick={() => centerNode(n.id)}
                      onDoubleClick={() => expandNode(n.id, n.label)}
                      className={cn(
                        'flex items-center gap-1.5 py-1 px-1 rounded hover:bg-slate-800/50 group cursor-pointer border-l-2',
                        n.expandable ? 'border-amber-500/60' : 'border-transparent',
                        gnSelectedId === n.id && 'bg-slate-800/70',
                      )}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: n.color }} />
                      <span className="flex-1 min-w-0 font-mono text-xs text-slate-400 truncate">{n.name}</span>
                      <span className="font-mono text-[9px] text-slate-700 shrink-0">{n.degree}</span>
                      <button
                        onClick={e => { e.stopPropagation(); removeNode(n.id) }}
                        className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors"
                        title="Remove from graph"
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  {!gnTreeMode && nodesViewMode === 'hierarchy' && (
                    <>
                      {/* L1: Genre / Keyword / Network / Country / Language */}
                      {hierarchyData.groups.map(l1n => (
                        <div key={l1n.id}>
                          {/* L1 row */}
                          <div
                            data-gnid={l1n.id}
                            onClick={() => centerNode(l1n.id)}
                            onDoubleClick={() => expandNode(l1n.id, l1n.label)}
                            className={cn(
                              'flex items-center gap-1.5 py-1 px-1 rounded hover:bg-slate-800/50 cursor-pointer border-l-2',
                              l1n.expandable ? 'border-amber-500/60' : 'border-transparent',
                              gnSelectedId === l1n.id && 'bg-slate-800/70',
                            )}
                          >
                            <button onClick={e => { e.stopPropagation(); toggleHierarchyNode(l1n.id) }} className="font-mono text-sm text-slate-500 shrink-0 w-4 flex items-center justify-center hover:text-slate-200 transition-colors">
                              {l1n.children.length > 0 ? (expandedHierarchy.has(l1n.id) ? '▾' : '▸') : <span className="text-[8px]">·</span>}
                            </button>
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: l1n.color }} />
                            <span className="flex-1 min-w-0 font-mono text-xs text-slate-300 truncate">{l1n.name}</span>
                            <span className="font-mono text-[9px] text-slate-700 shrink-0">{l1n.degree}</span>
                            <button onClick={e => { e.stopPropagation(); removeNode(l1n.id) }} className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors" title="Remove">✕</button>
                          </div>
                          {/* L2: Series */}
                          {expandedHierarchy.has(l1n.id) && l1n.children.map(sn => (
                            <div key={sn.id}>
                              <div
                                data-gnid={sn.id}
                                onClick={() => centerNode(sn.id)}
                                onDoubleClick={() => expandNode(sn.id, sn.label)}
                                className={cn(
                                  'flex items-center gap-1.5 pl-4 pr-1 py-0.5 rounded hover:bg-slate-800/50 cursor-pointer border-l-2',
                                  sn.expandable ? 'border-amber-500/60' : 'border-transparent',
                                  gnSelectedId === sn.id && 'bg-slate-800/70',
                                )}
                              >
                                <button onClick={e => { e.stopPropagation(); toggleHierarchyNode(sn.id) }} className="font-mono text-sm text-slate-500 shrink-0 w-4 flex items-center justify-center hover:text-slate-200 transition-colors">
                                  {sn.persons.length > 0 ? (expandedHierarchy.has(sn.id) ? '▾' : '▸') : <span className="text-[8px]">·</span>}
                                </button>
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sn.color }} />
                                <span className="flex-1 min-w-0 font-mono text-xs text-slate-400 truncate">{sn.name}</span>
                                <span className="font-mono text-[9px] text-slate-700 shrink-0">{sn.degree}</span>
                                <button onClick={e => { e.stopPropagation(); removeNode(sn.id) }} className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors" title="Remove">✕</button>
                              </div>
                              {/* L3: Person */}
                              {expandedHierarchy.has(sn.id) && sn.persons.map(p => (
                                <div
                                  key={p.id}
                                  data-gnid={p.id}
                                  onClick={() => centerNode(p.id)}
                                  onDoubleClick={() => expandNode(p.id, p.label)}
                                  className={cn(
                                    'flex items-center gap-1.5 pl-12 pr-1 py-0.5 rounded hover:bg-slate-800/50 cursor-pointer border-l-2',
                                    p.expandable ? 'border-amber-500/60' : 'border-transparent',
                                    gnSelectedId === p.id && 'bg-slate-800/70',
                                  )}
                                >
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
                                  <span className="flex-1 min-w-0 font-mono text-xs text-slate-500 truncate">{p.name}</span>
                                  <button onClick={e => { e.stopPropagation(); removeNode(p.id) }} className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors" title="Remove">✕</button>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                      {/* Orphan Series — no Genre/Keyword/Network/Country/Language in current graph */}
                      {hierarchyData.orphanSeries.map(sn => (
                        <div key={sn.id}>
                          <div
                            data-gnid={sn.id}
                            onClick={() => centerNode(sn.id)}
                            onDoubleClick={() => expandNode(sn.id, sn.label)}
                            className={cn(
                              'flex items-center gap-1.5 py-1 px-1 rounded hover:bg-slate-800/50 cursor-pointer border-l-2',
                              sn.expandable ? 'border-amber-500/60' : 'border-transparent',
                              gnSelectedId === sn.id && 'bg-slate-800/70',
                            )}
                          >
                            <button onClick={e => { e.stopPropagation(); toggleHierarchyNode(sn.id) }} className="font-mono text-sm text-slate-500 shrink-0 w-4 flex items-center justify-center hover:text-slate-200 transition-colors">
                              {sn.persons.length > 0 ? (expandedHierarchy.has(sn.id) ? '▾' : '▸') : <span className="text-[8px]">·</span>}
                            </button>
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: sn.color }} />
                            <span className="flex-1 min-w-0 font-mono text-xs text-slate-400 truncate">{sn.name}</span>
                            <span className="font-mono text-[9px] text-slate-700 shrink-0">{sn.degree}</span>
                            <button onClick={e => { e.stopPropagation(); removeNode(sn.id) }} className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors" title="Remove">✕</button>
                          </div>
                          {expandedHierarchy.has(sn.id) && sn.persons.map(p => (
                            <div
                              key={p.id}
                              data-gnid={p.id}
                              onClick={() => centerNode(p.id)}
                              onDoubleClick={() => expandNode(p.id, p.label)}
                              className={cn(
                                'flex items-center gap-1.5 pl-9 pr-1 py-0.5 rounded hover:bg-slate-800/50 cursor-pointer border-l-2',
                                p.expandable ? 'border-amber-500/60' : 'border-transparent',
                                gnSelectedId === p.id && 'bg-slate-800/70',
                              )}
                            >
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
                              <span className="flex-1 min-w-0 font-mono text-xs text-slate-500 truncate">{p.name}</span>
                              <button onClick={e => { e.stopPropagation(); removeNode(p.id) }} className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors" title="Remove">✕</button>
                            </div>
                          ))}
                        </div>
                      ))}
                      {/* Orphan Persons — no Series in current graph */}
                      {hierarchyData.orphanPersons.map(p => (
                        <div
                          key={p.id}
                          data-gnid={p.id}
                          onClick={() => centerNode(p.id)}
                          onDoubleClick={() => expandNode(p.id, p.label)}
                          className={cn(
                            'flex items-center gap-1.5 py-0.5 px-1 rounded hover:bg-slate-800/50 cursor-pointer border-l-2',
                            p.expandable ? 'border-amber-500/60' : 'border-transparent',
                            gnSelectedId === p.id && 'bg-slate-800/70',
                          )}
                        >
                          <span className="font-mono text-[8px] text-slate-700 shrink-0 w-4 text-center">·</span>
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
                          <span className="flex-1 min-w-0 font-mono text-xs text-slate-500 truncate">{p.name}</span>
                          <span className="font-mono text-[9px] text-slate-700 shrink-0">{p.degree}</span>
                          <button onClick={e => { e.stopPropagation(); removeNode(p.id) }} className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors" title="Remove">✕</button>
                        </div>
                      ))}
                    </>
                  )}

                  {!gnTreeMode && filteredNodes.length === 0 && (
                    <p className="font-mono text-xs text-slate-700 py-2 text-center">
                      {graphNodeList.length === 0 ? 'graph is empty' : 'no match'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats + clear */}
          <div className="p-3">
            <p className="font-mono text-xs text-slate-600">
              {stats.nodes} nodes · {stats.edges} edges
            </p>
            {stats.nodes > 0 && (
              <button
                onClick={clearGraph}
                className="mt-2 w-full font-mono text-xs py-1.5 rounded border border-slate-800 text-slate-600 hover:border-red-900 hover:text-red-400 transition-colors"
              >
                clear graph
              </button>
            )}
            <p className="font-mono text-xs text-slate-700 mt-3">
              double-click to expand · <span className="text-amber-600/70">amber glow</span> = expandable
            </p>
          </div>

        </div>
      </ResizablePanel>

      {/* ── Canvas ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {stats.nodes === 0 && !expanding && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-700 pointer-events-none z-10">
            <p className="font-mono text-sm">search for a series or load from the explore list</p>
            <p className="font-mono text-xs">double-click any node to expand connections</p>
          </div>
        )}

        <div
          ref={cyContainerRef}
          className="absolute inset-0"
          style={{ visibility: is3D ? 'hidden' : 'visible' }}
        />

        {/* Zoom controls — vertical slider (desktop only; touch uses pinch-zoom) */}
        {!is3D && (
          <div className="absolute top-3 right-3 z-20 hidden md:flex flex-col items-center gap-2 py-1">
            <button
              onClick={zoomFit}
              title="Fit to view"
              className="font-mono text-base text-white/40 hover:text-white/90 transition-colors leading-none select-none"
            >⊡</button>
            <div className="relative" style={{ height: 110, width: 20 }}>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={zoomToSlider(zoomLevel)}
                onChange={e => {
                  const cy = cyRef.current
                  if (!cy) return
                  cy.zoom({
                    level: sliderToZoom(Number(e.target.value)),
                    renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
                  })
                }}
                style={{
                  position: 'absolute',
                  width: 110,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-90deg)',
                  accentColor: '#fff',
                  background: 'transparent',
                  cursor: 'pointer',
                  outline: 'none',
                  border: 'none',
                }}
              />
            </div>
            <span className="font-mono text-[8px] text-white/30 tabular-nums select-none">{Math.round(zoomLevel * 100)}%</span>
          </div>
        )}

        {is3D && (
          <div ref={graph3DRef} className="absolute inset-0 overflow-hidden">
            {fgNodes.length > 0 ? (
              <ForceGraph3D
                width={dims3D.width}
                height={dims3D.height}
                graphData={{ nodes: fgNodes, links: fgLinks }}
                backgroundColor="#020617"
                nodeColor={(n: any) => n.color ?? '#7c3aed'}
                nodeVal={(n: any) => n.val ?? 1}
                nodeLabel={(n: any) => n.name}
                linkColor={(l: any) => l.color ?? LINK_COLOR_FALLBACK}
                linkOpacity={0.4}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-mono text-sm text-slate-600">graph is empty</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right detail panel ──────────────────────────────────────────────── */}
      {selected && (
        <ResizablePanel
          side="right"
          persistKey="explore-detail"
          defaultWidth={PANEL_SIZES.exploreRight.defaultWidth}
          minWidth={PANEL_SIZES.exploreRight.minWidth}
          maxWidth={PANEL_SIZES.exploreRight.maxWidth}
          collapsedLabel="details"
        >
          {/* History nav strip */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 shrink-0">
            <button
              onClick={historyBack}
              disabled={histIdx <= 0}
              title="Previous node (Alt+←)"
              className="font-mono text-xs text-slate-400 hover:text-slate-100 disabled:text-slate-700 disabled:cursor-default transition-colors px-1"
            >←</button>
            <span className="font-mono text-[9px] text-slate-600 select-none">
              {histLen > 0 ? `${histIdx + 1}/${histLen}` : '—'}
            </span>
            <button
              onClick={historyForward}
              disabled={histIdx >= histLen - 1}
              title="Next node (Alt+→)"
              className="font-mono text-xs text-slate-400 hover:text-slate-100 disabled:text-slate-700 disabled:cursor-default transition-colors px-1"
            >→</button>
          </div>

          {/* Header */}
          <div className="p-4 border-b border-slate-800 shrink-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h3
                  className="text-sm font-semibold text-slate-100 leading-tight truncate cursor-pointer hover:text-violet-400 transition-colors"
                  onClick={() => centerNode(selected.id)}
                  title="Center on canvas"
                >
                  {selected.name}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: NODE_COLORS[selected.label] ?? NODE_COLOR_FALLBACK }}
                  />
                  <span className="font-mono text-xs text-slate-500">{selected.label}</span>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="font-mono text-xs text-slate-600 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selected.label === 'Series' && (
                <>
                  <Link
                    href={`/series/${keyOfNodeId(selected.id)}`}
                    className="font-mono text-xs px-2 py-1 border border-slate-700 rounded hover:border-violet-500 hover:text-violet-400 transition-colors"
                  >
                    page →
                  </Link>
                  <Link
                    href={`/similar/${keyOfNodeId(selected.id)}`}
                    className="font-mono text-xs px-2 py-1 border border-slate-700 rounded hover:border-violet-500 hover:text-violet-400 transition-colors"
                  >
                    similar →
                  </Link>
                </>
              )}
              {selected.label === 'Person' && (
                <Link
                  href={`/person/${keyOfNodeId(selected.id)}`}
                  className="font-mono text-xs px-2 py-1 border border-slate-700 rounded hover:border-violet-500 hover:text-violet-400 transition-colors"
                >
                  page →
                </Link>
              )}
              {(() => {
                const inExplore = exploreList.some(i => i.id === selected.id)
                const itemType = selected.label.toLowerCase() as ExploreItem['type']
                return (
                  <button
                    onClick={() => {
                      const added = toggleExploreList({ id: selected.id, name: selected.name, type: itemType })
                      toast.success(
                        added ? `Added "${selected.name}"` : `Removed "${selected.name}"`,
                        { duration: TOAST_DURATION_MS },
                      )
                    }}
                    title={inExplore ? 'Remove from explore list' : 'Add to explore list'}
                    className={cn(
                      'font-mono text-xs px-2 py-1 border rounded transition-colors',
                      inExplore
                        ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                        : 'border-slate-700 hover:border-emerald-500 hover:text-emerald-400',
                    )}
                  >
                    {inExplore ? '✓' : '+'}
                  </button>
                )
              })()}
              {EXPANDABLE_LABELS.has(selected.label) &&
                !expandedRef.current.has(selected.id) && (
                  <button
                    onClick={() => expandNode(selected.id, selected.label)}
                    className="font-mono text-xs px-2 py-1 border border-amber-700 text-amber-400 rounded hover:border-amber-500 hover:text-amber-300 transition-colors"
                  >
                    expand +
                  </button>
                )}
              <button
                onClick={() => removeNode(selected.id)}
                className="p-1.5 border border-slate-800 text-slate-600 rounded hover:border-red-900 hover:text-red-400 transition-colors"
                title="Remove this node (and orphaned neighbours) from the graph"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12"/>
                  <path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4"/>
                  <path d="M3 4l1 9h8l1-9"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Neighbours */}
          {selected.neighbors.length > 0 && (
            <div className="flex-1 overflow-y-auto p-4">
              <p className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-2">
                Connected ({selected.neighbors.length})
              </p>
              <div className="space-y-0.5">
                {selected.neighbors.map((n, i) => {
                  const isExpandable = EXPANDABLE_LABELS.has(n.label) && !expandedRef.current.has(n.id)
                  return (
                    <div
                      key={i}
                      onClick={() => centerNode(n.id)}
                      className={cn(
                        'flex items-center gap-2 py-1.5 border-b border-b-slate-800/40 border-l-2 cursor-pointer hover:bg-slate-800/30 rounded px-1 -mx-1 transition-colors',
                        isExpandable ? 'border-l-amber-500/60' : 'border-l-transparent',
                      )}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: NODE_COLORS[n.label] ?? NODE_COLOR_FALLBACK }}
                      />
                      <span className="font-mono text-xs text-slate-400 truncate flex-1 min-w-0">{n.name}</span>
                      <span className="font-mono text-[9px] text-slate-700 shrink-0">{n.edgeType}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-3 border-t border-slate-800 shrink-0">
            <p className="font-mono text-xs text-slate-700 break-all">{selected.id}</p>
          </div>
        </ResizablePanel>
      )}
    </div>
  )
}
