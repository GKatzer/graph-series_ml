'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { api, failureMessage } from '@/lib/api'
import type { SeriesDetail } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SeriesGraph, GraphLegend, LinkLegend } from '@/components/SeriesGraph'
import { ResizablePanel } from '@/components/ResizablePanel'
import { PANEL_SIZES, TOAST_DURATION_MS, TMDB_IMAGE_BASE, TMDB_TV_URL } from '@/lib/constants'
import {
  useExploreList,
  toggleExploreList,
  seriesItem,
  personItem,
  type ExploreItem,
} from '@/lib/exploreStore'
import { nodeId, nodeDisplayName } from '@/lib/nodeId'
import { useIsMobile } from '@/lib/useIsMobile'

const KEYWORDS_COLLAPSED = 20
const ACTORS_COLLAPSED = 20

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-800 pt-4">
      <h2 className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-3">{title}</h2>
      {children}
    </div>
  )
}

function PersonBadge({
  personId, name, inExplore, onToggle,
}: {
  personId: number; name: string; inExplore: boolean; onToggle: () => void
}) {
  return (
    <div className="inline-flex items-stretch font-mono text-xs border border-slate-700 rounded overflow-hidden hover:border-slate-600 transition-colors">
      <Link
        href={`/person/${personId}`}
        className="px-1.5 py-0.5 text-slate-400 hover:text-violet-400 transition-colors"
      >
        {name}
      </Link>
      <button
        onClick={onToggle}
        className={cn(
          'px-1 py-0.5 border-l border-slate-700 transition-colors',
          inExplore ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400',
        )}
        title={inExplore ? 'Remove from explore list' : 'Add to explore list'}
      >
        {inExplore ? '✓' : '+'}
      </button>
    </div>
  )
}

// Badge that can be added to the explore list. Without `onToggle` (node id not known yet)
// it degrades to a plain badge.
function ExplorableBadge({
  name, inExplore, onToggle,
}: {
  name: string; inExplore?: boolean; onToggle?: () => void
}) {
  if (!onToggle) {
    return (
      <span className="inline-block font-mono text-xs px-2 py-0.5 rounded border border-slate-700 text-slate-400">
        {name}
      </span>
    )
  }
  return (
    <div className="inline-flex items-stretch font-mono text-xs border border-slate-700 rounded overflow-hidden hover:border-slate-600 transition-colors">
      <span className="px-2 py-0.5 text-slate-400">{name}</span>
      <button
        onClick={onToggle}
        className={cn(
          'px-1 py-0.5 border-l border-slate-700 transition-colors',
          inExplore ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400',
        )}
        title={inExplore ? 'Remove from explore list' : 'Add to explore list'}
      >
        {inExplore ? '✓' : '+'}
      </button>
    </div>
  )
}

interface ExploreProps {
  isInExplore: (id: string) => boolean
  onToggle: (item: ExploreItem) => void
}

// Rating / status line + link out to TMDB (page link is part of TMDB attribution).
function TmdbMeta({ series }: { series: SeriesDetail }) {
  const rated = series.vote_count ? series.vote_average : null
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-xs text-slate-500 mt-1">
      {rated != null && <span>★ {rated.toFixed(1)} ({series.vote_count})</span>}
      {series.status && <span>{series.status.toLowerCase()}</span>}
      <a
        href={`${TMDB_TV_URL}/${series.tmdb_id}`}
        target="_blank"
        rel="noreferrer"
        className="text-slate-600 hover:text-violet-400 transition-colors"
      >
        TMDB ↗
      </a>
    </div>
  )
}

function Overview({ series }: { series: SeriesDetail }) {
  if (!series.overview && !series.tagline && !series.poster_path) return null
  return (
    <div className="flex gap-3">
      {series.poster_path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${TMDB_IMAGE_BASE}/w185${series.poster_path}`}
          alt=""
          loading="lazy"
          className="shrink-0 w-16 h-24 object-cover rounded border border-slate-800"
        />
      )}
      <div className="min-w-0 space-y-1.5">
        {series.tagline && (
          <p className="text-slate-500 text-xs italic leading-relaxed">{series.tagline}</p>
        )}
        {series.overview && (
          <p className="text-slate-400 text-xs leading-relaxed">{series.overview}</p>
        )}
      </div>
    </div>
  )
}

// Genres, keywords, networks, countries, languages.
// keywordNodeIds: keyword name → graph node id (the detail endpoint returns names only).
function FacetSections({
  series, keywordNodeIds, isInExplore, onToggle,
}: ExploreProps & { series: SeriesDetail; keywordNodeIds: Map<string, string> }) {
  const [showAllKeywords, setShowAllKeywords] = useState(false)
  const keywords = showAllKeywords ? series.keywords : series.keywords.slice(0, KEYWORDS_COLLAPSED)

  return (
    <>
      {series.genres.length > 0 && (
        <Section title="Genres">
          <div className="flex flex-wrap gap-1.5">
            {series.genres.map(g => (
              <span key={g} className="inline-block font-mono text-xs px-2 py-0.5 rounded border border-slate-700 text-slate-400">
                {g}
              </span>
            ))}
          </div>
        </Section>
      )}

      {series.keywords.length > 0 && (
        <Section title="Keywords">
          <div className="flex flex-wrap gap-1.5">
            {keywords.map(k => {
              const id = keywordNodeIds.get(k)
              return (
                <ExplorableBadge
                  key={k} name={k}
                  inExplore={id ? isInExplore(id) : false}
                  onToggle={id ? () => onToggle({ id, name: k, type: 'keyword' }) : undefined}
                />
              )
            })}
          </div>
          {series.keywords.length > KEYWORDS_COLLAPSED && (
            <button
              onClick={() => setShowAllKeywords(v => !v)}
              className="mt-2 font-mono text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              {showAllKeywords ? 'show less' : `+${series.keywords.length - KEYWORDS_COLLAPSED} more`}
            </button>
          )}
        </Section>
      )}

      {series.networks.length > 0 && (
        <Section title="Networks">
          <div className="flex flex-wrap gap-1.5">
            {series.networks.map(n => {
              const id = nodeId('Network', n.network_id)
              return (
                <ExplorableBadge
                  key={n.network_id} name={n.name}
                  inExplore={isInExplore(id)}
                  onToggle={() => onToggle({ id, name: n.name, type: 'network' })}
                />
              )
            })}
          </div>
        </Section>
      )}

      {series.countries.length > 0 && (
        <Section title="Countries">
          <div className="flex flex-wrap gap-1.5">
            {series.countries.map(code => {
              const id = nodeId('Country', code)
              const name = nodeDisplayName('Country', code, code)
              return (
                <ExplorableBadge
                  key={code} name={name}
                  inExplore={isInExplore(id)}
                  onToggle={() => onToggle({ id, name, type: 'country' })}
                />
              )
            })}
          </div>
        </Section>
      )}

      {series.languages.length > 0 && (
        <Section title="Languages">
          <div className="flex flex-wrap gap-1.5">
            {series.languages.map(code => {
              const id = nodeId('Language', code)
              const name = nodeDisplayName('Language', code, code)
              return (
                <ExplorableBadge
                  key={code} name={name}
                  inExplore={isInExplore(id)}
                  onToggle={() => onToggle({ id, name, type: 'language' })}
                />
              )
            })}
          </div>
        </Section>
      )}
    </>
  )
}

function CastAndCrew({
  series, actors, isInExplore, onToggle,
}: ExploreProps & { series: SeriesDetail; actors: Array<{ person_id: number; name: string }> }) {
  const [showAllActors, setShowAllActors] = useState(false)
  const visibleActors = showAllActors ? actors : actors.slice(0, ACTORS_COLLAPSED)

  const badge = (p: { person_id: number; name: string }) => (
    <PersonBadge
      key={p.person_id} personId={p.person_id} name={p.name}
      inExplore={isInExplore(nodeId('Person', p.person_id))}
      onToggle={() => onToggle(personItem(p.person_id, p.name))}
    />
  )

  return (
    <Section title="Cast & Crew">
      <div className="space-y-4">
        {series.creators.length > 0 && (
          <div>
            <p className="font-mono text-xs text-slate-600 mb-1.5">Creators</p>
            <div className="flex flex-wrap gap-1.5">{series.creators.map(badge)}</div>
          </div>
        )}
        {series.directors.length > 0 && (
          <div>
            <p className="font-mono text-xs text-slate-600 mb-1.5">Directors</p>
            <div className="flex flex-wrap gap-1.5">{series.directors.map(badge)}</div>
          </div>
        )}
        {actors.length > 0 && (
          <div>
            <p className="font-mono text-xs text-slate-600 mb-1.5">
              Actors{series.cast_count != null ? ` (${series.cast_count} total)` : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">{visibleActors.map(badge)}</div>
            {actors.length > ACTORS_COLLAPSED && (
              <button
                onClick={() => setShowAllActors(v => !v)}
                className="mt-2 font-mono text-xs text-slate-600 hover:text-slate-400 transition-colors"
              >
                {showAllActors ? 'show less' : `+${actors.length - ACTORS_COLLAPSED} more`}
              </button>
            )}
          </div>
        )}
        {actors.length === 0 && series.cast_count != null && (
          <p className="font-mono text-xs text-slate-600">{series.cast_count} actors</p>
        )}
      </div>
    </Section>
  )
}

export default function SeriesPage() {
  const { id } = useParams<{ id: string }>()   // tmdb_id
  const router = useRouter()
  const searchParams = useSearchParams()
  const [series, setSeries] = useState<SeriesDetail | null>(null)
  const [actors, setActors] = useState<Array<{ person_id: number; name: string }>>([])
  const [keywordNodeIds, setKeywordNodeIds] = useState<Map<string, string>>(new Map())
  const [depth, setDepth] = useState<1 | 2>(() => searchParams.get('depth') === '2' ? 2 : 1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const exploreList = useExploreList()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (series) document.title = `${series.name} – Graph Page`
  }, [series])

  function handleDepthChange(d: 1 | 2) {
    setDepth(d)
    router.replace(`/series/${id}?depth=${d}`, { scroll: false })
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    api.series(id)
      .then(setSeries)
      .catch(e => setLoadError(failureMessage('Loading series', e)))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    const sid = nodeId('Series', id)
    api.seriesGraph(id, 1)
      .then(data => {
        const actorIds = new Set<string>()
        data.edges.forEach(e => {
          if (e.type === 'ACTED_IN') {
            if (e.target === sid) actorIds.add(e.source)
            else if (e.source === sid) actorIds.add(e.target)
          }
        })
        setActors(
          data.nodes
            .filter(n => actorIds.has(n.id) && n.label === 'Person')
            .map(n => ({ person_id: Number(n.key), name: n.name })),
        )

        const kMap = new Map<string, string>()
        data.nodes.forEach(n => {
          if (n.label === 'Keyword') kMap.set(n.name, n.id)
        })
        setKeywordNodeIds(kMap)
      })
      .catch(e => toast.error(failureMessage('Loading actors and keywords', e)))
  }, [id])

  const handleToggleExplore = (item: ExploreItem) => {
    const added = toggleExploreList(item)
    toast.success(added ? `Added "${item.name}"` : `Removed "${item.name}"`, { duration: TOAST_DURATION_MS })
  }

  const isInExplore = (itemId: string) => exploreList.some(i => i.id === itemId)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-slate-500 font-mono text-sm">
      loading…
    </div>
  )

  if (loadError || !series) return (
    <div role="alert" className="min-h-screen flex items-center justify-center text-red-400 font-mono text-sm px-4 text-center">
      {loadError ?? 'Not found'}
    </div>
  )

  const years = [series.start_year, series.end_year].filter(Boolean).join('–')
  const seriesInExplore = isInExplore(nodeId('Series', id))
  const exploreProps: ExploreProps = { isInExplore, onToggle: handleToggleExplore }

  // ── Mobile: flat scrollable layout ────────────────────────
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-3rem)] overflow-y-auto">

        {/* 2-col header: name/meta left, stacked buttons right */}
        <div className="flex gap-3 px-4 py-4 border-b border-slate-800">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-50 leading-snug">{series.name}</h1>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-xs text-slate-500 mt-1">
              {years && <span>{years}</span>}
              {series.episode_count && <span>{series.episode_count} ep.</span>}
              {series.season_count && <span>{series.season_count} s.</span>}
            </div>
            <TmdbMeta series={series} />
          </div>
          <div className="flex flex-col gap-1.5 shrink-0 w-32">
            <button
              onClick={() => handleToggleExplore(seriesItem(id, series.name))}
              className={cn(
                'w-full font-mono text-xs py-1.5 border rounded transition-colors text-center',
                seriesInExplore
                  ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                  : 'border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400',
              )}
            >
              {seriesInExplore ? '✓ explore' : '+ explore'}
            </button>
            <Link
              href={`/similar/${id}`}
              className="w-full font-mono text-xs py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors text-center"
            >
              similar →
            </Link>
          </div>
        </div>

        {/* Depth toggle */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
          <span className="font-mono text-xs text-slate-600">graph</span>
          <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded p-0.5">
            {([1, 2] as const).map(d => (
              <button
                key={d}
                onClick={() => handleDepthChange(d)}
                className={cn(
                  'font-mono text-xs px-2.5 py-1 rounded transition-colors',
                  depth === d ? 'bg-violet-600 text-white' : 'text-slate-400',
                )}
              >
                depth {d}
              </button>
            ))}
          </div>
        </div>

        {/* Graph */}
        <div className="relative h-64">
          <div className="absolute inset-0">
            <SeriesGraph seriesId={id} depth={depth} />
          </div>
        </div>

        {/* Legends */}
        <div className="px-4 py-3 border-t border-slate-800 space-y-2">
          <GraphLegend labels={['Series', 'Person', 'Genre', 'Keyword', 'Network', 'Country', 'Language']} />
          <LinkLegend />
        </div>

        {/* Info below graph */}
        <div className="px-4 py-5 space-y-4">
          <Overview series={series} />
          <FacetSections series={series} keywordNodeIds={keywordNodeIds} {...exploreProps} />
          <CastAndCrew series={series} actors={actors} {...exploreProps} />
        </div>
      </div>
    )
  }

  // ── Desktop layout ─────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col sm:flex-row overflow-hidden">

      {/* Left: info — resizable + collapsible */}
      <ResizablePanel side="left" persistKey="series-info" defaultWidth={PANEL_SIZES.seriesInfo.defaultWidth} minWidth={PANEL_SIZES.seriesInfo.minWidth} maxWidth={PANEL_SIZES.seriesInfo.maxWidth} collapsedLabel="info" mobileDefaultOpen>
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        <div>
          <div className="flex flex-col gap-2 mb-2">
            <h1 className="text-lg font-bold text-slate-50 leading-tight">{series.name}</h1>
            <div className="flex gap-1.5">
              <Link href={`/similar/${id}`} className="flex-1 font-mono text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors text-center">
                similar →
              </Link>
              <button
                onClick={() => handleToggleExplore(seriesItem(id, series.name))}
                className={cn(
                  'font-mono text-xs px-3 py-1.5 border rounded transition-colors',
                  seriesInExplore
                    ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                    : 'border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400',
                )}
              >
                {seriesInExplore ? '✓ explore' : '+ explore'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-xs text-slate-500">
            {years && <span>{years}</span>}
            {series.episode_count && <span>{series.episode_count} ep.</span>}
            {series.season_count && <span>{series.season_count} s.</span>}
          </div>
          <TmdbMeta series={series} />
          <p className="font-mono text-xs text-slate-700 mt-1">tmdb {id}</p>
        </div>

        <Overview series={series} />
        <FacetSections series={series} keywordNodeIds={keywordNodeIds} {...exploreProps} />
        <CastAndCrew series={series} actors={actors} {...exploreProps} />
        </div>
      </ResizablePanel>

      {/* Right: graph */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <p className="font-mono text-xs text-slate-400">Connections</p>
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded p-0.5">
            {([1, 2] as const).map(d => (
              <button key={d} onClick={() => handleDepthChange(d)} className={cn('font-mono text-xs px-2.5 py-1 rounded transition-colors', depth === d ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-100')}>
                depth {d}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 relative min-h-0">
          <div className="absolute inset-0">
            <SeriesGraph seriesId={id} depth={depth} />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800 shrink-0 space-y-2">
          <GraphLegend labels={['Series', 'Person', 'Genre', 'Keyword', 'Network', 'Country', 'Language']} />
          <LinkLegend />
        </div>
      </div>
    </div>
  )
}
