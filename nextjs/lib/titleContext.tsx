'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface TitleCtx {
  title: string
  setTitle: (t: string) => void
}

const TitleContext = createContext<TitleCtx>({ title: 'TVKG', setTitle: () => {} })

export function TitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('TVKG')
  return <TitleContext.Provider value={{ title, setTitle }}>{children}</TitleContext.Provider>
}

export function useTitleStore() {
  return useContext(TitleContext)
}

export function usePageTitle(title: string) {
  const { setTitle } = useTitleStore()
  useEffect(() => { setTitle(title) }, [title, setTitle])
}
