/**
 * Migration: Add campaign system tables and columns
 *
 * - campaign_participants table (who's in each campaign)
 * - Extra columns on campaigns (conversation_id, turn tracking, participant limits)
 * - campaign_id on conversations (link campaign to its chat)
 * - world_history JSONB on worlds (world-level canon events)
 *
 * Run with: npx ts-node src/db/add-campaign-system.ts
 */
import { query } from './pool';

async function migrate() {
  console.log('Adding campaign system columns to campaigns table...');

  // Add new columns to campaigns
  const campaignColumns = [
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id)`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS current_turn INTEGER DEFAULT 0`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 6`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS min_participants INTEGER DEFAULT 2`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS premise TEXT`,
    `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS outcome TEXT`,
  ];

  for (const sql of campaignColumns) {
    await query(sql);
  }

  console.log('Creating campaign_participants table...');
  await query(`
    CREATE TABLE IF NOT EXISTS campaign_participants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      turn_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(campaign_id, character_id)
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_campaign_participants_campaign ON campaign_participants(campaign_id)`);

  console.log('Adding campaign_id to conversations table...');
  await query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id)`);

  console.log('Adding world_history to worlds table...');
  await query(`ALTER TABLE worlds ADD COLUMN IF NOT EXISTS world_history JSONB DEFAULT '[]'`);

  console.log('Campaign system migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
