/**
 * clearDemo.ts — wipes all story-fact data from the database so the demo
 * can be run from a clean state.
 *
 * Deletes in FK-safe order: child tables first, then parents.
 * Preserves the schema itself — only data is removed.
 *
 * check_history is also cleared so the History view starts fresh.
 */

import { getDb } from './db.js';

export function clearAllDemoData(): void {
  const db = getDb();

  // Child tables first (FKs with ON DELETE CASCADE would handle it, but
  // explicit order avoids any edge-case if CASCADE is not fired in time)
  const tables = [
    'check_history',
    'uncategorised',
    'rules',
    'timeline_events',
    'timeline_markers',
    'event_establishes',
    'event_characters',
    'events',
    'character_attributes',
    'character_relationships',
    'character_knowledge',
    'character_traits',
    'character_aliases',
    'character_sources',
    'characters',
    'sources',
  ];

  for (const table of tables) {
    db.exec(`DELETE FROM ${table}`);
  }

  // Reset auto-increment counters so ids start from 1 again
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${tables.map(() => '?').join(',')})`)
  // sqlite_sequence is not a normal table; use individual exec instead
  for (const table of tables) {
    try {
      db.exec(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
    } catch {
      // sqlite_sequence may not exist if no rows have ever been inserted — fine
    }
  }
}
