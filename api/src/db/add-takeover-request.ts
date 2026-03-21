import { query } from './pool';

async function migrate() {
  console.log('Adding takeover request columns to conversations...');

  // Add takeover_requested_by and takeover_requested_at to conversations table
  await query(`
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS takeover_requested_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS takeover_requested_at TIMESTAMP WITH TIME ZONE
  `);

  console.log('✅ Migration complete: takeover request columns added');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
