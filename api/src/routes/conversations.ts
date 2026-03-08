import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateAIResponse } from '../services/ai';

export const conversationRouter = Router();

/**
 * GET /api/conversations
 * Get all conversations for the current user, with last message and partner info
 */
conversationRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get all conversations where this user participates
    const result = await query(
      `SELECT
        conv.id, conv.context, conv.title, conv.is_active, conv.updated_at,
        cp.character_id AS my_character_id, cp.unread_count,
        my_char.name AS my_character_name, my_char.avatar_url AS my_character_avatar
       FROM conversations conv
       JOIN conversation_participants cp ON conv.id = cp.conversation_id
       JOIN characters my_char ON cp.character_id = my_char.id
       WHERE cp.user_id = $1
       ORDER BY conv.updated_at DESC`,
      [userId]
    );

    // For each conversation, get the partner character info and last message
    const conversations = await Promise.all(
      result.rows.map(async (conv: any) => {
        // Get partner participant
        const partner = await query(
          `SELECT cp.character_id, cp.user_id, cp.is_ai_controlled,
                  c.name AS character_name, c.avatar_url AS character_avatar,
                  u.username AS owner_name
           FROM conversation_participants cp
           JOIN characters c ON cp.character_id = c.id
           JOIN users u ON cp.user_id = u.id
           WHERE cp.conversation_id = $1 AND cp.character_id != $2
           LIMIT 1`,
          [conv.id, conv.my_character_id]
        );

        // Get last message
        const lastMsg = await query(
          `SELECT m.content, m.created_at, m.sender_type, c.name AS sender_name
           FROM messages m
           JOIN characters c ON m.sender_character_id = c.id
           WHERE m.conversation_id = $1
           ORDER BY m.created_at DESC
           LIMIT 1`,
          [conv.id]
        );

        return {
          ...conv,
          partner: partner.rows[0] || null,
          last_message: lastMsg.rows[0] || null,
        };
      })
    );

    res.json({ success: true, data: conversations });
  } catch (error: any) {
    console.error('List conversations error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/conversations/:id
 * Get conversation details (participants, context, etc.)
 */
conversationRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Verify user is a participant
    const participant = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You are not in this conversation' });
      return;
    }

    // Get conversation
    const conv = await query(
      'SELECT * FROM conversations WHERE id = $1',
      [req.params.id]
    );

    if (conv.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    // Get all participants with character info
    const participants = await query(
      `SELECT cp.*, c.name AS character_name, c.avatar_url AS character_avatar,
              c.creator_id AS character_owner_id,
              u.username AS owner_name
       FROM conversation_participants cp
       JOIN characters c ON cp.character_id = c.id
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...conv.rows[0],
        participants: participants.rows,
      },
    });
  } catch (error: any) {
    console.error('Get conversation error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/conversations
 * Start a new conversation between characters
 */
conversationRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { character_id, partner_character_id, context, world_id } = req.body;

    if (!character_id || !partner_character_id) {
      res.status(400).json({ success: false, message: 'Both character IDs are required' });
      return;
    }

    // Verify the user owns the character
    const myChar = await query(
      'SELECT * FROM characters WHERE id = $1 AND creator_id = $2',
      [character_id, req.user!.id]
    );

    if (myChar.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You do not own this character' });
      return;
    }

    // Get the partner character and its owner
    const partnerChar = await query(
      'SELECT c.*, u.id AS owner_id FROM characters c JOIN users u ON c.creator_id = u.id WHERE c.id = $1',
      [partner_character_id]
    );

    if (partnerChar.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Partner character not found' });
      return;
    }

    // Check if a conversation already exists between these two characters
    const existing = await query(
      `SELECT cp1.conversation_id
       FROM conversation_participants cp1
       JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
       WHERE cp1.character_id = $1 AND cp2.character_id = $2`,
      [character_id, partner_character_id]
    );

    if (existing.rows.length > 0) {
      // Return existing conversation
      res.json({
        success: true,
        data: { id: existing.rows[0].conversation_id },
        message: 'Existing conversation found',
      });
      return;
    }

    // Create conversation
    const conv = await query(
      `INSERT INTO conversations (context, world_id, title)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [
        context || 'vacuum',
        world_id || null,
        `${myChar.rows[0].name} & ${partnerChar.rows[0].name}`,
      ]
    );

    // Add both participants
    await query(
      `INSERT INTO conversation_participants (conversation_id, character_id, user_id)
       VALUES ($1, $2, $3)`,
      [conv.rows[0].id, character_id, req.user!.id]
    );

    await query(
      `INSERT INTO conversation_participants (conversation_id, character_id, user_id, is_ai_controlled)
       VALUES ($1, $2, $3, $4)`,
      [conv.rows[0].id, partner_character_id, partnerChar.rows[0].owner_id, false]
    );

    // Update chat counts for both characters
    await query('UPDATE characters SET chat_count = chat_count + 1 WHERE id = $1 OR id = $2',
      [character_id, partner_character_id]
    );

    res.status(201).json({ success: true, data: conv.rows[0] });
  } catch (error: any) {
    console.error('Create conversation error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get messages in a conversation (paginated)
 */
conversationRouter.get('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    // Verify user is a participant
    const participant = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You are not in this conversation' });
      return;
    }

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM messages WHERE conversation_id = $1',
      [req.params.id]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT m.*, c.name AS sender_name, c.avatar_url AS sender_avatar
       FROM messages m
       JOIN characters c ON m.sender_character_id = c.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [req.params.id, limit, offset]
    );

    // Mark as read
    await query(
      `UPDATE conversation_participants SET unread_count = 0, last_read_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );

    res.json({
      success: true,
      data: {
        messages: result.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Send a message in a conversation
 */
conversationRouter.post('/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { character_id, content } = req.body;

    if (!content || !character_id) {
      res.status(400).json({ success: false, message: 'Character ID and content are required' });
      return;
    }

    // Verify user is a participant with this character
    const participant = await query(
      `SELECT id FROM conversation_participants
       WHERE conversation_id = $1 AND character_id = $2 AND user_id = $3`,
      [req.params.id, character_id, req.user!.id]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You cannot send messages as this character in this conversation' });
      return;
    }

    // Check daily chat limit for free users
    const tier = req.user!.subscription || 'free';
    if (tier === 'free') {
      const dailyCount = await query(
        `SELECT COUNT(*) FROM messages
         WHERE sender_user_id = $1 AND sender_type = 'user'
         AND created_at >= CURRENT_DATE`,
        [req.user!.id]
      );
      const used = parseInt(dailyCount.rows[0].count);
      const DAILY_LIMIT = 10;

      if (used >= DAILY_LIMIT) {
        res.status(429).json({
          success: false,
          message: `You've reached your daily chat limit (${DAILY_LIMIT} messages). Upgrade to Premium for unlimited chats!`,
          chatLimit: true,
          used,
          limit: DAILY_LIMIT,
        });
        return;
      }
    }

    // Insert message
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_character_id, sender_user_id, sender_type, content)
       VALUES ($1, $2, $3, 'user', $4)
       RETURNING *`,
      [req.params.id, character_id, req.user!.id, content]
    );

    // Get the full message with character info for the socket event
    const fullMessage = await query(
      `SELECT m.*, c.name AS sender_name, c.avatar_url AS sender_avatar
       FROM messages m
       JOIN characters c ON m.sender_character_id = c.id
       WHERE m.id = $1`,
      [result.rows[0].id]
    );

    // Update unread count for other participants
    await query(
      `UPDATE conversation_participants SET unread_count = unread_count + 1
       WHERE conversation_id = $1 AND user_id != $2`,
      [req.params.id, req.user!.id]
    );

    // Update conversation timestamp
    await query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${req.params.id}`).emit('new_message', fullMessage.rows[0]);
    }

    res.status(201).json({ success: true, data: fullMessage.rows[0] });
  } catch (error: any) {
    console.error('Send message error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/conversations/:id/ai-response
 * Generate an AI response for a character in this conversation
 *
 * HOW THIS WORKS:
 * 1. User sends a message as their character (normal send above)
 * 2. User clicks "Generate AI Response" for the partner character
 * 3. The AI reads the partner character's full profile (personality, background, world lore)
 * 4. It generates a response AS that character, staying in character
 * 5. The response is saved as a message with sender_type = 'ai'
 */
conversationRouter.post('/:id/ai-response', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user!.id;

    // Verify user is a participant
    const participant = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You are not in this conversation' });
      return;
    }

    // Find the AI character (the one NOT owned by this user, or the one flagged as ai_controlled)
    const aiParticipant = await query(
      `SELECT cp.character_id, cp.user_id, c.name, c.is_ai_enabled
       FROM conversation_participants cp
       JOIN characters c ON cp.character_id = c.id
       WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
      [conversationId, userId]
    );

    if (aiParticipant.rows.length === 0) {
      res.status(400).json({ success: false, message: 'No partner character found' });
      return;
    }

    const aiChar = aiParticipant.rows[0];

    if (!aiChar.is_ai_enabled) {
      res.status(400).json({ success: false, message: `${aiChar.name} does not have AI enabled` });
      return;
    }

    // Check if OpenRouter API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      res.status(500).json({ success: false, message: 'AI is not configured. Set OPENROUTER_API_KEY in your environment.' });
      return;
    }

    // Get recent messages for context
    const recentMessages = await query(
      `SELECT m.content, m.sender_character_id, c.name AS sender_name
       FROM messages m
       JOIN characters c ON m.sender_character_id = c.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    // Generate AI response
    const aiResponse = await generateAIResponse(
      aiChar.character_id,
      conversationId,
      recentMessages.rows
    );

    // Save the AI message
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_character_id, sender_user_id, sender_type, content, ai_model, ai_prompt_tokens, ai_completion_tokens)
       VALUES ($1, $2, $3, 'ai', $4, $5, $6, $7)
       RETURNING *`,
      [
        conversationId,
        aiChar.character_id,
        aiChar.user_id,
        aiResponse.content,
        aiResponse.model,
        aiResponse.promptTokens,
        aiResponse.completionTokens,
      ]
    );

    // Get full message with character info
    const fullMessage = await query(
      `SELECT m.*, c.name AS sender_name, c.avatar_url AS sender_avatar
       FROM messages m
       JOIN characters c ON m.sender_character_id = c.id
       WHERE m.id = $1`,
      [result.rows[0].id]
    );

    // Update conversation timestamp
    await query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [conversationId]
    );

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('new_message', fullMessage.rows[0]);
    }

    res.status(201).json({ success: true, data: fullMessage.rows[0] });
  } catch (error: any) {
    console.error('AI response error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message?.includes('API key')
        ? 'AI API key is invalid or missing'
        : 'Failed to generate AI response',
    });
  }
});
