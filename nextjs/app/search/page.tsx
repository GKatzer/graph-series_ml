'use client'

// app/search/page.tsx

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { api, failureMessage } from '@/lib/api'
import type { SeriesResult, PersonSearchResult, PersonDetail, SearchMode } from '@/lib/types'
import { cn, formatScore } from '@/lib/utils'
import { useExploreList, toggleExploreList, seriesItem, personItem } from '@/lib/exploreStore'
import { nodeId } from '@/lib/nodeId'
import { ResizablePanel } from '@/components/ResizablePanel'
import { TOAST_DURATION_MS, PANEL_SIZES } from '@/lib/constants'
import { CollapsibleTopBar } from '@/components/CollapsibleTopBar'
import { SeriesGraph, GraphLegend, LinkLegend } from '@/components/SeriesGraph'
import { useIsMobile } from '@/lib/useIsMobile'
import { Search } from 'lucide-react'

// ── SeriesCard ────────────────────────────────────────────
function SeriesCard({
  series,
  mode,
  selected,
  inExplore,
  onClick,
  onToggle,
}: {
  series: SeriesResult
  mode: SearchMode
  selected: boolean
  inExplore: boolean
  onClick: () => void
  onToggle: () => void
}) {
  const years = [series.start_year, series.end_year].filter(Boolean).join('–')
  return (
    <div
      className={cn(
        'w-full text-left border-b border-slate-800 transition-colors border-l-2',
        selected ? 'bg-violet-950/40 border-l-violet-500' : 'hover:bg-slate-900/60 border-l-transparent',
      )}
    >
      <button onClick={onClick} className="w-full text-left px-4 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-semibold text-slate-100 leading-tight">{series.name}</span>
          <span
            className="font-mono text-xs text-violet-400 shrink-0"
            title={mode === 'semantic' ? 'cosine similarity' : mode === 'hybrid' ? 'cosine similarity + graph bonuses (can exceed 1)' : 'full-text relevance'}
          >
            {formatScore(series.score, mode)}
          </span>
        </div>
        {years && <p className="font-mono text-xs text-slate-500 mb-1">{years}</p>}
        {series.overview && (
          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{series.overview}</p>
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

// ── PersonCard ────────────────────────────────────────────
function PersonCard({
  person,
  selected,
  inExplore,
  onClick,
  onToggle,
}: {
  person: PersonSearchResult
  selected: boolean
  inExplore: boolean
  onClick: () => void
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'w-full text-left border-b border-slate-800 transition-colors border-l-2',
        selected ? 'bg-violet-950/40 border-l-violet-500' : 'hover:bg-slate-900/60 border-l-transparent',
      )}
    >
      <button onClick={onClick} className="w-full text-left px-4 pt-3.5 pb-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-100">{person.name}</span>
          <span className="font-mono text-xs text-slate-500 shrink-0">{person.series_count} series</span>
        </div>
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

// ── Search modes ──────────────────────────────────────────
type SearchEntity = SearchMode | 'person'

const ENTITY_LABELS: Record<SearchEntity, string> = {
  structural: 'structural',
  semantic:   'semantic',
  hybrid:     'hybrid',
  person:     'person',
}

// ── Mode dropdown (mobile) — inline popover instead of the native full-screen picker ──
function ModeSelect({ entity, setEntity }: { entity: SearchEntity; setEntity: (e: SearchEntity) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 font-mono text-xs text-slate-100"
      >
        {ENTITY_LABELS[entity]}
        <span className={cn('text-[10px] text-slate-500 transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[8rem] bg-slate-900 border border-slate-700 rounded-md shadow-xl overflow-hidden">
          {(Object.keys(ENTITY_LABELS) as SearchEntity[]).map(e => (
            <button
              key={e}
              type="button"
              onClick={() => { setEntity(e); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 font-mono text-xs transition-colors',
                entity === e ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800',
              )}
            >
              {ENTITY_LABELS[e]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const q = searchParams.get('q') ?? ''
  const selParam = searchParams.get('sel')
  const sel = selParam && Number.isFinite(Number(selParam)) ? Number(selParam) : undefined  // tmdb_id

  const [query, setQuery] = useState(q)
  const [entity, setEntity] = useState<SearchEntity>('semantic')

  // Series search state
  const [results, setResults] = useState<SeriesResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  // Person search state
  const [personResults, setPersonResults] = useState<PersonSearchResult[]>([])
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null)
  const [personDetail, setPersonDetail] = useState<PersonDetail | null>(null)
  const [personLoading, setPersonLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const exploreList = useExploreList()

  // Mobile master-detail: the list is the primary view; tapping a card opens a
  // full-screen detail overlay while the list stays mounted (scroll preserved).
  const isMobile = useIsMobile()
  const [detailOpen, setDetailOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the END of a long query visible when the field isn't being edited.
  // Re-apply after web fonts load and next frame, since text width (and thus the
  // scroll extent) is only final once the mono font has painted.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const toEnd = () => { if (document.activeElement !== el) el.scrollLeft = el.scrollWidth }
    toEnd()
    const raf = requestAnimationFrame(toEnd)
    document.fonts?.ready.then(toEnd).catch(() => {})
    return () => cancelAnimationFrame(raf)
  }, [query, q, isMobile])

  // On focus, drop the caret at the end and scroll there.
  const focusToEnd = (el: HTMLInputElement) => {
    const len = el.value.length
    el.setSelectionRange(len, len)
    el.scrollLeft = el.scrollWidth
  }

  useEffect(() => {
    document.title = q ? `${q} – Search` : 'Search'
  }, [q, entity])

  const doSearch = useCallback(async (text: string, e: SearchEntity) => {
    if (!text.trim()) return
    setLoading(true)
    setSearchError(null)
    setResults([])
    setPersonResults([])
    try {
      if (e === 'person') {
        const res = await api.searchPersons(text, 20)
        setPersonResults(res.results)
      } else {
        const res = await api.search(text, 20, e)
        setResults(res.results)
      }
    } catch (err) {
      setSearchError(failureMessage('Search', err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-select first result
  useEffect(() => {
    if (results.length === 0) return
    if (sel && results.find(r => r.tmdb_id === sel)) setSelected(sel)
    else if (!sel) setSelected(results[0]?.tmdb_id ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])

  useEffect(() => {
    if (personResults.length > 0) setSelectedPerson(personResults[0].person_id)
  }, [personResults])

  useEffect(() => {
    setDetailOpen(false)
    if (q) doSearch(q, entity)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, entity])

  // Fetch person detail when person is selected
  useEffect(() => {
    if (!selectedPerson) { setPersonDetail(null); return }
    setPersonLoading(true)
    api.person(selectedPerson)
      .then(setPersonDetail)
      .catch(() => setPersonDetail(null))
      .finally(() => setPersonLoading(false))
  }, [selectedPerson])

  function selectCard(id: number) {
    setSelected(id)
    router.replace(`/search?q=${encodeURIComponent(q)}&sel=${id}`, { scroll: false })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const isPersonMode = entity === 'person'

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">

      {/* Top bar: plain non-collapsible div on mobile, CollapsibleTopBar on desktop */}
      {isMobile ? (
        <div className="border-b border-slate-800 shrink-0 px-3 py-2 flex items-center gap-2">
          <form onSubmit={submit} className="flex-1 min-w-0 flex">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" strokeWidth={1.75} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={e => focusToEnd(e.currentTarget)}
                onClick={e => focusToEnd(e.currentTarget)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                placeholder={isPersonMode ? 'Search person…' : 'Search series…'}
              />
            </div>
          </form>
          <ModeSelect entity={entity} setEntity={setEntity} />
        </div>
      ) : (
        <CollapsibleTopBar persistKey="search-top" label="search">
          <form onSubmit={submit} className="flex-1 min-w-0 flex max-w-2xl">
            <div className="relative flex-1 min-w-0">
              {/* mobile-only search icon */}
              <Search className="md:hidden pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" strokeWidth={1.75} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-md py-1.5 pl-9 pr-3 md:pl-3 md:pr-24 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                placeholder={isPersonMode ? 'Search person…' : 'Search series…'}
              />
              {/* desktop-only submit button, fitted inside the field */}
              <button
                type="submit"
                className="hidden md:block absolute right-1.5 top-1/2 -translate-y-1/2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono px-3 py-1 rounded transition-colors"
              >
                search →
              </button>
            </div>
          </form>

          {/* Mode / entity toggle — tabs on desktop, dropdown on mobile */}
          <div className="hidden md:flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-md p-1">
            {(Object.keys(ENTITY_LABELS) as SearchEntity[]).map(e => (
              <button
                key={e}
                onClick={() => setEntity(e)}
                className={cn(
                  'font-mono text-xs px-3 py-1 rounded transition-colors',
                  entity === e ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-100',
                )}
              >
                {ENTITY_LABELS[e]}
              </button>
            ))}
          </div>
        </CollapsibleTopBar>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Results list */}
        <ResizablePanel
          side="left"
          persistKey="search-results"
          defaultWidth={PANEL_SIZES.searchResults.defaultWidth}
          minWidth={PANEL_SIZES.searchResults.minWidth}
          maxWidth={PANEL_SIZES.searchResults.maxWidth}
          collapsedLabel="results"
          mobileInline
        >
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">searching…</div>
            )}
            {!loading && searchError && (
              <div role="alert" className="p-8 text-center">
                <p className="text-red-400 text-sm">{searchError}</p>
              </div>
            )}
            {!loading && !searchError && isPersonMode && personResults.length === 0 && q && (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm">No persons found for "{q}"</p>
              </div>
            )}
            {!loading && !searchError && !isPersonMode && results.length === 0 && q && (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm mb-2">No results for "{q}"</p>
                <p className="text-slate-600 text-xs font-mono">Try a different query or switch mode</p>
              </div>
            )}

            {isPersonMode
              ? personResults.map(p => (
                  <PersonCard
                    key={p.person_id}
                    person={p}
                    selected={selectedPerson === p.person_id}
                    inExplore={exploreList.some(i => i.id === nodeId('Person', p.person_id))}
                    onClick={() => { setSelectedPerson(p.person_id); setDetailOpen(true) }}
                    onToggle={() => {
                      const added = toggleExploreList(personItem(p.person_id, p.name))
                      toast.success(added ? `Added "${p.name}" to explore` : `Removed "${p.name}" from explore`, { duration: TOAST_DURATION_MS })
                    }}
                  />
                ))
              : results.map(s => (
                  <SeriesCard
                    key={s.tmdb_id}
                    series={s}
                    mode={entity as SearchMode}
                    selected={selected === s.tmdb_id}
                    inExplore={exploreList.some(i => i.id === nodeId('Series', s.tmdb_id))}
                    onClick={() => { selectCard(s.tmdb_id); setDetailOpen(true) }}
                    onToggle={() => {
                      const added = toggleExploreList(seriesItem(s.tmdb_id, s.name))
                      toast.success(added ? `Added "${s.name}" to explore` : `Removed "${s.name}" from explore`, { duration: TOAST_DURATION_MS })
                    }}
                  />
                ))}
          </div>
        </ResizablePanel>

        {/* Right panel — docked column on desktop, full-screen detail overlay on mobile */}
        <div
          className={cn(
            isMobile
              ? detailOpen
                ? 'fixed inset-x-0 top-12 bottom-0 z-40 bg-slate-950 flex flex-col'
                : 'hidden'
              : 'flex-1 flex flex-col overflow-hidden',
          )}
        >
          {isMobile && detailOpen && (
            <button
              onClick={() => setDetailOpen(false)}
              className="shrink-0 h-10 flex items-center gap-2 px-4 border-b border-slate-800 text-slate-300 hover:text-slate-100 transition-colors"
            >
              <span className="font-mono text-sm">←</span>
              <span className="font-mono text-xs uppercase tracking-wider">back to results</span>
            </button>
          )}

          {/* Content area: scrollable on mobile, flex column on desktop */}
          {(!isMobile || detailOpen) && (
            <div className={cn(isMobile ? 'flex-1 overflow-y-auto' : 'flex-1 flex flex-col overflow-hidden')}>
              {isPersonMode ? (
                /* ── Person detail ── */
                selectedPerson && personDetail ? (
                  <>
                    <div className="border-b border-slate-800 px-6 py-4 shrink-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-100">{personDetail.name}</h2>
                          <p className="font-mono text-xs text-slate-500 mt-0.5">
                            {personDetail.series.length} series
                          </p>
                        </div>
                        <Link
                          href={`/person/${personDetail.person_id}`}
                          className="font-mono text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors shrink-0"
                        >
                          page →
                        </Link>
                      </div>
                    </div>
                    <div className={cn('px-6 py-4', !isMobile && 'flex-1 overflow-y-auto')}>
                      <p className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-3">Series</p>
                      <div className="space-y-1">
                        {personDetail.series.map(s => {
                          const inExplore = exploreList.some(i => i.id === nodeId('Series', s.tmdb_id))
                          return (
                            <div key={s.tmdb_id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800/50">
                              <Link
                                href={`/series/${s.tmdb_id}`}
                                className="text-sm text-slate-300 hover:text-violet-400 transition-colors truncate"
                              >
                                {s.name}
                              </Link>
                              <div className="flex items-center gap-2 shrink-0">
                                {s.start_year && (
                                  <span className="font-mono text-xs text-slate-600">{s.start_year}</span>
                                )}
                                <span className="font-mono text-[10px] text-slate-700 border border-slate-800 rounded px-1">
                                  {s.role.toLowerCase()}
                                </span>
                                <button
                                  onClick={() => {
                                    const added = toggleExploreList(seriesItem(s.tmdb_id, s.name))
                                    toast.success(
                                      added ? `Added "${s.name}" to explore` : `Removed "${s.name}" from explore`,
                                      { duration: TOAST_DURATION_MS },
                                    )
                                  }}
                                  className={cn(
                                    'font-mono text-xs px-2 py-0.5 border rounded transition-colors',
                                    inExplore
                                      ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                                      : 'border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-500',
                                  )}
                                >
                                  {inExplore ? '✓' : '+'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : personLoading ? (
                  <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-xs">
                    loading…
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-sm">
                    select a person to see their series
                  </div>
                )
              ) : (
                /* ── Series detail ── */
                selected ? (
                  (() => {
                    const s = results.find(r => r.tmdb_id === selected)
                    if (!s) return null
                    const inExplore = exploreList.some(i => i.id === nodeId('Series', s.tmdb_id))
                    const years = [s.start_year, s.end_year].filter(Boolean).join('–')

                    if (isMobile) {
                      return (
                        <>
                          {/* Mobile: 2-col header */}
                          <div className="flex gap-3 px-4 py-4 border-b border-slate-800">
                            <div className="flex-1 min-w-0">
                              <h2 className="text-base font-semibold text-slate-100 leading-snug">{s.name}</h2>
                              <p className="font-mono text-xs text-slate-500 mt-0.5">
                                {years}{s.episode_count ? ` · ${s.episode_count} ep.` : ''}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0 w-32">
                              <button
                                onClick={() => {
                                  const added = toggleExploreList(seriesItem(s.tmdb_id, s.name))
                                  toast.success(
                                    added ? `Added "${s.name}" to explore` : `Removed "${s.name}" from explore`,
                                    { duration: TOAST_DURATION_MS },
                                  )
                                }}
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
                                href={`/series/${s.tmdb_id}`}
                                className="w-full font-mono text-xs py-1.5 border border-slate-700 rounded text-slate-400 hover:border-violet-500 hover:text-violet-400 transition-colors text-center"
                              >
                                full page →
                              </Link>
                              <Link
                                href={`/similar/${s.tmdb_id}`}
                                className="w-full font-mono text-xs py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors text-center"
                              >
                                similar →
                              </Link>
                            </div>
                          </div>

                          {/* Mobile: graph (fixed height) */}
                          <div className="relative h-64">
                            <div className="absolute inset-0">
                              <SeriesGraph seriesId={selected} />
                            </div>
                            <GraphLegend labels={['Series', 'Person', 'Genre', 'Keyword', 'Network', 'Country', 'Language']} />
                          </div>

                          {/* Mobile: legends + summary below graph */}
                          <div className="px-4 py-3 border-t border-slate-800">
                            <LinkLegend />
                          </div>
                          {s.overview && (
                            <div className="px-4 py-4 border-t border-slate-800/60">
                              <p className="text-sm text-slate-400 leading-relaxed">{s.overview}</p>
                            </div>
                          )}
                        </>
                      )
                    }

                    // Desktop series detail
                    return (
                      <>
                        <div className="border-b border-slate-800 px-6 py-4 shrink-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h2 className="text-lg font-semibold text-slate-100">{s.name}</h2>
                              <p className="font-mono text-xs text-slate-500 mt-0.5">
                                {years}{s.episode_count ? ` · ${s.episode_count} episodes` : ''}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  const added = toggleExploreList(seriesItem(s.tmdb_id, s.name))
                                  toast.success(
                                    added ? `Added "${s.name}" to explore` : `Removed "${s.name}" from explore`,
                                    { duration: TOAST_DURATION_MS },
                                  )
                                }}
                                className={cn(
                                  'font-mono text-xs px-3 py-1.5 border rounded transition-colors',
                                  inExplore
                                    ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                                    : 'border-slate-700 hover:border-emerald-500 hover:text-emerald-400',
                                )}
                              >
                                {inExplore ? '✓ in explore' : '+ explore'}
                              </button>
                              <Link
                                href={`/series/${s.tmdb_id}`}
                                className="font-mono text-xs px-3 py-1.5 border border-slate-700 rounded hover:border-violet-500 hover:text-violet-400 transition-colors"
                              >
                                full page →
                              </Link>
                              <Link
                                href={`/similar/${s.tmdb_id}`}
                                className="font-mono text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded transition-colors"
                              >
                                similar →
                              </Link>
                            </div>
                          </div>
                          {s.overview && (
                            <p className="text-sm text-slate-400 mt-3 line-clamp-3 leading-relaxed">{s.overview}</p>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex-1 relative">
                            <div className="absolute inset-0">
                              <SeriesGraph seriesId={selected} width={420} height={360} />
                            </div>
                            <GraphLegend labels={['Series', 'Person', 'Genre', 'Keyword', 'Network', 'Country', 'Language']} />
                          </div>
                          <div className="px-4 py-2 border-t border-slate-800 shrink-0">
                            <LinkLegend />
                          </div>
                        </div>
                      </>
                    )
                  })()
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-sm">
                    select a series to see its graph
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
