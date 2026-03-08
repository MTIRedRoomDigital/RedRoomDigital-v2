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
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://redroomdigital.com',
    'X-Title': 'RedRoomDigital',
  },
});

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
    'SELECT context, world_id FROM conversations WHERE id = $1',
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
  recentMessages: { sender_name: string; content: string; sender_character_id: string }[]
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
  for (const msg of recentMessages.slice(-20)) {
    const isMe = msg.sender_character_id === characterId;
    chatMessages.push({
      role: isMe ? 'assistant' : 'user',
      content: `[${msg.sender_name}]: ${msg.content}`,
    });
  }

  // Call the AI
  const response = await openai.chat.completions.create({
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
