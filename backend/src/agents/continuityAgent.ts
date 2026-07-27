/**
 * Continuity Agent — Phase 4
 *
 * Core reasoning pipeline for a new draft:
 *
 *   Step 1 — Claim extraction
 *     Send the draft to Granite with a structured prompt asking it to identify
 *     every factual claim (character knowledge, traits, events, rules, etc.)
 *     as a typed JSON array.
 *
 *   Step 2 — Fact retrieval
 *     For each distinct character or topic mentioned in the claims, call the
 *     Knowledge Agent's retrieveFacts() to gather the relevant established facts.
 *
 *   Step 3 — Step-by-step contradiction check
 *     Send Granite a second prompt with:
 *       - The list of claims
 *       - The retrieved facts
 *     Instruct it to reason step-by-step (plan → check → verify) and output a
 *     JSON array of contradiction flags with confidence levels.
 *
 * The two-call structure is deliberate: the first call focuses Granite on
 * *reading* the draft; the second focuses it on *reasoning* against known facts.
 * Single-shot prompts that ask for both simultaneously tend to conflate the two
 * tasks and miss contradictions.
 */

import { generate } from '../lib/watsonxClient.js';
import { retrieveFacts } from './knowledgeAgent.js';
import type { RetrievedFacts } from './knowledgeAgent.js';
import type { Claim, ContinuityFlag, ContinuityCheckResult } from '../types/continuity.js';

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildClaimExtractionPrompt(draftText: string): string {
  return `You are a continuity editor reviewing a new scene or chapter draft. Your first task is to extract every factual claim the draft makes — explicit or clearly implied — about characters, events, timeline position, world rules, and relationships.

Output ONLY a valid JSON array. No explanation, no markdown fences, no text before or after the array.

Each element in the array must have exactly these keys:
{
  "text": "string — the exact phrase or sentence from the draft that makes this claim",
  "type": "one of: character_knowledge | character_trait | character_attribute | event_occurrence | timeline_position | world_rule | relationship | other",
  "characters": ["names of characters this claim involves — empty array if none"],
  "sentenceIndex": number — 0-based index of the sentence in the draft where this claim appears
}

Rules:
- Only extract claims that could conceivably be checked against an established fact.
- Do NOT extract claims about things that are clearly new and original to this scene (newly introduced characters, new locations with no prior reference).
- If a character is shown knowing something, using an ability, or being unaware of something, always extract that as a "character_knowledge" claim.
- If the draft places events in a specific narrative order or time, extract that as "timeline_position".

DRAFT TO ANALYSE:
---
${draftText}
---

JSON array of claims:`;
}

function buildContradictionCheckPrompt(
  claims: Claim[],
  retrievedFacts: RetrievedFacts[],
  draftText: string,
): string {
  // Format the retrieved facts into a compact, readable block
  const factsBlock = retrievedFacts
    .map((rf) => {
      const lines: string[] = [`[Facts for query: "${rf.query}"]`];

      for (const char of rf.characters) {
        lines.push(`Character: ${char.name}`);
        if (char.aliases.length) lines.push(`  Aliases: ${char.aliases.join(', ')}`);
        for (const [k, v] of Object.entries(char.attributes)) {
          lines.push(`  ${k}: ${v}`);
        }
        for (const t of char.traits) lines.push(`  Trait: ${t.trait} (from "${t.sourceLabel}")`);
        for (const k of char.knowledge) {
          lines.push(`  Knows "${k.item}" — established after: ${k.establishedAfter} (from "${k.sourceLabel}")`);
        }
        for (const r of char.relationships) lines.push(`  Relationship: ${r.withCharacter} — ${r.nature}`);
      }

      for (const ev of rf.events) {
        lines.push(`Event [${ev.position}]: ${ev.summary}`);
        for (const est of ev.establishes) lines.push(`  Establishes: ${est}`);
      }

      for (const rule of rf.rules) {
        lines.push(`World Rule: ${rule.rule} (from "${rule.sourceLabel}")`);
      }

      return lines.join('\n');
    })
    .join('\n\n');

  const claimsBlock = claims
    .map((c, i) => `[Claim ${i + 1}] (${c.type}) "${c.text}"`)
    .join('\n');

  return `You are a continuity editor. You have been given:
1. A list of claims found in a new draft
2. Established facts from the story's knowledge base

Your task is to check each claim against the established facts and identify contradictions.

IMPORTANT: Reason step by step. For each claim:
  a) PLAN: What established facts are relevant to this claim?
  b) CHECK: Does the claim agree with, contradict, or have no relation to those facts?
  c) VERIFY: Is this a genuine contradiction, or merely an extension/addition that doesn't conflict?

Only flag genuine contradictions — cases where the draft states or implies something that directly conflicts with an established fact.

Output ONLY a valid JSON array of contradiction flags. Empty array [] if there are no contradictions.

Each flag must have exactly these keys:
{
  "claimIndex": number — 0-based index into the claims array,
  "conflictingFact": "string — the exact established fact that this claim contradicts",
  "factSource": "string — where this fact was established (source document and position)",
  "confidence": "high | medium | low",
  "reasoning": "string — your complete step-by-step reasoning (plan + check + verify)"
}

Confidence guide:
  high   — the claim directly and unambiguously contradicts an established fact
  medium — the claim likely contradicts a fact, but there is a plausible in-story explanation
  low    — the claim is suspicious and worth flagging, but may be intentional

ESTABLISHED FACTS:
---
${factsBlock || '(No established facts found for the characters or topics in this draft.)'}
---

CLAIMS FROM DRAFT:
---
${claimsBlock}
---

DRAFT (for context):
---
${draftText.slice(0, 3000)}${draftText.length > 3000 ? '\n[...truncated for context...]' : ''}
---

JSON array of contradiction flags:`;
}

// ── JSON helpers (reused from ingestion agent) ────────────────────────────────

function extractJsonArray(raw: string): unknown[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1].trim() : raw;

  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(text.slice(start, end + 1)) as unknown[];
  }
  // If model returned an empty response or a single object, recover gracefully
  if (text.trim() === '' || text.trim() === '[]') return [];
  throw new SyntaxError(`No JSON array found in model output: ${text.slice(0, 200)}`);
}

// ── Raw flag type returned by Granite ────────────────────────────────────────

interface RawFlag {
  claimIndex: number;
  conflictingFact: string;
  factSource: string;
  confidence: string;
  reasoning: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the Continuity Agent against a new draft.
 *
 * @param draftText  The new scene/chapter text to check
 * @returns          A ContinuityCheckResult with all claims and flags
 */
export async function checkDraft(draftText: string): Promise<ContinuityCheckResult> {
  let totalInputTokens = 0;
  let totalGeneratedTokens = 0;

  // ── Step 1: Extract claims ────────────────────────────────────────────────
  const claimPrompt = buildClaimExtractionPrompt(draftText);

  const claimResult = await generate({
    prompt: claimPrompt,
    maxNewTokens: 2048,
    temperature: 0,
  });

  totalInputTokens     += claimResult.inputTokenCount;
  totalGeneratedTokens += claimResult.generatedTokenCount;

  let rawClaims: unknown[];
  try {
    rawClaims = extractJsonArray(claimResult.text);
  } catch (err) {
    throw new Error(
      `Granite returned unparseable claims JSON.\n` +
      `Parse error: ${err instanceof Error ? err.message : String(err)}\n` +
      `Raw (first 800 chars): ${claimResult.text.slice(0, 800)}`
    );
  }

  const claims: Claim[] = rawClaims
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c, i) => ({
      text:          typeof c['text'] === 'string'          ? c['text']          : String(c['text'] ?? ''),
      type:          typeof c['type'] === 'string'          ? c['type'] as Claim['type'] : 'other',
      characters:    Array.isArray(c['characters'])         ? (c['characters'] as unknown[]).map(String) : [],
      sentenceIndex: typeof c['sentenceIndex'] === 'number' ? c['sentenceIndex'] : i,
    }));

  // ── Step 2: Retrieve relevant facts ──────────────────────────────────────
  // Build distinct queries: one per character mentioned, plus one global query
  // for timeline / world-rule claims.
  const queries = new Set<string>();

  for (const claim of claims) {
    for (const char of claim.characters) queries.add(char);
  }
  // Always add a broad query to catch rules and events
  queries.add('all world rules and events');

  const retrievedFactSets: RetrievedFacts[] = [];
  for (const q of queries) {
    const facts = retrieveFacts(q);
    // Only include non-empty results to keep the prompt size manageable
    if (facts.characters.length > 0 || facts.events.length > 0 || facts.rules.length > 0) {
      retrievedFactSets.push(facts);
    }
  }

  // ── Step 3: Check claims against facts ───────────────────────────────────
  if (claims.length === 0) {
    // No claims extracted — nothing to check
    return {
      draftText,
      claims: [],
      flags: [],
      checkedAt: new Date().toISOString(),
      totalInputTokens,
      totalGeneratedTokens,
    };
  }

  const checkPrompt = buildContradictionCheckPrompt(claims, retrievedFactSets, draftText);

  const checkResult = await generate({
    prompt: checkPrompt,
    maxNewTokens: 3000,
    temperature: 0,
  });

  totalInputTokens     += checkResult.inputTokenCount;
  totalGeneratedTokens += checkResult.generatedTokenCount;

  let rawFlags: unknown[];
  try {
    rawFlags = extractJsonArray(checkResult.text);
  } catch (err) {
    throw new Error(
      `Granite returned unparseable flags JSON.\n` +
      `Parse error: ${err instanceof Error ? err.message : String(err)}\n` +
      `Raw (first 800 chars): ${checkResult.text.slice(0, 800)}`
    );
  }

  const flags: ContinuityFlag[] = (rawFlags as RawFlag[])
    .filter((f) => typeof f === 'object' && f !== null)
    .map((f, i) => {
      const claimIndex = typeof f.claimIndex === 'number' ? f.claimIndex : 0;
      const claim = claims[claimIndex] ?? claims[0];
      return {
        flagNumber:      i + 1,
        claim,
        conflictingFact: typeof f.conflictingFact === 'string' ? f.conflictingFact : String(f.conflictingFact ?? ''),
        factSource:      typeof f.factSource === 'string'      ? f.factSource      : String(f.factSource ?? ''),
        confidence:      (['high', 'medium', 'low'].includes(f.confidence) ? f.confidence : 'medium') as ContinuityFlag['confidence'],
        reasoning:       typeof f.reasoning === 'string'       ? f.reasoning       : String(f.reasoning ?? ''),
      };
    });

  return {
    draftText,
    claims,
    flags,
    checkedAt: new Date().toISOString(),
    totalInputTokens,
    totalGeneratedTokens,
  };
}
