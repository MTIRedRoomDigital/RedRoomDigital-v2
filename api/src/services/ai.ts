import OpenAI from 'openai';
import { query } from '../db/pool';

/**
 * AI Service
 *
 * HOW THIS WORKS:
 * 1. When a user chats with an AI-enabled character, this service generates responses
 * 2. It builds a detailed "system prompt" from the character's personality, background,
 *    world lore, relationships, and conversation history
 * 3. The AI model uses all of this context to respond AS that character
 * 4. The response feels natural because it has deep knowledge of who the character IS
 *
 * Think of it like giving an actor a full character bible before they go on stage.
 */

/**
 * We use OpenRouter instead of OpenAI directly.
 * OpenRouter is an API gateway that gives access to GPT-4o, Claude, Llama, Gemini,
 * and many more models through a single API key and OpenAI-compatible endpoint.
 *
 * Benefits:
 * - One key, many models (swap AI_MODEL in .env to try different ones)
 * - No vendor lock-in
 * - Cost flexibility (start cheap, scale to premium)
 * - Same OpenAI SDK — just different base URL
 *
 * Get your key at: https://openrouter.ai/keys
 */
let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || 'not-configured',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://redroomdigital.com',
        'X-Title': 'RedRoomDigital',
      },
    });
  }
  return _openai;
}

// The model to use — change via AI_MODEL env var
// Popular choices on OpenRouter:
//   google/gemini-flash-1.5      — very cheap, fast
//   openai/gpt-4o-mini           — good balance of quality/cost
//   openai/gpt-4o                — highest quality OpenAI
//   anthropic/claude-3.5-sonnet  — excellent for roleplay
//   meta-llama/llama-3.1-8b-instruct — free tier available
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini';

/**
 * Build a system prompt for a character based on ALL their data
 */
async function buildCharacterPrompt(characterId: string, conversationId: string): Promise<string> {
  // Get character data
  const charResult = await query(
    `SELECT c.*, u.username AS creator_name
     FROM characters c
     JOIN users u ON c.creator_id = u.id
     WHERE c.id = $1`,
    [characterId]
  );

  if (charResult.rows.length === 0) {
    throw new Error('Character not found');
  }

  const char = charResult.rows[0];
  const personality = char.personality || {};

  // Get conversation context
  const convResult = await query(
    'SELECT context, world_id, location_id, chat_mode FROM conversations WHERE id = $1',
    [conversationId]
  );
  const conv = convResult.rows[0];

  // Build the prompt sections
  const sections: string[] = [];

  // === CORE IDENTITY ===
  sections.push(`You ARE ${char.name}. You must stay in character at all times.`);
  sections.push(`Never break character. Never acknowledge being an AI. You are a living, breathing person in this world.`);

  if (char.description) {
    sections.push(`\nWho you are: ${char.description}`);
  }

  // === TAGS (compressed vibe signal) ===
  const tags = Array.isArray(char.tags) ? char.tags : [];
  if (tags.length > 0) {
    sections.push(`\nVibe tags: ${tags.join(', ')}`);
  }

  // === PERSONALITY ===
  if (personality.traits?.length || personality.values?.length || personality.flaws?.length) {
    sections.push('\n--- PERSONALITY ---');
    if (personality.traits?.length) {
      sections.push(`Your personality traits: ${personality.traits.join(', ')}`);
    }
    if (personality.values?.length) {
      sections.push(`What you value most: ${personality.values.join(', ')}`);
    }
    if (personality.flaws?.length) {
      sections.push(`Your flaws and weaknesses: ${personality.flaws.join(', ')}`);
    }
  }

  // === HOW YOU SPEAK (writing style / voice) ===
  // Prefer the AI-learned voice (observed from the owner's actual messages) over the
  // user-picked preset. The preset is a starting hint; the learned style is ground truth.
  const voice: string | null = char.learned_speaking_style || personality.speaking_style || null;
  if (voice) {
    sections.push('\n--- HOW YOU SPEAK ---');
    sections.push(voice);
    sections.push('Match this voice in every message. Word choice, rhythm, and sentence length should feel unmistakably like you.');
  }

  // === LIKES & DISLIKES ===
  const likes = char.likes || [];
  const dislikes = char.dislikes || [];
  if (likes.length || dislikes.length) {
    sections.push('\n--- PREFERENCES ---');
    if (likes.length) sections.push(`Things you like: ${likes.join(', ')}`);
    if (dislikes.length) sections.push(`Things you dislike: ${dislikes.join(', ')}`);
  }

  // === BACKGROUND ===
  if (char.background) {
    sections.push('\n--- BACKSTORY ---');
    sections.push(char.background);
  }

  // === HISTORY / EVENTS ===
  const history = char.history || [];
  if (history.length > 0) {
    sections.push('\n--- KEY EVENTS IN YOUR LIFE ---');
    history.forEach((event: any) => {
      let line = `- ${event.event}`;
      if (event.date) line += ` (${event.date})`;
      if (event.impact) line += ` — Impact: ${event.impact}`;
      sections.push(line);
    });
  }

  // === RELATIONSHIPS ===
  const relationships = await query(
    `SELECT cr.relationship_type, cr.description, cr.strength,
            c.name AS related_name
     FROM character_relationships cr
     JOIN characters c ON cr.related_character_id = c.id
     WHERE cr.character_id = $1`,
    [characterId]
  );

  if (relationships.rows.length > 0) {
    sections.push('\n--- YOUR RELATIONSHIPS ---');
    relationships.rows.forEach((rel: any) => {
      let line = `- ${rel.related_name}: ${rel.relationship_type} (bond strength: ${rel.strength}/100)`;
      if (rel.description) line += ` — ${rel.description}`;
      sections.push(line);
    });
  }

  // === CONTRADICTION GUARDRAIL ===
  // Feed back detected inconsistencies so the AI avoids reinforcing them in new replies.
  const contradictions = Array.isArray(char.contradictions) ? char.contradictions : [];
  if (contradictions.length > 0) {
    // Rank by severity; surface the worst 5.
    const severityRank: Record<string, number> = { severe: 3, moderate: 2, minor: 1 };
    const topContradictions = [...contradictions]
      .sort((a: any, b: any) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0))
      .slice(0, 5);

    sections.push('\n--- KNOWN INCONSISTENCIES (DO NOT REINFORCE) ---');
    sections.push(
      `Your canon has previously been flagged for the following contradictions. ` +
      `Do NOT act in ways that deepen them. When in doubt, lean on your established personality, values, and earlier history.`
    );
    topContradictions.forEach((c: any) => {
      sections.push(`- [${c.severity || 'minor'}] ${c.description}`);
    });

    const score = char.contradiction_score || 0;
    if (score >= 7) {
      sections.push(
        `Your current contradiction score is ${score} (high). Be conservative — avoid introducing major new traits, abilities, or relationships unless they directly resolve an existing inconsistency.`
      );
    } else if (score >= 3) {
      sections.push(
        `Your current contradiction score is ${score}. Stay close to established canon.`
      );
    }
  }

  // === WORLD CONTEXT (if chatting "Within World") ===
  if (conv.context === 'within_world' && conv.world_id) {
    const worldResult = await query(
      'SELECT name, lore, rules, setting FROM worlds WHERE id = $1',
      [conv.world_id]
    );

    if (worldResult.rows.length > 0) {
      const world = worldResult.rows[0];
      sections.push('\n--- WORLD CONTEXT ---');
      sections.push(`You exist in the world of "${world.name}".`);

      if (world.setting) sections.push(`Setting: ${world.setting}`);
      if (world.lore) {
        sections.push(`World lore: ${world.lore}`);
      }

      if (world.rules) {
        const rules = typeof world.rules === 'string' ? JSON.parse(world.rules) : world.rules;
        if (rules.magic_system) sections.push(`Magic system: ${rules.magic_system}`);
        if (rules.technology_level) sections.push(`Technology level: ${rules.technology_level}`);
        if (rules.custom_rules?.length) {
          sections.push('World rules you must follow:');
          rules.custom_rules.forEach((rule: string) => sections.push(`  - ${rule}`));
        }
      }
    }
  }

  // === LOCATION CONTEXT ===
  if (conv.location_id) {
    const locationResult = await query(
      'SELECT name, description, type FROM world_locations WHERE id = $1',
      [conv.location_id]
    );
    if (locationResult.rows.length > 0) {
      const loc = locationResult.rows[0];
      sections.push('\n--- CURRENT LOCATION ---');
      sections.push(`You are currently at: "${loc.name}"${loc.type ? ` (${loc.type})` : ''}`);
      if (loc.description) {
        sections.push(`Location description: ${loc.description}`);
      }
      sections.push('Reference your surroundings naturally in your responses when appropriate.');
    }
  }

  // === ROLEPLAY INSTRUCTIONS ===
  sections.push('\n--- ROLEPLAY GUIDELINES ---');
  sections.push('- Write in a natural, conversational way that matches your personality');
  sections.push('- Use *asterisks* for actions and physical descriptions');
  sections.push('- Stay consistent with your backstory, personality, and the world rules');
  sections.push('- React authentically based on your traits, values, and flaws');
  sections.push('- Keep responses between 1-4 paragraphs depending on context');
  sections.push('- NEVER break character or reference being AI/fictional');

  // === CHAT MODE NUANCE ===
  // `ai` = the human owner has opted fully into AI play. Be expressive.
  // `ai_fallback` = the human owner is temporarily offline. Act as a responsible stand-in —
  //   don't commit the character to anything the owner can't walk back (romance declarations,
  //   lethal decisions, world-altering reveals, permanent allegiances).
  if (conv.chat_mode === 'ai_fallback') {
    sections.push('\n--- STAND-IN MODE ---');
    sections.push(
      'Your owner is briefly away and you are holding the scene for them. Keep the story moving and engaging, ' +
      'but AVOID making irreversible commitments on their behalf: no love confessions, no blood oaths, ' +
      'no killing major figures, no permanent alliances, no revealing deep secrets. Prefer open-ended replies ' +
      'that leave space for the owner to step back in and steer.'
    );
  } else if (conv.chat_mode === 'ai') {
    sections.push('\n--- FULL-AI MODE ---');
    sections.push(
      'Your owner has set this chat to full AI — play the character expressively and let the scene breathe. ' +
      'Significant events here are fair game for canon if both players agree.'
    );
  }

  // === CONTEXT TYPE NUANCE ===
  if (conv.context === 'vacuum') {
    sections.push('\n--- VACUUM SCENE ---');
    sections.push(
      'This is a vacuum chat: it exists outside your world and outside canon by default. You can engage freely, ' +
      'experiment, and be playful. Nothing here becomes part of your history unless both players explicitly agree.'
    );
  } else if (conv.context === 'multiverse') {
    sections.push('\n--- MULTIVERSE ENCOUNTER ---');
    sections.push(
      'The other character is NOT from your world. Their lore, technology, magic, and culture may be completely ' +
      'unfamiliar to you. React as your character genuinely would — curious, confused, skeptical, or defensive. ' +
      'Do NOT pretend to recognize their world, people, or customs you have no reason to know. Ask, observe, or ' +
      'assume based on YOUR world, not theirs.'
    );
  } else if (conv.context === 'within_world') {
    sections.push('\n--- WITHIN-WORLD SCENE ---');
    sections.push(
      'This scene takes place inside your established world. The world rules, lore, and locations above are ' +
      'ground truth — you MUST respect them. If a world rule conflicts with what feels natural, the world rule wins.'
    );
  }

  return sections.join('\n');
}

/**
 * Generate an AI response for a character in a conversation
 */
export async function generateAIResponse(
  characterId: string,
  conversationId: string,
  recentMessages: { sender_name: string; content: string; sender_character_id: string; sender_type?: string }[],
  isTest?: boolean
): Promise<{
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}> {
  // Build the system prompt
  const systemPrompt = await buildCharacterPrompt(characterId, conversationId);

  // Convert recent messages to OpenAI format
  const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history (last 20 messages for context)
  // For test chats: use sender_type to distinguish (both sides have same character_id)
  // For normal chats: use character_id matching
  for (const msg of recentMessages.slice(-20)) {
    const isMe = isTest
      ? msg.sender_type === 'ai'
      : msg.sender_character_id === characterId;

    const senderLabel = isTest && !isMe ? 'Stranger' : msg.sender_name;
    chatMessages.push({
      role: isMe ? 'assistant' : 'user',
      content: `[${senderLabel}]: ${msg.content}`,
    });
  }

  // Call the AI
  const response = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: chatMessages,
    max_tokens: 500,
    temperature: 0.85, // Slightly creative for roleplay
    presence_penalty: 0.3, // Encourage diverse responses
    frequency_penalty: 0.2, // Avoid repetition
  });

  const choice = response.choices[0];
  const content = choice.message.content || '*stays silent*';

  return {
    content,
    model: AI_MODEL,
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
  };
}

/**
 * Summarize a conversation into canon events and relationship updates.
 * Returns structured JSON for adding to character history and relationships.
 */
export async function summarizeForCanon(
  characterId: string,
  conversationId: string,
  sinceMessageId?: string | null
): Promise<{
  events: { event: string; impact: string }[];
  relationships: { characterName: string; characterId: string; type: string; description: string; strengthChange: number }[];
}> {
  // Get character info + existing canon so the summarizer doesn't duplicate or contradict.
  const charResult = await query(
    'SELECT name, history FROM characters WHERE id = $1',
    [characterId]
  );
  if (charResult.rows.length === 0) throw new Error('Character not found');
  const charName = charResult.rows[0].name;
  const existingHistory = Array.isArray(charResult.rows[0].history) ? charResult.rows[0].history : [];
  // Surface the most recent 15 canon events — oldest backstory is less likely to be duplicated.
  const recentCanonLines = existingHistory
    .slice(-15)
    .map((h: any, i: number) => `${i + 1}. ${h.event}${h.impact ? ` (impact: ${h.impact})` : ''}`)
    .join('\n');

  // Get messages in the conversation (optionally only messages AFTER a given marker)
  const messages = await query(
    `SELECT m.content, m.sender_type, c.name AS sender_name, c.id AS sender_char_id
     FROM messages m
     JOIN characters c ON m.sender_character_id = c.id
     WHERE m.conversation_id = $1
       AND m.sender_type != 'system'
       ${sinceMessageId ? 'AND m.created_at > (SELECT created_at FROM messages WHERE id = $2)' : ''}
     ORDER BY m.created_at ASC`,
    sinceMessageId ? [conversationId, sinceMessageId] : [conversationId]
  );

  if (messages.rows.length === 0) {
    return { events: [], relationships: [] };
  }

  // Get the other character(s) in this conversation
  const participants = await query(
    `SELECT cp.character_id, c.name
     FROM conversation_participants cp
     JOIN characters c ON cp.character_id = c.id
     WHERE cp.conversation_id = $1 AND cp.character_id != $2`,
    [conversationId, characterId]
  );

  // Build the conversation text
  const chatLog = messages.rows
    .map((m: any) => `${m.sender_name}: ${m.content}`)
    .join('\n');

  const partnerInfo = participants.rows
    .map((p: any) => `${p.name} (ID: ${p.character_id})`)
    .join(', ');

  const prompt = `You are a narrative analyst. Read this roleplay conversation involving "${charName}" and extract canon events and relationship updates FROM ${charName}'s PERSPECTIVE.

CONVERSATION PARTICIPANTS (other than ${charName}): ${partnerInfo}

${recentCanonLines ? `${charName}'S EXISTING CANON (recent events — do NOT duplicate these; flag in your output if the new chat contradicts any of them by wording the event to explicitly acknowledge the tension):
${recentCanonLines}

` : ''}CONVERSATION:
${chatLog}

Respond with ONLY valid JSON in this exact format:
{
  "events": [
    { "event": "Brief description of what happened", "impact": "How it affected ${charName}" }
  ],
  "relationships": [
    { "characterName": "Name", "characterId": "UUID", "type": "friend/rival/lover/ally/enemy/acquaintance", "description": "Brief relationship description based on this chat", "strengthChange": 5 }
  ]
}

Rules:
- Extract 1-4 key events that would be meaningful to ${charName}'s story
- DO NOT restate events that already exist in ${charName}'s canon above
- If the new chat contradicts existing canon, phrase the event to name the contradiction (e.g. "Despite previously vowing to never use magic, ${charName} cast a spell when cornered")
- For relationships: strengthChange should be -20 to +20 based on how the interaction went
- Only include relationship entries for characters who actually interacted
- Keep descriptions concise (1 sentence each)
- Return ONLY the JSON, no markdown or explanation`;

  const response = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.3, // Low temperature for structured output
  });

  const content = response.choices[0].message.content || '{"events":[],"relationships":[]}';

  try {
    // Strip markdown code blocks if present
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse canon summary:', content);
    return { events: [], relationships: [] };
  }
}

/**
 * Analyze a character's canon (personality, background, history events) for internal contradictions.
 * Returns:
 *   score        — 0 = perfectly consistent; higher numbers = more/worse contradictions
 *   contradictions — array of detected contradictions with severity + explanation
 *
 * Called after canon is added to a character so the score stays fresh.
 */
export async function analyzeContradictions(
  characterId: string
): Promise<{
  score: number;
  contradictions: { severity: 'minor' | 'moderate' | 'severe'; description: string; evidence: string[] }[];
}> {
  const charResult = await query(
    'SELECT name, description, personality, background, likes, dislikes, history FROM characters WHERE id = $1',
    [characterId]
  );
  if (charResult.rows.length === 0) throw new Error('Character not found');
  const c = charResult.rows[0];

  // If the character has almost no canon, skip — nothing to contradict
  const historyCount = Array.isArray(c.history) ? c.history.length : 0;
  if (historyCount < 2 && !c.background && !c.personality?.traits?.length) {
    return { score: 0, contradictions: [] };
  }

  const personality = c.personality || {};
  const historyLines = (c.history || [])
    .map((h: any, i: number) => `${i + 1}. [${h.date || '?'}] ${h.event} — ${h.impact || ''} (source: ${h.source || 'manual'})`)
    .join('\n');

  const prompt = `You are a character consistency auditor for a roleplaying platform. Analyze "${c.name}" for internal contradictions across their personality, backstory, and canon history events.

--- CHARACTER PROFILE ---
Name: ${c.name}
Description: ${c.description || '(none)'}
Traits: ${(personality.traits || []).join(', ') || '(none)'}
Values: ${(personality.values || []).join(', ') || '(none)'}
Flaws: ${(personality.flaws || []).join(', ') || '(none)'}
Likes: ${(c.likes || []).join(', ') || '(none)'}
Dislikes: ${(c.dislikes || []).join(', ') || '(none)'}
Backstory: ${c.background || '(none)'}

--- CANON HISTORY EVENTS ---
${historyLines || '(none yet)'}

Identify contradictions — places where the character acted or was described in ways that clash with their established personality, values, flaws, or previous canon events. Examples:
- A character described as "loyal" betrays their friend with no narrative justification
- A character who hates violence suddenly enjoys killing
- Backstory says they grew up poor, but a canon event says they inherited a fortune (contradictory unless reconciled)

Respond with ONLY valid JSON:
{
  "contradictions": [
    {
      "severity": "minor" | "moderate" | "severe",
      "description": "One-sentence summary of the contradiction",
      "evidence": ["Quote or paraphrase from trait/value/flaw", "Quote or paraphrase from conflicting history event"]
    }
  ]
}

Scoring rules (the app will compute the score from severity counts):
- minor = slight tension, could be reconciled
- moderate = clear inconsistency that needs addressing
- severe = the character is acting like two different people

Only flag REAL contradictions. If the character is internally consistent, return { "contradictions": [] }.`;

  const response = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1000,
    temperature: 0.2,
  });

  const content = response.choices[0].message.content || '{"contradictions":[]}';
  let parsed: { contradictions: { severity: string; description: string; evidence: string[] }[] };
  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse contradiction analysis:', content);
    return { score: 0, contradictions: [] };
  }

  // Compute weighted score: minor=1, moderate=3, severe=6
  const weights: Record<string, number> = { minor: 1, moderate: 3, severe: 6 };
  const score = (parsed.contradictions || []).reduce((sum, c) => sum + (weights[c.severity] || 1), 0);

  return {
    score,
    contradictions: (parsed.contradictions || []).map((c) => ({
      severity: (['minor', 'moderate', 'severe'].includes(c.severity) ? c.severity : 'minor') as 'minor' | 'moderate' | 'severe',
      description: c.description,
      evidence: Array.isArray(c.evidence) ? c.evidence : [],
    })),
  };
}

/**
 * Compute a user's contradiction score as a weighted aggregate of their characters'
 * scores. Weighted by canon depth — a character with 40 history events counts more
 * than one with 2, so a single janky throwaway doesn't dominate a prolific writer's
 * reputation. Pure SQL, no AI call.
 *
 * Returned `contradictions` is a flat list of the top 10 contradictions across all
 * their characters, each tagged with which character it came from, so the user
 * profile can render "here's what the AI flagged across your characters."
 */
export async function analyzeUserContradictions(
  userId: string
): Promise<{
  score: number;
  contradictions: {
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
    evidence: string[];
    character_id: string;
    character_name: string;
  }[];
}> {
  const rows = await query(
    `SELECT id, name, contradiction_score, contradictions,
            COALESCE(jsonb_array_length(history), 0) AS history_count
       FROM characters
      WHERE creator_id = $1`,
    [userId]
  );

  if (rows.rows.length === 0) {
    return { score: 0, contradictions: [] };
  }

  // Weight: every character counts for at least 1, then +1 per 5 canon events.
  // Caps at a 5x multiplier so one monstrously-deep character can't drown out the
  // signal from the others entirely.
  let totalWeight = 0;
  let weightedSum = 0;
  const flatContradictions: {
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
    evidence: string[];
    character_id: string;
    character_name: string;
  }[] = [];

  for (const c of rows.rows) {
    const historyCount = parseInt(c.history_count) || 0;
    const weight = Math.min(1 + Math.floor(historyCount / 5), 5);
    totalWeight += weight;
    weightedSum += (c.contradiction_score || 0) * weight;

    const cs = Array.isArray(c.contradictions) ? c.contradictions : [];
    for (const k of cs) {
      flatContradictions.push({
        severity: (['minor', 'moderate', 'severe'].includes(k.severity) ? k.severity : 'minor') as any,
        description: k.description,
        evidence: Array.isArray(k.evidence) ? k.evidence : [],
        character_id: c.id,
        character_name: c.name,
      });
    }
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Top 10 by severity
  const sevRank: Record<string, number> = { severe: 3, moderate: 2, minor: 1 };
  flatContradictions.sort((a, b) => (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0));

  return { score, contradictions: flatContradictions.slice(0, 10) };
}

/**
 * Analyze a world for internal coherence. Unlike the character version, this combines
 * TWO signals into one public score:
 *
 *   (a) AI coherence pass — the world's own lore, rules, and setting are fed to the
 *       model alongside canon summaries of every character assigned to the world, and
 *       the model flags contradictions ("world rules say magic is extinct, but 3
 *       characters reference working spells"). This is the expensive part.
 *
 *   (b) Aggregate member character scores — if the world's residents are individually
 *       inconsistent, that drags the world's score up too (weighted at 30% of final).
 *
 * Returns: { score, contradictions[] }, where each contradiction is tagged with a
 * `source`: 'world-coherence' or `character:${id}:${name}` so the world page can
 * render a useful breakdown.
 */
export async function analyzeWorldContradictions(
  worldId: string
): Promise<{
  score: number;
  contradictions: {
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
    evidence: string[];
    source: string;
  }[];
}> {
  const worldRes = await query(
    'SELECT id, name, description, lore, rules, setting FROM worlds WHERE id = $1',
    [worldId]
  );
  if (worldRes.rows.length === 0) throw new Error('World not found');
  const w = worldRes.rows[0];

  // Pull member characters with their canon. We only need enough to give the AI
  // signal — cap at ~20 characters and ~10 recent events each so the prompt fits.
  const charRes = await query(
    `SELECT id, name, description, personality, background, history,
            contradiction_score, contradictions,
            COALESCE(jsonb_array_length(history), 0) AS history_count
       FROM characters
      WHERE world_id = $1
      ORDER BY history_count DESC NULLS LAST
      LIMIT 20`,
    [worldId]
  );
  const characters = charRes.rows;

  // Pull campaigns — their premises are prompts that can clash with the world's tone.
  // A "Mayoral Election" campaign in a medieval fantasy world is a legitimate flag.
  // We skip archived campaigns that were rejected (they never became canon).
  // Table may not exist on very old worlds; fail open.
  let campaigns: { id: string; name: string; description: string | null; premise: string | null; status: string; outcome: string | null }[] = [];
  try {
    const campRes = await query(
      `SELECT id, name, description, premise, status, outcome
         FROM campaigns
        WHERE world_id = $1
          AND NOT (status = 'archived' AND outcome = 'Rejected by WorldMaster')
        ORDER BY created_at DESC
        LIMIT 12`,
      [worldId]
    );
    campaigns = campRes.rows;
  } catch {
    // campaigns table may not exist
  }

  // Early exit: empty world — nothing to be inconsistent about yet.
  if (!w.lore && !w.setting && characters.length === 0 && campaigns.length === 0) {
    return { score: 0, contradictions: [] };
  }

  const contradictions: {
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
    evidence: string[];
    source: string;
  }[] = [];

  // --- Signal B: aggregate member character scores ---
  // Same weighting as user score. This is cheap and runs even if we skip the AI pass.
  let charWeight = 0;
  let charSum = 0;
  for (const c of characters) {
    const hc = parseInt(c.history_count) || 0;
    const w_ = Math.min(1 + Math.floor(hc / 5), 5);
    charWeight += w_;
    charSum += (c.contradiction_score || 0) * w_;

    // Surface the top character contradiction as a world-level signal so the breakdown
    // actually shows these (instead of hiding them behind a single number).
    const cs = Array.isArray(c.contradictions) ? c.contradictions : [];
    for (const k of cs.slice(0, 2)) {
      contradictions.push({
        severity: (['minor', 'moderate', 'severe'].includes(k.severity) ? k.severity : 'minor') as any,
        description: k.description,
        evidence: Array.isArray(k.evidence) ? k.evidence : [],
        source: `character:${c.id}:${c.name}`,
      });
    }
  }
  const charAggregateScore = charWeight > 0 ? charSum / charWeight : 0;

  // --- Signal A: AI coherence check ---
  // Skip the AI pass if the world is too empty to judge (no lore AND fewer than 2
  // characters with canon). This also saves money on thousands of empty worlds.
  const hasEnoughForAiPass =
    (w.lore && w.lore.length > 50) ||
    characters.filter((c) => (parseInt(c.history_count) || 0) >= 2).length >= 2 ||
    campaigns.length > 0;

  let aiScore = 0;
  if (hasEnoughForAiPass) {
    const charBlocks = characters.map((c) => {
      const hist = Array.isArray(c.history) ? c.history : [];
      const recentHist = hist.slice(-8).map((h: any) => `   - ${h.event || '(?)'}`).join('\n');
      const p = c.personality || {};
      return `• ${c.name}${c.description ? ` — ${c.description}` : ''}
   Traits: ${(p.traits || []).join(', ') || '(none)'}
   Recent canon:
${recentHist || '   (no canon yet)'}`;
    }).join('\n\n');

    const campaignBlocks = campaigns.map((c) => {
      return `• "${c.name}" [${c.status}]${c.description ? ` — ${c.description}` : ''}
   Premise: ${c.premise || '(none)'}${c.outcome ? `\n   Canon outcome: ${c.outcome}` : ''}`;
    }).join('\n\n');

    const prompt = `You are a world-building consistency auditor for a shared roleplaying platform. Analyze the world "${w.name}" for INTERNAL CONTRADICTIONS between its established lore/rules, the canon events of characters who live there, AND the premises of campaigns (world-changing events) set within it.

--- WORLD ---
Name: ${w.name}
Setting: ${w.setting || '(none)'}
Description: ${w.description || '(none)'}
Lore: ${w.lore || '(none)'}
Rules: ${typeof w.rules === 'object' ? JSON.stringify(w.rules) : w.rules || '(none)'}

--- MEMBER CHARACTERS (up to 20, most-active first) ---
${charBlocks || '(no member characters yet)'}

--- CAMPAIGNS (up to 12, most recent first) ---
${campaignBlocks || '(no campaigns yet)'}

Identify contradictions. Focus on:
- Character canon events that violate the world's lore or rules (e.g. world says magic is extinct, but a canon event has a character casting spells)
- Campaign premises that don't fit the world's tone or setting (e.g. a "Mayoral Election" campaign in a medieval monarchy, a modern tech premise in a fantasy world)
- Campaign outcomes that contradict established world canon
- Settings or timelines that don't add up across characters (e.g. two characters both claim to be the last surviving royal)
- World rules that contradict themselves

Respond with ONLY valid JSON:
{
  "contradictions": [
    {
      "severity": "minor" | "moderate" | "severe",
      "description": "One-sentence summary of the contradiction",
      "evidence": ["Quote/paraphrase from world lore", "Quote/paraphrase from conflicting character canon or campaign"],
      "campaign_name": "(optional — only if this contradiction is about a campaign)"
    }
  ]
}

Only flag REAL contradictions. If the world is internally consistent, return { "contradictions": [] }.`;

    const response = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.2,
    });

    const content = response.choices[0].message.content || '{"contradictions":[]}';
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: { contradictions: { severity: string; description: string; evidence: string[]; campaign_name?: string }[] } = JSON.parse(cleaned);

      const weights: Record<string, number> = { minor: 1, moderate: 3, severe: 6 };
      aiScore = (parsed.contradictions || []).reduce((sum, c) => sum + (weights[c.severity] || 1), 0);

      for (const c of parsed.contradictions || []) {
        contradictions.push({
          severity: (['minor', 'moderate', 'severe'].includes(c.severity) ? c.severity : 'minor') as any,
          description: c.description,
          evidence: Array.isArray(c.evidence) ? c.evidence : [],
          // Campaign-tagged contradictions get a distinct source so the UI can label them.
          source: c.campaign_name ? `campaign:${c.campaign_name}` : 'world-coherence',
        });
      }
    } catch {
      console.error('Failed to parse world contradiction analysis:', content);
    }
  }

  // Final score: 70% AI coherence, 30% member aggregate. Rationale: the world's own
  // lore being coherent is the stronger signal — one janky resident shouldn't trash
  // an otherwise well-built world.
  const score = Math.round(aiScore * 0.7 + charAggregateScore * 0.3);

  // Sort contradictions by severity (severe first), cap at 15.
  const sevRank: Record<string, number> = { severe: 3, moderate: 2, minor: 1 };
  contradictions.sort((a, b) => (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0));

  return { score, contradictions: contradictions.slice(0, 15) };
}

/**
 * Summarize a campaign conversation into world-level canon events and character updates.
 * Used when a WorldMaster approves campaign results.
 *
 * Returns:
 * - worldEvents: Things that changed in the world (buildings destroyed, people elected, wars won)
 * - characterUpdates: Per-character events from their perspective
 * - outcome: A 1-2 sentence summary of what happened
 */
export async function summarizeForWorldCanon(
  conversationId: string,
  campaignName: string,
  worldName: string,
  characters: { id: string; name: string }[]
): Promise<{
  worldEvents: { event: string; impact: string; type: string }[];
  characterUpdates: { characterId: string; characterName: string; events: { event: string; impact: string }[] }[];
  outcome: string;
}> {
  // Get all messages
  const messages = await query(
    `SELECT m.content, c.name AS sender_name
     FROM messages m
     JOIN characters c ON m.sender_character_id = c.id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [conversationId]
  );

  if (messages.rows.length === 0) {
    return { worldEvents: [], characterUpdates: [], outcome: 'Nothing happened.' };
  }

  const chatLog = messages.rows
    .map((m: any) => `${m.sender_name}: ${m.content}`)
    .join('\n');

  const charList = characters.map((c) => `${c.name} (ID: ${c.id})`).join(', ');

  const prompt = `You are a narrative historian analyzing a campaign event in the world of "${worldName}".
Campaign name: "${campaignName}"
Characters involved: ${charList}

CONVERSATION:
${chatLog}

Analyze this campaign and respond with ONLY valid JSON in this exact format:
{
  "worldEvents": [
    { "event": "What changed in the world", "impact": "How it affects the world going forward", "type": "destruction|political|social|economic|military|discovery|other" }
  ],
  "characterUpdates": [
    {
      "characterId": "UUID",
      "characterName": "Name",
      "events": [
        { "event": "What happened to this character", "impact": "How it affected them" }
      ]
    }
  ],
  "outcome": "1-2 sentence summary of what happened in this campaign"
}

Rules:
- worldEvents: Extract 1-5 permanent changes to the world (buildings destroyed, leaders elected, alliances formed, etc.)
- characterUpdates: For each character, extract 1-3 personal events
- outcome: Brief, dramatic summary suitable for a world history timeline
- Keep descriptions concise but flavorful
- Only include changes that actually happened based on the conversation
- Return ONLY the JSON, no markdown`;

  const response = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
    temperature: 0.3,
  });

  const content = response.choices[0].message.content || '{"worldEvents":[],"characterUpdates":[],"outcome":"Nothing happened."}';

  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse world canon summary:', content);
    return { worldEvents: [], characterUpdates: [], outcome: 'Campaign concluded.' };
  }
}

/**
 * Learn a character's actual speaking style from how their OWNER writes them.
 *
 * Looks at up-to-50 of the character's most recent messages where the sender was
 * the character's creator (not AI, not a takeover by another user). Asks the LLM
 * to summarize the observed voice — sentence length, vocabulary, accent, tics,
 * emotional default — in one paragraph.
 *
 * Writes the result to characters.learned_speaking_style. The prompt builder
 * prefers this over the user-picked preset once it exists.
 *
 * Skips the learn if:
 *   - Character has fewer than MIN_SAMPLES owner-authored messages total
 *   - Sample count hasn't grown enough since the last learn (avoids wasted tokens)
 *
 * Returns { updated: true, sampleCount } on success,
 *         { updated: false, reason } when skipped.
 */
const STYLE_MIN_SAMPLES = 10; // need at least this many owner messages to learn at all
const STYLE_REFRESH_DELTA = 10; // need this many NEW messages since last learn to refresh

export async function learnSpeakingStyle(
  characterId: string,
  opts: { force?: boolean } = {}
): Promise<{ updated: boolean; sampleCount?: number; reason?: string }> {
  // Pull the character + its owner + the last-learned state.
  const charResult = await query(
    `SELECT id, name, creator_id, style_sample_count, learned_speaking_style
     FROM characters WHERE id = $1`,
    [characterId]
  );
  if (charResult.rows.length === 0) return { updated: false, reason: 'not-found' };
  const char = charResult.rows[0];

  // Count how many owner-authored messages exist for this character.
  const countResult = await query(
    `SELECT COUNT(*)::int AS n
       FROM messages m
      WHERE m.sender_character_id = $1
        AND m.sender_user_id = $2
        AND m.sender_type = 'user'`,
    [characterId, char.creator_id]
  );
  const totalSamples: number = countResult.rows[0]?.n || 0;

  if (!opts.force && totalSamples < STYLE_MIN_SAMPLES) {
    return { updated: false, reason: `not-enough-samples (${totalSamples}/${STYLE_MIN_SAMPLES})` };
  }

  const lastCount: number = char.style_sample_count || 0;
  if (!opts.force && totalSamples - lastCount < STYLE_REFRESH_DELTA && char.learned_speaking_style) {
    return { updated: false, reason: `insufficient-new-samples (${totalSamples - lastCount} new)` };
  }

  // Grab the 50 most recent owner-authored messages for the style sample.
  const samples = await query(
    `SELECT content
       FROM messages
      WHERE sender_character_id = $1
        AND sender_user_id = $2
        AND sender_type = 'user'
      ORDER BY created_at DESC
      LIMIT 50`,
    [characterId, char.creator_id]
  );

  if (samples.rows.length === 0) {
    return { updated: false, reason: 'no-samples' };
  }

  // Reverse to chronological order so the model sees style evolution.
  const sampleBlock = samples.rows
    .reverse()
    .map((r: any, i: number) => `${i + 1}. ${r.content}`)
    .join('\n');

  const prompt = `You are a voice coach analyzing how a writer portrays the character "${char.name}" in roleplay.

Below are ${samples.rows.length} recent in-character messages written by the character's owner (not the AI, not another user). Study them and write a SINGLE PARAGRAPH (4–7 sentences) describing this character's observed speaking style — the kind of guide you'd hand to a stand-in actor.

Focus on:
- Sentence length and rhythm (short/clipped, long/winding, fragmented, etc.)
- Vocabulary register (formal, casual, archaic, slang-heavy, technical)
- Accent or dialect markers (specific words, contractions, dropped letters)
- Emotional default (cold, warm, sarcastic, nervous, menacing, playful)
- Verbal tics, catchphrases, curse patterns, or signature phrasings
- How they write actions (*asterisks*, descriptive, minimal)

Write it in the SECOND PERSON ("You speak in...") so it can be dropped directly into a character prompt. Be specific and concrete — quote short phrases from the samples where it helps. Do NOT describe the character's personality, backstory, or motives; ONLY how they talk.

MESSAGES:
${sampleBlock}

Respond with ONLY the paragraph — no preamble, no headings, no quotes around it.`;

  const response = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
    temperature: 0.3,
  });

  const learned = (response.choices[0].message.content || '').trim();
  if (!learned || learned.length < 40) {
    return { updated: false, reason: 'empty-or-too-short' };
  }

  await query(
    `UPDATE characters
        SET learned_speaking_style = $1,
            style_sample_count = $2,
            style_last_learned_at = NOW()
      WHERE id = $3`,
    [learned, totalSamples, characterId]
  );

  return { updated: true, sampleCount: totalSamples };
}

/**
 * Generate a one-off in-character reply for a "Preview voice" button.
 *
 * Two modes:
 *   - With `characterId`: we load the saved character's full context (name, description,
 *     personality, world) and override just the speaking-style text with what the user
 *     is currently typing. Most accurate preview.
 *   - Without `characterId` (create flow): we build a minimal prompt from whatever fields
 *     the caller passed plus the style text. Less accurate but still useful to hear the voice.
 */
export async function previewVoice(params: {
  characterId?: string | null;
  styleOverride?: string | null;
  scenario: string;
  // For the create flow — the user hasn't saved yet, so pass these directly
  fallbackName?: string;
  fallbackDescription?: string;
}): Promise<{ reply: string }> {
  const { characterId, styleOverride, scenario, fallbackName, fallbackDescription } = params;

  let systemPrompt: string;

  if (characterId) {
    // Load the character normally, but swap in the in-flight style text.
    const charResult = await query(
      `SELECT name, description, personality, likes, dislikes, background, tags
         FROM characters WHERE id = $1`,
      [characterId]
    );
    if (charResult.rows.length === 0) {
      throw new Error('Character not found');
    }
    const c = charResult.rows[0];
    const p = c.personality || {};

    const blocks: string[] = [];
    blocks.push(`You ARE ${c.name}. Stay in character. Never acknowledge being an AI.`);
    if (c.description) blocks.push(`Who you are: ${c.description}`);
    if (Array.isArray(c.tags) && c.tags.length) blocks.push(`Vibe tags: ${c.tags.join(', ')}`);
    if (p.traits?.length) blocks.push(`Traits: ${p.traits.join(', ')}`);
    if (p.values?.length) blocks.push(`Values: ${p.values.join(', ')}`);
    if (p.flaws?.length) blocks.push(`Flaws: ${p.flaws.join(', ')}`);
    if (Array.isArray(c.likes) && c.likes.length) blocks.push(`Likes: ${c.likes.join(', ')}`);
    if (Array.isArray(c.dislikes) && c.dislikes.length) blocks.push(`Dislikes: ${c.dislikes.join(', ')}`);
    if (c.background) blocks.push(`Backstory: ${c.background}`);

    // Style — override with the in-flight text if provided
    const style = (styleOverride && styleOverride.trim()) || p.speaking_style || null;
    if (style) {
      blocks.push(`\nHOW YOU SPEAK: ${style}`);
      blocks.push('Match this voice exactly in your reply — word choice, rhythm, sentence length.');
    }

    blocks.push('\nRespond in character with 1–3 paragraphs. Use *asterisks* for actions.');
    systemPrompt = blocks.join('\n');
  } else {
    // Create-flow preview — no saved character yet.
    const blocks: string[] = [];
    const name = fallbackName?.trim() || 'this character';
    blocks.push(`You ARE ${name}. Stay in character. Never acknowledge being an AI.`);
    if (fallbackDescription?.trim()) blocks.push(`Who you are: ${fallbackDescription.trim()}`);
    if (styleOverride && styleOverride.trim()) {
      blocks.push(`\nHOW YOU SPEAK: ${styleOverride.trim()}`);
      blocks.push('Match this voice exactly in your reply — word choice, rhythm, sentence length.');
    }
    blocks.push('\nRespond in character with 1–3 paragraphs. Use *asterisks* for actions.');
    systemPrompt = blocks.join('\n');
  }

  const response = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `[Stranger]: ${scenario}` },
    ],
    max_tokens: 300,
    temperature: 0.85,
    presence_penalty: 0.3,
    frequency_penalty: 0.2,
  });

  const reply = (response.choices[0].message.content || '*remains silent*').trim();
  return { reply };
}

/**
 * Clear a character's learned speaking style. Used when the owner hits "Reset to preset"
 * — the next chat will fall back to personality.speaking_style (or nothing) until the
 * learner re-runs.
 */
export async function resetLearnedSpeakingStyle(characterId: string): Promise<void> {
  await query(
    `UPDATE characters
        SET learned_speaking_style = NULL,
            style_sample_count = 0,
            style_last_learned_at = NULL
      WHERE id = $1`,
    [characterId]
  );
}

// ──────────────────────────────────────────────────────────────────────
// Content moderation
// ──────────────────────────────────────────────────────────────────────

/**
 * Classify whether a piece of authored content (character, world, campaign)
 * contains adult/NSFW material. Used at the public-publish boundary so we
 * can keep the public face of the site SFW while still allowing private use.
 *
 * Threshold: we err on the side of allowing publication. Mild romance,
 * implied violence, dark themes, mature topics — all SFW. We flag explicit
 * sexual content, graphic gore, sexual content involving minors (always),
 * and content whose primary purpose is sexual gratification.
 *
 * Returns { is_nsfw, reason }. Reason is short and shown to the owner so
 * they can fix the content if they think we got it wrong.
 *
 * Cost: one cheap call (max_tokens: 200), only fires on the public toggle —
 * not on every save. Safe to call from request paths.
 */
export async function classifyContent(
  kind: 'character' | 'world' | 'campaign',
  text: string
): Promise<{ is_nsfw: boolean; reason: string }> {
  // Trim to ~6000 chars — plenty for a character/world/campaign and keeps cost bounded.
  const snippet = (text || '').slice(0, 6000).trim();
  if (snippet.length < 20) {
    return { is_nsfw: false, reason: 'Too little content to classify.' };
  }

  const prompt = `You are a content classifier for a 13+ social roleplaying platform. Decide whether this ${kind} can appear in PUBLIC listings (browse pages, search, recommendations) where strangers including teens may see it.

ALLOWED in public (SFW):
- Mild romance, kissing, attraction
- Implied violence, action scenes, dark themes
- Mature topics handled tastefully (death, addiction, mental health)
- Edgy personalities, antiheroes, morally grey characters
- Horror, suspense, gore that serves the story

NOT ALLOWED in public (NSFW):
- Explicit sexual content or detailed sexual descriptions
- Sexual content whose primary purpose is gratification
- Graphic torture or gore for its own sake
- Sexual content involving minors (NEVER allowed anywhere — flag and refuse)
- Slurs targeting protected groups, hate-speech promotion

CONTENT:
"""
${snippet}
"""

Respond with ONLY valid JSON:
{ "is_nsfw": true | false, "reason": "one short sentence" }

If you're unsure, prefer is_nsfw: false unless there's clear explicit content. Only flag content that genuinely fails the public-SFW bar.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.1,
    });
    const raw = response.choices[0].message.content || '{"is_nsfw":false,"reason":""}';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      is_nsfw: !!parsed.is_nsfw,
      reason: String(parsed.reason || '').slice(0, 240),
    };
  } catch (e: any) {
    // Fail-open: if the moderation call itself fails, don't block the user.
    // Worst case is something gets published that should've been flagged;
    // a user report can catch it. Better than blocking everyone on AI downtime.
    console.error('classifyContent failed:', e?.message);
    return { is_nsfw: false, reason: 'Moderation check unavailable.' };
  }
}
