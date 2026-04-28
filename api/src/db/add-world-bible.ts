/**
 * Migration: World Bible.
 *
 * The existing `worlds.lore` field is a single text blob — fine for a quick
 * paragraph, not enough for a real campaign setting. The Bible is a
 * structured collection of sections (Overview, History, Geography,
 * Factions, Magic, Glossary, etc.) that the world creator can edit and
 * everyone else reads guide-style.
 *
 * Stored as JSONB: an array of { id, icon, title, blurb, body } objects.
 * Free-form ordering by array index. Optional — empty array is the default
 * and means "no Bible yet."
 */
import { query } from './pool';

async function main() {
  console.log('Adding worlds.bible JSONB column...');
  await query(`ALTER TABLE worlds ADD COLUMN IF NOT EXISTS bible JSONB DEFAULT '[]'::jsonb`);
  console.log('✓ worlds.bible');
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
