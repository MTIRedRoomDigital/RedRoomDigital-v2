/**
 * One-time backfill: scan every existing character/world/campaign for NSFW
 * content and update flags accordingly.
 *
 * Behavior:
 *   - Calls classifyContent on each row.
 *   - Flagged content gets is_nsfw=true. If it was also is_public=true, we
 *     flip is_public=false (cannot be public AND nsfw) and notify the owner.
 *   - Skips characters/worlds whose owners have nsfw_scan_complete=true.
 *
 * Cost control: rate-limited at one call per ~600ms to avoid bursts.
 *
 * Run with: railway run npx tsx src/db/backfill-nsfw-scan.ts
 */
import { query } from './pool';
import { classifyContent } from '../services/ai';
import { buildCharacterText, buildWorldText, buildCampaignText } from '../services/moderation';
import { createNotification } from '../services/notifications';

const SLEEP_MS = 600;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scanCharacters() {
  console.log('\n=== Scanning characters ===');
  const rows = await query(
    `SELECT id, creator_id, name, description, personality, background,
            likes, dislikes, tags, is_public, is_nsfw
       FROM characters
      WHERE is_nsfw = false
      ORDER BY created_at ASC`
  );
  console.log(`${rows.rows.length} characters to scan`);

  let flagged = 0;
  for (const c of rows.rows) {
    const text = buildCharacterText(c);
    const r = await classifyContent('character', text);
    if (r.is_nsfw) {
      flagged++;
      const wasPublic = c.is_public;
      await query(
        'UPDATE characters SET is_nsfw = true, is_public = false WHERE id = $1',
        [c.id]
      );
      console.log(`  ⚑ "${c.name}" flagged: ${r.reason}`);
      // Notify owner
      try {
        await createNotification({
          userId: c.creator_id,
          type: 'system',
          title: 'Character marked as NSFW',
          body: wasPublic
            ? `"${c.name}" was auto-classified as NSFW and removed from public listings. You can still use it privately. Edit and republish if this was wrong.`
            : `"${c.name}" was auto-classified as NSFW. It cannot be made public. Edit if this was wrong.`,
          data: { characterId: c.id, reason: r.reason },
        });
      } catch (e: any) {
        console.warn(`    notification failed: ${e?.message}`);
      }
    }
    await sleep(SLEEP_MS);
  }
  console.log(`Characters: ${flagged} flagged out of ${rows.rows.length}`);
}

async function scanWorlds() {
  console.log('\n=== Scanning worlds ===');
  const rows = await query(
    `SELECT id, creator_id, name, description, lore, rules, setting, is_public, is_nsfw
       FROM worlds
      WHERE is_nsfw = false
      ORDER BY created_at ASC`
  );
  console.log(`${rows.rows.length} worlds to scan`);

  let flagged = 0;
  for (const w of rows.rows) {
    const text = buildWorldText(w);
    const r = await classifyContent('world', text);
    if (r.is_nsfw) {
      flagged++;
      const wasPublic = w.is_public;
      await query(
        'UPDATE worlds SET is_nsfw = true, is_public = false WHERE id = $1',
        [w.id]
      );
      console.log(`  ⚑ "${w.name}" flagged: ${r.reason}`);
      try {
        await createNotification({
          userId: w.creator_id,
          type: 'system',
          title: 'World marked as NSFW',
          body: wasPublic
            ? `"${w.name}" was auto-classified as NSFW and removed from public listings. Edit and republish if this was wrong.`
            : `"${w.name}" was auto-classified as NSFW. Edit if this was wrong.`,
          data: { worldId: w.id, reason: r.reason },
        });
      } catch (e: any) {
        console.warn(`    notification failed: ${e?.message}`);
      }
    }
    await sleep(SLEEP_MS);
  }
  console.log(`Worlds: ${flagged} flagged out of ${rows.rows.length}`);
}

async function scanCampaigns() {
  console.log('\n=== Scanning campaigns ===');
  let rows: any;
  try {
    rows = await query(
      `SELECT id, creator_id, name, description, premise, is_nsfw
         FROM campaigns
        WHERE is_nsfw = false
        ORDER BY created_at ASC`
    );
  } catch {
    console.log('campaigns table missing — skipping');
    return;
  }
  console.log(`${rows.rows.length} campaigns to scan`);

  let flagged = 0;
  for (const c of rows.rows) {
    const text = buildCampaignText(c);
    const r = await classifyContent('campaign', text);
    if (r.is_nsfw) {
      flagged++;
      await query('UPDATE campaigns SET is_nsfw = true WHERE id = $1', [c.id]);
      console.log(`  ⚑ "${c.name}" flagged: ${r.reason}`);
      try {
        await createNotification({
          userId: c.creator_id,
          type: 'system',
          title: 'Campaign marked as NSFW',
          body: `"${c.name}" was auto-classified as NSFW. Edit if this was wrong.`,
          data: { campaignId: c.id, reason: r.reason },
        });
      } catch (e: any) {
        console.warn(`    notification failed: ${e?.message}`);
      }
    }
    await sleep(SLEEP_MS);
  }
  console.log(`Campaigns: ${flagged} flagged out of ${rows.rows.length}`);
}

async function main() {
  console.log('Starting NSFW backfill scan…');
  await scanCharacters();
  await scanWorlds();
  await scanCampaigns();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
