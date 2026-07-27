/**
 * Ingest Route — Phase 2
 * POST /ingest/upload
 *
 * Accepts a single file upload (multipart/form-data, field name: "file").
 * Allowed types: .txt, .md, .pdf, .docx
 *
 * Pipeline:
 *   1. Validate file type
 *   2. Save to a temporary path on disk
 *   3. Call Docling to convert to clean Markdown
 *   4. Call the Ingestion Agent (Granite) to extract structured facts
 *   5. Return the FactModel as JSON
 *
 * The caller can then pass the FactModel to the Knowledge Agent (Phase 3)
 * for persistence in SQLite.
 */

import type { FastifyInstance } from 'fastify';
import { createWriteStream, mkdirSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

import { parseWithDocling } from '../lib/doclingParser.js';
import { extractFacts } from '../agents/ingestionAgent.js';
import { upsertFactModel } from '../agents/knowledgeAgent.js';

// ── Allowed file extensions ───────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.pdf', '.docx']);

const ALLOWED_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

// ── Temp directory ────────────────────────────────────────────────────────────

const TEMP_DIR = join(tmpdir(), 'continuum-uploads');
mkdirSync(TEMP_DIR, { recursive: true });

// ── Route handler ─────────────────────────────────────────────────────────────

export async function ingestRoutes(app: FastifyInstance) {
  /**
   * POST /ingest/upload
   *
   * Multipart form fields:
   *   file  (required) — the document file
   *
   * Response 200:
   *   { success: true, sourceLabel, factModel: FactModel, doclingPageCount }
   *
   * Response 400 / 500:
   *   { success: false, error: string }
   */
  app.post('/upload', async (request, reply) => {
    let tempFilePath: string | null = null;

    try {
      // ── 1. Extract multipart file ─────────────────────────────────────────
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file field found in the request. Send a multipart/form-data request with field name "file".',
        });
      }

      const originalName = data.filename ?? 'upload';
      const ext = extname(originalName).toLowerCase();

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        // Drain the stream to avoid memory leaks before returning
        await data.toBuffer();
        return reply.status(400).send({
          success: false,
          error: `Unsupported file type "${ext}". Allowed: .txt, .md, .pdf, .docx`,
        });
      }

      // Optional MIME check (browsers may lie, extension check is the gate)
      const mime = data.mimetype;
      if (mime && !ALLOWED_MIME_TYPES.has(mime) && !mime.startsWith('text/')) {
        await data.toBuffer();
        return reply.status(400).send({
          success: false,
          error: `Unsupported MIME type "${mime}".`,
        });
      }

      // ── 2. Write to a temporary file ──────────────────────────────────────
      const tempFileName = `${randomUUID()}${ext}`;
      tempFilePath = join(TEMP_DIR, tempFileName);

      const writeStream = createWriteStream(tempFilePath);
      await pipeline(data.file, writeStream);

      request.log.info({ tempFilePath, originalName }, 'File saved to temp dir');

      // ── 3. Parse with Docling ─────────────────────────────────────────────
      request.log.info('Starting Docling parse');
      const { markdown, pageCount } = await parseWithDocling(tempFilePath);
      request.log.info({ pageCount, charCount: markdown.length }, 'Docling parse complete');

      if (!markdown.trim()) {
        return reply.status(422).send({
          success: false,
          error: 'Docling extracted no text from the uploaded file. The file may be empty, image-only, or password-protected.',
        });
      }

      // ── 4. Extract facts with Granite ─────────────────────────────────────
      request.log.info({ sourceLabel: originalName }, 'Starting Granite fact extraction');
      const factModel = await extractFacts(markdown, originalName);
      request.log.info(
        {
          characters: factModel.characters.length,
          events: factModel.events.length,
          rules: factModel.rules.length,
        },
        'Fact extraction complete'
      );

      // ── 5. Persist to the Knowledge store ────────────────────────────────
      const sourceId = upsertFactModel(factModel);
      request.log.info({ sourceId }, 'FactModel persisted to Knowledge store');

      // ── 6. Return the FactModel and storage confirmation ──────────────────
      return reply.status(200).send({
        success: true,
        sourceLabel: originalName,
        doclingPageCount: pageCount,
        sourceId,
        factModel,
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'Ingest pipeline error');

      return reply.status(500).send({
        success: false,
        error: message,
      });

    } finally {
      // Always clean up the temp file, regardless of success or failure
      if (tempFilePath) {
        await unlink(tempFilePath).catch(() => {
          // Non-fatal — OS will clean up tmpdir eventually
        });
      }
    }
  });

  /**
   * GET /ingest/health
   * Confirms the ingest service sub-routes are reachable.
   */
  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', service: 'ingest' });
  });
}
