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

import { healthRoutes } from './routes/health.js';
import { ingestRoutes } from './routes/ingest.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { continuityRoutes } from './routes/continuity.js';
import { historyRoutes } from './routes/history.js';
import { seedRoutes } from './routes/seed.js';

const PORT = Number(process.env.BACKEND_PORT ?? 3001);

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
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
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
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
