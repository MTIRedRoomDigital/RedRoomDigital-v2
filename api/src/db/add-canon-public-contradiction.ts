/**
 * Migration: Add mid-chat canon, public chats, and contradiction score support.
 *
 * Adds:
 *   - conversations.last_canon_message_id      — tracks where canon was last applied (mid-chat canon)
 *   - conversations.last_canon_at              — timestamp of last canon application
 *   - conversations.is_public                  — chat is visible to the community
 *   - conversations.public_requested_by        — user who requested making it public (pending other user)
 *   - conversations.public_requested_at        — when the request was made
 *   - characters.contradiction_score           — 0 = perfectly consistent; higher = more contradictions
 *   - characters.contradictions                — JSONB array of detected contradictions
 *   - characters.contradictions_updated_at     — last time the AI analyzed this character
 */
import { query } from './pool';

async function main() {
  console.log('Running migration: canon + public chats + contradiction score...');

  await query(`
    ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS last_canon_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS last_canon_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS public_requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS public_requested_at TIMESTAMPTZ
  `);
  console.log('✓ conversations: added canon + public columns');

  await query(`
    ALTER TABLE characters
      ADD COLUMN IF NOT EXISTS contradiction_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS contradictions JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS contradictions_updated_at TIMESTAMPTZ
  `);
  console.log('✓ characters: added contradiction columns');

  await query(`CREATE INDEX IF NOT EXISTS idx_conversations_is_public ON conversations(is_public) WHERE is_public = TRUE`);
  console.log('✓ index on public conversations');

  console.log('Migration complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
