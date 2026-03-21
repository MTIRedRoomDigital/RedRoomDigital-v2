import { query } from './pool';

async function migrate() {
  console.log('Adding join_mode column to worlds...');

  // Add join_mode: 'open' (anyone can join) or 'locked' (must request)
  // Default to 'open' for existing worlds
  await query(`
    ALTER TABLE worlds
    ADD COLUMN IF NOT EXISTS join_mode VARCHAR(10) DEFAULT 'open' NOT NULL
  `);

  console.log('✅ Migration complete: join_mode column added to worlds');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
