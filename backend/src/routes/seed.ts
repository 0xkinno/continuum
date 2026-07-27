/**
 * Seed Route — Phase 7
 *
 * POST /seed/demo  — clear the database and re-ingest the demo project
 *
 * This runs the same logic as seed-demo.ts but as an HTTP endpoint so
 * judges can reset the demo with one button click from the UI.
 *
 * Response streams progress as newline-delimited JSON (NDJSON) so the
 * frontend can show live status without waiting for the full operation.
 *
 * Each line: { step: string, status: 'progress'|'ok'|'error', detail?: string }
 * Final line: { step: 'done', status: 'ok'|'error', flagCount: number, allCaught: boolean }
 */

import type { FastifyInstance } from 'fastify';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { clearAllDemoData } from '../lib/clearDemo.js';
import { directIngestFile } from '../agents/directIngest.js';
import { checkDraft } from '../agents/continuityAgent.js';
import { explainFlags } from '../agents/explanationAgent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, '..', 'seed', 'demo-data');

const DEMO_DOCUMENTS = [
  { path: join(DEMO_DIR, 'chapters', 'chapter-01.md'), label: 'chapter-01.md' },
  { path: join(DEMO_DIR, 'chapters', 'chapter-02.md'), label: 'chapter-02.md' },
  { path: join(DEMO_DIR, 'chapters', 'chapter-03.md'), label: 'chapter-03.md' },
  { path: join(DEMO_DIR, 'chapters', 'chapter-04.md'), label: 'chapter-04.md' },
  { path: join(DEMO_DIR, 'characters', 'character-sheet.md'), label: 'character-sheet.md' },
];

// Keywords for the 3 expected contradictions (mirrors seed-demo.ts)
const EXPECTED_KEYWORDS = [
  ['paired resonance', 'paired', 'fenwick', 'chapter 3', 'before arriving'],
  ['two stroke', 'two-stroke', 'second law', 'unbroken', 'single motion', 'warding circle', 'chalk'],
  ['salt water', 'active', 'actively', 'uncovered', 'third law', 'currently resonating', 'past trail'],
];

function flagMatchesKeywords(flag: { claim: string; conflictsWith: string; explanation: string; establishedIn: string; flagType: string }, keywords: string[]): boolean {
  const haystack = [flag.claim, flag.conflictsWith, flag.explanation, flag.establishedIn, flag.flagType].join(' ').toLowerCase();
  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

export async function seedRoutes(app: FastifyInstance) {
  /**
   * POST /seed/demo
   *
   * Streams NDJSON progress lines while seeding.
   * Client should read the stream and parse each line independently.
   */
  app.post('/demo', async (request, reply) => {
    reply.raw.setHeader('Content-Type', 'application/x-ndjson');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Transfer-Encoding', 'chunked');

    const emit = (obj: Record<string, unknown>) => {
      reply.raw.write(JSON.stringify(obj) + '\n');
    };

    try {
      // Step 1: Clear data
      emit({ step: 'clear', status: 'progress', detail: 'Clearing existing data…' });
      clearAllDemoData();
      emit({ step: 'clear', status: 'ok', detail: 'Database cleared' });

      // Step 2: Ingest documents
      for (const doc of DEMO_DOCUMENTS) {
        emit({ step: 'ingest', status: 'progress', detail: `Ingesting ${doc.label}…` });
        const result = await directIngestFile(doc.path, doc.label);
        emit({
          step: 'ingest', status: 'ok',
          detail: `${doc.label} ingested (${result.characters} chars, ${result.events} events, ${result.rules} rules)`,
          label: doc.label,
          characters: result.characters,
          events: result.events,
          rules: result.rules,
        });
      }

      // Step 3: Run continuity check
      emit({ step: 'check', status: 'progress', detail: 'Running continuity check on test draft…' });
      const testDraft = await readFile(join(DEMO_DIR, 'test-draft.md'), 'utf-8');
      const checkResult = await checkDraft(testDraft);
      emit({ step: 'check', status: 'ok', detail: `${checkResult.claims.length} claims extracted, ${checkResult.flags.length} raw flags` });

      // Step 4: Generate explanations
      emit({ step: 'explain', status: 'progress', detail: 'Generating editorial explanations…' });
      const explained = await explainFlags(checkResult.flags);
      emit({ step: 'explain', status: 'ok', detail: `${explained.length} explanations generated` });

      // Step 5: Validate
      const caughtCount = EXPECTED_KEYWORDS.filter((kws) =>
        explained.some((f) => flagMatchesKeywords(f, kws)),
      ).length;

      const allCaught = caughtCount === 3;

      emit({
        step: 'done',
        status: allCaught ? 'ok' : 'warn',
        flagCount: explained.length,
        caughtCount,
        allCaught,
        detail: allCaught
          ? `All 3 contradictions caught. Demo is ready.`
          : `${caughtCount}/3 contradictions caught. Demo may need review.`,
        flags: explained.map((f) => ({
          flagNumber:    f.flagNumber,
          flagType:      f.flagType,
          claim:         f.claim,
          conflictsWith: f.conflictsWith,
          establishedIn: f.establishedIn,
          confidence:    f.confidence,
        })),
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      emit({ step: 'error', status: 'error', detail: message });
    } finally {
      reply.raw.end();
    }
  });

  /**
   * GET /seed/demo-draft
   *
   * Returns the raw text of the test draft so the frontend can
   * auto-populate the editor.
   */
  app.get('/demo-draft', async (_req, reply) => {
    try {
      const text = await readFile(join(DEMO_DIR, 'test-draft.md'), 'utf-8');
      return reply.status(200).send({ success: true, draftText: text });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: message });
    }
  });
}
