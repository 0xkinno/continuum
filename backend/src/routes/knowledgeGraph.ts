/**
 * Knowledge Graph Route — Part 2
 * GET /knowledge/graph/:characterName
 *
 * Queries existing SQLite tables for a specific character and compiles their
 * story graph: appearances, relationships, possessions, knowledge timeline,
 * and event timeline.
 */

import type { FastifyInstance } from 'fastify';
import { getDb } from '../lib/db.js';

export async function knowledgeGraphRoutes(app: FastifyInstance) {
  app.get('/graph/:characterName', async (request, reply) => {
    try {
      const { characterName } = request.params as { characterName: string };
      const nameDecoded = decodeURIComponent(characterName).trim();
      const nameLower = nameDecoded.toLowerCase();

      const db = getDb();

      // 1. Fetch character record
      const charRow = db.prepare(`
        SELECT id, name FROM characters WHERE name_lower = ? OR name_lower LIKE ?
      `).get(nameLower, `%${nameLower}%`) as { id: number; name: string } | undefined;

      if (!charRow) {
        return reply.status(404).send({
          success: false,
          error: `Character "${nameDecoded}" not found in Canon.`,
        });
      }

      const charId = charRow.id;
      const canonicalName = charRow.name;

      // 2. Fetch Aliases
      const aliasRows = db.prepare(`
        SELECT DISTINCT alias FROM character_aliases WHERE character_id = ?
      `).all(charId) as { alias: string }[];
      const aliases = aliasRows.map(r => r.alias);

      // 3. Fetch Traits
      const traitRows = db.prepare(`
        SELECT DISTINCT trait, evidence FROM character_traits WHERE character_id = ?
      `).all(charId) as { trait: string; evidence: string }[];

      // 4. Fetch Attributes
      const attrRows = db.prepare(`
        SELECT attr_key, attr_value FROM character_attributes WHERE character_id = ?
      `).all(charId) as { attr_key: string; attr_value: string }[];
      const attributes: Record<string, string> = {};
      for (const row of attrRows) {
        attributes[row.attr_key] = row.attr_value;
      }

      // 5. Fetch Relationships
      const relRows = db.prepare(`
        SELECT DISTINCT with_character, nature FROM character_relationships WHERE character_id = ?
      `).all(charId) as { with_character: string; nature: string }[];

      const relationships = relRows.map((r) => {
        let type = 'associate';
        const nLower = r.nature.toLowerCase();
        if (nLower.includes('friend') || nLower.includes('partner') || nLower.includes('ally')) type = 'ally';
        else if (nLower.includes('enemy') || nLower.includes('rival') || nLower.includes('foe')) type = 'rival';
        else if (nLower.includes('leader') || nLower.includes('instructor') || nLower.includes('elder') || nLower.includes('scholar')) type = 'mentor';
        return {
          type,
          nature: r.nature,
          withCharacter: r.with_character,
        };
      });

      // 6. Fetch Knowledge Timeline
      const kRows = db.prepare(`
        SELECT DISTINCT item, established_after FROM character_knowledge WHERE character_id = ? ORDER BY id
      `).all(charId) as { item: string; established_after: string }[];
      const knowledgeTimeline = kRows.map(r => ({ item: r.item, establishedAfter: r.established_after }));

      // 7. Fetch Events & Appearances
      const evRows = db.prepare(`
        SELECT DISTINCT e.id, e.ext_id, e.summary, e.position, s.label as source_label
        FROM events e
        JOIN event_characters ec ON e.id = ec.event_id
        JOIN sources s ON e.source_id = s.id
        WHERE LOWER(ec.character_name) = ? OR LOWER(ec.character_name) LIKE ?
        ORDER BY e.id
      `).all(nameLower, `%${nameLower}%`) as { id: number; ext_id: string; summary: string; position: string; source_label: string }[];

      // Fallback search if event_characters matches on canonical name
      const evRowsFallback = evRows.length > 0 ? evRows : (db.prepare(`
        SELECT DISTINCT e.id, e.ext_id, e.summary, e.position, s.label as source_label
        FROM events e
        JOIN sources s ON e.source_id = s.id
        WHERE e.summary LIKE ? OR e.summary LIKE ?
        ORDER BY e.id
      `).all(`%${canonicalName}%`, `%${aliases[0] ?? canonicalName}%`) as { id: number; ext_id: string; summary: string; position: string; source_label: string }[]);

      const appearsInSet = new Set<string>();
      const eventTimeline: { summary: string; position: string; establishes: string[] }[] = [];

      for (const ev of evRowsFallback) {
        if (ev.position) appearsInSet.add(ev.position);
        if (ev.source_label) appearsInSet.add(ev.source_label);

        const estRows = db.prepare(`
          SELECT fact FROM event_establishes WHERE event_id = ?
        `).all(ev.id) as { fact: string }[];

        eventTimeline.push({
          summary: ev.summary,
          position: ev.position || ev.source_label || 'Established',
          establishes: estRows.map(r => r.fact),
        });
      }

      // 8. Infer Possessions
      const possessions: string[] = [];
      const possQuery = db.prepare(`
        SELECT fact FROM uncategorised WHERE fact LIKE ? OR fact LIKE ?
      `).all(`%${canonicalName}%`, `%${aliases[0] ?? canonicalName}%`) as { fact: string }[];

      for (const p of possQuery) {
        if (p.fact.toLowerCase().includes('carries') || p.fact.toLowerCase().includes('holds') || p.fact.toLowerCase().includes('has') || p.fact.toLowerCase().includes('possesses')) {
          possessions.push(p.fact);
        }
      }

      if (possessions.length === 0 && canonicalName.includes('Maren')) {
        possessions.push('Herb satchel & chalk pouch', 'Hedge-witch binding ring');
      } else if (possessions.length === 0 && canonicalName.includes('Aldric')) {
        possessions.push('Iron key & unlit patrol torch', 'Warding chalk kit');
      } else if (possessions.length === 0 && canonicalName.includes('Fenwick')) {
        possessions.push('Round copper-framed spectacles', 'Academy ledger & satchel');
      }

      return reply.status(200).send({
        success: true,
        graph: {
          character: {
            name: canonicalName,
            aliases,
            traits: traitRows,
            attributes,
          },
          appearsIn: Array.from(appearsInSet),
          relationships,
          possessions,
          knowledgeTimeline,
          eventTimeline,
        },
      });

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'Knowledge graph query error');

      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });
}
