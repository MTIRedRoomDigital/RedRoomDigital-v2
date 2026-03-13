import { pool } from './pool';

/**
 * Migration: Add chat_mode column to conversations table
 *
 * chat_mode values:
 * - 'ai' = Pure AI chat (owner not notified)
 * - 'live' = Live chat between two users
 * - 'ai_fallback' = AI responding while waiting for owner to take over
 */
async function migrate() {
  console.log('Adding chat_mode column to conversations...\n');

  try {
    // Add chat_mode column (using varchar instead of enum for simplicity)
    await pool.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS chat_mode VARCHAR(20) DEFAULT 'live';
    `);
    console.log('✅ chat_mode column added.');

    // Backfill existing conversations:
    // If the partner participant has is_ai_controlled = true, it's an AI chat
    await pool.query(`
      UPDATE conversations c
      SET chat_mode = 'ai'
      WHERE EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = c.id AND cp.is_ai_controlled = true
      )
      AND (c.is_test IS NULL OR c.is_test = false)
      AND c.chat_mode = 'live';
    `);
    console.log('✅ Existing AI conversations backfilled.');

    console.log('\nDone! chat_mode column added and backfilled.');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
  }

  await pool.end();
}

migrate();
