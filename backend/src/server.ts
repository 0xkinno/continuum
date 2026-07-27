/**
 * Continuum — Fastify Backend
 * Mounts all route plugins and starts the HTTP server.
 *
 * Phase 1:  /health       — health-check
 * Phase 2:  /ingest       — file upload → Docling → Granite fact-extraction
 * Phase 3:  /knowledge    — SQLite fact store (upsert + retrieval)
 * Phase 4:  /continuity   — draft contradiction-checking
 * Phase 5:  /history      — check history log
 * Phase 7:  /seed         — demo seeding endpoint
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { healthRoutes } from './routes/health.js';
import { ingestRoutes } from './routes/ingest.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { continuityRoutes } from './routes/continuity.js';
import { historyRoutes } from './routes/history.js';
import { seedRoutes } from './routes/seed.js';
import { listSources } from './agents/knowledgeAgent.js';
import { directIngestFile } from './agents/directIngest.js';

const PORT = Number(process.env.BACKEND_PORT ?? 3001);

async function autoSeedIfEmpty() {
  try {
    const sources = listSources();
    if (sources.length === 0) {
      console.log('[autoSeed] Database empty on startup. Auto-seeding demo project...');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const DEMO_DIR = join(__dirname, 'seed', 'demo-data');
      const docs = [
        { path: join(DEMO_DIR, 'chapters', 'chapter-01.md'), label: 'chapter-01.md' },
        { path: join(DEMO_DIR, 'chapters', 'chapter-02.md'), label: 'chapter-02.md' },
        { path: join(DEMO_DIR, 'chapters', 'chapter-03.md'), label: 'chapter-03.md' },
        { path: join(DEMO_DIR, 'chapters', 'chapter-04.md'), label: 'chapter-04.md' },
        { path: join(DEMO_DIR, 'characters', 'character-sheet.md'), label: 'character-sheet.md' },
      ];
      for (const d of docs) {
        await directIngestFile(d.path, d.label);
      }
      console.log('[autoSeed] Auto-seeding complete. Canon and Knowledge base populated.');
    }
  } catch (err) {
    console.error('[autoSeed] Error during auto-seed:', err);
  }
}

async function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // ── Plugins ───────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Max upload: 50 MB — generous for a multi-chapter document.
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(ingestRoutes,     { prefix: '/ingest' });
  await app.register(knowledgeRoutes,  { prefix: '/knowledge' });
  await app.register(continuityRoutes, { prefix: '/continuity' });
  await app.register(historyRoutes,    { prefix: '/history' });
  await app.register(seedRoutes,       { prefix: '/seed' });

  return app;
}

async function start() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  await autoSeedIfEmpty();
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
