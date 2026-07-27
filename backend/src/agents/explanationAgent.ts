/**
 * Explanation Agent — Phase 5
 *
 * Takes the raw ContinuityFlag array from the Continuity Agent and calls
 * IBM Granite to write an editorial-toned explanation for each flag.
 *
 * Output per flag — ExplainedFlag:
 *   flagType     — human-readable category label (e.g. "CHARACTER KNOWLEDGE")
 *   claim        — the exact text from the draft that is at issue
 *   conflictsWith — the established fact it contradicts
 *   establishedIn — where in the story that fact was first set down
 *   explanation  — 2-4 sentence editorial note, reads like a human editor
 *   confidence   — passed through from the Continuity Agent
 *
 * Prompting strategy:
 *   All flags are explained in a single Granite call to reduce latency.
 *   The prompt asks for a JSON array, one entry per flag, in the same
 *   order as the input. If Granite drops or reorders entries, we fall back
 *   to pairing by index.
 */

import { generate } from '../lib/watsonxClient.js';
import type { ContinuityFlag } from '../types/continuity.js';

// ── Output type ───────────────────────────────────────────────────────────────

export interface ExplainedFlag {
  flagNumber:     number;
  flagType:       string;   // e.g. "CHARACTER KNOWLEDGE"
  claim:          string;
  conflictsWith:  string;
  establishedIn:  string;
  explanation:    string;
  confidence:     'high' | 'medium' | 'low';
}

// ── Claim type → readable label ───────────────────────────────────────────────

const FLAG_TYPE_LABELS: Record<string, string> = {
  character_knowledge: 'CHARACTER KNOWLEDGE',
  character_trait:     'CHARACTER TRAIT',
  character_attribute: 'CHARACTER ATTRIBUTE',
  event_occurrence:    'EVENT',
  timeline_position:   'TIMELINE',
  world_rule:          'ESTABLISHED RULE',
  relationship:        'RELATIONSHIP',
  other:               'CONTINUITY',
};

function labelForType(type: string): string {
  return FLAG_TYPE_LABELS[type] ?? 'CONTINUITY';
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildExplanationPrompt(flags: ContinuityFlag[]): string {
  const flagsBlock = flags
    .map((f, i) => {
      const lines = [
        `[Flag ${i + 1}]`,
        `Type: ${labelForType(f.claim.type)}`,
        `Claim in draft: "${f.claim.text}"`,
        `Conflicts with: "${f.conflictingFact}"`,
        `Established in: ${f.factSource}`,
        `Confidence: ${f.confidence}`,
        `Reasoning trace: ${f.reasoning}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');

  return `You are a senior continuity editor working on a long-form creative project. You have been given a list of potential continuity violations found in a new draft.

For each flag, write a short editorial note — the kind a thoughtful human editor would leave in the margin of a manuscript. The note should:
- Open with a clear one-sentence statement of the problem
- Name the specific claim in the draft and the established fact it contradicts
- State where the contradiction was established in the story
- Close with why this matters narratively (one sentence)
- Be 3-4 sentences total — concise, specific, editorial in tone
- Sound like a person, not a system error message
- Use "the draft" to refer to the new material and "established in [location]" for the known fact

Output ONLY a valid JSON array with exactly ${flags.length} element(s), in the same order as the input flags.

Each element must have exactly these keys:
{
  "flagType": "string — the type label in ALL CAPS",
  "claim": "string — the exact phrase from the draft that is the problem",
  "conflictsWith": "string — the established fact it contradicts",
  "establishedIn": "string — narrative location where the fact was established",
  "explanation": "string — your editorial note (3-4 sentences)",
  "confidence": "high | medium | low"
}

FLAGS TO EXPLAIN:
---
${flagsBlock}
---

JSON array:`;
}

// ── JSON recovery ─────────────────────────────────────────────────────────────

function extractJsonArray(raw: string): unknown[] {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1].trim() : raw;
  const start = text.indexOf('[');
  const end   = text.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(text.slice(start, end + 1)) as unknown[];
  }
  if (text.trim() === '' || text.trim() === '[]') return [];
  throw new SyntaxError(`No JSON array found in model output: ${text.slice(0, 300)}`);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate editorial explanations for a set of ContinuityFlags.
 * Returns one ExplainedFlag per input flag, preserving order.
 */
export async function explainFlags(flags: ContinuityFlag[]): Promise<ExplainedFlag[]> {
  if (flags.length === 0) return [];

  const prompt = buildExplanationPrompt(flags);

  const result = await generate({
    prompt,
    maxNewTokens: 2048,
    temperature: 0.3,   // Slight temperature for prose variety, not zero-temp JSON extraction
    stopSequences: [],
  });

  let rawItems: unknown[];
  try {
    rawItems = extractJsonArray(result.text);
  } catch (err) {
    throw new Error(
      `Explanation Agent: Granite returned unparseable JSON.\n` +
      `Parse error: ${err instanceof Error ? err.message : String(err)}\n` +
      `Raw (first 800 chars): ${result.text.slice(0, 800)}`
    );
  }

  // Pair by index — if Granite returns fewer items than flags, fill remaining
  return flags.map((flag, i) => {
    const raw = (rawItems[i] ?? {}) as Record<string, unknown>;
    return {
      flagNumber:    flag.flagNumber,
      flagType:      typeof raw['flagType'] === 'string'
                       ? raw['flagType']
                       : labelForType(flag.claim.type),
      claim:         typeof raw['claim'] === 'string'
                       ? raw['claim']
                       : flag.claim.text,
      conflictsWith: typeof raw['conflictsWith'] === 'string'
                       ? raw['conflictsWith']
                       : flag.conflictingFact,
      establishedIn: typeof raw['establishedIn'] === 'string'
                       ? raw['establishedIn']
                       : flag.factSource,
      explanation:   typeof raw['explanation'] === 'string'
                       ? raw['explanation']
                       : `The draft states "${flag.claim.text}" which conflicts with the established fact: "${flag.conflictingFact}" (${flag.factSource}).`,
      confidence:    (['high', 'medium', 'low'].includes(raw['confidence'] as string)
                       ? raw['confidence']
                       : flag.confidence) as 'high' | 'medium' | 'low',
    };
  });
}
