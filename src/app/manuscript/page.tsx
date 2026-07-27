'use client'

import { useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { uploadDocument, checkDraft, runSeedDemo, getDemoDraft } from '@/lib/api'
import type { SeedProgressLine } from '@/lib/api'
import type { ExplainedFlag } from '@/lib/types'
import { useWorkspace } from '@/context/WorkspaceContext'
import styles from '../workspace.module.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split draftText into sentences and return spans with flag highlights applied. */
function buildHighlightedContent(
  draftText: string,
  flags: ExplainedFlag[],
  activeFlagNum: number | null,
  onFlagClick: (n: number) => void,
): React.ReactNode[] {
  if (flags.length === 0) return [<span key="text">{draftText}</span>]

  // Build a set of claim texts to highlight (match by substring)
  const claimTexts = flags.map((f) => ({ claim: f.claim, flagNumber: f.flagNumber }))

  // Split into segments: plain text vs flagged text
  const segments: { text: string; flagNumber: number | null }[] = []
  let remaining = draftText

  // Simple greedy matching — find each claim text in the remaining string
  while (remaining.length > 0) {
    let earliest = -1
    let earliestClaim = ''
    let earliestFlagNum = 0

    for (const { claim, flagNumber } of claimTexts) {
      if (!claim) continue
      const idx = remaining.indexOf(claim)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx
        earliestClaim = claim
        earliestFlagNum = flagNumber
      }
    }

    if (earliest === -1) {
      segments.push({ text: remaining, flagNumber: null })
      break
    }

    if (earliest > 0) {
      segments.push({ text: remaining.slice(0, earliest), flagNumber: null })
    }
    segments.push({ text: earliestClaim, flagNumber: earliestFlagNum })
    remaining = remaining.slice(earliest + earliestClaim.length)
  }

  return segments.map((seg, i) =>
    seg.flagNumber !== null ? (
      <mark
        key={i}
        className={`${styles.flaggedSpan} ${activeFlagNum === seg.flagNumber ? styles.highlighted : ''}`}
        onClick={() => onFlagClick(seg.flagNumber!)}
      >
        {seg.text}
      </mark>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ManuscriptPage() {
  const {
    sources, draftText, checking, checkError, explained, hasResults, activeFlagNum,
    setDraftText, setChecking, setCheckError, setExplained, setHasResults, setActiveFlagNum,
    refreshSources, clearWorkspace,
  } = useWorkspace()

  const [uploading, setUploading]     = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging]       = useState(false)
  // Seed demo state — transient progress feedback for the run in flight,
  // not part of the persisted workspace state.
  const [seeding, setSeeding]         = useState(false)
  const [seedLog, setSeedLog]         = useState<SeedProgressLine[]>([])
  const [seedDone, setSeedDone]       = useState(false)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const noteRefs       = useRef<Record<number, HTMLDivElement | null>>({})
  const seedLogRef     = useRef<HTMLDivElement>(null)

  // ── Seed demo ────────────────────────────────────────────────────────────────

  const handleSeedDemo = useCallback(async () => {
    setSeeding(true)
    setSeedLog([])
    setSeedDone(false)
    try {
      await runSeedDemo((line) => {
        setSeedLog((prev) => [...prev, line])
        // Auto-scroll seed log
        setTimeout(() => {
          if (seedLogRef.current) {
            seedLogRef.current.scrollTop = seedLogRef.current.scrollHeight
          }
        }, 0)
        // When done, refresh sources and load the test draft into editor
        if (line.step === 'done' && line.status !== 'error') {
          refreshSources()
          getDemoDraft().then((res) => {
            if (res.success && res.draftText) {
              setDraftText(res.draftText)
              setHasResults(false)
              setExplained([])
            }
          }).catch(() => {})
          setSeedDone(true)
        }
      })
    } catch (e) {
      setSeedLog((prev) => [...prev, {
        step: 'error',
        status: 'error',
        detail: e instanceof Error ? e.message : 'Seed failed',
      }])
    } finally {
      setSeeding(false)
    }
  }, [refreshSources, setDraftText, setExplained, setHasResults])

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    setUploadError(null)
    setUploading(true)
    try {
      const res = await uploadDocument(file)
      if (!res.success) {
        setUploadError(res.error ?? 'Upload failed.')
      } else {
        await refreshSources()
      }
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }, [refreshSources])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  // ── Check ───────────────────────────────────────────────────────────────────

  const handleCheck = useCallback(async () => {
    if (!draftText.trim()) return
    setCheckError(null)
    setChecking(true)
    setExplained([])
    setHasResults(false)
    setActiveFlagNum(null)
    try {
      const res = await checkDraft(draftText)
      if (!res.success) {
        setCheckError(res.error ?? 'Check failed.')
      } else {
        setExplained(res.explained ?? [])
        setHasResults(true)
      }
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : 'Check failed.')
    } finally {
      setChecking(false)
    }
  }, [draftText, setCheckError, setChecking, setExplained, setHasResults, setActiveFlagNum])

  const handleFlagClick = useCallback((flagNum: number) => {
    setActiveFlagNum(flagNum)
    const ref = noteRefs.current[flagNum]
    if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [setActiveFlagNum])

  const handleClear = useCallback(() => {
    clearWorkspace()
    refreshSources()
  }, [clearWorkspace, refreshSources])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.workspace}>

      {/* ── LEFT: Upload panel ── */}
      <aside className={styles.leftPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelLabel}>Sources</span>
        </div>
        <div className={styles.panelScroll}>

          {/* Demo project button */}
          <button
            className={styles.demoBtn}
            onClick={handleSeedDemo}
            disabled={seeding}
            title="Clear the database and load The Ashenveil Chronicles demo project"
          >
            <span>{seeding ? '⟳' : '⬦'}</span>
            {seeding ? 'Loading demo project…' : 'Load demo project'}
          </button>

          {/* Seed log */}
          <AnimatePresence>
            {seedLog.length > 0 && (
              <motion.div
                key="seedLog"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={styles.seedLog}
                ref={seedLogRef}
              >
                {seedLog.map((line, i) => (
                  <p key={i} className={`${styles.seedLogLine} ${styles[line.status] ?? ''}`}>
                    {line.status === 'ok' ? '✓ ' : line.status === 'error' ? '✗ ' : '  '}
                    {line.detail ?? line.step}
                  </p>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Seed success */}
          <AnimatePresence>
            {seedDone && !seeding && (
              <motion.p
                key="seedDone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={styles.seedSuccess}
              >
                ✓ Demo loaded. Draft ready in editor — click &ldquo;Check continuity&rdquo;.
              </motion.p>
            )}
          </AnimatePresence>

          {/* Dropzone */}
          <div
            className={`${styles.dropzone} ${dragging ? styles.dragging : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            aria-label="Upload document"
          >
            <span className={styles.dropzoneIcon}>↑</span>
            <p className={styles.dropzoneText}>
              Drop a document or click to upload
            </p>
            <p className={styles.dropzoneFormats}>txt · md · pdf · docx</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx"
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Upload progress */}
          <AnimatePresence>
            {uploading && (
              <motion.div
                key="uploading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={styles.uploadingBar}
              >
                <div className={styles.uploadingProgress} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload error */}
          <AnimatePresence>
            {uploadError && (
              <motion.p
                key="uploadError"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={styles.uploadError}
              >
                {uploadError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Source list */}
          {sources.length > 0 && (
            <>
              <p className={styles.sourceListHeading}>Ingested</p>
              {sources.map((src) => (
                <div key={src.id} className={styles.sourceItem}>
                  <p className={styles.sourceName}>{src.label}</p>
                  <div className={styles.sourceMeta}>
                    <span>{src.coverage || '—'}</span>
                    <span className={`${styles.statusBadge} ${styles.ready}`}>Ready</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* ── CENTER: Draft editor ── */}
      <main className={styles.centerPanel}>
        <div className={styles.editorHeader}>
          <span className={styles.panelLabel}>Draft</span>
          <div className={styles.editorActions}>
            {hasResults && !checking && (
              <div className={styles.statsRow}>
                <span className={styles.statItem}>
                  <span className={`${styles.statValue} ${explained.length > 0 ? styles.flagCount : ''}`}>
                    {explained.length}
                  </span>&nbsp;flag{explained.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {checkError && (
              <span className={styles.errorLabel}>
                {checkError}
              </span>
            )}
            <button
              className={styles.editDraftBtn}
              onClick={handleClear}
              title="Clear the draft and flags, and refresh the sources list"
            >
              Clear
            </button>
            <button
              className={`${styles.checkBtn} ${checking ? styles.checking : ''}`}
              onClick={handleCheck}
              disabled={checking || !draftText.trim()}
            >
              {checking ? 'Checking…' : 'Check continuity'}
            </button>
          </div>
        </div>

        <div className={styles.editorBody}>
          {/* Show highlighted overlay when results exist, raw textarea otherwise */}
          {hasResults && explained.length > 0 ? (
            <div className={styles.draftOverlay}>
              {buildHighlightedContent(draftText, explained, activeFlagNum, handleFlagClick)}
            </div>
          ) : (
            <textarea
              className={styles.draftTextarea}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Write your new scene or chapter here, then click 'Check continuity'…"
              spellCheck={false}
            />
          )}

          {/* "Edit draft" link when in overlay mode */}
          {hasResults && (
            <div style={{ maxWidth: '680px', margin: '0 auto', marginTop: 'var(--space-4)' }}>
              <button
                className={styles.editDraftBtn}
                onClick={() => { setHasResults(false); setExplained([]); setActiveFlagNum(null) }}
              >
                Edit draft
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ── RIGHT: Margin notes ── */}
      <aside className={styles.rightPanel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelLabel}>Editor Notes</span>
        </div>
        <div className={styles.marginScroll}>
          <AnimatePresence mode="popLayout">
            {explained.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={styles.noFlags}
              >
                <span className={styles.noFlagsIcon}>∅</span>
                <p className={styles.noFlagsText}>
                  {hasResults
                    ? 'No contradictions found. The draft is consistent with established canon.'
                    : 'Flags will appear here after you run a continuity check.'}
                </p>
              </motion.div>
            ) : (
              explained.map((flag) => (
                <motion.div
                  key={flag.flagNumber}
                  ref={(el) => { noteRefs.current[flag.flagNumber] = el }}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ delay: flag.flagNumber * 0.08, duration: 0.3 }}
                  className={`${styles.noteCard} ${activeFlagNum === flag.flagNumber ? styles.active : ''}`}
                  onClick={() => setActiveFlagNum(flag.flagNumber)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.noteHeader}>
                    <span className={styles.noteType}>{flag.flagType}</span>
                    <span className={styles.noteConfidence}>{flag.confidence}</span>
                  </div>
                  <p className={styles.noteExplanation}>{flag.explanation}</p>
                  <p className={styles.noteSource}>
                    Established in: {flag.establishedIn}
                  </p>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </aside>

    </div>
  )
}
