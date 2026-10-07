'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Maximize2, Minimize2 } from 'lucide-react'
import { api, failureMessage } from '@/lib/api'
import type { GraphData } from '@/lib/types'
import { cn } from '@/lib/utils'
import { nodeId, nodeDisplayName } from '@/lib/nodeId'
import {
  NODE_COLORS,
  LINK_COLORS,
  NODE_COLOR_FALLBACK,
  LINK_COLOR_FALLBACK,
  FG2D_PHYSICS,
  FG2D_NODE,
  FG2D_LINK,
  FG2D_COLORS,
} from '@/lib/constants'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false })

// Re-export so other files that import from this module don't need to change.
export { NODE_COLORS, LINK_COLORS }

export function GraphLegend({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {labels.map(label => (
        <div key={label} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: NODE_COLORS[label] ?? NODE_COLOR_FALLBACK }} />
          <span className="font-mono text-xs text-slate-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

export function LinkLegend({ types }: { types?: string[] }) {
  const entries = (types ?? Object.keys(LINK_COLORS)).filter(t => LINK_COLORS[t])
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {entries.map(type => (
        <div key={type} className="flex items-center gap-1.5">
          <div className="w-4 h-px" style={{ background: LINK_COLORS[type] }} />
          <span className="font-mono text-xs text-slate-500">{type.replace(/_/g, ' ')}</span>
        </div>
      ))}
    </div>
  )
}

/** `centerId` is a prefixed graph node id ("series:1399"), not a bare tmdb_id. */
export function buildGraphData(data: GraphData, centerId: string) {
  const degree: Record<string, number> = {}
  data.edges.forEach(e => {
    degree[e.source] = (degree[e.source] ?? 0) + 1
    degree[e.target] = (degree[e.target] ?? 0) + 1
  })

  const nodes = data.nodes.map(n => ({
    id: n.id,
    key: n.key,
    name: nodeDisplayName(n.label, n.key, n.name),
    label: n.label,
    color: NODE_COLORS[n.label] ?? NODE_COLOR_FALLBACK,
    degree: degree[n.id] ?? 0,
    val: n.id === centerId
      ? FG2D_NODE.centerVal
      : Math.max(FG2D_NODE.minVal, Math.min((degree[n.id] ?? 1) * FG2D_NODE.valPerDegree, FG2D_NODE.maxVal)),
  }))

  const links = data.edges.map(e => ({
    source: e.source,
    target: e.target,
    type: e.type,
    color: LINK_COLORS[e.type] ?? LINK_COLOR_FALLBACK,
  }))

  return { nodes, links }
}

// ── Shared graph renderer ─────────────────────────────────────────────────────

interface BaseGraphProps {
  centerId: string
  loading: boolean
  error?: string | null
  graphData: { nodes: any[]; links: any[] } | null
  /** Receives the prefixed graph node id ("series:1399"). */
  onNodeClick?: (id: string, label: string) => void
  className?: string
}

function BaseGraph({ centerId, loading, error, graphData, onNodeClick, className }: BaseGraphProps) {
  const router = useRouter()
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const clickStart = useRef<{ x: number; y: number } | null>(null)
  const fittedRef = useRef(false)
  const [hoveredNode, setHoveredNode] = useState<any>(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })
  const [fullscreen, setFullscreen] = useState(false)

  // Exit fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // Re-fit the graph after the canvas resizes on entering/leaving fullscreen.
  useEffect(() => {
    if (!graphData) return
    const t = setTimeout(() => fgRef.current?.zoomToFit(300, 40), 150)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        if (w > 0 && h > 0) setDims({ width: Math.floor(w), height: Math.floor(h) })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!fgRef.current || !graphData) return
    fittedRef.current = false
    fgRef.current.d3Force('charge')?.strength(FG2D_PHYSICS.chargeStrength)
    fgRef.current.d3Force('link')?.distance(FG2D_PHYSICS.linkDistance).strength(FG2D_PHYSICS.linkStrength)
  }, [graphData])

  const navigateToNode = useCallback((node: any, newTab: boolean) => {
    if (onNodeClick) { onNodeClick(node.id, node.label); return }
    let href: string | null = null
    if (node.label === 'Series') href = `/series/${node.key}`
    else if (node.label === 'Person') href = `/person/${node.key}`
    if (!href) return
    if (newTab) window.open(href, '_blank')
    else router.push(href)
  }, [onNodeClick, router])

  // Own click hit-testing on the canvas. force-graph's onNodeClick only fires when
  // a node is "hovered" at pointer-up, which never happens on touch (no hover before
  // a tap) — so taps on nodes were ignored. We map the click to graph coords and pick
  // the nearest node ourselves, which works for both mouse and touch.
  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    clickStart.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onCanvasClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target || target.tagName !== 'CANVAS') return
    const start = clickStart.current
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return // drag / pan, not a tap
    const fg = fgRef.current
    const cont = containerRef.current
    if (!fg || !cont || !graphData) return
    const rect = cont.getBoundingClientRect()
    const pt = fg.screen2GraphCoords(e.clientX - rect.left, e.clientY - rect.top)
    if (!pt) return
    let best: any = null
    let bestD = Infinity
    for (const n of graphData.nodes) {
      if (n.x == null || n.y == null) continue
      const r = Math.sqrt(n.val ?? 1) * FG2D_NODE.radiusMult + 6
      const d = Math.hypot(n.x - pt.x, n.y - pt.y)
      if (d <= r && d < bestD) { bestD = d; best = n }
    }
    if (best) navigateToNode(best, e.ctrlKey || e.metaKey)
  }, [graphData, navigateToNode])

  const handleNodeDragEnd = useCallback((node: any) => {
    node.fx = undefined
    node.fy = undefined
    fgRef.current?.d3ReheatSimulation?.()
  }, [])

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const r = Math.sqrt(node.val ?? 1) * FG2D_NODE.radiusMult
    const isHovered = hoveredNode?.id === node.id
    const isCenter = node.id === centerId

    let dimmed = false
    if (hoveredNode && !isHovered && !isCenter) {
      const links = graphData?.links ?? []
      const connected = links.some(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        return (src === hoveredNode.id && tgt === node.id) ||
               (tgt === hoveredNode.id && src === node.id)
      })
      if (!connected) dimmed = true
    }

    const alpha = dimmed ? FG2D_NODE.dimmedAlpha : 1.0

    if (isCenter || isHovered) {
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + FG2D_NODE.glowRadius, 0, 2 * Math.PI)
      ctx.fillStyle = isCenter ? FG2D_COLORS.centerGlow : FG2D_COLORS.hoverGlow
      ctx.fill()
    }

    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = node.color
    ctx.fill()

    if (isHovered) {
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + FG2D_NODE.hoverOutlineExtra, 0, 2 * Math.PI)
      ctx.strokeStyle = FG2D_COLORS.hoverStroke
      ctx.lineWidth = FG2D_NODE.hoverStrokeWidth
      ctx.stroke()
    }

    if (!dimmed) {
      const label = node.name.length > FG2D_NODE.labelMaxChars
        ? node.name.slice(0, FG2D_NODE.labelMaxChars - 2) + '…'
        : node.name
      const fontSize = isCenter ? FG2D_NODE.labelFontCenter : FG2D_NODE.labelFontDefault
      ctx.globalAlpha = 1
      ctx.font = `${fontSize}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      const tw = ctx.measureText(label).width
      const tx = node.x
      const ty = node.y + r + 1.5

      ctx.fillStyle = FG2D_COLORS.labelBg
      ctx.fillRect(tx - tw / 2 - 1, ty, tw + 2, fontSize + 1.5)
      ctx.fillStyle = isCenter ? FG2D_COLORS.labelCenter : isHovered ? FG2D_COLORS.labelHovered : FG2D_COLORS.labelDefault
      ctx.fillText(label, tx, ty + 0.5)
    }

    ctx.globalAlpha = 1
  }, [hoveredNode, centerId, graphData])

  // Explicit hit area — required because custom node painting uses 'replace' mode,
  // which otherwise leaves nodes with no clickable/tappable region.
  const paintNodePointerArea = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const r = Math.sqrt(node.val ?? 1) * FG2D_NODE.radiusMult + 4
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
    ctx.fill()
  }, [])

  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const src = typeof link.source === 'object' ? link.source : { x: 0, y: 0 }
    const tgt = typeof link.target === 'object' ? link.target : { x: 0, y: 0 }

    let alpha = 1
    if (hoveredNode) {
      const srcId = typeof link.source === 'object' ? link.source.id : link.source
      const tgtId = typeof link.target === 'object' ? link.target.id : link.target
      const connected = srcId === hoveredNode.id || tgtId === hoveredNode.id
      alpha = connected ? FG2D_LINK.connectedAlpha : FG2D_LINK.dimmedAlpha
    }

    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(src.x, src.y)
    ctx.lineTo(tgt.x, tgt.y)
    ctx.strokeStyle = link.color ?? LINK_COLOR_FALLBACK
    ctx.lineWidth = hoveredNode && alpha === 1 ? FG2D_LINK.hoverWidth : FG2D_LINK.normalWidth
    ctx.stroke()
    ctx.globalAlpha = 1
  }, [hoveredNode])

  if (loading) return (
    <div ref={containerRef} className={cn('flex items-center justify-center text-slate-600 text-xs font-mono w-full h-full', className)}>
      loading graph…
    </div>
  )

  if (error) return (
    <div ref={containerRef} role="alert" className={cn('flex items-center justify-center text-red-400 text-xs font-mono w-full h-full text-center px-4', className)}>
      {error}
    </div>
  )

  if (!graphData) return (
    <div ref={containerRef} className={cn('flex items-center justify-center text-slate-600 text-xs font-mono w-full h-full', className)}>
      no graph data
    </div>
  )

  return (
    <div
      ref={containerRef}
      onPointerDown={onCanvasPointerDown}
      onClick={onCanvasClick}
      className={cn(
        'graph-canvas relative',
        fullscreen ? 'fixed inset-0 z-[60] bg-slate-950' : 'w-full h-full',
        className,
      )}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="transparent"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={paintNodePointerArea}
        nodeLabel={() => ''}
        linkCanvasObject={paintLink}
        linkCanvasObjectMode={() => 'replace'}
        width={dims.width}
        height={dims.height}
        onNodeHover={(node: any) => setHoveredNode(node)}
        onNodeDragEnd={handleNodeDragEnd}
        onEngineStop={() => {
          if (fittedRef.current) return
          fittedRef.current = true
          fgRef.current?.zoomToFit(400, 40)
        }}
        cooldownTicks={FG2D_PHYSICS.cooldownTicks}
        d3AlphaDecay={FG2D_PHYSICS.alphaDecay}
        d3VelocityDecay={FG2D_PHYSICS.velocityDecay}
        enableZoomInteraction
        enableNodeDrag
      />

      {/* Fullscreen toggle */}
      <button
        onClick={() => setFullscreen(f => !f)}
        title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
        aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
      >
        {fullscreen
          ? <Minimize2 className="w-4 h-4" strokeWidth={1.75} />
          : <Maximize2 className="w-4 h-4" strokeWidth={1.75} />}
      </button>
    </div>
  )
}

// ── SeriesGraph ───────────────────────────────────────────────────────────────

interface SeriesGraphProps {
  seriesId: string | number   // tmdb_id
  depth?: 1 | 2
  width?: number
  height?: number
  onNodeClick?: (id: string, label: string) => void
  className?: string
}

export function SeriesGraph({ seriesId, depth = 1, onNodeClick, className }: SeriesGraphProps) {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setGraphData(null)

    api.seriesGraph(seriesId, depth)
      .catch(e => {
        if (depth === 2) return api.seriesGraph(seriesId, 1)
        return Promise.reject(e)
      })
      .then(data => setGraphData(buildGraphData(data, nodeId('Series', seriesId))))
      .catch(e => setError(failureMessage('Loading graph', e)))
      .finally(() => setLoading(false))
  }, [seriesId, depth])

  return (
    <BaseGraph
      centerId={nodeId('Series', seriesId)}
      loading={loading}
      error={error}
      graphData={graphData}
      onNodeClick={onNodeClick}
      className={className}
    />
  )
}

// ── PersonGraph ───────────────────────────────────────────────────────────────

interface PersonGraphProps {
  personId: string | number   // person_id
  onNodeClick?: (id: string, label: string) => void
  className?: string
}

export function PersonGraph({ personId, onNodeClick, className }: PersonGraphProps) {
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setGraphData(null)

    api.personGraph(personId)
      .then(data => setGraphData(buildGraphData(data, nodeId('Person', personId))))
      .catch(e => setError(failureMessage('Loading graph', e)))
      .finally(() => setLoading(false))
  }, [personId])

  return (
    <BaseGraph
      centerId={nodeId('Person', personId)}
      loading={loading}
      error={error}
      graphData={graphData}
      onNodeClick={onNodeClick}
      className={className}
    />
  )
}
