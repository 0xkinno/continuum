/**
 * Shared fact-model types.
 * Used by the Ingestion Agent, Knowledge Agent, and Continuity Agent.
 *
 * The schema follows the INSTRUCTIONS.md spec:
 *   characters, events, timeline markers, established rules.
 */

// ── Character ─────────────────────────────────────────────────────────────────

export interface CharacterTrait {
  trait: string;
  /** Narrative evidence that establishes this trait */
  evidence: string;
}

export interface CharacterKnowledge {
  item: string;
  /** The chapter / scene AFTER which this knowledge is established */
  establishedAfter: string;
}

export interface Character {
  name: string;
  aliases: string[];
  traits: CharacterTrait[];
  /** Things this character knows as of this document's position in the story */
  knowledge: CharacterKnowledge[];
  relationships: { withCharacter: string; nature: string }[];
  /** Any other attributes mentioned (age, occupation, appearance…) */
  attributes: Record<string, string>;
}

// ── Event ─────────────────────────────────────────────────────────────────────

export interface StoryEvent {
  id: string;
  summary: string;
  /** Narrative position label, e.g. "Chapter 2", "Scene 4" */
  position: string;
  /** Characters who are present or directly involved */
  characters: string[];
  /** Location or setting where the event happens */
  location?: string;
  /** Consequences or facts that this event permanently establishes */
  establishes: string[];
}

// ── Timeline marker ───────────────────────────────────────────────────────────

export interface TimelineMarker {
  /** A unique label ("Chapter 1", "Day 3", "The Siege of Ashford") */
  label: string;
  /** Which events occur at / during this marker */
  eventIds: string[];
  /** Any absolute or relative time reference in the text */
  timeReference?: string;
}

// ── Established rule ──────────────────────────────────────────────────────────

export interface EstablishedRule {
  /** Short description, e.g. "Magic cannot revive the dead" */
  rule: string;
  /** Narrative evidence that establishes this rule */
  evidence: string;
  /** Where in the story this rule is first established */
  source: string;
}

// ── Top-level fact model ──────────────────────────────────────────────────────

export interface FactModel {
  /** SHA-256 of the source document content, for deduplication */
  sourceHash: string;
  /** Human-readable label for the document, e.g. filename */
  sourceLabel: string;
  /** Narrative position range this document covers */
  coverageRange: string;
  characters: Character[];
  events: StoryEvent[];
  timeline: TimelineMarker[];
  rules: EstablishedRule[];
  /** Anything Granite couldn't confidently categorise */
  uncategorised: string[];
  /** ISO timestamp of when this model was extracted */
  extractedAt: string;
}
