/**
 * Migration: Add world_locations table and location_id to conversations
 *
 * Run with: npx ts-node src/db/add-locations.ts
 */
import { query } from './pool';

async function migrate() {
  console.log('Creating world_locations table...');

  await query(`
    CREATE TABLE IF NOT EXISTS world_locations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(100),
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_world_locations_world ON world_locations(world_id)`);

  console.log('Adding location_id to conversations...');
  await query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES world_locations(id)`);

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
