/**
 * Knowledge Agent — Phase 3
 *
 * Two responsibilities:
 *
 * 1. upsertFactModel(factModel)
 *    Persists a FactModel produced by the Ingestion Agent into SQLite.
 *    "Upsert" semantics:
 *      - Sources  : UNIQUE on sha256 → INSERT OR IGNORE (same doc, skip)
 *      - Characters: UNIQUE on name_lower → INSERT OR IGNORE then link
 *      - Aliases, traits, knowledge, relationships: always insert new rows
 *        from this source (knowledge grows; we don't delete old records)
 *      - Attributes: UNIQUE(character_id, attr_key) → INSERT OR REPLACE
 *        so later documents can update an attribute (e.g. age updated)
 *      - Events: UNIQUE(source_id, ext_id) → INSERT OR IGNORE
 *      - Timeline markers: UNIQUE(source_id, label) → INSERT OR IGNORE, then
 *        append any new eventIds
 *      - Rules: deduplicated by rule_lower across all sources
 *      - Uncategorised: always append
 *
 * 2. retrieveFacts(query)
 *    Returns all structured facts relevant to a free-text query.
 *    Query interpretation:
 *      - If the query mentions a character name, returns all facts about them.
 *      - If the query mentions a chapter/timeline label, scopes facts to that
 *        position and earlier (preserving narrative "as-of" semantics).
 *      - Always returns the full rules set (world rules are globally relevant).
 *    Returns a RetrievedFacts object ready for the Continuity Agent.
 */

import { getDb } from '../lib/db.js';
import type { FactModel } from '../types/facts.js';

// ── Retrieval result types ────────────────────────────────────────────────────

export interface RetrievedCharacter {
  name: string;
  aliases: string[];
  traits: { trait: string; evidence: string; sourceLabel: string }[];
  knowledge: { item: string; establishedAfter: string; sourceLabel: string }[];
  relationships: { withCharacter: string; nature: string }[];
  attributes: Record<string, string>;
}

export interface RetrievedEvent {
  extId: string;
  summary: string;
  position: string;
  characters: string[];
  location: string | null;
  establishes: string[];
  sourceLabel: string;
}

export interface RetrievedRule {
  rule: string;
  evidence: string;
  sourceLoc: string;
  sourceLabel: string;
}

export interface RetrievedFacts {
  query: string;
  characters: RetrievedCharacter[];
  events: RetrievedEvent[];
  rules: RetrievedRule[];
  /** Timeline labels present in the store, ordered as encountered */
  timelineLabels: string[];
}

// ── Row types returned by node:sqlite ────────────────────────────────────────

interface SourceRow     { id: number; label: string; coverage: string }
interface CharRow       { id: number; name: string }
interface AliasRow      { alias: string }
interface TraitRow      { trait: string; evidence: string; label: string }
interface KnowledgeRow  { item: string; established_after: string; label: string }
interface RelRow        { with_character: string; nature: string }
interface AttrRow       { attr_key: string; attr_value: string }
interface EventRow      { id: number; ext_id: string; summary: string; position: string; location: string | null; label: string }
interface EvtCharRow    { character_name: string }
interface EvtEstRow     { fact: string }
interface RuleRow       { rule_text: string; evidence: string; source_loc: string; label: string }
interface TimelineRow   { label: string }

// ── 1. UPSERT ─────────────────────────────────────────────────────────────────

/**
 * Persist a FactModel into SQLite.
 * Returns the database ID of the source record (new or existing).
 */
export function upsertFactModel(factModel: FactModel): number {
  const db = getDb();

  // ── Source ────────────────────────────────────────────────────────────────
  // INSERT OR IGNORE: if sha256 already exists we skip and fetch the existing id
  db.prepare(`
    INSERT OR IGNORE INTO sources (sha256, label, coverage, extracted_at)
    VALUES (?, ?, ?, ?)
  `).run(factModel.sourceHash, factModel.sourceLabel, factModel.coverageRange, factModel.extractedAt);

  const sourceRow = db.prepare(`SELECT id FROM sources WHERE sha256 = ?`).get(factModel.sourceHash) as { id: number };
  const sourceId = sourceRow.id;

  // ── Characters ────────────────────────────────────────────────────────────
  for (const char of factModel.characters) {
    const nameLower = char.name.toLowerCase().trim();

    db.prepare(`INSERT OR IGNORE INTO characters (name, name_lower) VALUES (?, ?)`).run(char.name, nameLower);
    const charRow = db.prepare(`SELECT id FROM characters WHERE name_lower = ?`).get(nameLower) as { id: number };
    const charId = charRow.id;

    // Link character to this source (idempotent)
    db.prepare(`INSERT OR IGNORE INTO character_sources (character_id, source_id) VALUES (?, ?)`).run(charId, sourceId);

    // Aliases
    for (const alias of char.aliases) {
      db.prepare(`INSERT OR IGNORE INTO character_aliases (character_id, alias, source_id) VALUES (?, ?, ?)`).run(charId, alias, sourceId);
    }

    // Traits (always insert — each source contribution is preserved)
    for (const t of char.traits) {
      db.prepare(`INSERT INTO character_traits (character_id, source_id, trait, evidence) VALUES (?, ?, ?, ?)`).run(charId, sourceId, t.trait, t.evidence);
    }

    // Knowledge
    for (const k of char.knowledge) {
      db.prepare(`INSERT INTO character_knowledge (character_id, source_id, item, established_after) VALUES (?, ?, ?, ?)`).run(charId, sourceId, k.item, k.establishedAfter);
    }

    // Relationships
    for (const r of char.relationships) {
      db.prepare(`INSERT INTO character_relationships (character_id, source_id, with_character, nature) VALUES (?, ?, ?, ?)`).run(charId, sourceId, r.withCharacter, r.nature);
    }

    // Attributes — later values win (INSERT OR REPLACE)
    for (const [key, value] of Object.entries(char.attributes)) {
      db.prepare(`INSERT OR REPLACE INTO character_attributes (character_id, source_id, attr_key, attr_value) VALUES (?, ?, ?, ?)`).run(charId, sourceId, key, value);
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────
  for (const ev of factModel.events) {
    db.prepare(`
      INSERT OR IGNORE INTO events (source_id, ext_id, summary, position, location)
      VALUES (?, ?, ?, ?, ?)
    `).run(sourceId, ev.id, ev.summary, ev.position, ev.location ?? null);

    const evRow = db.prepare(`SELECT id FROM events WHERE source_id = ? AND ext_id = ?`).get(sourceId, ev.id) as { id: number };
    const evDbId = evRow.id;

    for (const charName of ev.characters) {
      db.prepare(`INSERT OR IGNORE INTO event_characters (event_id, character_name) VALUES (?, ?)`).run(evDbId, charName);
    }
    for (const fact of ev.establishes) {
      db.prepare(`INSERT INTO event_establishes (event_id, fact) VALUES (?, ?)`).run(evDbId, fact);
    }
  }

  // ── Timeline markers ──────────────────────────────────────────────────────
  for (const tm of factModel.timeline) {
    db.prepare(`
      INSERT OR IGNORE INTO timeline_markers (source_id, label, time_reference)
      VALUES (?, ?, ?)
    `).run(sourceId, tm.label, tm.timeReference ?? null);

    const tmRow = db.prepare(`SELECT id FROM timeline_markers WHERE source_id = ? AND label = ?`).get(sourceId, tm.label) as { id: number };
    const tmId = tmRow.id;

    for (const extEventId of tm.eventIds) {
      db.prepare(`INSERT OR IGNORE INTO timeline_events (marker_id, ext_event_id) VALUES (?, ?)`).run(tmId, extEventId);
    }
  }

  // ── Rules ─────────────────────────────────────────────────────────────────
  for (const rule of factModel.rules) {
    const ruleLower = rule.rule.toLowerCase().trim();
    // Only insert if no identical rule already exists globally
    const existing = db.prepare(`SELECT id FROM rules WHERE rule_lower = ?`).get(ruleLower);
    if (!existing) {
      db.prepare(`INSERT INTO rules (source_id, rule_text, rule_lower, evidence, source_loc) VALUES (?, ?, ?, ?, ?)`).run(sourceId, rule.rule, ruleLower, rule.evidence, rule.source);
    }
  }

  // ── Uncategorised ─────────────────────────────────────────────────────────
  for (const fact of factModel.uncategorised) {
    db.prepare(`INSERT INTO uncategorised (source_id, fact) VALUES (?, ?)`).run(sourceId, fact);
  }

  return sourceId;
}

// ── 2. RETRIEVE ───────────────────────────────────────────────────────────────

/**
 * Retrieve structured facts relevant to a natural-language query.
 *
 * Resolution strategy:
 *  a) Extract character names from the query by matching against all stored
 *     character names and aliases.
 *  b) Extract a timeline position from the query by matching against stored
 *     timeline labels ("Chapter 2", "Day 3", etc.).
 *  c) If a timeline position is found, only return facts from sources whose
 *     timeline markers are at or before that position (narrative ordering).
 *  d) If no specific characters are named, return all characters.
 *  e) Always return all rules.
 */
export function retrieveFacts(query: string): RetrievedFacts {
  const db = getDb();
  const queryLower = query.toLowerCase();

  // ── a) Find mentioned character names ─────────────────────────────────────
  const allChars = db.prepare(`SELECT id, name FROM characters`).all() as unknown as CharRow[];
  const mentionedCharIds = new Set<number>();

  for (const c of allChars) {
    if (queryLower.includes(c.name.toLowerCase())) {
      mentionedCharIds.add(c.id);
    }
  }

  // Also check aliases
  const allAliases = db.prepare(`SELECT character_id, alias FROM character_aliases`).all() as unknown as { character_id: number; alias: string }[];
  for (const a of allAliases) {
    if (queryLower.includes(a.alias.toLowerCase())) {
      mentionedCharIds.add(a.character_id);
    }
  }

  // ── b) Find timeline position ─────────────────────────────────────────────
  const allTimeline = db.prepare(`
    SELECT DISTINCT tm.label, s.id as source_id
    FROM timeline_markers tm
    JOIN sources s ON tm.source_id = s.id
    ORDER BY s.id, tm.id
  `).all() as unknown as { label: string; source_id: number }[];

  const timelineLabels = [...new Set(allTimeline.map((t) => t.label))];

  let scopedSourceIds: number[] | null = null;
  let positionLabel: string | null = null;

  for (const t of allTimeline) {
    if (queryLower.includes(t.label.toLowerCase())) {
      positionLabel = t.label;
      break;
    }
  }

  if (positionLabel) {
    // Include all sources up to and including the matched timeline label
    // (ordered by source insertion order as a proxy for narrative order)
    const allSources = db.prepare(`SELECT id FROM sources ORDER BY id`).all() as unknown as { id: number }[];
    const matchSourceIds = new Set(
      (db.prepare(`SELECT source_id FROM timeline_markers WHERE label = ?`).all(positionLabel) as unknown as { source_id: number }[]).map((r) => r.source_id)
    );
    scopedSourceIds = [];
    for (const s of allSources) {
      scopedSourceIds.push(s.id);
      if (matchSourceIds.has(s.id)) break;
    }
  }

  // Source filter clause for SQL queries
  const sourceFilter =
    scopedSourceIds
      ? `AND source_id IN (${scopedSourceIds.join(',')})`
      : '';

  // Character filter clause
  const charFilter =
    mentionedCharIds.size > 0
      ? `AND character_id IN (${[...mentionedCharIds].join(',')})`
      : '';

  // ── Retrieve characters ───────────────────────────────────────────────────
  const targetCharIds =
    mentionedCharIds.size > 0 ? [...mentionedCharIds] : allChars.map((c) => c.id);

  const characters: RetrievedCharacter[] = [];

  for (const charId of targetCharIds) {
    const charRow = db.prepare(`SELECT name FROM characters WHERE id = ?`).get(charId) as { name: string } | undefined;
    if (!charRow) continue;

    const aliases = (db.prepare(`SELECT alias FROM character_aliases WHERE character_id = ? ${sourceFilter}`).all(charId) as unknown as AliasRow[]).map((r) => r.alias);

    const traits = (db.prepare(`
      SELECT ct.trait, ct.evidence, s.label
      FROM character_traits ct JOIN sources s ON ct.source_id = s.id
      WHERE ct.character_id = ? ${sourceFilter}
    `).all(charId) as unknown as TraitRow[]).map((r) => ({ trait: r.trait, evidence: r.evidence, sourceLabel: r.label }));

    const knowledge = (db.prepare(`
      SELECT ck.item, ck.established_after, s.label
      FROM character_knowledge ck JOIN sources s ON ck.source_id = s.id
      WHERE ck.character_id = ? ${sourceFilter}
    `).all(charId) as unknown as KnowledgeRow[]).map((r) => ({ item: r.item, establishedAfter: r.established_after, sourceLabel: r.label }));

    const relationships = (db.prepare(`
      SELECT cr.with_character, cr.nature
      FROM character_relationships cr
      WHERE cr.character_id = ? ${sourceFilter}
    `).all(charId) as unknown as RelRow[]).map((r) => ({ withCharacter: r.with_character, nature: r.nature }));

    const attrRows = db.prepare(`
      SELECT attr_key, attr_value
      FROM character_attributes
      WHERE character_id = ? ${sourceFilter}
    `).all(charId) as unknown as AttrRow[];

    const attributes: Record<string, string> = {};
    for (const a of attrRows) attributes[a.attr_key] = a.attr_value;

    characters.push({ name: charRow.name, aliases, traits, knowledge, relationships, attributes });
  }

  // ── Retrieve events ───────────────────────────────────────────────────────
  const eventRows = db.prepare(`
    SELECT e.id, e.ext_id, e.summary, e.position, e.location, s.label
    FROM events e JOIN sources s ON e.source_id = s.id
    WHERE 1=1 ${sourceFilter}
    ORDER BY e.id
  `).all() as unknown as EventRow[];

  // Filter to events that involve any of the queried characters (if specified)
  const events: RetrievedEvent[] = [];
  for (const ev of eventRows) {
    const evChars = (db.prepare(`SELECT character_name FROM event_characters WHERE event_id = ?`).all(ev.id) as unknown as EvtCharRow[]).map((r) => r.character_name);
    const evEstabs = (db.prepare(`SELECT fact FROM event_establishes WHERE event_id = ?`).all(ev.id) as unknown as EvtEstRow[]).map((r) => r.fact);

    // Include if no character filter, or if this event involves a queried char
    const isRelevant =
      mentionedCharIds.size === 0 ||
      evChars.some((name) => allChars.find((c) => mentionedCharIds.has(c.id) && c.name.toLowerCase() === name.toLowerCase()));

    if (isRelevant) {
      events.push({
        extId: ev.ext_id,
        summary: ev.summary,
        position: ev.position,
        characters: evChars,
        location: ev.location,
        establishes: evEstabs,
        sourceLabel: ev.label,
      });
    }
  }

  // ── Retrieve rules (always all, ignoring source/char filter) ─────────────
  const ruleRows = db.prepare(`
    SELECT r.rule_text, r.evidence, r.source_loc, s.label
    FROM rules r JOIN sources s ON r.source_id = s.id
    ORDER BY r.id
  `).all() as unknown as RuleRow[];

  const rules: RetrievedRule[] = ruleRows.map((r) => ({
    rule:        r.rule_text,
    evidence:    r.evidence,
    sourceLoc:   r.source_loc,
    sourceLabel: r.label,
  }));

  return { query, characters, events, rules, timelineLabels };
}

// ── 3. LIST SOURCES ───────────────────────────────────────────────────────────

export function listSources(): SourceRow[] {
  const db = getDb();
  return db.prepare(`SELECT id, label, coverage FROM sources ORDER BY id`).all() as unknown as SourceRow[];
}
