'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
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

const PIPELINE = [
  { num: '01', label: 'Upload',  sub: 'Docling Engine' },
  { num: '02', label: 'Parse',   sub: 'IBM Granite' },
  { num: '03', label: 'Extract', sub: 'Knowledge Store' },
  { num: '04', label: 'Verify',  sub: 'Continuity Reasoning' },
  { num: '05', label: 'Canon',   sub: 'Explanation Agent' },
]

export default function LandingPage() {
  return (
    <div data-landing="true" className={styles.landingContainer}>
      {/* ── Landing Navigation with Apple Backdrop Blur ── */}
      <nav className={styles.landingNav}>
        <Link href="/" className={styles.landingWordmark}>
          Continuum<span>.</span>
        </Link>
        <div className={styles.navActions}>
          <Link href="/manuscript" className={styles.ctaNavBtn}>
            Open workspace →
          </Link>
        </div>
      </nav>

      {/* ── Hero Text Block (Headline First, followed by 72vh Hero Photograph) ── */}
      <section className={styles.heroHeaderSection}>
        <motion.div
          className={styles.heroHeaderContent}
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

          <motion.div variants={heroItem} className={styles.heroCtaWrapper}>
            <Link href="/manuscript" className={styles.ctaBtn}>
              <span>Open the workspace</span>
              <span className={styles.ctaArrow}>→</span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Massive 72vh Full-Width Editorial Hero Photograph (0px Gallery Frame) */}
        <motion.div
          className={styles.heroBannerFrame}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: EASE_EDITORIAL }}
        >
          <div className="editorialGalleryFrame">
            <div className={styles.heroBanner}>
              <motion.img
                src="/images/hero.jpg"
                alt="Museum-quality walnut writing desk editorial photography"
                className={`${styles.heroBannerImage} editorialImage`}
                initial={{ scale: 1.04 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.6, ease: EASE_EDITORIAL }}
              />
            </div>
          </div>
        </motion.div>
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

      {/* ── Architecture Section: Minimal Geometric Light-Connected Pipeline ── */}
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
          <p className={styles.prose}>
            Five floating geometric nodes connected with animated light streams — passing
            structured JSON context without heavyweight frameworks or ASCII clutter.
          </p>
        </div>

        <div className={styles.pipelineWrapper}>
          <div className={styles.geometricPipeline}>
            {PIPELINE.map((node, i) => (
              <Fragment key={node.label}>
                {/* Floating Glass Node */}
                <motion.div
                  className={styles.geometricNodeCard}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ delay: i * 0.12, duration: 0.65, ease: EASE_EDITORIAL }}
                  whileHover={{ y: -4, transition: { duration: 0.3 } }}
                >
                  <div className={styles.nodeHeader}>
                    <span className={styles.nodePoint} />
                    <span className={styles.nodeNum}>{node.num}</span>
                  </div>
                  <h4 className={styles.nodeLabel}>{node.label}</h4>
                  <p className={styles.nodeSub}>{node.sub}</p>
                </motion.div>

                {/* Light-Stream Connector Line (No arrows, geometric minimal) */}
                {i < PIPELINE.length - 1 && (
                  <div className={styles.lightConnector}>
                    <div className={styles.lightTrack}>
                      <motion.div
                        className={styles.lightPulse}
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ delay: i * 0.12 + 0.2, duration: 0.75, ease: EASE_EDITORIAL }}
                      />
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
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


