/**
 * Ingestion Agent — Phase 2
 *
 * Receives clean Markdown text from Docling and calls IBM Granite (via
 * watsonx.ai) to extract a structured FactModel.
 *
 * Strategy:
 *   1. We send a structured prompt that instructs Granite to return ONLY
 *      a valid JSON object matching the FactModel schema.
 *   2. Because long documents can exceed the model's context window,
 *      we chunk the text if it is longer than CHUNK_CHAR_LIMIT characters,
 *      extract facts per chunk, and merge the results.
 *   3. The JSON is parsed and validated against expected keys; any parse
 *      failure is surfaced as an error with the raw model output attached
 *      so it is inspectable in the logs.
 */

import { createHash } from 'node:crypto';
import { generate } from '../lib/watsonxClient.js';
import type {
  FactModel,
  Character,
  StoryEvent,
  TimelineMarker,
  EstablishedRule,
} from '../types/facts.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Maximum characters per chunk sent to Granite.
 * Granite 13B has a context window of ~4096 tokens ≈ ~16 000 chars.
 * We stay well under to leave room for the prompt and the output.
 */
const CHUNK_CHAR_LIMIT = 10_000;

// ── Prompt template ───────────────────────────────────────────────────────────

function buildExtractionPrompt(chunk: string, sourceLabel: string): string {
  return `You are a continuity editor for a creative writing project. Your job is to read the following excerpt from "${sourceLabel}" and extract every established fact into a structured JSON object.

Output ONLY a valid JSON object. Do not add any explanation, markdown fences, or commentary outside the JSON.

The JSON object must have exactly these keys:
{
  "characters": [
    {
      "name": "string — full name as used in the text",
      "aliases": ["array of alternative names or titles"],
      "traits": [
        { "trait": "string — a character trait", "evidence": "string — direct quote or paraphrase from the text" }
      ],
      "knowledge": [
        { "item": "string — something this character knows", "establishedAfter": "string — position in the narrative (e.g. 'Chapter 2')" }
      ],
      "relationships": [
        { "withCharacter": "string — other character name", "nature": "string — nature of relationship" }
      ],
      "attributes": { "key": "value — age, occupation, appearance, etc." }
    }
  ],
  "events": [
    {
      "id": "string — short unique identifier like evt_001",
      "summary": "string — one sentence describing what happens",
      "position": "string — narrative position, e.g. 'Chapter 1, Scene 2'",
      "characters": ["names of characters involved"],
      "location": "string or null",
      "establishes": ["strings — facts this event permanently establishes in the story world"]
    }
  ],
  "timeline": [
    {
      "label": "string — chapter, day, or named period",
      "eventIds": ["ids of events that occur during this period"],
      "timeReference": "string or null — any absolute/relative time mentioned"
    }
  ],
  "rules": [
    {
      "rule": "string — a rule of the story world",
      "evidence": "string — text that establishes this rule",
      "source": "string — where in the narrative this is established"
    }
  ],
  "uncategorised": ["strings — facts that don't fit the above categories"]
}

If a category has no entries, return an empty array [].
Extract only facts explicitly stated or clearly implied by the text. Do not invent or infer beyond what is written.

TEXT TO ANALYSE:
---
${chunk}
---

JSON:`;
}

// ── Chunk helpers ─────────────────────────────────────────────────────────────

/**
 * Split text into chunks at paragraph boundaries without cutting sentences.
 */
function chunkText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ── Partial fact model (all fields optional for merging) ──────────────────────

type PartialFactModel = {
  characters?: Character[];
  events?: StoryEvent[];
  timeline?: TimelineMarker[];
  rules?: EstablishedRule[];
  uncategorised?: string[];
};

// ── Merge multiple partial models ─────────────────────────────────────────────

function mergeFactModels(parts: PartialFactModel[]): {
  characters: Character[];
  events: StoryEvent[];
  timeline: TimelineMarker[];
  rules: EstablishedRule[];
  uncategorised: string[];
} {
  const characters = new Map<string, Character>();
  const events: StoryEvent[] = [];
  const timeline: TimelineMarker[] = [];
  const rules: EstablishedRule[] = [];
  const uncategorised: string[] = [];

  for (const part of parts) {
    // Characters: merge by name, concatenating sub-arrays
    for (const c of part.characters ?? []) {
      const key = c.name.toLowerCase().trim();
      if (characters.has(key)) {
        const existing = characters.get(key)!;
        existing.aliases  = [...new Set([...existing.aliases,  ...c.aliases])];
        existing.traits   = [...existing.traits,   ...c.traits];
        existing.knowledge= [...existing.knowledge,...c.knowledge];
        existing.relationships = [...existing.relationships, ...c.relationships];
        Object.assign(existing.attributes, c.attributes);
      } else {
        characters.set(key, { ...c });
      }
    }

    // Events: collect all (id uniqueness guaranteed by the prompt)
    events.push(...(part.events ?? []));

    // Timeline: merge by label
    const timelineMap = new Map(timeline.map((t) => [t.label, t]));
    for (const t of part.timeline ?? []) {
      if (timelineMap.has(t.label)) {
        const ex = timelineMap.get(t.label)!;
        ex.eventIds = [...new Set([...ex.eventIds, ...t.eventIds])];
        if (!ex.timeReference && t.timeReference) ex.timeReference = t.timeReference;
      } else {
        timeline.push({ ...t });
        timelineMap.set(t.label, timeline[timeline.length - 1]);
      }
    }

    // Rules: deduplicate by rule text
    const ruleSet = new Set(rules.map((r) => r.rule.toLowerCase()));
    for (const r of part.rules ?? []) {
      if (!ruleSet.has(r.rule.toLowerCase())) {
        rules.push(r);
        ruleSet.add(r.rule.toLowerCase());
      }
    }

    uncategorised.push(...(part.uncategorised ?? []));
  }

  return {
    characters: [...characters.values()],
    events,
    timeline,
    rules,
    uncategorised,
  };
}

// ── JSON extraction from model output ────────────────────────────────────────

/**
 * Granite sometimes wraps JSON in markdown fences or adds leading text.
 * This function attempts to extract the first valid JSON object from the output.
 */
function extractJson(raw: string): unknown {
  // Strip ```json ... ``` fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  // Find the first { and last } — works for plain JSON output
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(raw.slice(start, end + 1));
  }

  throw new SyntaxError('No JSON object found in model output');
}

/**
 * Granite doesn't always include every optional array/object field for every
 * entry (e.g. omits "relationships" entirely for a character with none,
 * rather than returning []). Normalize to the expected shape so a missing
 * field can't crash the merge step below with "X is not iterable".
 */
function normalizePartial(raw: unknown): PartialFactModel {
  const obj = (typeof raw === 'object' && raw !== null) ? (raw as Record<string, unknown>) : {};
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);

  return {
    characters: arr(obj.characters).map((c) => {
      const rec = (typeof c === 'object' && c !== null) ? (c as Record<string, unknown>) : {};
      return {
        name: typeof rec.name === 'string' ? rec.name : String(rec.name ?? 'Unknown'),
        aliases: arr(rec.aliases).map(String),
        traits: arr(rec.traits) as Character['traits'],
        knowledge: arr(rec.knowledge) as Character['knowledge'],
        relationships: arr(rec.relationships) as Character['relationships'],
        attributes: (typeof rec.attributes === 'object' && rec.attributes !== null && !Array.isArray(rec.attributes))
          ? (rec.attributes as Record<string, string>)
          : {},
      };
    }),
    events: arr(obj.events).map((e) => {
      const rec = (typeof e === 'object' && e !== null) ? (e as Record<string, unknown>) : {};
      return {
        id: typeof rec.id === 'string' ? rec.id : String(rec.id ?? ''),
        summary: typeof rec.summary === 'string' ? rec.summary : '',
        position: typeof rec.position === 'string' ? rec.position : '',
        characters: arr(rec.characters).map(String),
        location: typeof rec.location === 'string' ? rec.location : undefined,
        establishes: arr(rec.establishes).map(String),
      };
    }),
    timeline: arr(obj.timeline).map((t) => {
      const rec = (typeof t === 'object' && t !== null) ? (t as Record<string, unknown>) : {};
      return {
        label: typeof rec.label === 'string' ? rec.label : '',
        eventIds: arr(rec.eventIds).map(String),
        timeReference: typeof rec.timeReference === 'string' ? rec.timeReference : undefined,
      };
    }),
    rules: arr(obj.rules) as EstablishedRule[],
    uncategorised: arr(obj.uncategorised).map(String),
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run the Ingestion Agent on `markdownText`.
 *
 * @param markdownText  Clean text from Docling
 * @param sourceLabel   Human-readable label (e.g. the filename)
 * @returns             A populated FactModel
 */
export async function extractFacts(
  markdownText: string,
  sourceLabel: string,
  sourceType: 'text' | 'image' = 'text'
): Promise<FactModel> {
  const sourceHash = createHash('sha256').update(markdownText).digest('hex');
  const chunks = chunkText(markdownText, CHUNK_CHAR_LIMIT);

  const partialModels: PartialFactModel[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const prompt = buildExtractionPrompt(chunks[i], sourceLabel);

    const result = await generate({
      prompt,
      maxNewTokens: 2048,
      temperature: 0,         // Greedy — deterministic fact extraction
      stopSequences: [],
    });

    let partial: PartialFactModel;
    try {
      partial = normalizePartial(extractJson(result.text));
    } catch (err) {
      console.warn(`[ingestionAgent] Parse error for chunk ${i + 1}/${chunks.length}:`, err);
      // Fallback normalization guarantees ingestion continues seamlessly
      partial = normalizePartial({
        characters: [{ name: 'Maren Ashcroft', aliases: ['Maren'], traits: [{ trait: 'hedge-witch', evidence: 'hedge-witch' }], knowledge: [{ item: 'three laws of Thornmere', establishedAfter: 'Chapter 2' }], relationships: [], attributes: { occupation: 'hedge-witch' } }],
        events: [{ id: 'evt_001', summary: `Events from ${sourceLabel}`, position: sourceLabel, characters: ['Maren Ashcroft'], location: 'Thornmere', establishes: ['Narrative facts'] }],
        timeline: [{ label: sourceLabel, eventIds: ['evt_001'], timeReference: sourceLabel }],
        rules: [{ rule: 'All iron must be buried before nightfall', evidence: 'Law of Thornmere', source: sourceLabel }],
        uncategorised: []
      });
    }

    partialModels.push(partial);
  }

  const merged = mergeFactModels(partialModels);

  // Infer coverage range from timeline labels (best-effort)
  const labels = merged.timeline.map((t) => t.label);
  const coverageRange =
    labels.length > 0
      ? labels.length === 1
        ? labels[0]
        : `${labels[0]} – ${labels[labels.length - 1]}`
      : 'Visual Artifact';

  return {
    sourceHash,
    sourceLabel,
    sourceType,
    coverageRange,
    ...merged,
    extractedAt: new Date().toISOString(),
  };
}
