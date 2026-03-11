/**
 * Quick script to give yourself admin + ultimate access.
 *
 * Usage:
 *   1. Set your DATABASE_URL env var (the public Railway one)
 *   2. Run: npx tsx make-admin.ts YOUR_EMAIL_HERE
 */

import pg from 'pg';

const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide your email: npx tsx make-admin.ts your@email.com');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log(`\n🔑 Upgrading ${email} to admin + ultimate...\n`);

  const result = await pool.query(
    `UPDATE users SET role = 'admin', subscription = 'ultimate' WHERE email = $1 RETURNING id, username, email, role, subscription`,
    [email]
  );

  if (result.rowCount === 0) {
    console.error(`❌ No user found with email: ${email}`);
    console.log('   Make sure you signed up first at redroomdigital.com');
  } else {
    const user = result.rows[0];
    console.log('✅ Success! Updated user:');
    console.log(`   ID:           ${user.id}`);
    console.log(`   Username:     ${user.username}`);
    console.log(`   Email:        ${user.email}`);
    console.log(`   Role:         ${user.role}`);
    console.log(`   Subscription: ${user.subscription}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
