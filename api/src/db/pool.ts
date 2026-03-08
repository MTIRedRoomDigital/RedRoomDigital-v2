import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

// Connection pool - reuses connections instead of opening new ones each time
// Think of it like a "pool" of database connections ready to go
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log when the pool connects (helpful for debugging)
pool.on('connect', () => {
  console.log('📦 Database pool: new connection established');
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message);
});

// Helper: run a single query
export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log slow queries in development
  if (process.env.NODE_ENV === 'development' && duration > 100) {
    console.log(`🐌 Slow query (${duration}ms):`, text.substring(0, 80));
  }

  return result;
}
