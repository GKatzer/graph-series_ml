'use client'

import { useEffect } from 'react'
import { useTitleStore } from '@/lib/titleContext'

export function TitleSetter({ title }: { title: string }) {
  const { setTitle } = useTitleStore()
  useEffect(() => { setTitle(title) }, [title, setTitle])
  return null
}
