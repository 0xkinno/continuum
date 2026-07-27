'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getStoryGraph } from '@/lib/api'
import type { StoryGraphData } from '@/lib/types'

interface StoryGraphProps {
  characterName: string
  onSelectCharacter: (name: string) => void
}

export function StoryGraph({ characterName, onSelectCharacter }: StoryGraphProps) {
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

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-amber-900/60" />
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-soft)]">
          Compiling Story Graph for {characterName}…
        </p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="py-12 px-6 rounded-lg border border-amber-950/10 bg-[var(--color-paper-dim)] text-center space-y-4">
        <p className="font-serif italic text-lg text-amber-900/80">
          {error || 'No story graph available for this character.'}
        </p>
        <p className="font-mono text-xs text-[var(--color-ink-soft)]">
          Select another character card from Canon Overview to inspect their visual narrative graph.
        </p>
      </div>
    )
  }

  const { character, appearsIn, relationships, possessions, knowledgeTimeline, eventTimeline } = data

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="border-b border-amber-950/10 pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ink-soft)] block mb-1">
              Visual Story Graph & Narrative Connections
            </span>
            <h2 className="font-serif text-3xl md:text-4xl text-[var(--color-ink)]">
              {character.name}
            </h2>
          </div>
          {character.aliases && character.aliases.length > 0 && (
            <div className="font-mono text-xs text-[var(--color-ink-soft)]">
              Known as: <span className="text-amber-900">{character.aliases.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Traits & Attributes tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(character.attributes).map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center px-2.5 py-1 rounded bg-amber-900/5 border border-amber-900/10 font-mono text-[11px] text-amber-900"
            >
              <span className="opacity-60 mr-1.5 uppercase">{k}:</span> {v}
            </span>
          ))}
          {character.traits.map((t, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2.5 py-1 rounded bg-[var(--color-paper-dim)] border border-amber-950/10 font-serif italic text-xs text-[var(--color-ink-soft)]"
            >
              {t.trait}
            </span>
          ))}
        </div>
      </div>

      {/* 4-Column Clean Editorial Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Column 1: APPEARS IN */}
        <div className="bg-[var(--color-paper-dim)] rounded-lg p-5 border border-amber-950/10 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-950/10 pb-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-soft)]">
              Appears In
            </h3>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-900/10 text-amber-900">
              {appearsIn.length}
            </span>
          </div>
          {appearsIn.length === 0 ? (
            <p className="font-mono text-xs text-[var(--color-ink-soft)] italic">No explicit chapters logged</p>
          ) : (
            <ul className="space-y-2">
              {appearsIn.map((chapter, idx) => (
                <li
                  key={idx}
                  className="font-mono text-xs text-[var(--color-ink)] flex items-center gap-2 py-1 border-b border-amber-950/5 last:border-0"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-700/60" />
                  {chapter}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Column 2: RELATIONSHIPS */}
        <div className="bg-[var(--color-paper-dim)] rounded-lg p-5 border border-amber-950/10 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-950/10 pb-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-soft)]">
              Relationships
            </h3>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-900/10 text-amber-900">
              {relationships.length}
            </span>
          </div>
          {relationships.length === 0 ? (
            <p className="font-mono text-xs text-[var(--color-ink-soft)] italic">No direct relationships logged</p>
          ) : (
            <div className="space-y-3">
              {relationships.map((rel, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded border border-amber-950/10 bg-[var(--color-paper)] hover:border-amber-700/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-900/10 text-amber-900">
                      {rel.type}
                    </span>
                    <button
                      onClick={() => onSelectCharacter(rel.withCharacter)}
                      className="font-serif text-sm font-semibold text-amber-900 hover:underline flex items-center gap-1 group text-left"
                    >
                      {rel.withCharacter}
                      <span className="font-mono text-xs transition-transform group-hover:translate-x-0.5">→</span>
                    </button>
                  </div>
                  <p className="font-serif italic text-xs text-[var(--color-ink-soft)]">
                    {rel.nature}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: POSSESSIONS */}
        <div className="bg-[var(--color-paper-dim)] rounded-lg p-5 border border-amber-950/10 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-950/10 pb-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-soft)]">
              Possessions
            </h3>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-900/10 text-amber-900">
              {possessions.length}
            </span>
          </div>
          {possessions.length === 0 ? (
            <p className="font-mono text-xs text-[var(--color-ink-soft)] italic">No items logged</p>
          ) : (
            <ul className="space-y-2">
              {possessions.map((item, idx) => (
                <li
                  key={idx}
                  className="p-2.5 rounded bg-[var(--color-paper)] border border-amber-950/5 font-serif text-xs text-[var(--color-ink)] leading-relaxed"
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Column 4: TIMELINE */}
        <div className="bg-[var(--color-paper-dim)] rounded-lg p-5 border border-amber-950/10 space-y-4">
          <div className="flex items-center justify-between border-b border-amber-950/10 pb-2">
            <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-soft)]">
              Timeline
            </h3>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-900/10 text-amber-900">
              {eventTimeline.length}
            </span>
          </div>
          {eventTimeline.length === 0 ? (
            <p className="font-mono text-xs text-[var(--color-ink-soft)] italic">No events logged</p>
          ) : (
            <div className="relative pl-3 space-y-4 border-l border-amber-900/20">
              {eventTimeline.map((ev, idx) => (
                <div key={idx} className="relative group">
                  <span className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-amber-800 ring-4 ring-[var(--color-paper-dim)]" />
                  <span className="font-mono text-[10px] text-amber-900 block uppercase tracking-wider mb-0.5">
                    {ev.position}
                  </span>
                  <p className="font-serif text-xs text-[var(--color-ink)] leading-snug">
                    {ev.summary}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Knowledge Timeline Section */}
      {knowledgeTimeline.length > 0 && (
        <div className="bg-[var(--color-paper-dim)] rounded-lg p-6 border border-amber-950/10">
          <h3 className="font-mono text-xs uppercase tracking-widest text-[var(--color-ink-soft)] mb-4 border-b border-amber-950/10 pb-2">
            Established Knowledge Milestones
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {knowledgeTimeline.map((k, idx) => (
              <div key={idx} className="p-3 rounded bg-[var(--color-paper)] border border-amber-950/10">
                <span className="font-mono text-[10px] text-amber-900 uppercase tracking-wider block mb-1">
                  After {k.establishedAfter}
                </span>
                <p className="font-serif text-xs text-[var(--color-ink)]">
                  {k.item}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}
