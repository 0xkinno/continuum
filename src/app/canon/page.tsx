'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { getCanon } from '@/lib/api'
import type { RetrievedFacts } from '@/lib/types'
import styles from './canon.module.css'

export default function CanonPage() {
  const [facts, setFacts]   = useState<RetrievedFacts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60])

  useEffect(() => {
    getCanon()
      .then((res) => {
        if (res.success && res.facts) setFacts(res.facts)
        else setError(res.error ?? 'Could not load canon.')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.hero} ref={heroRef}>
        <motion.img
          src="/images/canon-preview.jpg"
          alt=""
          className={`${styles.heroImage} editorialImage`}
          style={{ y: heroY }}
        />
        <div className={styles.heroOverlay} />
        <header className={styles.pageHeader}>
          <p className={styles.pageEyebrow}>Story Bible</p>
          <h1 className={styles.pageTitle}>Canon</h1>
          <p className={styles.pageSubtitle}>
            Every character, event, timeline marker, and established rule the story has set in place —
            built automatically from your uploaded documents.
          </p>
        </header>
      </div>

      {loading && <p className={styles.loading}>Loading canon…</p>}

      {error && (
        <div className={styles.empty}>
          <p className={styles.emptyLabel}>Error</p>
          <p className={styles.emptyText}>{error}</p>
        </div>
      )}

      {!loading && !error && facts && (

        <>
          {/* ── Characters ─────────────────────────────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Characters</h2>

            {facts.characters.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyLabel}>No characters yet</p>
                <p className={styles.emptyText}>Upload a chapter or character sheet to populate this section.</p>
              </div>
            ) : (
              <div className={styles.characterGrid}>
                {facts.characters.map((char, i) => (
                  <motion.div
                    key={char.name}
                    className={styles.characterCard}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ delay: i * 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <h3 className={styles.characterName}>{char.name}</h3>
                    {char.aliases.length > 0 && (
                      <p className={styles.characterAliases}>
                        also known as: {char.aliases.join(' · ')}
                      </p>
                    )}

                    {/* Attributes */}
                    {Object.keys(char.attributes).length > 0 && (
                      <div className={styles.characterSection}>
                        <p className={styles.characterSectionLabel}>Attributes</p>
                        {Object.entries(char.attributes).map(([k, v]) => (
                          <div key={k} className={styles.attrRow}>
                            <span className={styles.attrKey}>{k}</span>
                            <span>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Traits */}
                    {char.traits.length > 0 && (
                      <div className={styles.characterSection}>
                        <p className={styles.characterSectionLabel}>Traits</p>
                        {char.traits.map((t, ti) => (
                          <p key={ti} className={styles.characterItem}>{t.trait}</p>
                        ))}
                      </div>
                    )}

                    {/* Knowledge */}
                    {char.knowledge.length > 0 && (
                      <div className={styles.characterSection}>
                        <p className={styles.characterSectionLabel}>Knowledge</p>
                        {char.knowledge.map((k, ki) => (
                          <p key={ki} className={styles.characterItem}>
                            {k.item}
                            {k.establishedAfter && (
                              <> <span style={{ color: 'var(--color-ink-soft)' }}>— after {k.establishedAfter}</span></>
                            )}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Relationships */}
                    {char.relationships.length > 0 && (
                      <div className={styles.characterSection}>
                        <p className={styles.characterSectionLabel}>Relationships</p>
                        {char.relationships.map((r, ri) => (
                          <p key={ri} className={styles.characterItem}>
                            {r.withCharacter} — {r.nature}
                          </p>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* ── Timeline ───────────────────────────────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Timeline</h2>

            {facts.events.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyLabel}>No events yet</p>
                <p className={styles.emptyText}>Events will appear here once documents have been ingested.</p>
              </div>
            ) : (
              <div className={styles.timeline}>
                {facts.events.map((ev, i) => (
                  <motion.div
                    key={ev.extId}
                    className={styles.timelineEvent}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ delay: i * 0.08, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <div className={styles.timelineDot} />
                    <p className={styles.timelinePos}>{ev.position || ev.sourceLabel}</p>
                    <p className={styles.timelineSummary}>{ev.summary}</p>
                    {ev.characters.length > 0 && (
                      <p className={styles.timelineChars}>
                        Characters: {ev.characters.join(', ')}
                      </p>
                    )}
                    {ev.establishes.length > 0 && (
                      <div className={styles.timelineEstablishes}>
                        {ev.establishes.map((f, fi) => (
                          <p key={fi} className={styles.timelineEstablishItem}>{f}</p>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </section>

          {/* ── Established Rules ──────────────────────────────────────────── */}
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Established Rules</h2>

            {facts.rules.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyLabel}>No rules yet</p>
                <p className={styles.emptyText}>World rules and constraints will appear here after ingestion.</p>
              </div>
            ) : (
              <div className={styles.rulesList}>
                {facts.rules.map((rule, i) => (
                  <motion.div
                    key={i}
                    className={styles.ruleItem}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <p className={styles.ruleText}>&ldquo;{rule.rule}&rdquo;</p>
                    {rule.evidence && (
                      <p className={styles.ruleEvidence}>{rule.evidence}</p>
                    )}
                    <p className={styles.ruleSource}>
                      Established in {rule.sourceLoc || rule.sourceLabel}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
