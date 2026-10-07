'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { api, failureMessage } from '@/lib/api'
import type { PersonDetail, SeriesRef } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PersonGraph, GraphLegend } from '@/components/SeriesGraph'
import { ResizablePanel } from '@/components/ResizablePanel'
import { PANEL_SIZES, TOAST_DURATION_MS } from '@/lib/constants'
import { useExploreList, toggleExploreList, seriesItem, personItem, type ExploreItem } from '@/lib/exploreStore'
import { nodeId } from '@/lib/nodeId'
import { useIsMobile } from '@/lib/useIsMobile'

const ROLE_LABELS: Record<SeriesRef['role'], string> = {
  CREATED:  'Creator',
  DIRECTED: 'Director',
  ACTED_IN: 'Actor',
}

const ROLE_ORDER: SeriesRef['role'][] = ['CREATED', 'DIRECTED', 'ACTED_IN']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-800 pt-4">
      <h2 className="font-mono text-xs text-violet-400 tracking-widest uppercase mb-3">{title}</h2>
      {children}
    </div>
  )
}

function SeriesRow({
  s, inExplore, onToggle,
}: {
  s: SeriesRef; inExplore: boolean; onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-800/50 hover:bg-slate-900/40 px-1 rounded transition-colors group">
      <Link
        href={`/series/${s.tmdb_id}`}
        className="flex-1 flex items-center justify-between gap-3 min-w-0"
      >
        <span className="text-xs text-slate-300 group-hover:text-violet-400 transition-colors leading-tight">
          {s.name}
        </span>
        {s.start_year && (
          <span className="font-mono text-xs text-slate-600 shrink-0">{s.start_year}</span>
        )}
      </Link>
      <button
        onClick={onToggle}
        className={cn(
          'shrink-0 font-mono text-xs px-1.5 py-0.5 border rounded transition-colors',
          inExplore
            ? 'border-emerald-700 text-emerald-400'
            : 'border-slate-800 text-slate-600 hover:border-emerald-700 hover:text-emerald-400',
        )}
        title={inExplore ? 'Remove from explore list' : 'Add to explore list'}
      >
        {inExplore ? '✓' : '+'}
      </button>
    </div>
  )
}

export default function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const exploreList = useExploreList()
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    api.person(id)
      .then(setPerson)
      .catch(e => setLoadError(failureMessage('Loading person', e)))
      .finally(() => setLoading(false))
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

  if (loadError || !person) return (
    <div role="alert" className="min-h-screen flex items-center justify-center text-red-400 font-mono text-sm px-4 text-center">
      {loadError ?? 'Not found'}
    </div>
  )

  const byRole = ROLE_ORDER.reduce<Record<string, SeriesRef[]>>((acc, role) => {
    const list = person.series.filter(s => s.role === role)
    if (list.length) acc[role] = list.sort((a, b) => (b.start_year ?? 0) - (a.start_year ?? 0))
    return acc
  }, {})

  const personInExplore = isInExplore(nodeId('Person', id))

  // ── Mobile: flat scrollable layout (all info inline, no drawers) ──
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-3rem)] overflow-y-auto">

        {/* Header: name/meta left, explore button right */}
        <div className="flex gap-3 px-4 py-4 border-b border-slate-800">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-50 leading-snug">{person.name}</h1>
            <p className="font-mono text-xs text-slate-700 mt-1 truncate">{id}</p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">{person.series.length} series</p>
          </div>
          <div className="shrink-0 w-28">
            <button
              onClick={() => handleToggleExplore(personItem(id, person.name))}
              className={cn(
                'w-full font-mono text-xs py-1.5 border rounded transition-colors text-center',
                personInExplore
                  ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                  : 'border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400',
              )}
            >
              {personInExplore ? '✓ explore' : '+ explore'}
            </button>
          </div>
        </div>

        {/* Graph */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
          <span className="font-mono text-xs text-slate-600">connections</span>
          <span className="font-mono text-xs text-slate-700">series, co-workers, genres</span>
        </div>
        <div className="relative h-64">
          <div className="absolute inset-0">
            <PersonGraph personId={id} />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-800">
          <GraphLegend labels={['Series', 'Person', 'Genre', 'Country', 'Language']} />
        </div>

        {/* Series by role */}
        <div className="px-4 py-4 space-y-4">
          {ROLE_ORDER.map(role => {
            const list = byRole[role]
            if (!list) return null
            return (
              <Section key={role} title={`${ROLE_LABELS[role]} (${list.length})`}>
                <div className="space-y-0">
                  {list.map(s => (
                    <SeriesRow
                      key={s.tmdb_id}
                      s={s}
                      inExplore={isInExplore(nodeId('Series', s.tmdb_id))}
                      onToggle={() => handleToggleExplore(seriesItem(s.tmdb_id, s.name))}
                    />
                  ))}
                </div>
              </Section>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col sm:flex-row overflow-hidden">

      {/* Left: person info — resizable + collapsible */}
      <ResizablePanel side="left" persistKey="person-info" defaultWidth={PANEL_SIZES.personInfo.defaultWidth} minWidth={PANEL_SIZES.personInfo.minWidth} maxWidth={PANEL_SIZES.personInfo.maxWidth} collapsedLabel="info">
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

        <div>
          <div className="flex items-start gap-2 mb-1">
            <h1 className="flex-1 text-xl font-bold text-slate-50 leading-tight">{person.name}</h1>
            <button
              onClick={() => handleToggleExplore(personItem(id, person.name))}
              className={cn(
                'shrink-0 font-mono text-xs px-2 py-1 border rounded transition-colors',
                personInExplore
                  ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                  : 'border-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400',
              )}
            >
              {personInExplore ? '✓ explore' : '+ explore'}
            </button>
          </div>
          <p className="font-mono text-xs text-slate-700">{id}</p>
          <p className="font-mono text-xs text-slate-500 mt-1">
            {person.series.length} {person.series.length === 1 ? 'series' : 'series'}
          </p>
        </div>

        {ROLE_ORDER.map(role => {
          const list = byRole[role]
          if (!list) return null
          return (
            <Section key={role} title={`${ROLE_LABELS[role]} (${list.length})`}>
              <div className="space-y-0">
                {list.map(s => (
                  <SeriesRow
                    key={s.tmdb_id}
                    s={s}
                    inExplore={isInExplore(nodeId('Series', s.tmdb_id))}
                    onToggle={() => handleToggleExplore(seriesItem(s.tmdb_id, s.name))}
                  />
                ))}
              </div>
            </Section>
          )
        })}
        </div>
      </ResizablePanel>

      {/* Right: graph */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <p className="font-mono text-xs text-slate-400">Connections</p>
          <p className="font-mono text-xs text-slate-600">
            series, co-workers, genres
          </p>
        </div>

        <div className="flex-1 relative min-h-0">
          <div className="absolute inset-0">
            <PersonGraph personId={id} />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-800 shrink-0">
          <GraphLegend labels={['Series', 'Person', 'Genre', 'Country', 'Language']} />
        </div>
      </div>
    </div>
  )
}
