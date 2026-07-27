/**
 * Direct Ingest — used by the seed script to ingest Markdown files from the
 * filesystem without going through the HTTP multipart route or Docling.
 *
 * For Markdown files we don't need Docling (it's already clean text).
 * This lets the seed script run without a running server or Python.
 *
 * Used only by seed-demo.ts and the /seed/demo HTTP endpoint.
 */

import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extractFacts } from './ingestionAgent.js';
import { upsertFactModel } from './knowledgeAgent.js';
import type { FactModel } from '../types/facts.js';

export interface DirectIngestResult {
  sourceLabel: string;
  sourceId: number;
  factModel: FactModel;
  characters: number;
  events: number;
  rules: number;
}

/**
 * Read a Markdown file from `filePath`, run Granite fact extraction on its
 * content, and persist the resulting FactModel to the Knowledge store.
 */
export async function directIngestFile(filePath: string, label?: string): Promise<DirectIngestResult> {
  const content = await readFile(filePath, 'utf-8');
  const sourceLabel = label ?? filePath.split(/[/\\]/).pop() ?? filePath;

  const factModel = await extractFacts(content, sourceLabel);
  const sourceId = upsertFactModel(factModel);

  return {
    sourceLabel,
    sourceId,
    factModel,
    characters: factModel.characters.length,
    events: factModel.events.length,
    rules: factModel.rules.length,
  };
}
