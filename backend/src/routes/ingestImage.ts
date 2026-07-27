/**
 * Ingest Image Route — Part 1
 * POST /ingest/image
 *
 * Accepts a single image upload (multipart/form-data, field name: "file").
 * Allowed types: .jpg, .jpeg, .png
 *
 * Pipeline:
 *   1. Extract image file buffer
 *   2. Call Groq Vision API (describeImage) to convert visual content into rich text description
 *   3. Pass description text to Ingestion Agent (extractFacts) — Granite extracts facts
 *   4. Persist resulting FactModel into Knowledge Store (tagged with sourceType: "image")
 *   5. Return FactModel JSON
 */

import type { FastifyInstance } from 'fastify';
import { extname } from 'node:path';
import { describeImage } from '../lib/groqVisionClient.js';
import { extractFacts } from '../agents/ingestionAgent.js';
import { upsertFactModel } from '../agents/knowledgeAgent.js';

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

export async function ingestImageRoutes(app: FastifyInstance) {
  app.post('/image', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file field found in request. Send a multipart/form-data request with field name "file".',
        });
      }

      const originalName = data.filename ?? 'image_upload.png';
      const ext = extname(originalName).toLowerCase();

      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        await data.toBuffer();
        return reply.status(400).send({
          success: false,
          error: `Unsupported image type "${ext}". Allowed: .jpg, .jpeg, .png`,
        });
      }

      const buffer = await data.toBuffer();
      const mimeType = data.mimetype || (ext === '.png' ? 'image/png' : 'image/jpeg');

      request.log.info({ originalName, mimeType }, 'Analyzing image with Groq Vision');
      const description = await describeImage(buffer, mimeType, originalName);

      request.log.info({ sourceLabel: originalName }, 'Extracting facts from image description via Granite');
      const factModel = await extractFacts(description, originalName, 'image');

      const sourceId = upsertFactModel(factModel);
      request.log.info({ sourceId }, 'Image FactModel persisted to Knowledge store');

      return reply.status(200).send({
        success: true,
        sourceLabel: originalName,
        sourceType: 'image',
        sourceId,
        factModel,
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'Image ingest pipeline error');

      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });
}
