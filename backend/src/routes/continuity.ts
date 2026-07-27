/**
 * Continuity Routes — Phase 4 + 5
 *
 * POST /continuity/check   — check a draft (claims + flags + explanations)
 * POST /continuity/explain — explain a set of pre-computed flags (standalone)
 * GET  /continuity/health  — health-check
 *
 * The /check endpoint now runs the full pipeline:
 *   checkDraft → explainFlags → record to check_history
 * and returns both raw flags and explained flags in one response.
 */

import type { FastifyInstance } from 'fastify';
import { checkDraft } from '../agents/continuityAgent.js';
import { explainFlags } from '../agents/explanationAgent.js';
import { getDb } from '../lib/db.js';
import type { ContinuityFlag } from '../types/continuity.js';

export async function continuityRoutes(app: FastifyInstance) {
  /**
   * POST /continuity/check
   *
   * Body: { draftText: string }
   *
   * Response 200:
   *   {
   *     success: true,
   *     result: ContinuityCheckResult,    ← raw claims + flags
   *     explained: ExplainedFlag[],        ← Granite editorial notes
   *     historyId: number                  ← SQLite row id for this check
   *   }
   */
  app.post('/check', async (request, reply) => {
    const body = request.body as { draftText?: string };

    if (!body?.draftText || typeof body.draftText !== 'string' || !body.draftText.trim()) {
      return reply.status(400).send({
        success: false,
        error: 'Request body must contain a non-empty draftText string.',
      });
    }

    const draftText = body.draftText.trim();

    const MAX_DRAFT_CHARS = 40_000;
    if (draftText.length > MAX_DRAFT_CHARS) {
      return reply.status(400).send({
        success: false,
        error: `Draft text exceeds the ${MAX_DRAFT_CHARS}-character limit. Split it into sections.`,
      });
    }

    try {
      request.log.info({ draftLength: draftText.length }, 'Starting continuity check');

      // Step 1: Check draft for contradictions
      const result = await checkDraft(draftText);

      request.log.info(
        { claimsFound: result.claims.length, flagsFound: result.flags.length },
        'Continuity check complete',
      );

      // Step 2: Generate explanations for all flags
      const explained = await explainFlags(result.flags);

      request.log.info({ explanationsGenerated: explained.length }, 'Explanations generated');

      // Step 3: Record to history
      const db = getDb();
      const historyStmt = db.prepare(`
        INSERT INTO check_history (draft_excerpt, draft_length, flag_count, claims_count, result_json, checked_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const historyResult = historyStmt.run(
        draftText.slice(0, 100),
        draftText.length,
        result.flags.length,
        result.claims.length,
        JSON.stringify({ result, explained }),
        result.checkedAt,
      );
      const historyId = historyResult.lastInsertRowid as number;

      return reply.status(200).send({ success: true, result, explained, historyId });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'Continuity check error');
      return reply.status(500).send({ success: false, error: message });
    }
  });

  /**
   * POST /continuity/explain
   *
   * Standalone explanation endpoint — explain a pre-computed set of flags.
   * Body: { flags: ContinuityFlag[] }
   * Response: { success: true, explained: ExplainedFlag[] }
   */
  app.post('/explain', async (request, reply) => {
    const body = request.body as { flags?: ContinuityFlag[] };

    if (!Array.isArray(body?.flags)) {
      return reply.status(400).send({ success: false, error: 'Body must contain a flags array.' });
    }

    try {
      const explained = await explainFlags(body.flags);
      return reply.status(200).send({ success: true, explained });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: message });
    }
  });

  /**
   * GET /continuity/health
   */
  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', service: 'continuity' });
  });
}
