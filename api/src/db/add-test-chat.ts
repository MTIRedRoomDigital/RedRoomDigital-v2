import { pool } from './pool';

/**
 * Migration: Add is_test column to conversations table
 * This allows test chats to be stored using the same infrastructure
 * but filtered out of normal conversation listings.
 */
async function migrate() {
  console.log('Adding is_test column to conversations...\n');

  try {
    await pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;
    `);
    console.log('Done! is_test column added to conversations table.');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
  }

  await pool.end();
}

migrate();
