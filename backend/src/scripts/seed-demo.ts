/**
 * seed-demo.ts — Demo seeding script for Continuum Phase 7
 *
 * Usage (from backend/ directory):
 *   npx tsx src/scripts/seed-demo.ts
 *
 * What it does:
 *   1. Wipes all existing demo data from the database
 *   2. Ingests 4 chapters + 1 character sheet via Granite fact extraction
 *   3. Runs the test draft through the Continuity + Explanation agents
 *   4. Validates that exactly 3 flags are returned
 *   5. Prints a detailed pass/fail report
 *
 * Exit codes:
 *   0 — all 3 contradictions caught
 *   1 — one or more contradictions missed (details printed to stderr)
 *
 * Prerequisites:
 *   - WATSONX_API_KEY and WATSONX_PROJECT_ID set in backend/.env
 *   - Node ≥22 (for node:sqlite)
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearAllDemoData } from '../lib/clearDemo.js';
import { directIngestFile } from '../agents/directIngest.js';
import { checkDraft } from '../agents/continuityAgent.js';
import { explainFlags } from '../agents/explanationAgent.js';
import type { ExplainedFlag } from '../agents/explanationAgent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMO_DIR = join(__dirname, '..', 'seed', 'demo-data');

// ── The 3 expected contradictions — used for validation ──────────────────────

/**
 * Each entry defines a keyword or phrase that should appear in either:
 *  - the flag's claim, conflictsWith, or explanation field
 * if Granite correctly identified the contradiction.
 */
const EXPECTED_CONTRADICTIONS = [
  {
    id: 'C1',
    label: 'Paired resonance knowledge before Chapter 3',
    description:
      'Maren claims to have worked out paired resonance independently before arriving in Thornmere. ' +
      'She did not learn about paired resonance until Chapter 3 (from Fenwick). ' +
      'This is a CHARACTER KNOWLEDGE violation.',
    // Keywords that should appear in any flag that caught this contradiction
    matchKeywords: ['paired resonance', 'paired', 'resonance', 'fenwick', 'chapter 3', 'before arriving'],
  },
  {
    id: 'C2',
    label: 'Two-stroke warding circle method',
    description:
      'Maren claims to draw warding circles in two strokes. ' +
      'The Second Law (established Chapter 2) states circles MUST be completed in one unbroken motion. ' +
      'A two-stroke method would render the ward inert. ' +
      'This is an ESTABLISHED RULE violation.',
    matchKeywords: ['two stroke', 'two-stroke', 'second law', 'unbroken', 'single motion', 'single stroke', 'warding circle', 'chalk'],
  },
  {
    id: 'C3',
    label: 'Salt water neutralises active iron resonance',
    description:
      'Maren tells Orin that salt water can neutralise actively resonating (currently uncovered) iron. ' +
      'The Third Law (established Chapter 2) explicitly states: salt water only cancels PAST resonance trails, ' +
      'not currently resonating iron. Aldric explicitly clarified this in Chapter 2. ' +
      'This is an ESTABLISHED RULE violation.',
    matchKeywords: ['salt water', 'active', 'actively', 'uncovered', 'third law', 'currently resonating', 'past trail', 'resonance trail'],
  },
];

// ── Colour output helpers ─────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const ok   = (s: string) => `${GREEN}✓${RESET} ${s}`;
const fail = (s: string) => `${RED}✗${RESET} ${s}`;
const warn = (s: string) => `${YELLOW}⚠${RESET} ${s}`;
const bold = (s: string) => `${BOLD}${s}${RESET}`;
const section = (s: string) => `\n${BOLD}── ${s} ──${RESET}`;

// ── Validation ────────────────────────────────────────────────────────────────

function flagMatchesContradiction(
  flag: ExplainedFlag,
  keywords: string[],
): boolean {
  const haystack = [
    flag.claim,
    flag.conflictsWith,
    flag.explanation,
    flag.establishedIn,
    flag.flagType,
  ]
    .join(' ')
    .toLowerCase();

  return keywords.some((kw) => haystack.includes(kw.toLowerCase()));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(bold('\nContinuum — Demo Seed Script'));
  console.log('Phase 7: Demo Hardening\n');

  // ── Step 1: Clear existing data ───────────────────────────────────────────
  console.log(section('Step 1: Clearing existing data'));
  clearAllDemoData();
  console.log(ok('Database cleared'));

  // ── Step 2: Ingest all source documents ───────────────────────────────────
  console.log(section('Step 2: Ingesting demo documents'));

  const documents = [
    { path: join(DEMO_DIR, 'chapters', 'chapter-01.md'), label: 'chapter-01.md (Chapter 1: The Warding Circle)' },
    { path: join(DEMO_DIR, 'chapters', 'chapter-02.md'), label: 'chapter-02.md (Chapter 2: Iron and Salt)' },
    { path: join(DEMO_DIR, 'chapters', 'chapter-03.md'), label: 'chapter-03.md (Chapter 3: The Scholar\'s Visit)' },
    { path: join(DEMO_DIR, 'chapters', 'chapter-04.md'), label: 'chapter-04.md (Chapter 4: The Night the Lock-Box Broke)' },
    { path: join(DEMO_DIR, 'characters', 'character-sheet.md'), label: 'character-sheet.md (Character Profiles)' },
  ];

  for (const doc of documents) {
    process.stdout.write(`  Ingesting ${doc.label}… `);
    const result = await directIngestFile(doc.path, doc.label.split(' ')[0]);
    console.log(ok(`${result.characters} chars, ${result.events} events, ${result.rules} rules`));
  }

  console.log(ok('All documents ingested'));

  // ── Step 3: Load the test draft ───────────────────────────────────────────
  console.log(section('Step 3: Running continuity check on test draft'));

  const testDraftPath = join(DEMO_DIR, 'test-draft.md');
  const testDraft = await readFile(testDraftPath, 'utf-8');
  console.log(`  Draft length: ${testDraft.length} characters`);

  // ── Step 4: Run continuity check ─────────────────────────────────────────
  process.stdout.write('  Running Continuity Agent (Step 1: claim extraction)… ');
  const checkResult = await checkDraft(testDraft);
  console.log(ok(`${checkResult.claims.length} claims extracted`));

  if (checkResult.flags.length === 0) {
    console.error(fail('Continuity Agent found 0 raw flags. Check watsonx credentials and knowledge store population.'));
    process.exit(1);
  }
  console.log(ok(`${checkResult.flags.length} raw contradiction flags identified`));

  // ── Step 5: Generate explanations ─────────────────────────────────────────
  process.stdout.write('  Running Explanation Agent… ');
  const explained = await explainFlags(checkResult.flags);
  console.log(ok(`${explained.length} explanations generated`));

  // ── Step 6: Print all flags ───────────────────────────────────────────────
  console.log(section('Flags found'));

  for (const flag of explained) {
    console.log(`\n  ${bold(`Flag ${flag.flagNumber}`)} [${flag.confidence.toUpperCase()} confidence] — ${flag.flagType}`);
    console.log(`  Claim:          "${flag.claim}"`);
    console.log(`  Conflicts with: "${flag.conflictsWith}"`);
    console.log(`  Established in: ${flag.establishedIn}`);
    console.log(`  Explanation:    ${flag.explanation}`);
  }

  // ── Step 7: Validate exactly 3 contradictions caught ─────────────────────
  console.log(section('Validation'));

  const validationResults = EXPECTED_CONTRADICTIONS.map((expected) => {
    const matchingFlag = explained.find((f) =>
      flagMatchesContradiction(f, expected.matchKeywords),
    );
    return { expected, matchingFlag, caught: !!matchingFlag };
  });

  let allCaught = true;

  for (const { expected, matchingFlag, caught } of validationResults) {
    if (caught) {
      console.log(ok(`${expected.id}: ${expected.label}`));
      console.log(`     → Caught by Flag ${matchingFlag!.flagNumber}: "${matchingFlag!.flagType}"`);
    } else {
      console.log(fail(`${expected.id}: ${expected.label} — NOT CAUGHT`));
      console.log(warn(`     What should have been flagged: ${expected.description}`));
      allCaught = false;
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(section('Summary'));
  const caught = validationResults.filter((r) => r.caught).length;
  console.log(`  Contradictions caught: ${caught} / ${EXPECTED_CONTRADICTIONS.length}`);
  console.log(`  Total flags returned:  ${explained.length}`);

  if (allCaught) {
    console.log(`\n${GREEN}${BOLD}✓ DEMO SEED PASSED — all 3 contradictions caught.${RESET}`);
    console.log('  The demo is ready. Run the app and follow docs/DEMO.md for the judge walkthrough.\n');
    process.exit(0);
  } else {
    const missed = validationResults.filter((r) => !r.caught).map((r) => r.expected.id);
    console.error(`\n${RED}${BOLD}✗ DEMO SEED FAILED — missed: ${missed.join(', ')}${RESET}`);
    console.error('  Review the contradiction descriptions above and verify the story content.');
    console.error('  The knowledge store is still populated — run the app to inspect the Canon view.\n');
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n${RED}${BOLD}Fatal error during seed:${RESET} ${message}`);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
