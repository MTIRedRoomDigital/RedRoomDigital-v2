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
    'SELECT context, world_id, location_id FROM conversations WHERE id = $1',
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

  if (conv.context === 'vacuum') {
    sections.push('- This is a "vacuum" chat — no specific world rules apply, but stay in character');
  } else if (conv.context === 'multiverse') {
    sections.push('- This is a "multiverse" chat — characters from different worlds can interact');
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
  // Get character info
  const charResult = await query(
    'SELECT name FROM characters WHERE id = $1',
    [characterId]
  );
  if (charResult.rows.length === 0) throw new Error('Character not found');
  const charName = charResult.rows[0].name;

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

CONVERSATION:
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
