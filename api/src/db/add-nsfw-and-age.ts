/**
 * Migration: NSFW flag + age gate
 *
 * Policy: RedRoom is 13+. Anything public-facing (browsable, indexed, shared
 * with strangers) must be SFW. Private chats are not moderated. NSFW content
 * can exist privately but cannot be made public.
 *
 * Schema changes:
 * - characters.is_nsfw, worlds.is_nsfw, campaigns.is_nsfw — owner self-flags,
 *   server auto-flags from AI moderation pass on publish attempts.
 * - users.birthdate — DATE, nullable for grandfathered users (we'll prompt
 *   them on next login or at first action that requires it).
 * - users.nsfw_scan_complete — BOOLEAN, used by the one-time backfill scan
 *   so we don't re-scan the same characters every run.
 */
import { query } from './pool';

async function main() {
  console.log('Running migration: NSFW flag + age gate...');

  await query(`ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT false`);
  console.log('✓ characters.is_nsfw');

  await query(`ALTER TABLE worlds ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT false`);
  console.log('✓ worlds.is_nsfw');

  // Campaigns table may not exist on very old envs — guard.
  try {
    await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_nsfw BOOLEAN DEFAULT false`);
    console.log('✓ campaigns.is_nsfw');
  } catch (e: any) {
    console.warn('skipped campaigns.is_nsfw:', e?.message);
  }

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthdate DATE`);
  console.log('✓ users.birthdate');

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nsfw_scan_complete BOOLEAN DEFAULT false`);
  console.log('✓ users.nsfw_scan_complete (used by backfill)');

  // Helpful index: fast filtering on the public listing query.
  await query(`CREATE INDEX IF NOT EXISTS idx_characters_public_sfw ON characters (is_public, is_nsfw)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_worlds_public_sfw ON worlds (is_public, is_nsfw)`);
  console.log('✓ public+sfw indexes');

  console.log('Migration complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
