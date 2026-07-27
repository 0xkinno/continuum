'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { getHistory } from '@/lib/api'
import type { HistoryListItem } from '@/lib/types'
import styles from './history.module.css'

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function HistoryPage() {
  const [checks, setChecks]   = useState<HistoryListItem[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60])

  useEffect(() => {
    getHistory(50, 0)
      .then((res) => {
        if (res.success) {
          setChecks(res.checks ?? [])
          setTotal(res.total ?? 0)
        } else {
          setError(res.error ?? 'Could not load history.')
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.hero} ref={heroRef}>
        <motion.img
          src="/images/history-preview.jpg"
          alt=""
          className={`${styles.heroImage} editorialImage`}
          style={{ y: heroY }}
        />
        <div className={styles.heroOverlay} />
        <header className={styles.pageHeader}>
          <p className={styles.pageEyebrow}>Audit Log</p>
          <h1 className={styles.pageTitle}>History</h1>
          <p className={styles.pageSubtitle}>
            Every continuity check you have run — {total} total.
          </p>
        </header>
      </div>

      {loading && <p className={styles.loading}>Loading history…</p>}

      {error && (
        <div className={styles.empty}>
          <p className={styles.emptyLabel}>Error</p>
          <p className={styles.emptyText}>{error}</p>
        </div>
      )}

      {!loading && !error && checks.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyLabel}>No checks yet</p>
          <p className={styles.emptyText}>
            Run your first continuity check from the Manuscript view to see results here.
          </p>
        </div>
      )}

      {!loading && checks.length > 0 && (
        <div className={styles.list}>
          {checks.map((check, i) => (
            <motion.div
              key={check.id}
              className={styles.row}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className={styles.rowLeft}>
                <p className={styles.excerpt}>
                  {check.draft_excerpt.length > 0
                    ? `"${check.draft_excerpt.slice(0, 90)}${check.draft_excerpt.length >= 90 ? '…' : ''}"`
                    : '(empty draft)'}
                </p>
                <div className={styles.meta}>
                  <span>{formatDate(check.checked_at)}</span>
                  <span>{check.draft_length.toLocaleString()} chars</span>
                  <span>{check.claims_count} claim{check.claims_count !== 1 ? 's' : ''} extracted</span>
                </div>
              </div>
              <span className={`${styles.flagBadge} ${check.flag_count > 0 ? styles.hasFlags : styles.noFlags}`}>
                {check.flag_count > 0
                  ? `${check.flag_count} flag${check.flag_count !== 1 ? 's' : ''}`
                  : 'No flags'}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
