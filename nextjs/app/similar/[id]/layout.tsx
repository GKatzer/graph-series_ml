import { Suspense } from 'react'

export default function SimilarLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}
