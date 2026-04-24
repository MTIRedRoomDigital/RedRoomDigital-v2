/**
 * Migration: Extend contradiction score to users and worlds.
 *
 * Characters already have contradiction_score / contradictions / contradictions_updated_at
 * (see add-canon-public-contradiction.ts). This adds the same triplet to users and worlds.
 *
 * User score  — weighted aggregate of their characters' scores (cheap, no AI call).
 *               Tells other players "is this writer consistent?"
 * World score — combines two signals, both surfaced in the same number:
 *               (a) AI coherence check of lore + rules + member character canons,
 *               (b) aggregate of characters living in that world.
 *               Public, so anyone can see if a world's canon is a mess.
 */
import { query } from './pool';

async function main() {
  console.log('Running migration: user + world contradiction scores...');

  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS contradiction_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS contradictions JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS contradictions_updated_at TIMESTAMPTZ
  `);
  console.log('✓ users: added contradiction columns');

  await query(`
    ALTER TABLE worlds
      ADD COLUMN IF NOT EXISTS contradiction_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS contradictions JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS contradictions_updated_at TIMESTAMPTZ
  `);
  console.log('✓ worlds: added contradiction columns');

  console.log('Migration complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
