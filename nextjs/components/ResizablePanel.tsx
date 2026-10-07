'use client'

// components/ResizablePanel.tsx — a docked side panel that can be drag-resized and
// collapsed/expanded with a toggle styled like the explore leftbar. Width + collapsed
// state persist to localStorage so the user's workspace survives reloads.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { STORAGE_KEYS } from '@/lib/constants'
import { useIsMobile } from '@/lib/useIsMobile'

interface ResizablePanelProps {
  /** Which edge the panel docks to — controls divider side and arrow direction. */
  side: 'left' | 'right'
  /** Unique key for persisting width/collapsed state. */
  persistKey: string
  defaultWidth: number
  minWidth?: number
  maxWidth?: number
  collapsedWidth?: number
  /** Optional short label shown vertically when collapsed. */
  collapsedLabel?: string
  /** On mobile, start with the drawer already open (for pages where the panel is the primary content). */
  mobileDefaultOpen?: boolean
  /** On mobile, render children inline full-width instead of as an off-canvas drawer. */
  mobileInline?: boolean
  className?: string
  children: ReactNode
}

export function ResizablePanel({
  side,
  persistKey,
  defaultWidth,
  minWidth = 180,
  maxWidth = 560,
  collapsedWidth = 32,
  collapsedLabel,
  mobileDefaultOpen = false,
  mobileInline = false,
  className,
  children,
}: ResizablePanelProps) {
  const isMobile = useIsMobile()
  const [width, setWidth] = useState(defaultWidth)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(mobileDefaultOpen)
  const [hydrated, setHydrated] = useState(false)

  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)
  const storeKey = `${STORAGE_KEYS.panelPrefix}${persistKey}`

  // Restore persisted state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey)
      if (raw) {
        const s = JSON.parse(raw)
        if (typeof s.width === 'number') setWidth(s.width)
        if (typeof s.collapsed === 'boolean') setCollapsed(s.collapsed)
      }
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [storeKey])

  // Persist on change
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(storeKey, JSON.stringify({ width, collapsed }))
    } catch {
      /* ignore */
    }
  }, [width, collapsed, hydrated, storeKey])

  // Drag-to-resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - startX.current
      const delta = side === 'left' ? dx : -dx
      setWidth(Math.max(minWidth, Math.min(maxWidth, startW.current + delta)))
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [side, minWidth, maxWidth])

  function onDividerDown(e: React.MouseEvent) {
    dragging.current = true
    startX.current = e.clientX
    startW.current = width
    document.body.style.cursor = 'col-resize'
    e.preventDefault()
  }

  const panelWidth = collapsed ? collapsedWidth : width

  // Arrow points "outward" to collapse, "inward" to expand.
  const arrow = collapsed
    ? side === 'left' ? '›' : '‹'
    : side === 'left' ? '‹' : '›'

  const divider = (
    <div
      onMouseDown={onDividerDown}
      className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-violet-600/30 active:bg-violet-600/50 transition-colors"
      title="Drag to resize"
    />
  )

  const panel = (
    <div
      style={{ width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth }}
      className={cn(
        'shrink-0 flex flex-col relative transition-[width] duration-150',
        side === 'left' ? 'border-r border-slate-800' : 'border-l border-slate-800',
        className,
      )}
    >
      {/* Floating toggle tab — only when expanded */}
      {!collapsed && (
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse panel"
          className={cn(
            'absolute top-3 z-20 flex items-center justify-center',
            'w-4 h-10 bg-slate-900 border border-slate-700 text-slate-500',
            'hover:text-slate-200 hover:border-slate-500 transition-colors',
            side === 'left'
              ? 'right-0 translate-x-full rounded-r border-l-0'
              : 'left-0 -translate-x-full rounded-l border-r-0',
          )}
        >
          <span className="font-mono text-[10px]">{arrow}</span>
        </button>
      )}

      {collapsed ? (
        <>
          <button
            onClick={() => setCollapsed(false)}
            className="shrink-0 h-8 w-full flex items-center justify-center border-b border-slate-800 text-slate-600 hover:text-slate-300 hover:bg-slate-900 transition-colors"
            title="Expand panel"
          >
            <span className="font-mono text-xs">{arrow}</span>
          </button>
          {collapsedLabel && (
            <div className="flex-1 flex items-start justify-center pt-3">
              <span className="font-mono text-[10px] text-slate-600 tracking-widest uppercase [writing-mode:vertical-rl]">
                {collapsedLabel}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
      )}
    </div>
  )

  // ── Mobile: render inline full-width (for pages that manage detail themselves) ──
  if (isMobile && mobileInline) {
    return (
      <div className={cn('flex-1 min-w-0 flex flex-col overflow-hidden', className)}>
        {children}
      </div>
    )
  }

  // ── Mobile: off-canvas drawer instead of a docked, drag-resizable column ──
  if (isMobile) {
    const openArrow = side === 'left' ? '›' : '‹'
    return (
      <>
        {/* Floating edge tab to open the drawer */}
        {!mobileOpen && (
          <button
            onClick={() => setMobileOpen(true)}
            className={cn(
              'fixed top-16 z-30 flex items-center gap-1.5 px-2.5 py-2 rounded-md shadow-lg',
              'bg-slate-900 border border-slate-700 text-slate-300 active:bg-slate-800 transition-colors',
              side === 'left' ? 'left-2' : 'right-2',
            )}
            title={collapsedLabel ? `Open ${collapsedLabel}` : 'Open panel'}
          >
            {side === 'right' && <span className="font-mono text-xs">{openArrow}</span>}
            {collapsedLabel && (
              <span className="font-mono text-[10px] uppercase tracking-wider">{collapsedLabel}</span>
            )}
            {side === 'left' && <span className="font-mono text-xs">{openArrow}</span>}
          </button>
        )}

        {/* Backdrop + sliding drawer */}
        {mobileOpen && (
          <>
            <div
              onClick={() => setMobileOpen(false)}
              className="fixed inset-x-0 top-12 bottom-0 z-40 bg-black/50 backdrop-blur-[1px]"
            />
            <div
              className={cn(
                'fixed top-12 bottom-0 z-50 w-[85vw] max-w-sm flex flex-col bg-slate-950',
                side === 'left' ? 'left-0 border-r border-slate-800' : 'right-0 border-l border-slate-800',
                className,
              )}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="shrink-0 h-9 flex items-center justify-between px-3 border-b border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Close panel"
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  {collapsedLabel}
                </span>
                <span className="font-mono text-sm">✕</span>
              </button>
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
            </div>
          </>
        )}
      </>
    )
  }

  if (side === 'left') {
    return (
      <>
        {panel}
        {!collapsed && divider}
      </>
    )
  }
  return (
    <>
      {!collapsed && divider}
      {panel}
    </>
  )
}
