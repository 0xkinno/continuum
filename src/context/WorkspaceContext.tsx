'use client'

/**
 * Workspace state lifted above the router so it survives navigation to
 * Canon/History and back. RootLayout mounts this provider once and never
 * remounts it on route changes — only the routed page content underneath
 * it unmounts/remounts, which is what used to wipe the draft and flags.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { getSources } from '@/lib/api'
import type { ExplainedFlag } from '@/lib/types'

export interface Source {
  id: number
  label: string
  coverage: string
}

interface WorkspaceContextValue {
  sources: Source[]
  draftText: string
  checking: boolean
  checkError: string | null
  explained: ExplainedFlag[]
  hasResults: boolean
  activeFlagNum: number | null
  setSources: (s: Source[]) => void
  setDraftText: (t: string) => void
  setChecking: (b: boolean) => void
  setCheckError: (e: string | null) => void
  setExplained: (f: ExplainedFlag[]) => void
  setHasResults: (b: boolean) => void
  setActiveFlagNum: (n: number | null) => void
  refreshSources: () => Promise<void>
  clearWorkspace: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<Source[]>([])
  const [draftText, setDraftText] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [explained, setExplained] = useState<ExplainedFlag[]>([])
  const [hasResults, setHasResults] = useState(false)
  const [activeFlagNum, setActiveFlagNum] = useState<number | null>(null)

  const refreshSources = useCallback(async () => {
    try {
      const res = await getSources()
      if (res.success && res.sources) setSources(res.sources)
    } catch {
      /* ignore — left panel just stays as-is */
    }
  }, [])

  // Fetch once when the app first mounts — this provider lives above the
  // router, so it never runs again on navigation.
  useEffect(() => {
    refreshSources()
  }, [refreshSources])

  const clearWorkspace = useCallback(() => {
    setDraftText('')
    setExplained([])
    setHasResults(false)
    setActiveFlagNum(null)
    setCheckError(null)
  }, [])

  return (
    <WorkspaceContext.Provider
      value={{
        sources, draftText, checking, checkError, explained, hasResults, activeFlagNum,
        setSources, setDraftText, setChecking, setCheckError, setExplained, setHasResults, setActiveFlagNum,
        refreshSources, clearWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider')
  return ctx
}
