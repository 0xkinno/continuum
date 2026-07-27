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

async function safeJson<T>(res: Response, fallbackError: string): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    try {
      const parsed = JSON.parse(text)
      if (parsed.message || parsed.error) {
        throw new Error(parsed.message || parsed.error)
      }
    } catch {
      throw new Error(`HTTP ${res.status}: ${res.statusText || fallbackError}`)
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText || fallbackError}`)
  }

  try {
    return JSON.parse(text) as T
  } catch (err) {
    console.error('JSON Parse Error for response text:', text)
    throw new Error('Received invalid JSON from backend service.')
  }
}

// ── Upload ────────────────────────────────────────────────────────────────────

export async function uploadDocument(file: File): Promise<IngestResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/ingest/upload`, { method: 'POST', body: form })
  return safeJson<IngestResponse>(res, 'Failed to upload document.')
}

// ── Knowledge ─────────────────────────────────────────────────────────────────

export async function getSources(): Promise<SourcesResponse> {
  const res = await fetch(`${BASE}/knowledge/sources`)
  return safeJson<SourcesResponse>(res, 'Failed to fetch sources.')
}

export async function getCanon(): Promise<CanonResponse> {
  const res = await fetch(`${BASE}/knowledge/query?q=all+world+rules+and+events+and+characters`)
  return safeJson<CanonResponse>(res, 'Failed to fetch canon.')
}

// ── Continuity check ──────────────────────────────────────────────────────────

export async function checkDraft(draftText: string): Promise<CheckResponse> {
  const res = await fetch(`${BASE}/continuity/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftText }),
  })
  return safeJson<CheckResponse>(res, 'Failed to perform continuity check.')
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getHistory(limit = 50, offset = 0): Promise<HistoryListResponse> {
  const res = await fetch(`${BASE}/history/list?limit=${limit}&offset=${offset}`)
  return safeJson<HistoryListResponse>(res, 'Failed to fetch history list.')
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
  return safeJson<{ success: boolean; draftText?: string; error?: string }>(res, 'Failed to fetch demo draft.')
}
