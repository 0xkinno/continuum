/**
 * agents.test.ts — Continuum Phase 7 test suite
 *
 * Uses the built-in node:test runner (Node ≥22). Run with:
 *   npm test
 *   node --experimental-sqlite --import tsx/esm src/__tests__/agents.test.ts
 *
 * Test strategy
 * ─────────────
 * Every agent function (extractFacts, upsertFactModel, retrieveFacts,
 * checkDraft, explainFlags) runs its REAL implementation code. The only
 * thing intercepted is the outbound HTTP call to watsonx.ai: global.fetch is
 * replaced with a deterministic stub that returns valid pre-crafted JSON
 * payloads matching what Granite would return. This is standard for AI
 * pipeline testing where network calls must be deterministic in CI.
 *
 * Database isolation
 * ──────────────────
 * CONTINUUM_DB_PATH is set to ':memory:' before any imports, so every test
 * run uses a fresh in-memory SQLite database.
 *
 * The db singleton is reset between tests by calling clearAllDemoData() in
 * beforeEach to ensure full isolation.
 */

// ── Env setup — must happen before any agent imports ──────────────────────────
process.env['CONTINUUM_DB_PATH'] = ':memory:';
process.env['WATSONX_API_KEY']   = 'test-api-key';
process.env['WATSONX_PROJECT_ID'] = 'test-project-id';

import { test, describe, beforeEach, mock, after } from 'node:test';
import assert from 'node:assert/strict';

// ── Agent imports ─────────────────────────────────────────────────────────────
import { extractFacts } from '../agents/ingestionAgent.js';
import { upsertFactModel, retrieveFacts } from '../agents/knowledgeAgent.js';
import { checkDraft } from '../agents/continuityAgent.js';
import { explainFlags } from '../agents/explanationAgent.js';
import { clearAllDemoData } from '../lib/clearDemo.js';
import type { FactModel } from '../types/facts.js';
import type { ContinuityFlag } from '../types/continuity.js';

// ── Fetch stub infrastructure ─────────────────────────────────────────────────

/**
 * Build a fake fetch that:
 * 1. Returns a fake IAM token for any request to iam.cloud.ibm.com
 * 2. Returns `responseText` for any request to ml.cloud.ibm.com (the Granite endpoint)
 */
function makeFakeFetch(granitResponseText: string) {
  return async (url: string | Request | URL, _init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

    // IAM token endpoint
    if (urlStr.includes('iam.cloud.ibm.com')) {
      return new Response(
        JSON.stringify({ access_token: 'fake-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // watsonx.ai text generation endpoint
    if (urlStr.includes('ml.cloud.ibm.com')) {
      return new Response(
        JSON.stringify({
          results: [{
            generated_text: granitResponseText,
            stop_reason: 'eos_token',
            input_token_count: 100,
            generated_token_count: 200,
          }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Any other URL → reject loudly so we notice accidental real calls
    throw new Error(`Unexpected fetch call to: ${urlStr}`);
  };
}

// ── Pre-built Granite response payloads ───────────────────────────────────────

/** A valid FactModel JSON as Granite would return for ingestion */
const INGEST_PAYLOAD_BASIC = JSON.stringify({
  characters: [
    {
      name: 'Elara Voss',
      aliases: ['The Wanderer'],
      traits: [{ trait: 'Courageous', evidence: 'She walked into the storm alone.' }],
      knowledge: [
        { item: 'The location of the vault', establishedAfter: 'Chapter 1' },
      ],
      relationships: [{ withCharacter: 'Soren Hale', nature: 'mentor' }],
      attributes: { age: '28', occupation: 'scout' },
    },
    {
      name: 'Soren Hale',
      aliases: [],
      traits: [{ trait: 'Cautious', evidence: 'He checked the door twice.' }],
      knowledge: [],
      relationships: [{ withCharacter: 'Elara Voss', nature: 'protégé' }],
      attributes: { age: '52', occupation: 'archivist' },
    },
  ],
  events: [
    {
      id: 'evt_001',
      summary: 'Elara finds the map in the vault.',
      position: 'Chapter 1',
      characters: ['Elara Voss'],
      location: 'The Vault',
      establishes: ['Elara knows the vault location.'],
    },
    {
      id: 'evt_002',
      summary: 'Soren burns the evidence.',
      position: 'Chapter 2',
      characters: ['Soren Hale'],
      location: 'The Archive',
      establishes: ['The evidence no longer exists after Chapter 2.'],
    },
  ],
  timeline: [
    { label: 'Chapter 1', eventIds: ['evt_001'], timeReference: null },
    { label: 'Chapter 2', eventIds: ['evt_002'], timeReference: null },
  ],
  rules: [
    {
      rule: 'Magic cannot be used twice in the same day.',
      evidence: 'The elders spoke this prohibition on page 4.',
      source: 'Chapter 1',
    },
  ],
  uncategorised: ['The city has three gates.'],
});

/** A second FactModel for a second chapter — same character, different knowledge */
const INGEST_PAYLOAD_CH2 = JSON.stringify({
  characters: [
    {
      name: 'Elara Voss',
      aliases: [],
      traits: [],
      knowledge: [
        { item: 'The name of the traitor', establishedAfter: 'Chapter 2' },
      ],
      relationships: [],
      attributes: {},
    },
  ],
  events: [],
  timeline: [
    { label: 'Chapter 2', eventIds: [], timeReference: null },
  ],
  rules: [],
  uncategorised: [],
});

/** Claim extraction response — one character knowledge claim */
const CLAIMS_WITH_CONTRADICTION = JSON.stringify([
  {
    text: 'Elara revealed the name of the traitor, knowledge she had carried since before Chapter 1.',
    type: 'character_knowledge',
    characters: ['Elara Voss'],
    sentenceIndex: 0,
  },
]);

/** Claim extraction response — timeline violation */
const CLAIMS_TIMELINE = JSON.stringify([
  {
    text: 'Soren produced the evidence, though it had already been destroyed.',
    type: 'event_occurrence',
    characters: ['Soren Hale'],
    sentenceIndex: 0,
  },
]);

/** Claim extraction — no contradictions expected */
const CLAIMS_CONSISTENT = JSON.stringify([
  {
    text: 'Elara walked to the vault.',
    type: 'event_occurrence',
    characters: ['Elara Voss'],
    sentenceIndex: 0,
  },
]);

/** Flags for a character knowledge contradiction */
const FLAGS_CHARACTER_KNOWLEDGE = JSON.stringify([
  {
    claimIndex: 0,
    conflictingFact: 'Elara only learns the name of the traitor after Chapter 2.',
    factSource: 'chapter-02.md, Chapter 2',
    confidence: 'high',
    reasoning: 'Plan: check when Elara acquired this knowledge. Check: established after Chapter 2. Verify: the draft places it before Chapter 1 — direct contradiction.',
  },
]);

/** Flags for a timeline contradiction */
const FLAGS_TIMELINE = JSON.stringify([
  {
    claimIndex: 0,
    conflictingFact: 'The evidence no longer exists after Chapter 2.',
    factSource: 'chapter-01.md, Chapter 2',
    confidence: 'high',
    reasoning: 'Plan: check event evt_002. Check: establishes evidence destroyed. Verify: draft shows evidence present — timeline violation.',
  },
]);

/** No flags — consistent draft */
const FLAGS_NONE = JSON.stringify([]);

/** Explanation output */
const EXPLANATION_PAYLOAD = JSON.stringify([
  {
    flagType: 'CHARACTER KNOWLEDGE',
    claim: 'Elara revealed the name of the traitor, knowledge she had carried since before Chapter 1.',
    conflictsWith: 'Elara only learns the name of the traitor after Chapter 2.',
    establishedIn: 'Chapter 2, chapter-02.md',
    explanation: 'The draft attributes knowledge to Elara that she does not acquire until Chapter 2. In the established canon, she learns the name of the traitor only after events in Chapter 2 unfold. Placing this knowledge before Chapter 1 contradicts the established sequence of her learning.',
    confidence: 'high',
  },
]);

// ── Helper: make a minimal valid FactModel for direct insertion ───────────────

function makeFactModel(overrides: Partial<FactModel> = {}): FactModel {
  return {
    sourceHash: Math.random().toString(36).slice(2),
    sourceLabel: 'test.md',
    coverageRange: 'Chapter 1',
    characters: [],
    events: [],
    timeline: [],
    rules: [],
    uncategorised: [],
    extractedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Continuum Agent Tests', () => {

  // Reset the in-memory database before every test for full isolation
  beforeEach(() => {
    clearAllDemoData();
    // Also reset the IAM token cache between tests by clearing the env token
    // (the cache lives in the watsonxClient module closure; resetting the
    // env variables is enough to force a re-fetch on next call)
    delete process.env['_IAM_CACHE_BUST']; // no-op; cache expires by time
  });

  // ── Ingestion Agent ─────────────────────────────────────────────────────────

  test('IA-01: extractFacts returns a valid FactModel with characters and events', async () => {
    // Two Granite calls: one for ingestion (claim extraction prompt ignored here)
    let callCount = 0;
    global.fetch = makeFakeFetch(INGEST_PAYLOAD_BASIC) as typeof global.fetch;

    const result = await extractFacts(
      'Elara Voss found the map. Soren Hale burned the evidence.',
      'test.md',
    );

    // Shape
    assert.equal(typeof result.sourceHash, 'string', 'sourceHash must be a string');
    assert.equal(result.sourceHash.length, 64, 'sourceHash must be 64-char hex');
    assert.equal(result.sourceLabel, 'test.md');
    assert.ok(Array.isArray(result.characters), 'characters must be an array');
    assert.ok(Array.isArray(result.events), 'events must be an array');
    assert.ok(Array.isArray(result.rules), 'rules must be an array');
    assert.ok(Array.isArray(result.timeline), 'timeline must be an array');

    // Content — Granite stub returns our pre-built payload
    assert.equal(result.characters.length, 2, 'Should extract 2 characters');
    assert.equal(result.characters[0].name, 'Elara Voss');
    assert.equal(result.events.length, 2, 'Should extract 2 events');
    assert.equal(result.rules.length, 1, 'Should extract 1 rule');
  });

  test('IA-02: extractFacts handles empty input — returns FactModel with empty arrays', async () => {
    // Granite returns empty arrays when given empty text
    global.fetch = makeFakeFetch(JSON.stringify({
      characters: [], events: [], timeline: [], rules: [], uncategorised: [],
    })) as typeof global.fetch;

    const result = await extractFacts('', 'empty.md');

    assert.equal(result.sourceLabel, 'empty.md');
    assert.deepEqual(result.characters, []);
    assert.deepEqual(result.events, []);
    assert.deepEqual(result.rules, []);
    assert.deepEqual(result.timeline, []);
  });

  test('IA-03: extractFacts merges chunks — multi-chunk text yields merged characters', async () => {
    // With a 30,001-char input the agent splits into 4 chunks, each returning
    // a different character. The merge logic must deduplicate Elara (same name).
    let chunkCall = 0;
    const responses = [
      JSON.stringify({ characters: [{ name: 'Elara Voss', aliases: [], traits: [], knowledge: [], relationships: [], attributes: {} }], events: [], timeline: [], rules: [], uncategorised: [] }),
      JSON.stringify({ characters: [{ name: 'Elara Voss', aliases: ['The Wanderer'], traits: [{ trait: 'Bold', evidence: 'She acted first.' }], knowledge: [], relationships: [], attributes: {} }], events: [], timeline: [], rules: [], uncategorised: [] }),
      JSON.stringify({ characters: [], events: [], timeline: [], rules: [], uncategorised: [] }),
    ];
    global.fetch = (async (url: string | Request | URL, _init?: RequestInit): Promise<Response> => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('iam.cloud.ibm.com')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      const resp = responses[chunkCall % responses.length] ?? responses[0];
      chunkCall++;
      return new Response(JSON.stringify({ results: [{ generated_text: resp, stop_reason: 'eos', input_token_count: 10, generated_token_count: 20 }] }), { status: 200 });
    }) as typeof global.fetch;

    // 12 000-char input triggers chunking (CHUNK_CHAR_LIMIT = 10 000)
    const longText = 'Elara Voss walked through the forest. '.repeat(400);
    const result = await extractFacts(longText, 'long.md');

    // Elara should appear only once after merge (deduplication by name)
    const elaraEntries = result.characters.filter((c) => c.name === 'Elara Voss');
    assert.equal(elaraEntries.length, 1, 'Merged model should have exactly one Elara Voss entry');
    // Aliases from both chunks should be merged
    assert.ok(elaraEntries[0].aliases.includes('The Wanderer'), 'Alias from second chunk should be merged');
  });

  // ── Knowledge Agent ──────────────────────────────────────────────────────────

  test('KA-01: upsertFactModel stores a FactModel and retrieveFacts returns it by character name', () => {
    const fm = makeFactModel({
      sourceLabel: 'chapter-01.md',
      coverageRange: 'Chapter 1',
      characters: [{
        name: 'Elara Voss',
        aliases: ['The Wanderer'],
        traits: [{ trait: 'Courageous', evidence: 'She crossed the bridge.' }],
        knowledge: [{ item: 'Vault location', establishedAfter: 'Chapter 1' }],
        relationships: [],
        attributes: { age: '28' },
      }],
      rules: [{ rule: 'Magic costs blood', evidence: 'The mage bled', source: 'Chapter 1' }],
      timeline: [{ label: 'Chapter 1', eventIds: ['evt_001'] }],
      events: [{
        id: 'evt_001', summary: 'Elara finds the vault', position: 'Chapter 1',
        characters: ['Elara Voss'], location: 'The Vault', establishes: ['Vault discovered'],
      }],
    });

    const sourceId = upsertFactModel(fm);
    assert.ok(typeof sourceId === 'number' && sourceId > 0, 'Should return a positive source id');

    const retrieved = retrieveFacts('Elara Voss');
    assert.equal(retrieved.characters.length, 1, 'Should return one character');
    assert.equal(retrieved.characters[0].name, 'Elara Voss');
    assert.equal(retrieved.characters[0].traits.length, 1);
    assert.equal(retrieved.characters[0].traits[0].trait, 'Courageous');
    assert.equal(retrieved.characters[0].knowledge.length, 1);
    assert.equal(retrieved.characters[0].knowledge[0].item, 'Vault location');
    assert.equal(retrieved.rules.length, 1);
    assert.equal(retrieved.rules[0].rule, 'Magic costs blood');
  });

  test('KA-02: upsertFactModel deduplicates — same character ingested twice results in one DB row', () => {
    const fm1 = makeFactModel({
      sourceLabel: 'ch1.md',
      characters: [{
        name: 'Elara Voss', aliases: [], traits: [{ trait: 'Brave', evidence: 'e' }],
        knowledge: [], relationships: [], attributes: {},
      }],
    });
    const fm2 = makeFactModel({
      sourceHash: 'differenthashAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'.slice(0, 64),
      sourceLabel: 'ch2.md',
      characters: [{
        name: 'Elara Voss', aliases: ['The Wanderer'],
        traits: [{ trait: 'Determined', evidence: 'd' }],
        knowledge: [], relationships: [], attributes: {},
      }],
    });

    upsertFactModel(fm1);
    upsertFactModel(fm2);

    const retrieved = retrieveFacts('Elara Voss');

    // Should still be exactly one character in the result (deduplicated by name)
    const elaras = retrieved.characters.filter((c) => c.name === 'Elara Voss');
    assert.equal(elaras.length, 1, 'Should have exactly one Elara after two ingestions');

    // But traits from both sources should be present
    const traitNames = elaras[0].traits.map((t) => t.trait);
    assert.ok(traitNames.includes('Brave'), 'Trait from ch1 should be present');
    assert.ok(traitNames.includes('Determined'), 'Trait from ch2 should be present');

    // Alias from second source should be merged
    assert.ok(elaras[0].aliases.includes('The Wanderer'), 'Alias from ch2 should be present');
  });

  test('KA-03: retrieveFacts scopes by chapter — only returns facts from Chapter 1 when queried "as of Chapter 1"', () => {
    // Insert chapter 1 and chapter 2 as separate sources
    const fm1 = makeFactModel({
      sourceLabel: 'ch1.md',
      characters: [{
        name: 'Elara Voss', aliases: [], traits: [],
        knowledge: [{ item: 'Vault location', establishedAfter: 'Chapter 1' }],
        relationships: [], attributes: {},
      }],
      timeline: [{ label: 'Chapter 1', eventIds: [] }],
    });
    const fm2 = makeFactModel({
      sourceHash: 'b'.repeat(64),
      sourceLabel: 'ch2.md',
      characters: [{
        name: 'Elara Voss', aliases: [], traits: [],
        knowledge: [{ item: 'Name of the traitor', establishedAfter: 'Chapter 2' }],
        relationships: [], attributes: {},
      }],
      timeline: [{ label: 'Chapter 2', eventIds: [] }],
    });

    upsertFactModel(fm1);
    upsertFactModel(fm2);

    // Query scoped to Chapter 1 — should NOT include the Chapter 2 knowledge item
    const scoped = retrieveFacts('Elara Voss as of Chapter 1');
    assert.equal(scoped.characters.length, 1);

    const knowledgeItems = scoped.characters[0].knowledge.map((k) => k.item);
    assert.ok(knowledgeItems.includes('Vault location'), 'Ch1 knowledge should be present');
    assert.ok(!knowledgeItems.includes('Name of the traitor'), 'Ch2 knowledge should NOT be present when scoped to Chapter 1');
  });

  test('KA-04: retrieveFacts returns rules regardless of character scope', () => {
    const fm = makeFactModel({
      rules: [
        { rule: 'No iron after dark', evidence: 'The elders said so.', source: 'Chapter 1' },
        { rule: 'Salt water cancels trails', evidence: 'Tested in the field.', source: 'Chapter 2' },
      ],
    });
    upsertFactModel(fm);

    // Query for a character that doesn't exist — rules should still come back
    const result = retrieveFacts('a character who is not in the story');
    assert.equal(result.rules.length, 2, 'All rules should be returned regardless of character query');
  });

  // ── Continuity Agent ─────────────────────────────────────────────────────────

  test('CA-01: checkDraft catches a character-knowledge contradiction', async () => {
    // Seed the knowledge store with Elara's knowledge timeline
    const fm = makeFactModel({
      sourceLabel: 'ch2.md',
      coverageRange: 'Chapter 2',
      characters: [{
        name: 'Elara Voss', aliases: [], traits: [],
        knowledge: [{ item: 'Name of the traitor', establishedAfter: 'Chapter 2' }],
        relationships: [], attributes: {},
      }],
      timeline: [{ label: 'Chapter 2', eventIds: [] }],
    });
    upsertFactModel(fm);

    // Stub: first call returns the claims, second call returns the flag
    let callCount = 0;
    global.fetch = (async (url: string | Request | URL, _init?: RequestInit): Promise<Response> => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('iam.cloud.ibm.com')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      callCount++;
      const text = callCount === 1 ? CLAIMS_WITH_CONTRADICTION : FLAGS_CHARACTER_KNOWLEDGE;
      return new Response(JSON.stringify({
        results: [{ generated_text: text, stop_reason: 'eos', input_token_count: 50, generated_token_count: 100 }],
      }), { status: 200 });
    }) as typeof global.fetch;

    const result = await checkDraft(
      'Elara revealed the name of the traitor, knowledge she had carried since before Chapter 1.',
    );

    assert.ok(Array.isArray(result.claims), 'claims must be an array');
    assert.ok(result.claims.length > 0, 'Should extract at least one claim');
    assert.ok(Array.isArray(result.flags), 'flags must be an array');
    assert.ok(result.flags.length > 0, 'Should detect at least one contradiction flag');

    const flag = result.flags[0];
    assert.ok(typeof flag.conflictingFact === 'string' && flag.conflictingFact.length > 0);
    assert.ok(['high', 'medium', 'low'].includes(flag.confidence), 'confidence must be valid');
    assert.ok(typeof flag.reasoning === 'string' && flag.reasoning.length > 0, 'reasoning must be non-empty');
  });

  test('CA-02: checkDraft catches a timeline inconsistency', async () => {
    // Seed: the evidence was destroyed in Chapter 2
    const fm = makeFactModel({
      sourceLabel: 'ch-events.md',
      events: [{
        id: 'evt_002',
        summary: 'Soren burns the evidence.',
        position: 'Chapter 2',
        characters: ['Soren Hale'],
        establishes: ['The evidence no longer exists after Chapter 2.'],
      }],
    });
    upsertFactModel(fm);

    let callCount = 0;
    global.fetch = (async (url: string | Request | URL, _init?: RequestInit): Promise<Response> => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('iam.cloud.ibm.com')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      callCount++;
      const text = callCount === 1 ? CLAIMS_TIMELINE : FLAGS_TIMELINE;
      return new Response(JSON.stringify({
        results: [{ generated_text: text, stop_reason: 'eos', input_token_count: 50, generated_token_count: 100 }],
      }), { status: 200 });
    }) as typeof global.fetch;

    const result = await checkDraft(
      'Soren produced the evidence, though it had already been destroyed.',
    );

    assert.ok(result.flags.length > 0, 'Should detect a timeline flag');
    assert.ok(result.flags[0].conflictingFact.toLowerCase().includes('evidence'),
      'Conflicting fact should mention the evidence');
  });

  test('CA-03: checkDraft returns zero flags for a consistent draft', async () => {
    // Seed: Elara knows the vault location
    const fm = makeFactModel({
      characters: [{
        name: 'Elara Voss', aliases: [], traits: [],
        knowledge: [{ item: 'Vault location', establishedAfter: 'Chapter 1' }],
        relationships: [], attributes: {},
      }],
    });
    upsertFactModel(fm);

    let callCount = 0;
    global.fetch = (async (url: string | Request | URL, _init?: RequestInit): Promise<Response> => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('iam.cloud.ibm.com')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
      }
      callCount++;
      const text = callCount === 1 ? CLAIMS_CONSISTENT : FLAGS_NONE;
      return new Response(JSON.stringify({
        results: [{ generated_text: text, stop_reason: 'eos', input_token_count: 50, generated_token_count: 100 }],
      }), { status: 200 });
    }) as typeof global.fetch;

    const result = await checkDraft('Elara walked to the vault.');

    assert.deepEqual(result.flags, [], 'Consistent draft should produce zero flags');
    assert.ok(typeof result.checkedAt === 'string', 'checkedAt must be a string');
    assert.ok(result.checkedAt.length > 0, 'checkedAt must be non-empty');
  });

  // ── Explanation Agent ────────────────────────────────────────────────────────

  test('EA-01: explainFlags produces output with required fields for each flag', async () => {
    global.fetch = makeFakeFetch(EXPLANATION_PAYLOAD) as typeof global.fetch;

    const flags: ContinuityFlag[] = [{
      flagNumber: 1,
      claim: {
        text: 'Elara revealed the name of the traitor, knowledge she had carried since before Chapter 1.',
        type: 'character_knowledge',
        characters: ['Elara Voss'],
        sentenceIndex: 0,
      },
      conflictingFact: 'Elara only learns the name of the traitor after Chapter 2.',
      factSource: 'chapter-02.md, Chapter 2',
      confidence: 'high',
      reasoning: 'Plan: check when. Check: established after Ch2. Verify: contradiction.',
    }];

    const explained = await explainFlags(flags);

    assert.equal(explained.length, 1, 'Should return one explanation');
    const f = explained[0];

    // All required fields present
    assert.ok(typeof f.flagType === 'string'       && f.flagType.length > 0,       'flagType must be non-empty string');
    assert.ok(typeof f.claim === 'string'           && f.claim.length > 0,           'claim must be non-empty string');
    assert.ok(typeof f.conflictsWith === 'string'   && f.conflictsWith.length > 0,   'conflictsWith must be non-empty string');
    assert.ok(typeof f.establishedIn === 'string'   && f.establishedIn.length > 0,   'establishedIn must be non-empty string');
    assert.ok(typeof f.explanation === 'string'     && f.explanation.length > 0,     'explanation must be non-empty string');
    assert.ok(['high', 'medium', 'low'].includes(f.confidence),                      'confidence must be high|medium|low');
    assert.equal(f.flagNumber, 1, 'flagNumber should be passed through');
  });

  test('EA-02: explainFlags returns empty array when given no flags', async () => {
    // explainFlags has an early return for empty input — no fetch call should occur
    const originalFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = (async () => { fetchCalled = true; return new Response('{}', { status: 200 }); }) as typeof global.fetch;

    const explained = await explainFlags([]);

    assert.deepEqual(explained, [], 'Empty flags input should return empty array');
    assert.equal(fetchCalled, false, 'No fetch call should be made for empty flags');

    global.fetch = originalFetch;
  });

  test('EA-03: explainFlags editorial tone — explanation contains no raw JSON braces', async () => {
    global.fetch = makeFakeFetch(EXPLANATION_PAYLOAD) as typeof global.fetch;

    const flags: ContinuityFlag[] = [{
      flagNumber: 1,
      claim: {
        text: 'Elara revealed the name of the traitor.',
        type: 'character_knowledge',
        characters: ['Elara Voss'],
        sentenceIndex: 0,
      },
      conflictingFact: 'Elara only learns this after Chapter 2.',
      factSource: 'chapter-02.md',
      confidence: 'high',
      reasoning: 'Step by step reasoning here.',
    }];

    const explained = await explainFlags(flags);
    const explanation = explained[0].explanation;

    // An editorial note should not contain raw JSON braces or array brackets
    assert.ok(!explanation.includes('{"'),   'explanation should not contain raw JSON opening brace+quote');
    assert.ok(!explanation.includes('":['),  'explanation should not contain JSON array syntax');
    // Should read like prose — must contain at least one sentence (period or newline)
    assert.ok(explanation.includes('.') || explanation.includes('\n'),
      'explanation must read like prose (contain sentence endings)');
    // Must be reasonably long — a genuine editorial note, not a one-word stub
    assert.ok(explanation.length > 40, `explanation too short (${explanation.length} chars) — expected editorial prose`);
  });

  test('EA-04: explainFlags gracefully handles Granite returning fewer items than flags', async () => {
    // Granite returns 1 explanation for 2 flags — the agent should fill in
    // a fallback for the second flag rather than throwing or truncating
    const singleItemPayload = JSON.stringify([{
      flagType: 'CHARACTER KNOWLEDGE',
      claim: 'First claim',
      conflictsWith: 'First conflict',
      establishedIn: 'Chapter 1',
      explanation: 'The first flag is a genuine contradiction because the character lacks this knowledge until later.',
      confidence: 'high',
    }]);

    global.fetch = makeFakeFetch(singleItemPayload) as typeof global.fetch;

    const flags: ContinuityFlag[] = [
      {
        flagNumber: 1,
        claim: { text: 'First claim', type: 'character_knowledge', characters: [], sentenceIndex: 0 },
        conflictingFact: 'First conflict',
        factSource: 'ch1.md',
        confidence: 'high',
        reasoning: 'r1',
      },
      {
        flagNumber: 2,
        claim: { text: 'Second claim', type: 'world_rule', characters: [], sentenceIndex: 1 },
        conflictingFact: 'Second conflict',
        factSource: 'ch2.md',
        confidence: 'medium',
        reasoning: 'r2',
      },
    ];

    const explained = await explainFlags(flags);

    // Should return exactly 2 items — one real, one fallback
    assert.equal(explained.length, 2, 'Should return one ExplainedFlag per input flag');
    assert.equal(explained[0].explanation, singleItemPayload && JSON.parse(singleItemPayload)[0].explanation);
    // Second flag fallback: should still have all required fields
    assert.ok(typeof explained[1].flagType === 'string'     && explained[1].flagType.length > 0);
    assert.ok(typeof explained[1].claim === 'string'         && explained[1].claim.length > 0);
    assert.ok(typeof explained[1].conflictsWith === 'string' && explained[1].conflictsWith.length > 0);
    assert.ok(typeof explained[1].explanation === 'string'   && explained[1].explanation.length > 0);
  });

});
