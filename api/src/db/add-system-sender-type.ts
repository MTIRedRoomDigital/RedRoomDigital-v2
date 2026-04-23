import { pool } from './pool';

/**
 * Migration: add 'system' to message_sender_type enum.
 *
 * The canon-snapshot, takeover, and public-chat features insert timeline-marker
 * rows into `messages` with sender_type = 'system'. The original schema only
 * had ('user', 'ai') so any code path inserting 'system' blows up.
 *
 * ALTER TYPE ... ADD VALUE is safe and idempotent via IF NOT EXISTS.
 */
async function run() {
  console.log('Running migration: add system sender_type...');
  try {
    await pool.query(`ALTER TYPE message_sender_type ADD VALUE IF NOT EXISTS 'system'`);
    console.log("✓ 'system' added to message_sender_type enum");
    const result = await pool.query(
      `SELECT unnest(enum_range(NULL::message_sender_type))::text AS v`
    );
    console.log('Current enum values:', result.rows.map((r) => r.v));
    console.log('Migration complete.');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
