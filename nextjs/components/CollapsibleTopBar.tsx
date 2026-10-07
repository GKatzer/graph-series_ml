'use client'

// components/CollapsibleTopBar.tsx — a horizontal bar that can be collapsed into a
// thin strip and expanded again. Persists state to localStorage.

import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { STORAGE_KEYS } from '@/lib/constants'

interface CollapsibleTopBarProps {
  persistKey: string
  /** Short label shown in the collapsed strip so the user knows what's hidden. */
  label?: string
  className?: string
  children: ReactNode
}

export function CollapsibleTopBar({
  persistKey,
  label = 'toolbar',
  className,
  children,
}: CollapsibleTopBarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const storeKey = `${STORAGE_KEYS.topBarPrefix}${persistKey}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey)
      if (raw) {
        const s = JSON.parse(raw)
        if (typeof s.collapsed === 'boolean') setCollapsed(s.collapsed)
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [storeKey])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(storeKey, JSON.stringify({ collapsed })) } catch { /* ignore */ }
  }, [collapsed, hydrated, storeKey])

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={cn(
          'w-full h-8 shrink-0 border-b border-violet-950/60 flex items-center justify-center gap-3',
          'text-violet-400 hover:text-violet-300 hover:bg-violet-950/20 transition-colors cursor-pointer',
          className,
        )}
        title="Expand"
      >
        <div className="flex-1 h-px bg-violet-500/40 ml-6" />
        <span className="font-mono text-[11px] tracking-wider">{label} ▾</span>
        <div className="flex-1 h-px bg-violet-500/40 mr-6" />
      </button>
    )
  }

  return (
    <div className={cn('border-b border-slate-800 shrink-0', className)}>
      <div className="flex items-center">
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          {children}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="self-stretch px-3 flex items-center text-slate-700 hover:text-slate-300 hover:bg-slate-900/40 border-l border-slate-800/50 transition-colors"
          title="Collapse"
        >
          <span className="font-mono text-[10px]">▴</span>
        </button>
      </div>
    </div>
  )
}
