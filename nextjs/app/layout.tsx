// app/layout.tsx

import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { Toaster } from 'sonner'
import { Search, Waypoints, Info } from 'lucide-react'
import { ExploreMenu } from '@/components/ExploreMenu'
import './globals.css'

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'TV Series Knowledge Graph',
  description: 'Semantic search and graph navigation across 56k TV series',
  icons: { icon: '/logo.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${mono.variable} bg-slate-950 text-slate-100 antialiased min-h-screen`}>
        <header className="fixed top-0 inset-x-0 z-50 border-b border-violet-950 bg-slate-900 shadow-[0_1px_0_0_rgba(139,92,246,0.08)]">
          <nav className="max-w-7xl mx-auto px-3 sm:px-4 h-12 flex items-center justify-between">
            <Link
              href="/"
              className="font-mono text-sm font-semibold tracking-tight text-violet-300 hover:text-violet-100 transition-colors"
            >
              TVKG
            </Link>
            <div className="flex items-center gap-4 sm:gap-6 text-slate-500">
              <Link
                href="/search"
                aria-label="Search"
                title="Search"
                className="hover:text-slate-200 transition-colors"
              >
                <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </Link>
              <Link
                href="/explore"
                aria-label="Explore"
                title="Explore"
                className="hover:text-slate-200 transition-colors"
              >
                <Waypoints className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </Link>
              <Link
                href="/methodology"
                aria-label="About"
                title="About"
                className="hover:text-slate-200 transition-colors"
              >
                <Info className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </Link>
              <ExploreMenu />
            </div>
          </nav>
        </header>
        <main className="pt-12">{children}</main>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  )
}
