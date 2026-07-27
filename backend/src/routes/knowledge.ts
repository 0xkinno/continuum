/**
 * Knowledge Routes — Phase 3
 *
 * POST /knowledge/store   — persist a FactModel from the Ingestion Agent
 * GET  /knowledge/query   — retrieve facts by natural-language query
 * GET  /knowledge/sources — list all ingested source documents
 */

import type { FastifyInstance } from 'fastify';
import { upsertFactModel, retrieveFacts, listSources } from '../agents/knowledgeAgent.js';
import type { FactModel } from '../types/facts.js';

export async function knowledgeRoutes(app: FastifyInstance) {
  /**
   * POST /knowledge/store
   *
   * Body: { factModel: FactModel }
   * Response: { success: true, sourceId: number, sourceLabel: string }
   */
  app.post('/store', async (request, reply) => {
    const body = request.body as { factModel?: FactModel };

    if (!body?.factModel) {
      return reply.status(400).send({ success: false, error: 'Request body must contain a factModel field.' });
    }

    const factModel = body.factModel;

    // Validate minimum required fields
    if (!factModel.sourceHash || !factModel.sourceLabel) {
      return reply.status(400).send({ success: false, error: 'factModel must include sourceHash and sourceLabel.' });
    }

    try {
      const sourceId = upsertFactModel(factModel);
      request.log.info({ sourceId, sourceLabel: factModel.sourceLabel }, 'FactModel persisted to Knowledge store');
      return reply.status(200).send({ success: true, sourceId, sourceLabel: factModel.sourceLabel });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'Knowledge store error');
      return reply.status(500).send({ success: false, error: message });
    }
  });

  /**
   * GET /knowledge/query?q=<query>
   *
   * Returns all structured facts relevant to the query.
   * Response: { success: true, facts: RetrievedFacts }
   */
  app.get('/query', async (request, reply) => {
    const { q } = request.query as { q?: string };

    if (!q || !q.trim()) {
      return reply.status(400).send({ success: false, error: 'Provide a query string via ?q=' });
    }

    try {
      const facts = retrieveFacts(q.trim());
      return reply.status(200).send({ success: true, facts });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'Knowledge query error');
      return reply.status(500).send({ success: false, error: message });
    }
  });

  /**
   * GET /knowledge/sources
   * Lists all ingested source documents.
   */
  app.get('/sources', async (_req, reply) => {
    try {
      const sources = listSources();
      return reply.status(200).send({ success: true, sources });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ success: false, error: message });
    }
  });
}
