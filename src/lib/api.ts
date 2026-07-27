/**
 * API client — all calls go through Next.js /api/backend/* rewrite → Fastify.
 * Every function returns the typed response shape or throws with a message.
 */

import type {
  IngestResponse,
  CheckResponse,
  SourcesResponse,
  CanonResponse,
  HistoryListResponse,
} from './types'

const BASE = '/api/backend'

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadDocument(file: File): Promise<IngestResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/ingest/upload`, { method: 'POST', body: form })
  return res.json() as Promise<IngestResponse>
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

export async function getSources(): Promise<SourcesResponse> {
  const res = await fetch(`${BASE}/knowledge/sources`)
  return res.json() as Promise<SourcesResponse>
}

export async function getCanon(): Promise<CanonResponse> {
  const res = await fetch(`${BASE}/knowledge/query?q=all+world+rules+and+events+and+characters`)
  return res.json() as Promise<CanonResponse>
}

// ── Continuity check ──────────────────────────────────────────────────────────

export async function checkDraft(draftText: string): Promise<CheckResponse> {
  const res = await fetch(`${BASE}/continuity/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftText }),
  })
  return res.json() as Promise<CheckResponse>
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getHistory(limit = 50, offset = 0): Promise<HistoryListResponse> {
  const res = await fetch(`${BASE}/history/list?limit=${limit}&offset=${offset}`)
  return res.json() as Promise<HistoryListResponse>
}

// ── Demo seed ─────────────────────────────────────────────────────────────────

export interface SeedProgressLine {
  step: string
  status: 'progress' | 'ok' | 'warn' | 'error'
  detail?: string
  flagCount?: number
  caughtCount?: number
  allCaught?: boolean
  flags?: unknown[]
  label?: string
  characters?: number
  events?: number
  rules?: number
}

/**
 * Calls POST /seed/demo which streams NDJSON progress.
 * Calls onProgress for each line, resolves when the stream ends.
 */
export async function runSeedDemo(
  onProgress: (line: SeedProgressLine) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/seed/demo`, { method: 'POST' })
  if (!res.body) throw new Error('No response body from seed endpoint')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) {
        try {
          onProgress(JSON.parse(line) as SeedProgressLine)
        } catch { /* skip malformed lines */ }
      }
    }
  }
  if (buffer.trim()) {
    try { onProgress(JSON.parse(buffer) as SeedProgressLine) } catch { /* ignore */ }
  }
}

export async function getDemoDraft(): Promise<{ success: boolean; draftText?: string; error?: string }> {
  const res = await fetch(`${BASE}/seed/demo-draft`)
  return res.json() as Promise<{ success: boolean; draftText?: string; error?: string }>
}
