/**
 * Phase 1 — Health-check route
 * GET /health → 200 { status, version, timestamp }
 */

import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      services: {
        watsonx: process.env.WATSONX_API_KEY ? 'configured' : 'not-configured',
      },
    });
  });
}
