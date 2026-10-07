'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { api, failureMessage } from '@/lib/api'
import type { SeriesResult } from '@/lib/types'
import { cn, formatScore } from '@/lib/utils'
import { SeriesGraph, GraphLegend } from '@/components/SeriesGraph'
import { ResizablePanel } from '@/components/ResizablePanel'
import { PANEL_SIZES, TOAST_DURATION_MS } from '@/lib/constants'
import { CollapsibleTopBar } from '@/components/CollapsibleTopBar'
import { useExploreList, toggleExploreList, seriesItem } from '@/lib/exploreStore'
import { nodeId } from '@/lib/nodeId'
import { useIsMobile } from '@/lib/useIsMobile'

type Strategy = 'semantic' | 'hybrid'

function SimilarityBadge({ result, strategy }: { result: SeriesResult; strategy: Strategy }) {
  // Candidates added from the graph (source "graph") carry a weighted overlap count, not a cosine score.
  if (result.source === 'graph') {
    return (
      <span className="font-mono text-xs text-slate-500">
        graph overlap {result.score.toFixed(1)}
      </span>
    )
  }
  if (strategy === 'semantic') {
    return (
      <span className="font-mono text-xs text-violet-400">
        {formatScore(result.score, 'semantic')} semantic match
      </span>
    )
  }
  // Hybrid: cosine similarity plus bonuses for shared cast and countries, so it can exceed 1.
  const parts: string[] = []
  if (result.score > 0) parts.push(`hybrid score ${formatScore(result.score, 'hybrid')}`)
  if (result.shared_actors) parts.push(`${result.shared_actors} shared actors`)
  if (result.shared_countries) parts.push(`${result.shared_countries} shared countries`)
  return (
    <span className="font-mono text-xs text-slate-500">
      {parts.length ? parts.join(' · ') : 'similar'}
    </span>
  )
}

function SimilarCard({
  result, index, selected, inExplore, onClick, onToggle, strategy,
}: {
  result: SeriesResult; index: number; selected: boolean; inExplore: boolean
  onClick: () => void; onToggle: () => void; strategy: Strategy
}) {
  const years = [result.start_year, result.end_year].filter(Boolean).join('–')
  return (
    <div
      className={cn(
        'w-full text-left border-b border-slate-800 transition-colors border-l-2',
        selected ? 'bg-violet-950/40 border-l-violet-500' : 'hover:bg-slate-900/60 border-l-transparent',
      )}
    >
      <button onClick={onClick} className="w-full text-left px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-semibold text-slate-100 leading-tight">{result.name}</span>
          <span className="font-mono text-xs text-slate-600 shrink-0">#{index + 1}</span>
        </div>
        {years && <p className="font-mono text-xs text-slate-500 mb-1">{years}</p>}
        <SimilarityBadge result={result} strategy={strategy} />
        {result.overview && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1">{result.overview}</p>
        )}
      </button>
      <div className="px-4 pb-2">
        <button
          onClick={e => { e.stopPropagation(); onToggle() }}
          className={cn(
            'font-mono text-xs px-2 py-0.5 border rounded transition-colors',
            inExplore
              ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
              : 'border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-500',
          )}
        >
          {inExplore ? '✓ explore' : '+ explore'}
        </button>
      </div>
    </div>
  )
}

export default function SimilarPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [results, setResults] = useState<SeriesResult[]>([])
  const [selected, setSelected] = useState<number | null>(null)  // tmdb_id
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [strategy, setStrategy] = useState<Strategy>('hybrid')
  const [sourceName, setSourceName] = useState<string>('')
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const exploreList = useExploreList()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!id) return
    api.series(id)
      .then(s => setSourceName(s.name))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.similar(id, strategy)
      .then(res => {
        setResults(res.results)
        setSelected(res.results[0]?.tmdb_id ?? null)
      })
      .catch(e => { setResults([]); setError(failureMessage('Loading similar series', e)) })
      .finally(() => setLoading(false))
  }, [id, strategy])

  // Close detail when strategy changes so the list is visible while reloading
  useEffect(() => {
    setMobileShowDetail(false)
  }, [strategy])

  function handleToggleExplore(s: SeriesResult) {
    const added = toggleExploreList(seriesItem(s.tmdb_id, s.name))
    toast.success(
      added ? `Added "${s.name}" to explore` : `Removed "${s.name}" from explore`,
      { duration: TOAST_DURATION_MS },
    )
  }

  // Filters row — rendered as plain content on mobile (non-sticky, non-collapsible)
  const filtersRow = (strategy: Strategy, setStrategy: (s: Strategy) => void) => (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
      <Link
        href={`/series/${id}`}
        className="flex-1 font-mono text-xs text-slate-500 hover:text-violet-400 transition-colors truncate"
      >
        ← {sourceName || id}
      </Link>
      <span className="font-mono text-xs text-slate-700 shrink-0">/</span>
      <span className="font-mono text-xs text-slate-300 shrink-0">similar</span>
      <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded p-0.5 shrink-0">
        {(['semantic', 'hybrid'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            className={cn(
              'font-mono text-xs px-2.5 py-1 rounded transition-colors',
              strategy === s ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-100',
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )

  // ── Mobile: master-detail ──────────────────────────────────
  if (isMobile) {
    // Detail view
    if (mobileShowDetail && selected) {
      const s = results.find(r => r.tmdb_id === selected)
      if (s) {
        const inExplore = exploreList.some(item => item.id === nodeId('Series', s.tmdb_id))
        const years = [s.start_year, s.end_year].filter(Boolean).join('–')
        return (
          <div className="h-[calc(100vh-3rem)] flex flex-col bg-slate-950">
            {/* Back button */}
            <button
              onClick={() => setMobileShowDetail(false)}
              className="shrink-0 h-10 flex items-center gap-2 px-4 border-b border-slate-800 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span className="font-mono text-sm">←</span>
              <span className="font-mono text-xs uppercase tracking-wider">back to results</span>
            </button>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* 2-col header: name/meta left, stacked buttons right */}
              <div className="flex gap-3 px-4 py-4 border-b border-slate-800">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-slate-100 leading-snug">{s.name}</h2>
                  {years && <p className="font-mono text-xs text-slate-500 mt-0.5">{years}</p>}
                  <div className="mt-1">
                    <SimilarityBadge result={s} strategy={strategy} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 w-32">
                  <button
                    onClick={() => handleToggleExplore(s)}
                    className={cn(
                      'w-full font-mono text-xs py-1.5 border rounded transition-colors text-center',
                      inExplore
                        ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400',
                    )}
                  >
                    {inExplore ? '✓ explore' : '+ explore'}
                  </button>
                  <Link
                    href={`/similar/${s.tmdb_id}`}
                    className="w-full font-mono text-xs py-1.5 border border-slate-700 rounded text-slate-400 hover:border-slate-500 hover:text-slate-100 transition-colors text-center"
                  >
                    its similar →
                  </Link>
                  <Link
                    href={`/series/${s.tmdb_id}`}
                    className="w-full font-mono text-xs py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors text-center"
                  >
                    full page →
                  </Link>
                </div>
              </div>

              {/* Graph */}
              <div className="relative h-64">
                <div className="absolute inset-0">
                  <SeriesGraph seriesId={s.tmdb_id} />
                </div>
                <GraphLegend labels={['Series', 'Person', 'Genre', 'Keyword', 'Network', 'Country', 'Language']} />
              </div>

              {/* Summary below graph */}
              {s.overview && (
                <div className="px-4 py-4 border-t border-slate-800">
                  <p className="text-sm text-slate-400 leading-relaxed">{s.overview}</p>
                </div>
              )}
            </div>
          </div>
        )
      }
    }

    // List view
    return (
      <div className="h-[calc(100vh-3rem)] flex flex-col">
        {filtersRow(strategy, setStrategy)}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">searching…</div>
          )}
          {!loading && error && (
            <div role="alert" className="p-8 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <p className="text-slate-400 text-sm">No similar series found</p>
              <p className="text-slate-600 text-xs font-mono">Try switching to hybrid mode or check back later</p>
            </div>
          )}
          {results.map((s, i) => (
            <SimilarCard
              key={s.tmdb_id}
              result={s}
              index={i}
              selected={selected === s.tmdb_id}
              inExplore={exploreList.some(item => item.id === nodeId('Series', s.tmdb_id))}
              strategy={strategy}
              onClick={() => { setSelected(s.tmdb_id); setMobileShowDetail(true) }}
              onToggle={() => handleToggleExplore(s)}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── Desktop layout ─────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">

      {/* Top bar */}
      <CollapsibleTopBar persistKey="similar-top" label="filters">
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <Link
            href={`/series/${id}`}
            className="font-mono text-xs text-slate-500 hover:text-violet-400 transition-colors truncate"
          >
            ← {sourceName || id}
          </Link>
          <span className="font-mono text-xs text-slate-700 shrink-0">/</span>
          <span className="font-mono text-xs text-slate-300 shrink-0">similar</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md p-1 shrink-0">
          {(['semantic', 'hybrid'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={cn(
                'font-mono text-xs px-3 py-1 rounded transition-colors',
                strategy === s ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-100',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </CollapsibleTopBar>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: results list — resizable + collapsible */}
        <ResizablePanel side="left" persistKey="similar-results" defaultWidth={PANEL_SIZES.similarResults.defaultWidth} minWidth={PANEL_SIZES.similarResults.minWidth} maxWidth={PANEL_SIZES.similarResults.maxWidth} collapsedLabel="results" mobileDefaultOpen>
          <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              searching…
            </div>
          )}
          {!loading && error && (
            <div role="alert" className="p-8 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <div className="p-8 text-center space-y-2">
              <p className="text-slate-400 text-sm">No similar series found</p>
              <p className="text-slate-600 text-xs font-mono">
                Try switching to hybrid mode or check back later
              </p>
            </div>
          )}
          {results.map((s, i) => (
            <SimilarCard
              key={s.tmdb_id}
              result={s}
              index={i}
              selected={selected === s.tmdb_id}
              inExplore={exploreList.some(item => item.id === nodeId('Series', s.tmdb_id))}
              strategy={strategy}
              onClick={() => setSelected(s.tmdb_id)}
              onToggle={() => handleToggleExplore(s)}
            />
          ))}
          </div>
        </ResizablePanel>

        {/* Right: graph of selected result */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              {(() => {
                const s = results.find(r => r.tmdb_id === selected)
                if (!s) return null
                const inExplore = exploreList.some(item => item.id === nodeId('Series', s.tmdb_id))
                return (
                  <div className="border-b border-slate-800 px-6 py-4 flex items-start justify-between gap-4 shrink-0">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-slate-100 truncate">{s.name}</h2>
                      <p className="font-mono text-xs text-slate-500 mt-0.5">
                        {[s.start_year, s.end_year].filter(Boolean).join('–')}
                        {s.episode_count ? ` · ${s.episode_count} ep.` : ''}
                      </p>
                      <div className="mt-1">
                        <SimilarityBadge result={s} strategy={strategy} />
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleExplore(s)}
                        className={cn(
                          'font-mono text-xs px-3 py-1.5 border rounded transition-colors',
                          inExplore
                            ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                            : 'border-slate-700 hover:border-emerald-500 hover:text-emerald-400',
                        )}
                      >
                        {inExplore ? '✓ explore' : '+ explore'}
                      </button>
                      <Link
                        href={`/similar/${selected}`}
                        className="font-mono text-xs px-3 py-1.5 border border-slate-700 rounded hover:border-slate-500 hover:text-slate-100 transition-colors"
                      >
                        its similar →
                      </Link>
                      <Link
                        href={`/series/${selected}`}
                        className="font-mono text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors"
                      >
                        full page →
                      </Link>
                    </div>
                  </div>
                )
              })()}

              <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0">
                  <SeriesGraph seriesId={selected} />
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-800 shrink-0">
                <GraphLegend labels={['Series', 'Person', 'Genre', 'Keyword', 'Network', 'Country', 'Language']} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-sm">
              select a series to see its graph
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
