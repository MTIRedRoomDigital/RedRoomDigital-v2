/**
 * Migration: Add OAuth support
 *
 * - Add oauth_provider and oauth_id columns to users
 * - Make password_hash nullable (OAuth users don't have passwords)
 * - Add unique constraint on (oauth_provider, oauth_id)
 *
 * Run with: npx ts-node src/db/add-oauth.ts
 */
import { query } from './pool';

async function migrate() {
  console.log('Adding OAuth columns to users table...');

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20)`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255)`);

  // Make password_hash nullable for OAuth users
  console.log('Making password_hash nullable...');
  await query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);

  // Add unique constraint so one social account can only link to one user
  console.log('Adding unique constraint on oauth_provider + oauth_id...');
  await query(`
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_oauth_unique UNIQUE (oauth_provider, oauth_id);
    EXCEPTION
      WHEN duplicate_table THEN null;
      WHEN duplicate_object THEN null;
    END $$
  `);

  // Index for fast OAuth lookups
  await query(`CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id)`);

  console.log('OAuth migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
