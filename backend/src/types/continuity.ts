/**
 * Continuity-related types — Phase 4
 * Extends the base types from facts.ts.
 */

// ── Claim extracted from new draft text ──────────────────────────────────────

export interface Claim {
  /** The exact excerpt or paraphrase from the draft that makes this claim */
  text: string;
  /**
   * Category of claim — helps the Continuity Agent choose which facts to
   * retrieve and compare.
   */
  type:
    | 'character_knowledge'   // character knows / doesn't know something
    | 'character_trait'       // character described as having a trait
    | 'character_attribute'   // age, occupation, appearance, etc.
    | 'event_occurrence'      // claim that an event happened / didn't happen
    | 'timeline_position'     // claim about when something occurs
    | 'world_rule'            // invokes or violates a world rule
    | 'relationship'          // describes how characters relate
    | 'other';
  /** Character names mentioned in this claim (empty if none) */
  characters: string[];
  /** Approximate location in the draft: sentence index (0-based) */
  sentenceIndex: number;
}

// ── Contradiction flag ────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ContinuityFlag {
  /** Sequential flag number within this check (1-based) */
  flagNumber: number;
  /** The claim from the new draft that is in question */
  claim: Claim;
  /**
   * The established fact that conflicts with the claim.
   * Verbatim from the Knowledge Agent's retrieval result.
   */
  conflictingFact: string;
  /** Where in the knowledge base this fact comes from */
  factSource: string;
  /** Confidence that this is a genuine contradiction (not a false positive) */
  confidence: ConfidenceLevel;
  /**
   * Granite's step-by-step reasoning trace — the intermediate chain-of-thought
   * before it reached its conclusion. Preserved for the Explanation Agent.
   */
  reasoning: string;
}

// ── Full check result ─────────────────────────────────────────────────────────

export interface ContinuityCheckResult {
  /** The draft text that was checked */
  draftText: string;
  /** All claims Granite identified in the draft */
  claims: Claim[];
  /** Flags where a claim contradicts an established fact */
  flags: ContinuityFlag[];
  /** ISO timestamp */
  checkedAt: string;
  /** Total Granite token usage for this check */
  totalInputTokens: number;
  totalGeneratedTokens: number;
}
