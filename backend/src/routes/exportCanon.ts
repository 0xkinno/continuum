/**
 * Export Canon Route
 * GET /knowledge/export
 *
 * Exports the complete SQLite story bible in Markdown (.md), PDF (.pdf),
 * Plain Text (.txt), or JSON (.json) format.
 */

import type { FastifyInstance } from 'fastify';
import { getDb } from '../lib/db.js';

export interface CanonExportJSON {
  generatedAt: string;
  sourceCount: { total: number; text: number; image: number };
  characters: Array<{
    name: string;
    traits: string[];
    attributes: Record<string, string>;
    relationships: Array<{ type: string; withCharacter: string; nature: string }>;
    knowledge: Array<{ item: string; establishedAfter: string }>;
    appearsIn: string[];
  }>;
  timeline: Array<{ summary: string; source: string; position: string }>;
  rules: Array<{ text: string; source: string }>;
  sources: Array<{ filename: string; sourceType: 'text' | 'image'; ingestedAt: string }>;
}

function generatePdfFromText(title: string, contentLines: string[]): Buffer {
  const sanitize = (str: string) =>
    str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const streamBody: string[] = ['BT', '/F1 12 Tf', '14 TL', '50 740 Td'];
  streamBody.push(`(${sanitize(title)}) Tj T* T*`);

  for (const rawLine of contentLines) {
    const line = rawLine.trim();
    if (!line) {
      streamBody.push('T*');
      continue;
    }

    if (line.startsWith('# ')) {
      streamBody.push('/F1 18 Tf 22 TL');
      streamBody.push(`(${sanitize(line.slice(2))}) Tj T* T*`);
      streamBody.push('/F1 12 Tf 14 TL');
    } else if (line.startsWith('## ')) {
      streamBody.push('/F1 14 Tf 18 TL');
      streamBody.push(`(${sanitize(line.slice(3))}) Tj T* T*`);
      streamBody.push('/F1 12 Tf 14 TL');
    } else if (line.startsWith('### ')) {
      streamBody.push('/F1 13 Tf 16 TL');
      streamBody.push(`(${sanitize(line.slice(4))}) Tj T*`);
      streamBody.push('/F1 12 Tf 14 TL');
    } else if (line === '---') {
      streamBody.push(`(--------------------------------------------------------------------------------) Tj T*`);
    } else {
      // Split into lines <= 80 characters for clean PDF line wrapping
      const chunks = line.match(/.{1,80}(\s+|$)/g) || [line];
      for (const chunk of chunks) {
        streamBody.push(`(${sanitize(chunk.trim())}) Tj T*`);
      }
    }
  }

  streamBody.push('ET');
  const streamData = streamBody.join('\n');

  const pdfObj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const pdfObj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const pdfObj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n';
  const pdfObj4 = `4 0 obj\n<< /Length ${Buffer.byteLength(streamData)} >>\nstream\n${streamData}\nendstream\nendobj\n`;
  const pdfObj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';

  const header = '%PDF-1.4\n';
  let offset = header.length;
  const offsets = [offset];

  const objs = [pdfObj1, pdfObj2, pdfObj3, pdfObj4, pdfObj5];
  let body = '';
  for (const obj of objs) {
    body += obj;
    offset += Buffer.byteLength(obj);
    offsets.push(offset);
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 0; i < objs.length; i++) {
    xref += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, 'latin1');
}

export async function exportCanonRoutes(app: FastifyInstance) {
  app.get('/export', async (request, reply) => {
    try {
      const { format = 'md' } = request.query as { format?: string };
      const db = getDb();

      // 1. Fetch Sources
      const sourceRows = db.prepare(`
        SELECT id, label, source_type, coverage, extracted_at FROM sources ORDER BY id
      `).all() as { id: number; label: string; source_type: string; coverage: string; extracted_at: string }[];

      const textSourceCount = sourceRows.filter(s => s.source_type !== 'image').length;
      const imageSourceCount = sourceRows.filter(s => s.source_type === 'image').length;

      // 2. Fetch Characters & Sub-tables
      const charRows = db.prepare(`SELECT id, name FROM characters ORDER BY id`).all() as { id: number; name: string }[];

      const charactersData = charRows.map((char) => {
        const traitRows = db.prepare(`
          SELECT DISTINCT trait FROM character_traits WHERE character_id = ?
        `).all(char.id) as { trait: string }[];

        const attrRows = db.prepare(`
          SELECT attr_key, attr_value FROM character_attributes WHERE character_id = ?
        `).all(char.id) as { attr_key: string; attr_value: string }[];
        const attributes: Record<string, string> = {};
        for (const a of attrRows) attributes[a.attr_key] = a.attr_value;

        const relRows = db.prepare(`
          SELECT DISTINCT with_character, nature FROM character_relationships WHERE character_id = ?
        `).all(char.id) as { with_character: string; nature: string }[];

        const rels = relRows.map(r => {
          let type = 'associate';
          const nLower = r.nature.toLowerCase();
          if (nLower.includes('friend') || nLower.includes('partner') || nLower.includes('ally')) type = 'ally';
          else if (nLower.includes('enemy') || nLower.includes('rival')) type = 'rival';
          else if (nLower.includes('leader') || nLower.includes('instructor') || nLower.includes('elder') || nLower.includes('scholar')) type = 'mentor';
          return { type, withCharacter: r.with_character, nature: r.nature };
        });

        const kRows = db.prepare(`
          SELECT DISTINCT item, established_after FROM character_knowledge WHERE character_id = ? ORDER BY id
        `).all(char.id) as { item: string; established_after: string }[];

        const appRows = db.prepare(`
          SELECT DISTINCT s.label FROM events e
          JOIN event_characters ec ON e.id = ec.event_id
          JOIN sources s ON e.source_id = s.id
          WHERE LOWER(ec.character_name) = ?
        `).all(char.name.toLowerCase()) as { label: string }[];

        return {
          name: char.name,
          traits: traitRows.map(t => t.trait),
          attributes,
          relationships: rels,
          knowledge: kRows.map(k => ({ item: k.item, establishedAfter: k.established_after })),
          appearsIn: appRows.map(a => a.label),
        };
      });

      // 3. Fetch Events / Timeline
      const evRows = db.prepare(`
        SELECT e.summary, e.position, s.label as source_label FROM events e
        JOIN sources s ON e.source_id = s.id ORDER BY e.id
      `).all() as { summary: string; position: string; source_label: string }[];

      const timelineData = evRows.map(e => ({
        summary: e.summary,
        source: e.source_label,
        position: e.position || e.source_label || 'Established',
      }));

      // 4. Fetch Rules
      const ruleRows = db.prepare(`
        SELECT r.rule_text, s.label as source_label FROM rules r
        JOIN sources s ON r.source_id = s.id ORDER BY r.id
      `).all() as { rule_text: string; source_label: string }[];

      const rulesData = ruleRows.map(r => ({
        text: r.rule_text,
        source: r.source_label,
      }));

      const timestamp = new Date().toISOString();
      const timestampShort = timestamp.slice(0, 10);

      // JSON format response
      if (format.toLowerCase() === 'json') {
        const jsonExport: CanonExportJSON = {
          generatedAt: timestamp,
          sourceCount: {
            total: sourceRows.length,
            text: textSourceCount,
            image: imageSourceCount,
          },
          characters: charactersData,
          timeline: timelineData,
          rules: rulesData,
          sources: sourceRows.map(s => ({
            filename: s.label,
            sourceType: (s.source_type as 'text' | 'image') || 'text',
            ingestedAt: s.extracted_at,
          })),
        };
        return reply.type('application/json').send(jsonExport);
      }

      // Build Markdown Content Lines
      const projectName = 'Continuum Story Bible';
      const mdLines: string[] = [
        `# ${projectName}`,
        `> Generated by Continuum on ${timestamp}`,
        `> Canon built from ${sourceRows.length} sources (${textSourceCount} text, ${imageSourceCount} images)`,
        '',
        '---',
        '',
        '## Characters',
        '',
      ];

      for (const c of charactersData) {
        mdLines.push(`### ${c.name}`);
        mdLines.push(`**Traits:** ${c.traits.join(', ') || 'None specified'}`);
        const attrStr = Object.entries(c.attributes).map(([k, v]) => `${k}: ${v}`).join(', ') || 'None specified';
        mdLines.push(`**Attributes:** ${attrStr}`);
        mdLines.push('');
        mdLines.push('**Relationships:**');
        if (c.relationships.length === 0) {
          mdLines.push('- None logged');
        } else {
          for (const r of c.relationships) {
            mdLines.push(`- ${r.type}: ${r.withCharacter} (${r.nature})`);
          }
        }
        mdLines.push('');
        mdLines.push('**Knowledge:**');
        if (c.knowledge.length === 0) {
          mdLines.push('- None logged');
        } else {
          for (const k of c.knowledge) {
            mdLines.push(`- ${k.item} -- established after ${k.establishedAfter}`);
          }
        }
        mdLines.push('');
        mdLines.push(`**Appears in:** ${c.appearsIn.join(', ') || 'General Lore'}`);
        mdLines.push('');
        mdLines.push('---');
        mdLines.push('');
      }

      mdLines.push('## Timeline');
      mdLines.push('');
      if (timelineData.length === 0) {
        mdLines.push('1. No timeline events logged yet');
      } else {
        timelineData.forEach((ev, i) => {
          mdLines.push(`${i + 1}. ${ev.summary} -- ${ev.position}`);
        });
      }
      mdLines.push('');

      mdLines.push('## Established Rules');
      mdLines.push('');
      if (rulesData.length === 0) {
        mdLines.push('- No world rules logged yet');
      } else {
        for (const r of rulesData) {
          mdLines.push(`- ${r.text} -- established in ${r.source}`);
        }
      }
      mdLines.push('');

      mdLines.push('## Sources');
      mdLines.push('');
      mdLines.push('| Source | Type | Ingested |');
      mdLines.push('|---|---|---|');
      for (const s of sourceRows) {
        mdLines.push(`| ${s.label} | ${s.source_type || 'text'} | ${s.extracted_at} |`);
      }

      const mdText = mdLines.join('\n');

      // PDF format response
      if (format.toLowerCase() === 'pdf') {
        const pdfBuffer = generatePdfFromText(projectName, mdLines);
        reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="story-bible-${timestampShort}.pdf"`)
          .send(pdfBuffer);
        return;
      }

      // Plain text format response
      if (format.toLowerCase() === 'txt') {
        reply
          .header('Content-Type', 'text/plain; charset=utf-8')
          .header('Content-Disposition', `attachment; filename="story-bible-${timestampShort}.txt"`)
          .send(mdText);
        return;
      }

      // Default Markdown format response (.md)
      reply
        .header('Content-Type', 'text/markdown; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="story-bible-${timestampShort}.md"`)
        .send(mdText);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, 'Export canon error');
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });
}
