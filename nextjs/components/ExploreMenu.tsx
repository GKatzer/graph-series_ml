'use client'

// components/ExploreMenu.tsx — header widget showing the persistent explore list.
// Lets the user review/remove bookmarked series and jump to the explore page.
// Independent from the explore graph: clearing the graph never touches this list.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import { useExploreList, removeFromExploreList, clearExploreList } from '@/lib/exploreStore'
import { cn } from '@/lib/utils'
import { keyOfNodeId } from '@/lib/nodeId'

export function ExploreMenu() {
  const list = useExploreList()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded border transition-colors',
          list.length > 0
            ? 'border-emerald-700 text-emerald-300 hover:border-emerald-500'
            : 'border-slate-700 text-slate-400 hover:text-slate-100 hover:border-slate-500',
        )}
        aria-label="Explore list"
        title="Explore list"
      >
        <Bookmark className="w-[14px] h-[14px] sm:hidden" strokeWidth={1.75} />
        <span className="hidden sm:inline">explore list</span>
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px]',
            list.length > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400',
          )}
        >
          {list.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-md shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="font-mono text-xs text-violet-400 tracking-widest uppercase">
              Explore list
            </span>
            {list.length > 0 && (
              <button
                onClick={() => clearExploreList()}
                className="font-mono text-[10px] text-slate-600 hover:text-red-400 transition-colors"
              >
                clear
              </button>
            )}
          </div>

          {list.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="font-mono text-xs text-slate-600">no series yet</p>
              <p className="font-mono text-[10px] text-slate-700 mt-1">
                add from search with “+ explore”
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {list.map(item => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/50 transition-colors"
                >
                  {item.type === 'series' || item.type === 'person' ? (
                    <Link
                      href={item.type === 'person' ? `/person/${keyOfNodeId(item.id)}` : `/series/${keyOfNodeId(item.id)}`}
                      onClick={() => setOpen(false)}
                      className="flex-1 min-w-0 text-xs text-slate-200 truncate hover:text-violet-300 transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <span className="flex-1 min-w-0 text-xs text-slate-500 truncate" title={item.name}>
                      {item.name}
                    </span>
                  )}
                  <button
                    onClick={() => removeFromExploreList(item.id)}
                    className="shrink-0 font-mono text-xs text-slate-600 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <Link
            href="/explore"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 border-t border-slate-800 font-mono text-xs text-center text-violet-400 hover:bg-violet-600/10 transition-colors"
          >
            open explore →
          </Link>
        </div>
      )}
    </div>
  )
}
