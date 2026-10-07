import { Suspense } from 'react'

export default function SeriesLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}