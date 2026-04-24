/**
 * Migration: add learned_speaking_style support.
 *
 * RedRoom characters have a user-set `personality.speaking_style` (inside the JSONB).
 * That's a starting point. We also want the AI to *learn* the character's actual voice
 * from how the owner writes them over time, and prefer that learned voice in prompts.
 *
 * Adds:
 *   - characters.learned_speaking_style  — AI-generated summary of the owner's observed voice
 *   - characters.style_last_learned_at   — last time the learner ran for this character
 *   - characters.style_sample_count      — how many owner-authored messages were in the last sample
 *                                          (used to decide whether we have enough data to learn yet)
 */
import { query } from './pool';

async function main() {
  console.log('Running migration: learned_speaking_style...');

  await query(`
    ALTER TABLE characters
      ADD COLUMN IF NOT EXISTS learned_speaking_style TEXT,
      ADD COLUMN IF NOT EXISTS style_last_learned_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS style_sample_count INTEGER DEFAULT 0
  `);
  console.log('✓ characters: added learned_speaking_style columns');

  console.log('Migration complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
