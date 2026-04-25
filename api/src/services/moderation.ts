/**
 * Moderation gate for the public-publish boundary.
 *
 * Policy: anything browsable by strangers (public characters / worlds /
 * campaigns) must be SFW. Private content is the user's business — we never
 * scan private chats or unpublished drafts.
 *
 * The gate runs only on the transition or persistence of `is_public = true`.
 * It calls `classifyContent` to decide. If flagged, we set is_nsfw=true and
 * silently flip is_public=false, returning a structured result the route
 * handler turns into a friendly message for the owner.
 *
 * Fail-open: if AI is down, we don't block the user. Reports + manual review
 * catch the rare miss.
 */
import { classifyContent } from './ai';

export interface ModerationResult {
  /** True if the content was flagged and should NOT be public. */
  flagged: boolean;
  /** Short explanation suitable to show the owner. */
  reason: string;
}

/**
 * Build the text snippet we hand to the classifier. Each kind gathers the
 * authored fields most likely to carry adult content. Field name labels are
 * included so the model can interpret context.
 */
export function buildCharacterText(c: any): string {
  const personality = c.personality || {};
  const traits = Array.isArray(personality.traits) ? personality.traits.join(', ') : '';
  const speaking = personality.speaking_style || '';
  const likes = Array.isArray(c.likes) ? c.likes.join(', ') : '';
  const dislikes = Array.isArray(c.dislikes) ? c.dislikes.join(', ') : '';
  const tags = Array.isArray(c.tags) ? c.tags.join(', ') : '';
  return [
    `Name: ${c.name || ''}`,
    c.description ? `Description: ${c.description}` : '',
    traits ? `Traits: ${traits}` : '',
    speaking ? `Speaking style: ${speaking}` : '',
    c.background ? `Background: ${c.background}` : '',
    likes ? `Likes: ${likes}` : '',
    dislikes ? `Dislikes: ${dislikes}` : '',
    tags ? `Tags: ${tags}` : '',
  ].filter(Boolean).join('\n');
}

export function buildWorldText(w: any): string {
  const rules = w.rules ? (typeof w.rules === 'object' ? JSON.stringify(w.rules) : w.rules) : '';
  return [
    `Name: ${w.name || ''}`,
    w.description ? `Description: ${w.description}` : '',
    w.setting ? `Setting: ${w.setting}` : '',
    w.lore ? `Lore: ${w.lore}` : '',
    rules ? `Rules: ${rules}` : '',
  ].filter(Boolean).join('\n');
}

export function buildCampaignText(c: any): string {
  return [
    `Name: ${c.name || ''}`,
    c.description ? `Description: ${c.description}` : '',
    c.premise ? `Premise: ${c.premise}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Run classification and return whether the content should be blocked from
 * publishing. Caller is responsible for actually flipping is_public/is_nsfw
 * in the database based on the result.
 */
export async function checkPublishable(
  kind: 'character' | 'world' | 'campaign',
  text: string
): Promise<ModerationResult> {
  const r = await classifyContent(kind, text);
  if (r.is_nsfw) {
    return { flagged: true, reason: r.reason };
  }
  return { flagged: false, reason: '' };
}
