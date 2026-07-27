'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import { getCanon } from '@/lib/api'
import type { RetrievedFacts } from '@/lib/types'
import { StoryGraph } from '@/components/StoryGraph'
import styles from './canon.module.css'

export default function CanonPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const tabParam = searchParams.get('tab')
  const charParam = searchParams.get('character')

  const [activeTab, setActiveTab] = useState<'overview' | 'graph'>(tabParam === 'graph' ? 'graph' : 'overview')
  const [selectedCharacter, setSelectedCharacter] = useState<string>(charParam || 'Maren Ashcroft')

  const [facts, setFacts]   = useState<RetrievedFacts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 60])

  useEffect(() => {
    if (tabParam === 'graph') {
      setActiveTab('graph')
    } else {
      setActiveTab('overview')
    }
    if (charParam) {
      setSelectedCharacter(charParam)
    }
  }, [tabParam, charParam])

  useEffect(() => {
    getCanon()
      .then((res) => {
        if (res.success && res.facts) {
          setFacts(res.facts)
          if (!charParam && res.facts.characters.length > 0) {
            setSelectedCharacter(res.facts.characters[0].name)
          }
        } else {
          setError(res.error ?? 'Could not load canon.')
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Network error'))
      .finally(() => setLoading(false))
  }, [charParam])

  const handleSelectCharacterForGraph = (charName: string) => {
    setSelectedCharacter(charName)
    setActiveTab('graph')
    router.push(`/canon?tab=graph&character=${encodeURIComponent(charName)}`)
  }

  const handleTabChange = (tab: 'overview' | 'graph') => {
    setActiveTab(tab)
    if (tab === 'graph') {
      router.push(`/canon?tab=graph&character=${encodeURIComponent(selectedCharacter)}`)
    } else {
      router.push('/canon?tab=overview')
    }
  }

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
            built automatically from your uploaded documents and visual artifacts.
          </p>

          {/* Sub-nav toggle: Overview | Graph */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => handleTabChange('overview')}
              className={`px-5 py-2 rounded-full font-mono text-xs uppercase tracking-widest transition-all ${
                activeTab === 'overview'
                  ? 'bg-amber-900 text-amber-50 shadow-md ring-1 ring-amber-700/50'
                  : 'bg-amber-950/20 text-amber-200/70 hover:bg-amber-900/30 hover:text-amber-100'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => handleTabChange('graph')}
              className={`px-5 py-2 rounded-full font-mono text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
                activeTab === 'graph'
                  ? 'bg-amber-900 text-amber-50 shadow-md ring-1 ring-amber-700/50'
                  : 'bg-amber-950/20 text-amber-200/70 hover:bg-amber-900/30 hover:text-amber-100'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18" />
              </svg>
              Story Graph
            </button>
          </div>
        </header>
      </div>

      {loading && <p className={styles.loading}>Loading canon…</p>}

      {error && (
        <div className={styles.empty}>
          <p className={styles.emptyLabel}>Error</p>
          <p className={styles.emptyText}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {activeTab === 'graph' ? (
            <div className="max-w-7xl mx-auto px-4 py-8">
              {/* Character switcher pills */}
              {facts && facts.characters.length > 0 && (
                <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-amber-950/10 pb-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-soft)] mr-2">
                    Select Character:
                  </span>
                  {facts.characters.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleSelectCharacterForGraph(c.name)}
                      className={`px-3 py-1 rounded font-serif text-xs transition-all ${
                        selectedCharacter === c.name
                          ? 'bg-amber-900 text-amber-50 font-semibold shadow-sm'
                          : 'bg-[var(--color-paper-dim)] text-[var(--color-ink)] hover:bg-amber-900/10'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              <StoryGraph
                characterName={selectedCharacter}
                onSelectCharacter={handleSelectCharacterForGraph}
              />
            </div>
          ) : (
            facts && (
              <>
                {/* ── Characters ─────────────────────────────────────────────────── */}
                <section className={styles.section}>
                  <h2 className={styles.sectionHeading}>Characters</h2>

                  {facts.characters.length === 0 ? (
                    <div className={styles.empty}>
                      <p className={styles.emptyLabel}>No characters yet</p>
                      <p className={styles.emptyText}>Upload a chapter, character sheet, or artifact image to populate this section.</p>
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
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => handleSelectCharacterForGraph(char.name)}
                              className="text-left group"
                            >
                              <h3 className={`${styles.characterName} group-hover:text-amber-900 transition-colors inline-flex items-center gap-1.5`}>
                                {char.name}
                                <span className="font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                              </h3>
                            </button>
                            <button
                              onClick={() => handleSelectCharacterForGraph(char.name)}
                              className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-900/10 text-amber-900 hover:bg-amber-900/20 transition-colors"
                            >
                              Graph
                            </button>
                          </div>

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
                                <p key={ti} className={styles.characterItem}>
                                  {t.trait}
                                  {t.sourceLabel && t.sourceLabel.toLowerCase().match(/\.(jpg|jpeg|png)$/) && (
                                    <svg className="w-3.5 h-3.5 inline ml-1.5 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <title>Image Artifact</title>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                      <circle cx="12" cy="13" r="3" strokeWidth="2" />
                                    </svg>
                                  )}
                                </p>
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
                                  <button
                                    onClick={() => handleSelectCharacterForGraph(r.withCharacter)}
                                    className="hover:underline hover:text-amber-900"
                                  >
                                    {r.withCharacter}
                                  </button>{' '}
                                  — {r.nature}
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
                          <p className={styles.timelinePos}>
                            {ev.position || ev.sourceLabel}
                            {ev.sourceLabel && ev.sourceLabel.toLowerCase().match(/\.(jpg|jpeg|png)$/) && (
                              <svg className="w-3.5 h-3.5 inline ml-1.5 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <title>Image Artifact</title>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <circle cx="12" cy="13" r="3" strokeWidth="2" />
                              </svg>
                            )}
                          </p>
                          <p className={styles.timelineSummary}>{ev.summary}</p>
                          {ev.characters.length > 0 && (
                            <p className={styles.timelineChars}>
                              Characters:{' '}
                              {ev.characters.map((cName, cIdx) => (
                                <span key={cIdx}>
                                  <button
                                    onClick={() => handleSelectCharacterForGraph(cName)}
                                    className="hover:underline hover:text-amber-900"
                                  >
                                    {cName}
                                  </button>
                                  {cIdx < ev.characters.length - 1 ? ', ' : ''}
                                </span>
                              ))}
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
                            {rule.sourceLabel && rule.sourceLabel.toLowerCase().match(/\.(jpg|jpeg|png)$/) && (
                              <svg className="w-3.5 h-3.5 inline ml-1.5 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <title>Image Artifact</title>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <circle cx="12" cy="13" r="3" strokeWidth="2" />
                              </svg>
                            )}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )
          )}
        </>
      )}
    </div>
  )
}
