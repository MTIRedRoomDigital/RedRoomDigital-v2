import { query } from './pool';

async function migrate() {
  console.log('Adding votes and blocks tables...');

  // Votes table — supports both characters and worlds
  await query(`
    CREATE TABLE IF NOT EXISTS votes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('character', 'world')),
      target_id UUID NOT NULL,
      vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, target_type, target_id)
    )
  `);

  // Add like/dislike count columns to characters and worlds for fast reads
  await query(`ALTER TABLE characters ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0`);
  await query(`ALTER TABLE characters ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0`);
  await query(`ALTER TABLE worlds ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0`);
  await query(`ALTER TABLE worlds ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0`);

  // Blocks table — user-to-user blocking
  await query(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(blocker_id, blocked_id)
    )
  `);

  // Index for fast lookup
  await query(`CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON user_blocks(blocked_id)`);

  console.log('✅ Migration complete: votes and blocks tables added');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
