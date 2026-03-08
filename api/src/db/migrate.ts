import { pool } from './pool';
import fs from 'fs';
import path from 'path';

/**
 * Database Migration Script
 *
 * This reads the schema.sql file and runs it against your PostgreSQL database.
 * Run with: npm run db:migrate
 *
 * WHAT IT DOES:
 * 1. Connects to PostgreSQL using your DATABASE_URL from .env
 * 2. Reads the schema.sql file
 * 3. Executes all the CREATE TABLE statements
 * 4. Reports success or failure
 */
async function migrate() {
  console.log('🚀 Starting database migration...\n');

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📄 Read schema.sql successfully');
    console.log('📦 Connecting to database...');

    // Execute the schema
    await pool.query(schema);

    console.log('✅ Migration completed successfully!\n');
    console.log('Tables created:');

    // List all tables
    const result = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    result.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.tablename}`);
    });

    console.log(`\nTotal: ${result.rows.length} tables`);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);

    // If tables already exist, that's okay
    if (error.message.includes('already exists')) {
      console.log('\n💡 Tables already exist. If you want to reset, run:');
      console.log('   DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('   Then run this migration again.');
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
