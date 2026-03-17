/**
 * Migration: Add campaigns and quests tables
 *
 * Run with: npx ts-node src/db/add-campaigns.ts
 */
import { query } from './pool';

async function migrate() {
  console.log('Creating quest_status enum...');
  await query(`
    DO $$ BEGIN
      CREATE TYPE quest_status AS ENUM ('draft', 'active', 'completed', 'archived');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);

  console.log('Creating campaigns table...');
  await query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      narrative_arc TEXT,
      status quest_status DEFAULT 'draft',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_campaigns_world ON campaigns(world_id)`);

  console.log('Creating quests table...');
  await query(`
    CREATE TABLE IF NOT EXISTS quests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      objectives JSONB DEFAULT '[]',
      rewards JSONB DEFAULT '{}',
      lore_reveals TEXT,
      status quest_status DEFAULT 'draft',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_quests_campaign ON quests(campaign_id)`);

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
