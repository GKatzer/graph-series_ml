'use client'

// app/page.tsx — главная страница

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TMDB_URL, TMDB_ATTRIBUTION } from '@/lib/constants'

const EXAMPLES = [
  'dark detective noir',
  'British comedy workplace',
  'based on a book',
  'post-apocalyptic survival',
  'slow-burn psychological thriller',
  'anthology horror',
]

export default function HomePage() {
  useEffect(() => { document.title = 'TVKG' }, [])
  const router = useRouter()
  const [query, setQuery] = useState('')

  function submit(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-[120px]" />
        </div>

        <p className="font-mono text-xs text-violet-400 tracking-[0.2em] uppercase mb-6">
          56 000 series · semantic + graph search
        </p>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-50 mb-4 max-w-2xl leading-tight">
          Find TV series by{' '}
          <span className="text-violet-400">what they feel like</span>
        </h1>

        <p className="text-slate-400 text-base max-w-lg mb-10 leading-relaxed">
          Search by mood, themes, or natural language. Navigate the graph of
          cast, creators, genres, and countries to discover what connects your
          favourite shows.
        </p>

        {/* Search input */}
        <form
          onSubmit={e => { e.preventDefault(); submit(query) }}
          className="w-full max-w-xl relative"
        >
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. bleak Scandinavian crime with strong female lead"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 pr-24 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors font-mono"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono px-4 py-1.5 rounded-md transition-colors"
          >
            search →
          </button>
        </form>

        {/* Example chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-xl">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => submit(ex)}
              className="font-mono text-xs px-3 py-1 rounded-full border border-slate-700 text-slate-400 hover:border-violet-500 hover:text-violet-400 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-t border-slate-800 px-4 py-12">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div>
            <p className="font-mono text-violet-400 text-xs tracking-widest uppercase mb-2">Semantic</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Vector search over TMDB overviews and keywords — find series by mood,
              themes, or atmosphere, not just keywords.
            </p>
          </div>
          <div>
            <p className="font-mono text-violet-400 text-xs tracking-widest uppercase mb-2">Graph</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Navigate cast, creators, genres and countries as a live graph.
              Discover what structurally connects two shows.
            </p>
          </div>
          <div>
            <p className="font-mono text-violet-400 text-xs tracking-widest uppercase mb-2">Hybrid</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Combine both: semantic similarity re-ranked by shared actors,
              countries, or creators for explainable results.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-4 py-5 text-center">
        <p className="font-mono text-xs text-slate-600">
          data from{' '}
          <a href={TMDB_URL} target="_blank" rel="noreferrer" className="hover:text-slate-400 transition-colors">
            TMDB
          </a>
          {' · '}
          <Link href="/methodology" className="hover:text-slate-400 transition-colors">
            methodology
          </Link>
        </p>
        <p className="font-mono text-[10px] text-slate-700 mt-2 max-w-md mx-auto leading-relaxed">
          {TMDB_ATTRIBUTION}
        </p>
      </footer>
    </div>
  )
}
