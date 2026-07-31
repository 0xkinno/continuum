'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import ArchitectureDiagram from '@/components/ArchitectureDiagram'
import styles from './landing.module.css'

const EASE_EDITORIAL = [0.22, 1, 0.36, 1] as const

const heroStagger = {
  initial: {},
  animate: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

const heroItem = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE_EDITORIAL } },
}

export default function LandingPage() {
  return (
    <div data-landing="true" className={styles.landingContainer}>
      {/* ── 2-Column Editorial Hero Composition ── */}
      <section className={styles.heroHeaderSection}>
        <div className={styles.heroGrid}>
          {/* Left Column: Eyebrow, Headline, Supporting Paragraph */}
          <motion.div
            className={styles.heroLeftContent}
            initial="initial"
            animate="animate"
            variants={heroStagger}
          >
            <motion.p variants={heroItem} className={styles.heroEyebrow}>
              IBM watsonx · Granite Reasoning · Docling Parser
            </motion.p>

            <motion.h1 variants={heroItem} className={styles.heroHeading}>
              The continuity engine for serious storytellers.
            </motion.h1>

            <motion.p variants={heroItem} className={styles.heroSub}>
              Upload your chapters, scripts, and character sheets. Write new scenes.
              Continuum flags every contradiction with a clear editorial explanation —
              powered by IBM Granite and a queryable story-fact model.
            </motion.p>
          </motion.div>

          {/* Right Column: Complete Editorial Manuscript Photograph */}
          <motion.div
            className={styles.heroRightFrame}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 0.3, ease: EASE_EDITORIAL }}
          >
            <img
              src="/images/hero.jpg"
              alt="Museum-quality walnut writing desk editorial photography"
              className={styles.heroBannerImage}
            />
          </motion.div>
        </div>
      </section>

      {/* ── Problem Section: Editorial Card Panel ── */}
      <motion.section
        className={styles.section}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: EASE_EDITORIAL }}
        viewport={{ once: true, amount: 0.15 }}
      >
        <div className={styles.sectionInner}>
          <div className={styles.featurePanel}>
            <p className={styles.sectionEyebrow}>The problem</p>
            <h2 className={styles.sectionHeading}>Continuity breaks silently.</h2>
            <p className={styles.prose}>
              Every novelist, screenwriter, and game writer knows the feeling: you&rsquo;re
              fifty thousand words in, and a character suddenly knows something they couldn&rsquo;t
              possibly know yet. A location shifts without explanation. A rule of the world is
              quietly violated. By the time a reader catches it, the damage is done.
            </p>
            <p className={styles.prose} style={{ marginTop: 'var(--space-6)' }}>
              The problem isn&rsquo;t carelessness. It&rsquo;s scale. Long-form creative work
              accumulates more established facts than any human mind can hold in active memory.
              Current tools — outlines, spreadsheets, style bibles — require the writer to do
              the checking manually. Continuum does it automatically in real time.
            </p>
          </div>
        </div>
      </motion.section>

      {/* ── Campaign Photographic Divider 2: Close-up Fountain Pen ── */}
      <section className={styles.photoDividerSection}>
        <div className="editorialGalleryFrame">
          <div className={styles.photoDividerFrame}>
            <img
              src="/images/macro-pen.jpg"
              alt="Macro editorial fountain pen resting on manuscript"
              className={`${styles.photoDividerImage} editorialImage`}
            />
          </div>
        </div>
      </section>

      {/* ── Solution Section & Glass Feature Cards ── */}
      <motion.section
        className={styles.section}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: EASE_EDITORIAL }}
        viewport={{ once: true, amount: 0.15 }}
      >
        <div className={styles.sectionInner}>
          <p className={styles.sectionEyebrow}>The solution</p>
          <h2 className={styles.sectionHeading}>A four-agent pipeline that reads your story.</h2>
          <p className={styles.prose}>
            Continuum builds a queryable model of your established facts — characters,
            knowledge, events, rules — and checks every new scene against it in real time.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {[
            {
              num: '01', title: 'Ingest',
              desc: 'Upload any format — plain text, Markdown, PDF, Word doc. Docling converts it to clean text. IBM Granite extracts every established fact into a structured model: characters, traits, timeline markers, world rules.',
            },
            {
              num: '02', title: 'Check',
              desc: 'Write a new scene. Granite reads it, identifies every factual claim, and checks each one against your knowledge store step by step — not a single-shot judgment, but a structured reasoning trace with confidence levels.',
            },
            {
              num: '03', title: 'Explain',
              desc: 'Contradictions appear as inline margin notes — written in the tone of a human continuity editor. Not "error: field mismatch", but a clear sentence explaining what conflicts, where it was established, and why it matters.',
            },
          ].map((f, i) => (
            <motion.div
              key={f.num}
              className={styles.featureItem}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.14, duration: 0.7, ease: EASE_EDITORIAL }}
            >
              <span className={styles.featureNum}>{f.num}</span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Architecture Section: SVG Hand-Drawn Excalidraw Component ── */}
      <motion.section
        className={styles.section}
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: EASE_EDITORIAL }}
        viewport={{ once: true, amount: 0.15 }}
      >
        <div className={styles.sectionInner}>
          <p className={styles.sectionEyebrow}>Architecture</p>
          <h2 className={styles.sectionHeading}>Four agents. One pipeline.</h2>
          <p className={styles.prose} style={{ marginBottom: 'var(--space-8)' }}>
            Sequential agent flow using IBM Granite reasoning and a queryable 12-table SQLite fact store.
          </p>
        </div>

        <div style={{ marginTop: 'var(--space-4)' }}>
          <ArchitectureDiagram />
        </div>
      </motion.section>

      {/* ── Campaign Photographic Divider 3: Literary Archive Composition ── */}
      <section className={styles.photoDividerSection}>
        <div className="editorialGalleryFrame">
          <div className={styles.photoDividerFrame}>
            <img
              src="/images/archive-notes.jpg"
              alt="Literary archive composition with character sheets and notes"
              className={`${styles.photoDividerImage} editorialImage`}
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerWordmark}>Continuum — Creative Continuity Engine</span>
          <span className={styles.footerCredit}>
            Built with IBM Bob · watsonx.ai · Docling · IBM Granite
          </span>
        </div>
      </footer>
    </div>
  )
}
