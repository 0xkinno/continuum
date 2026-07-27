/**
 * History Routes — Phase 5
 *
 * GET /history/list         — list all continuity checks (most recent first)
 * GET /history/:id          — get one full check result by ID
 */

import type { FastifyInstance } from 'fastify';
import { getDb } from '../lib/db.js';

interface HistoryRow {
  id: number;
  draft_excerpt: string;
  draft_length: number;
  flag_count: number;
  claims_count: number;
  checked_at: string;
}

interface HistoryDetailRow extends HistoryRow {
  result_json: string;
}

export async function historyRoutes(app: FastifyInstance) {
  /**
   * GET /history/list?limit=50&offset=0
   *
   * Returns a paginated list of past checks (without full JSON payloads).
   */
  app.get('/list', async (request, reply) => {
    const { limit = '50', offset = '0' } = request.query as {
      limit?: string;
      offset?: string;
    };

    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const off = Math.max(parseInt(offset, 10) || 0, 0);

    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT id, draft_excerpt, draft_length, flag_count, claims_count, checked_at
        FROM check_history
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `).all(lim, off) as unknown as HistoryRow[];

      const total = (db.prepare('SELECT COUNT(*) as cnt FROM check_history').get() as unknown as { cnt: number }).cnt;

      return reply.status(200).send({ success: true, checks: rows, total, limit: lim, offset: off });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: message });
    }
  });

  /**
   * GET /history/:id
   *
   * Returns the full result + explanations for one check.
   */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const numId = parseInt(id, 10);

    if (isNaN(numId)) {
      return reply.status(400).send({ success: false, error: 'Invalid id.' });
    }

    try {
      const db = getDb();
      const row = db.prepare(`
        SELECT id, draft_excerpt, draft_length, flag_count, claims_count, checked_at, result_json
        FROM check_history WHERE id = ?
      `).get(numId) as unknown as HistoryDetailRow | undefined;

      if (!row) {
        return reply.status(404).send({ success: false, error: `No check found with id ${numId}.` });
      }

      const payload = JSON.parse(row.result_json) as unknown;

      return reply.status(200).send({
        success: true,
        check: {
          id:           row.id,
          draftExcerpt: row.draft_excerpt,
          draftLength:  row.draft_length,
          flagCount:    row.flag_count,
          claimsCount:  row.claims_count,
          checkedAt:    row.checked_at,
        },
        payload,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: message });
    }
  });
}
