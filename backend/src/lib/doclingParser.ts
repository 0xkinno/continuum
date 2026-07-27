/**
 * Docling Integration — Phase 2
 *
 * Docling (https://github.com/DS4SD/docling) is a Python library.
 * We call it as a subprocess: the backend ships a thin Python helper
 * script (`docling_parse.py`) that Docling loads, and Node calls it
 * with the file path, receiving clean Markdown text on stdout.
 *
 * Why subprocess and not a REST micro-service?
 *   The spec says "no heavyweight multi-agent framework" and requires
 *   a simple pipeline. A subprocess call is the lightest bridge
 *   between Node and a Python package without introducing a second
 *   HTTP service to manage during a live demo.
 *
 * Setup requirements (documented in README):
 *   pip install docling
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the Python helper that lives next to this file's src root
const DOCLING_SCRIPT = join(__dirname, '..', 'scripts', 'docling_parse.py');

export interface ParseResult {
  /** Clean, flowing Markdown text extracted from the document */
  markdown: string;
  /** Number of detected pages / sections (informational) */
  pageCount: number;
}

/**
 * Parse a file at `filePath` using Docling.
 * Returns clean Markdown text suitable for the fact-extraction prompt.
 *
 * Supported file types: .txt, .md, .pdf, .docx
 */
export async function parseWithDocling(filePath: string): Promise<ParseResult> {
  let stdout: string;

  try {
    const result = await execFileAsync('python3', [DOCLING_SCRIPT, filePath], {
      maxBuffer: 20 * 1024 * 1024, // 20 MB stdout buffer — generous for long docs
      timeout: 120_000,            // 2 minutes — PDF rendering can be slow
    });
    stdout = result.stdout;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    throw new Error(`Docling parse failed: ${message}`);
  }

  let parsed: { markdown: string; page_count: number };
  try {
    parsed = JSON.parse(stdout) as { markdown: string; page_count: number };
  } catch {
    throw new Error(
      `Docling script returned non-JSON output. Raw output: ${stdout.slice(0, 500)}`
    );
  }

  return {
    markdown: parsed.markdown,
    pageCount: parsed.page_count,
  };
}
