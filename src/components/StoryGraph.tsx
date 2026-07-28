'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getStoryGraph } from '@/lib/api'
import type { StoryGraphData } from '@/lib/types'
import styles from './StoryGraph.module.css'

interface CharacterItem {
  name: string
  aliases?: string[]
}

interface StoryGraphProps {
  characterName: string
  allCharacters?: CharacterItem[]
  onSelectCharacter: (name: string) => void
}

export function StoryGraph({ characterName, allCharacters = [], onSelectCharacter }: StoryGraphProps) {
  const [data, setData] = useState<StoryGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    getStoryGraph(characterName)
      .then((res) => {
        if (!isMounted) return
        if (res.success && res.graph) {
          setData(res.graph)
        } else {
          setError(res.error || `Could not load story graph for ${characterName}`)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Error fetching story graph')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [characterName])

  return (
    <div className={styles.container}>
      {/* ── Character Selector Pills ────────────────────────────────────────── */}
      {allCharacters && allCharacters.length > 0 && (
        <motion.div
          className={styles.selectorSection}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <span className={styles.selectorLabel}>CHARACTER</span>
          <div className={styles.pillRow}>
            {allCharacters.map((char) => {
              const isSelected = char.name === characterName
              return (
                <button
                  key={char.name}
                  onClick={() => onSelectCharacter(char.name)}
                  className={isSelected ? styles.pillActive : styles.pill}
                >
                  {char.name}
                </button>
              )
            })}
          </div>
        </motion.div>
      )}

      {loading && (
        <div className={styles.loadingSpinner}>
          Compiling Story Graph for {characterName}…
        </div>
      )}

      {error && (
        <div className={styles.emptyText} style={{ textAlign: 'center', padding: '32px 0' }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
        >
          {/* ── Character Profile Card ────────────────────────────────────────── */}
          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <h2 className={styles.characterTitle}>{data.character.name}</h2>
              {data.character.aliases && data.character.aliases.length > 0 && (
                <p className={styles.characterSubtitle}>
                  Known as: {data.character.aliases.join(', ')}
                </p>
              )}
            </div>

            <div className={styles.divider} />

            {/* Structured Attributes Grid */}
            <div className={styles.attributeGrid}>
              {Object.entries(data.character.attributes).map(([key, val]) => (
                <div key={key} className={styles.attributeCell}>
                  <span className={styles.attributeLabel}>{key}</span>
                  <span className={styles.attributeValue}>{val}</span>
                </div>
              ))}
            </div>

            {/* Traits */}
            {data.character.traits && data.character.traits.length > 0 && (
              <div className={styles.traitsRow}>
                {data.character.traits.map((t, idx) => (
                  <span key={idx} className={styles.traitBadge}>
                    {t.trait}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {/* ── 4-Column Story Graph Grid ─────────────────────────────────────── */}
          <div className={styles.graphGrid}>
            
            {/* Column 1: APPEARS IN */}
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <h3 className={styles.columnTitle}>APPEARS IN</h3>
                <span className={styles.itemCount}>{data.appearsIn.length}</span>
              </div>

              {data.appearsIn.length === 0 ? (
                <p className={styles.emptyText}>No explicit chapters logged</p>
              ) : (
                <ul className={styles.itemList}>
                  {data.appearsIn.map((ch, idx) => (
                    <li key={idx} className={styles.listItem}>
                      <span className={styles.dashMarker}>—</span>
                      <span>{ch}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Column 2: RELATIONSHIPS */}
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <h3 className={styles.columnTitle}>RELATIONSHIPS</h3>
                <span className={styles.itemCount}>{data.relationships.length}</span>
              </div>

              {data.relationships.length === 0 ? (
                <p className={styles.emptyText}>No direct relationships recorded</p>
              ) : (
                <div>
                  {/* Group relationships by type */}
                  {Array.from(new Set(data.relationships.map((r) => r.type))).map((type) => {
                    const relsOfType = data.relationships.filter((r) => r.type === type)
                    return (
                      <div key={type} className={styles.relGroup}>
                        <span className={styles.relTypeLabel}>{type}</span>
                        {relsOfType.map((rel, idx) => (
                          <div key={idx}>
                            <button
                              onClick={() => onSelectCharacter(rel.withCharacter)}
                              className={styles.relLink}
                            >
                              <span>{rel.withCharacter}</span>
                              <span className={styles.arrowIcon}>→</span>
                            </button>
                            {rel.nature && (
                              <span className={styles.relNature}>({rel.nature})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Column 3: POSSESSIONS */}
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <h3 className={styles.columnTitle}>POSSESSIONS</h3>
                <span className={styles.itemCount}>{data.possessions.length}</span>
              </div>

              {data.possessions.length === 0 ? (
                <p className={styles.emptyText}>No possessions recorded</p>
              ) : (
                <ul className={styles.itemList}>
                  {data.possessions.map((item, idx) => (
                    <li key={idx} className={styles.listItem}>
                      <span className={styles.dashMarker}>—</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Column 4: TIMELINE */}
            <div className={styles.column}>
              <div className={styles.columnHeader}>
                <h3 className={styles.columnTitle}>TIMELINE</h3>
                <span className={styles.itemCount}>{data.eventTimeline.length}</span>
              </div>

              {data.eventTimeline.length === 0 ? (
                <p className={styles.emptyText}>No timeline events recorded</p>
              ) : (
                <div className={styles.timelineContainer}>
                  {data.eventTimeline.map((ev, idx) => (
                    <div key={idx} className={styles.timelineItem}>
                      <span className={styles.timelineDot} />
                      <p className={styles.timelineText}>{ev.summary}</p>
                      <span className={styles.timelineSource}>{ev.position}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </motion.div>
      )}
    </div>
  )
}
