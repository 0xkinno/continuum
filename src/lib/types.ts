/**
 * Frontend API types — mirrors backend response shapes.
 * Keep in sync with backend/src/types/*.ts and route responses.
 */

// ── Fact model ────────────────────────────────────────────────────────────────

export interface CharacterTrait   { trait: string; evidence: string }
export interface CharacterKnowledge { item: string; establishedAfter: string }
export interface Character {
  name: string
  aliases: string[]
  traits: CharacterTrait[]
  knowledge: CharacterKnowledge[]
  relationships: { withCharacter: string; nature: string }[]
  attributes: Record<string, string>
}

export interface StoryEvent {
  id: string
  summary: string
  position: string
  characters: string[]
  location?: string | null
  establishes: string[]
}

export interface TimelineMarker {
  label: string
  eventIds: string[]
  timeReference?: string
}

export interface EstablishedRule {
  rule: string
  evidence: string
  source: string
}

export interface FactModel {
  sourceHash: string
  sourceLabel: string
  sourceType?: 'text' | 'image'
  coverageRange: string
  characters: Character[]
  events: StoryEvent[]
  timeline: TimelineMarker[]
  rules: EstablishedRule[]
  uncategorised: string[]
  extractedAt: string
}

// ── Continuity ────────────────────────────────────────────────────────────────

export type ClaimType =
  | 'character_knowledge'
  | 'character_trait'
  | 'character_attribute'
  | 'event_occurrence'
  | 'timeline_position'
  | 'world_rule'
  | 'relationship'
  | 'other'

export interface Claim {
  text: string
  type: ClaimType
  characters: string[]
  sentenceIndex: number
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ContinuityFlag {
  flagNumber: number
  claim: Claim
  conflictingFact: string
  factSource: string
  confidence: ConfidenceLevel
  reasoning: string
}

export interface ContinuityCheckResult {
  draftText: string
  claims: Claim[]
  flags: ContinuityFlag[]
  checkedAt: string
  totalInputTokens: number
  totalGeneratedTokens: number
}

export interface ExplainedFlag {
  flagNumber:    number
  flagType:      string
  claim:         string
  conflictsWith: string
  establishedIn: string
  explanation:   string
  confidence:    ConfidenceLevel
  suggestedFix?: string
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface IngestResponse {
  success: boolean
  sourceLabel?: string
  sourceType?: 'text' | 'image'
  doclingPageCount?: number
  sourceId?: number
  factModel?: FactModel
  error?: string
}

export interface CheckResponse {
  success: boolean
  result?: ContinuityCheckResult
  explained?: ExplainedFlag[]
  historyId?: number
  error?: string
}

export interface SourcesResponse {
  success: boolean
  sources?: { id: number; label: string; coverage: string; sourceType?: 'text' | 'image' }[]
  error?: string
}

export interface RetrievedCharacter {
  name: string
  aliases: string[]
  traits: { trait: string; evidence: string; sourceLabel: string }[]
  knowledge: { item: string; establishedAfter: string; sourceLabel: string }[]
  relationships: { withCharacter: string; nature: string }[]
  attributes: Record<string, string>
}

export interface RetrievedEvent {
  extId: string
  summary: string
  position: string
  characters: string[]
  location: string | null
  establishes: string[]
  sourceLabel: string
}

export interface RetrievedRule {
  rule: string
  evidence: string
  sourceLoc: string
  sourceLabel: string
}

export interface RetrievedFacts {
  query: string
  characters: RetrievedCharacter[]
  events: RetrievedEvent[]
  rules: RetrievedRule[]
  timelineLabels: string[]
}

export interface CanonResponse {
  success: boolean
  facts?: RetrievedFacts
  error?: string
}

export interface StoryGraphData {
  character: {
    name: string
    aliases: string[]
    traits: { trait: string; evidence: string }[]
    attributes: Record<string, string>
  }
  appearsIn: string[]
  relationships: { type: string; nature: string; withCharacter: string }[]
  possessions: string[]
  knowledgeTimeline: { item: string; establishedAfter: string }[]
  eventTimeline: { summary: string; position: string; establishes: string[] }[]
}

export interface StoryGraphResponse {
  success: boolean
  graph?: StoryGraphData
  error?: string
}

export interface HistoryListItem {
  id: number
  draft_excerpt: string
  draft_length: number
  flag_count: number
  claims_count: number
  checked_at: string
}

export interface HistoryListResponse {
  success: boolean
  checks?: HistoryListItem[]
  total?: number
  error?: string
}

