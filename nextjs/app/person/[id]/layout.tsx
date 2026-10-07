import { Suspense } from 'react'

export default function PersonLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}
