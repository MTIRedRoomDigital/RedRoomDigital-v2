import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateAIResponse, summarizeForCanon } from '../services/ai';
import { createNotification } from '../services/notifications';

export const conversationRouter = Router();

/**
 * GET /api/conversations
 * Get all conversations for the current user, with last message and partner info
 */
conversationRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get all conversations where this user participates (exclude test chats)
    const result = await query(
      `SELECT
        conv.id, conv.context, conv.title, conv.is_active, conv.updated_at, conv.chat_mode,
        cp.character_id AS my_character_id, cp.unread_count,
        my_char.name AS my_character_name, my_char.avatar_url AS my_character_avatar
       FROM conversations conv
       JOIN conversation_participants cp ON conv.id = cp.conversation_id
       JOIN characters my_char ON cp.character_id = my_char.id
       WHERE cp.user_id = $1 AND (conv.is_test IS NULL OR conv.is_test = false)
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

    // Get location info if set
    let location = null;
    if (conv.rows[0].location_id) {
      const locResult = await query(
        'SELECT id, name, description, type FROM world_locations WHERE id = $1',
        [conv.rows[0].location_id]
      );
      if (locResult.rows.length > 0) location = locResult.rows[0];
    }

    res.json({
      success: true,
      data: {
        ...conv.rows[0],
        location,
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
    const { character_id, partner_character_id, context, world_id, location_id, is_test, chat_mode } = req.body;

    // === TEST CHAT MODE ===
    // Owner tests their own character — no partner character needed
    if (is_test && character_id) {
      const myChar = await query(
        'SELECT * FROM characters WHERE id = $1 AND creator_id = $2',
        [character_id, req.user!.id]
      );

      if (myChar.rows.length === 0) {
        res.status(403).json({ success: false, message: 'You do not own this character' });
        return;
      }

      // Create test conversation
      const conv = await query(
        `INSERT INTO conversations (context, world_id, title, is_test)
         VALUES ($1, $2, $3, true)
         RETURNING *`,
        [
          myChar.rows[0].world_id ? 'within_world' : 'vacuum',
          myChar.rows[0].world_id || null,
          `Test: ${myChar.rows[0].name}`,
        ]
      );

      // Add the character as a participant (AI-controlled for test)
      await query(
        `INSERT INTO conversation_participants (conversation_id, character_id, user_id, is_ai_controlled)
         VALUES ($1, $2, $3, true)`,
        [conv.rows[0].id, character_id, req.user!.id]
      );

      res.status(201).json({ success: true, data: conv.rows[0] });
      return;
    }

    // === NORMAL CHAT MODE ===
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

    // Determine chat mode and AI control settings
    const mode = chat_mode || 'live'; // 'ai' | 'live' | 'ai_fallback'

    // Check if an ACTIVE conversation already exists between these characters with the same mode group
    // AI chats and live/ai_fallback chats are separate — you can have both simultaneously
    const modeGroup = mode === 'ai' ? ['ai'] : ['live', 'ai_fallback'];
    const existing = await query(
      `SELECT cp1.conversation_id
       FROM conversation_participants cp1
       JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
       JOIN conversations conv ON cp1.conversation_id = conv.id
       WHERE cp1.character_id = $1 AND cp2.character_id = $2
       AND (conv.is_test IS NULL OR conv.is_test = false)
       AND conv.is_active = true
       AND conv.chat_mode = ANY($3)`,
      [character_id, partner_character_id, modeGroup]
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
    const isAIControlled = mode === 'ai' || mode === 'ai_fallback';

    // Validate: AI modes require is_ai_enabled on the partner character
    if (isAIControlled && !partnerChar.rows[0].is_ai_enabled) {
      res.status(400).json({
        success: false,
        message: `${partnerChar.rows[0].name} does not have AI enabled. Only live chat is available.`,
      });
      return;
    }

    // Create conversation with chat_mode
    const conv = await query(
      `INSERT INTO conversations (context, world_id, location_id, title, chat_mode)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        context || 'vacuum',
        world_id || null,
        location_id || null,
        `${myChar.rows[0].name} & ${partnerChar.rows[0].name}`,
        mode,
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
      [conv.rows[0].id, partner_character_id, partnerChar.rows[0].owner_id, isAIControlled]
    );

    // Update chat counts for both characters
    await query('UPDATE characters SET chat_count = chat_count + 1 WHERE id = $1 OR id = $2',
      [character_id, partner_character_id]
    );

    // Notification logic depends on chat_mode:
    // - 'ai': Pure AI chat — do NOT notify the partner user
    // - 'live': Live chat — notify partner that someone is chatting
    // - 'ai_fallback': AI responding until partner takes over — send chat_request
    if (mode === 'live') {
      await createNotification({
        userId: partnerChar.rows[0].owner_id,
        type: 'chat_message',
        title: 'New Live Chat',
        body: `${myChar.rows[0].name} is chatting with ${partnerChar.rows[0].name}`,
        data: {
          conversationId: conv.rows[0].id,
          fromCharacterName: myChar.rows[0].name,
          toCharacterName: partnerChar.rows[0].name,
        },
        io: req.app.get('io'),
      });
    } else if (mode === 'ai_fallback') {
      await createNotification({
        userId: partnerChar.rows[0].owner_id,
        type: 'chat_request',
        title: 'Chat Request',
        body: `${myChar.rows[0].name} wants to chat with ${partnerChar.rows[0].name}. AI is responding until you take over!`,
        data: {
          conversationId: conv.rows[0].id,
          fromCharacterName: myChar.rows[0].name,
          toCharacterName: partnerChar.rows[0].name,
          chatMode: 'ai_fallback',
        },
        io: req.app.get('io'),
      });
    }
    // mode === 'ai' → no notification sent

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

    // Send throttled notification to other participants
    // Only creates a notification if there isn't an unread one for this conversation from the last 5 minutes
    try {
      const otherParticipants = await query(
        `SELECT cp.user_id FROM conversation_participants cp
         WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
        [req.params.id, req.user!.id]
      );

      for (const participant of otherParticipants.rows) {
        const recentNotif = await query(
          `SELECT id FROM notifications
           WHERE user_id = $1 AND type = 'chat_message' AND is_read = FALSE
           AND data->>'conversationId' = $2
           AND created_at > NOW() - INTERVAL '5 minutes'
           LIMIT 1`,
          [participant.user_id, req.params.id]
        );

        if (recentNotif.rows.length === 0) {
          await createNotification({
            userId: participant.user_id,
            type: 'chat_message',
            title: 'New Message',
            body: `${fullMessage.rows[0].sender_name}: ${content.substring(0, 100)}`,
            data: { conversationId: req.params.id },
            io,
          });
        }
      }
    } catch (notifErr: any) {
      // Don't fail the message send if notification creation fails
      console.error('Chat notification error:', notifErr.message);
    }

    // Auto-trigger AI response for AI and AI Fallback chats
    // This runs asynchronously — the user's message is returned immediately
    try {
      const convMode = await query('SELECT chat_mode, is_active FROM conversations WHERE id = $1', [req.params.id]);
      const mode = convMode.rows[0]?.chat_mode;
      const isActive = convMode.rows[0]?.is_active;

      if (isActive && (mode === 'ai' || mode === 'ai_fallback')) {
        // Fire and forget — generate AI response in the background
        (async () => {
          try {
            // Find the AI character (the partner, not the sender)
            const aiParticipant = await query(
              `SELECT cp.character_id, cp.user_id, c.name, c.is_ai_enabled
               FROM conversation_participants cp
               JOIN characters c ON cp.character_id = c.id
               WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
              [req.params.id, req.user!.id]
            );

            if (aiParticipant.rows.length === 0 || !aiParticipant.rows[0].is_ai_enabled) return;
            if (!process.env.OPENROUTER_API_KEY) return;

            const aiChar = aiParticipant.rows[0];

            // Get recent messages for context
            const recentMessages = await query(
              `SELECT m.content, m.sender_character_id, m.sender_type, c.name AS sender_name
               FROM messages m
               JOIN characters c ON m.sender_character_id = c.id
               WHERE m.conversation_id = $1
               ORDER BY m.created_at ASC`,
              [req.params.id]
            );

            // Generate AI response
            const aiResponse = await generateAIResponse(
              aiChar.character_id,
              req.params.id as string,
              recentMessages.rows,
              false
            );

            // Save the AI message
            const aiResult = await query(
              `INSERT INTO messages (conversation_id, sender_character_id, sender_user_id, sender_type, content, ai_model, ai_prompt_tokens, ai_completion_tokens)
               VALUES ($1, $2, $3, 'ai', $4, $5, $6, $7)
               RETURNING *`,
              [req.params.id, aiChar.character_id, aiChar.user_id, aiResponse.content, aiResponse.model, aiResponse.promptTokens, aiResponse.completionTokens]
            );

            // Get full message with character info
            const aiFullMessage = await query(
              `SELECT m.*, c.name AS sender_name, c.avatar_url AS sender_avatar
               FROM messages m
               JOIN characters c ON m.sender_character_id = c.id
               WHERE m.id = $1`,
              [aiResult.rows[0].id]
            );

            // Update conversation timestamp
            await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [req.params.id]);

            // Emit via Socket.IO
            if (io) {
              io.to(`conversation:${req.params.id}`).emit('new_message', aiFullMessage.rows[0]);
            }
          } catch (aiErr: any) {
            console.error('Auto AI response error:', aiErr.message);
          }
        })();
      }
    } catch (autoAiErr: any) {
      console.error('Auto AI check error:', autoAiErr.message);
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
    const conversationId = req.params.id as string;
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

    // Check if this is a test conversation and get chat_mode
    const convCheck = await query(
      'SELECT is_test, chat_mode FROM conversations WHERE id = $1',
      [conversationId]
    );
    const isTest = convCheck.rows[0]?.is_test;
    const chatMode = convCheck.rows[0]?.chat_mode;

    // Reject AI generation if the conversation is a live chat (someone took over)
    if (!isTest && chatMode === 'live') {
      res.status(400).json({ success: false, message: 'This is a live chat — AI responses are not available.' });
      return;
    }

    // Find the AI character
    // For test chats: the character IS owned by this user (they're testing their own character)
    // For normal chats: the character is NOT owned by this user
    const aiParticipant = isTest
      ? await query(
          `SELECT cp.character_id, cp.user_id, c.name, c.is_ai_enabled
           FROM conversation_participants cp
           JOIN characters c ON cp.character_id = c.id
           WHERE cp.conversation_id = $1 AND cp.is_ai_controlled = true`,
          [conversationId]
        )
      : await query(
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

    if (!aiChar.is_ai_enabled && !isTest) {
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
      `SELECT m.content, m.sender_character_id, m.sender_type, c.name AS sender_name
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
      recentMessages.rows,
      isTest
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

/**
 * POST /api/conversations/:id/test-message
 * Send a message in a TEST conversation (user talks as themselves, not as a character)
 */
conversationRouter.post('/:id/test-message', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    const conversationId = req.params.id;
    const userId = req.user!.id;

    if (!content) {
      res.status(400).json({ success: false, message: 'Message content is required' });
      return;
    }

    // Verify this is a test conversation and user is a participant
    const conv = await query(
      `SELECT conv.is_test, cp.character_id
       FROM conversations conv
       JOIN conversation_participants cp ON conv.id = cp.conversation_id
       WHERE conv.id = $1 AND cp.user_id = $2 AND conv.is_test = true`,
      [conversationId, userId]
    );

    if (conv.rows.length === 0) {
      res.status(403).json({ success: false, message: 'Not a valid test conversation' });
      return;
    }

    const characterId = conv.rows[0].character_id;

    // Insert message (uses character_id as sender since it's NOT NULL, but sender_type = 'user')
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_character_id, sender_user_id, sender_type, content)
       VALUES ($1, $2, $3, 'user', $4)
       RETURNING *`,
      [conversationId, characterId, userId, content]
    );

    // Return with "You" as sender name for test messages
    const msg = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        ...msg,
        sender_name: 'You',
        sender_avatar: null,
      },
    });
  } catch (error: any) {
    console.error('Test message error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a test conversation (only test conversations can be deleted)
 */
conversationRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Only allow deleting test conversations that belong to this user
    const conv = await query(
      `SELECT conv.id FROM conversations conv
       JOIN conversation_participants cp ON conv.id = cp.conversation_id
       WHERE conv.id = $1 AND cp.user_id = $2 AND conv.is_test = true`,
      [req.params.id, userId]
    );

    if (conv.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Test conversation not found' });
      return;
    }

    await query('DELETE FROM conversations WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Test conversation deleted' });
  } catch (error: any) {
    console.error('Delete conversation error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/conversations/:id/takeover
 * User B takes over from AI in an ai_fallback conversation.
 * Transitions chat_mode from 'ai_fallback' to 'live'.
 *
 * HOW THIS WORKS:
 * 1. User A starts a chat with User B's character, but User B is offline
 * 2. AI responds as User B's character temporarily (chat_mode = 'ai_fallback')
 * 3. User B comes online, clicks the notification, sees the conversation
 * 4. User B clicks "Take Over" → this endpoint is called
 * 5. chat_mode changes to 'live', is_ai_controlled becomes false
 * 6. A socket event notifies User A that the chat is now live
 */
conversationRouter.post('/:id/takeover', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // 1. Verify user is a participant
    const participant = await query(
      'SELECT id, character_id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You are not in this conversation' });
      return;
    }

    // 2. Verify conversation is in ai_fallback mode
    const conv = await query('SELECT chat_mode FROM conversations WHERE id = $1', [conversationId]);
    if (conv.rows[0]?.chat_mode !== 'ai_fallback') {
      res.status(400).json({ success: false, message: 'This conversation is not in AI fallback mode' });
      return;
    }

    // 3. Update conversation mode to 'live'
    await query('UPDATE conversations SET chat_mode = $1 WHERE id = $2', ['live', conversationId]);

    // 4. Update participant's is_ai_controlled to false
    await query(
      'UPDATE conversation_participants SET is_ai_controlled = false WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    // 5. Emit socket event so the other user sees the transition in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('chat_mode_changed', {
        conversationId,
        newMode: 'live',
        takenOverBy: userId,
      });
    }

    res.json({ success: true, data: { chat_mode: 'live' } });
  } catch (error: any) {
    console.error('Takeover error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/conversations/:id/end
 * End a conversation. Sets is_active to false.
 * Either participant can end the conversation.
 * The conversation remains visible in chat history but is marked as ended.
 */
conversationRouter.post('/:id/end', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // Verify user is a participant
    const participant = await query(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You are not in this conversation' });
      return;
    }

    // Verify conversation exists and isn't a test chat
    const conv = await query(
      'SELECT id, is_active, is_test FROM conversations WHERE id = $1',
      [conversationId]
    );

    if (conv.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }

    if (!conv.rows[0].is_active) {
      res.status(400).json({ success: false, message: 'This conversation has already ended' });
      return;
    }

    // End the conversation
    await query(
      'UPDATE conversations SET is_active = false, updated_at = NOW() WHERE id = $1',
      [conversationId]
    );

    // Emit socket event so the other user sees the conversation end in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('conversation_ended', {
        conversationId,
        endedBy: userId,
      });
    }

    res.json({ success: true, message: 'Conversation ended' });
  } catch (error: any) {
    console.error('End conversation error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/conversations/:id/canon-request
 * Request to add a conversation to both characters' canon.
 * Only available after a chat has ended. Sends a notification to the other user.
 * Body: { character_id: string } — the requester's character in this conversation
 */
conversationRouter.post('/:id/canon-request', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    const { character_id } = req.body;

    if (!character_id) {
      res.status(400).json({ success: false, message: 'character_id is required' });
      return;
    }

    // Verify conversation exists and is ended
    const convCheck = await query(
      'SELECT id, is_active, is_test FROM conversations WHERE id = $1',
      [conversationId]
    );
    if (convCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Conversation not found' });
      return;
    }
    if (convCheck.rows[0].is_active) {
      res.status(400).json({ success: false, message: 'You can only add to canon after the chat has ended' });
      return;
    }

    // Verify user owns this character and is a participant
    const myParticipant = await query(
      `SELECT cp.character_id, c.name AS character_name
       FROM conversation_participants cp
       JOIN characters c ON cp.character_id = c.id
       WHERE cp.conversation_id = $1 AND cp.character_id = $2 AND cp.user_id = $3`,
      [conversationId, character_id, userId]
    );
    if (myParticipant.rows.length === 0) {
      res.status(403).json({ success: false, message: 'This character is not yours in this conversation' });
      return;
    }

    // Get the other participant
    const otherParticipant = await query(
      `SELECT cp.user_id, cp.character_id, c.name AS character_name, u.username
       FROM conversation_participants cp
       JOIN characters c ON cp.character_id = c.id
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
      [conversationId, userId]
    );

    if (otherParticipant.rows.length === 0) {
      // Solo/AI-only chat — just apply canon directly to the requester's character
      await applyCanonToCharacter(character_id, conversationId);
      res.json({ success: true, message: 'Canon updated for your character', solo: true });
      return;
    }

    const other = otherParticipant.rows[0];

    // Check for existing pending canon request for this conversation
    const existingNotif = await query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = 'canon_request' AND is_read = false
       AND data->>'conversationId' = $2
       LIMIT 1`,
      [other.user_id, conversationId]
    );
    if (existingNotif.rows.length > 0) {
      res.status(400).json({ success: false, message: 'A canon request for this conversation is already pending' });
      return;
    }

    // Send notification to the other user
    await createNotification({
      userId: other.user_id,
      type: 'canon_request',
      title: 'Canon Request',
      body: `${req.user!.username} wants to add the chat between ${myParticipant.rows[0].character_name} & ${other.character_name} to canon`,
      data: {
        conversationId,
        fromUserId: userId,
        fromUsername: req.user!.username,
        fromCharacterId: character_id,
        fromCharacterName: myParticipant.rows[0].character_name,
        toCharacterId: other.character_id,
        toCharacterName: other.character_name,
      },
      io: req.app.get('io'),
    });

    res.json({ success: true, message: `Canon request sent to ${other.username}` });
  } catch (error: any) {
    console.error('Canon request error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/conversations/:id/canon-request/respond
 * Accept or reject a canon request. If accepted, both characters get their canon updated.
 * Body: { notification_id: string, action: 'accept' | 'reject' }
 */
conversationRouter.post('/:id/canon-request/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    const { notification_id, action } = req.body;

    if (!notification_id || !['accept', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'notification_id and action (accept/reject) are required' });
      return;
    }

    // Get the notification to extract character info
    const notifResult = await query(
      'SELECT id, data FROM notifications WHERE id = $1 AND user_id = $2',
      [notification_id, userId]
    );
    if (notifResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    const notifData = notifResult.rows[0].data;

    // Mark notification as read
    await query('UPDATE notifications SET is_read = true WHERE id = $1', [notification_id]);

    if (action === 'reject') {
      // Notify the requester
      await createNotification({
        userId: notifData.fromUserId,
        type: 'canon_rejected',
        title: 'Canon Request Declined',
        body: `${req.user!.username} declined adding the chat between ${notifData.fromCharacterName} & ${notifData.toCharacterName} to canon`,
        data: { conversationId },
        io: req.app.get('io'),
      });

      res.json({ success: true, message: 'Canon request declined' });
      return;
    }

    // === ACCEPTED — apply canon to BOTH characters ===
    const fromCharId = notifData.fromCharacterId as string;
    const toCharId = notifData.toCharacterId as string;

    // Apply canon to both characters
    const result1 = await applyCanonToCharacter(fromCharId, conversationId);
    const result2 = await applyCanonToCharacter(toCharId, conversationId);

    // Notify the requester that it was accepted
    await createNotification({
      userId: notifData.fromUserId,
      type: 'canon_accepted',
      title: 'Canon Request Accepted!',
      body: `${req.user!.username} agreed! The chat between ${notifData.fromCharacterName} & ${notifData.toCharacterName} is now canon`,
      data: {
        conversationId,
        eventsAdded: (result1?.eventsAdded || 0) + (result2?.eventsAdded || 0),
      },
      io: req.app.get('io'),
    });

    res.json({
      success: true,
      message: 'Canon updated for both characters!',
      data: {
        character1: result1,
        character2: result2,
      },
    });
  } catch (error: any) {
    console.error('Canon respond error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Helper: Apply canon events + relationship updates to a single character
 */
async function applyCanonToCharacter(characterId: string, conversationId: string) {
  // Get character's current history
  const charCheck = await query('SELECT id, history FROM characters WHERE id = $1', [characterId]);
  if (charCheck.rows.length === 0) return null;

  // Check if this conversation was already added to this character's canon
  const existingHistory = charCheck.rows[0].history || [];
  const alreadyAdded = existingHistory.some((h: any) => h.conversationId === conversationId && h.source === 'canon_chat');
  if (alreadyAdded) return { eventsAdded: 0, relationshipsUpdated: 0, alreadyExists: true };

  // Use AI to summarize
  const summary = await summarizeForCanon(characterId, conversationId);

  // Apply events to character history
  const newHistory = [
    ...existingHistory,
    ...summary.events.map((e) => ({
      event: e.event,
      impact: e.impact,
      date: new Date().toISOString().split('T')[0],
      source: 'canon_chat',
      conversationId,
    })),
  ];

  await query('UPDATE characters SET history = $1 WHERE id = $2', [JSON.stringify(newHistory), characterId]);

  // Apply relationship updates
  let relationshipsUpdated = 0;
  for (const rel of summary.relationships) {
    if (!rel.characterId) continue;

    const existing = await query(
      'SELECT id, strength FROM character_relationships WHERE character_id = $1 AND related_character_id = $2',
      [characterId, rel.characterId]
    );

    if (existing.rows.length > 0) {
      const newStrength = Math.max(0, Math.min(100, existing.rows[0].strength + rel.strengthChange));
      await query(
        `UPDATE character_relationships SET
          relationship_type = $1, description = $2, strength = $3, updated_at = NOW()
         WHERE character_id = $4 AND related_character_id = $5`,
        [rel.type, rel.description, newStrength, characterId, rel.characterId]
      );
    } else {
      const initialStrength = Math.max(0, Math.min(100, 50 + rel.strengthChange));
      await query(
        `INSERT INTO character_relationships (character_id, related_character_id, relationship_type, description, strength)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (character_id, related_character_id) DO UPDATE SET
           relationship_type = $3, description = $4, strength = $5, updated_at = NOW()`,
        [characterId, rel.characterId, rel.type, rel.description, initialStrength]
      );
    }
    relationshipsUpdated++;
  }

  return { eventsAdded: summary.events.length, relationshipsUpdated };
}

/**
 * POST /api/conversations/:id/canon-removal-request
 * Request to remove canon events from a specific conversation for both characters.
 * Only the character owner can request this. The other user must agree.
 * Body: { character_id: string }
 */
conversationRouter.post('/:id/canon-removal-request', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    const { character_id } = req.body;

    if (!character_id) {
      res.status(400).json({ success: false, message: 'character_id is required' });
      return;
    }

    // Verify user owns this character and was a participant
    const myParticipant = await query(
      `SELECT cp.character_id, c.name AS character_name, c.history
       FROM conversation_participants cp
       JOIN characters c ON cp.character_id = c.id
       WHERE cp.conversation_id = $1 AND cp.character_id = $2 AND cp.user_id = $3`,
      [conversationId, character_id, userId]
    );
    if (myParticipant.rows.length === 0) {
      res.status(403).json({ success: false, message: 'This character is not yours in this conversation' });
      return;
    }

    // Check this conversation actually has canon events for this character
    const history = myParticipant.rows[0].history || [];
    const canonEvents = history.filter((h: any) => h.conversationId === conversationId && h.source === 'canon_chat');
    if (canonEvents.length === 0) {
      res.status(400).json({ success: false, message: 'No canon events from this conversation to remove' });
      return;
    }

    // Get the other participant
    const otherParticipant = await query(
      `SELECT cp.user_id, cp.character_id, c.name AS character_name, u.username
       FROM conversation_participants cp
       JOIN characters c ON cp.character_id = c.id
       JOIN users u ON cp.user_id = u.id
       WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
      [conversationId, userId]
    );

    if (otherParticipant.rows.length === 0) {
      // Solo chat — remove directly
      await removeCanonFromCharacter(character_id, conversationId);
      res.json({ success: true, message: 'Canon events removed from your character', solo: true });
      return;
    }

    const other = otherParticipant.rows[0];

    // Check for existing pending removal request
    const existingNotif = await query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = 'canon_removal_request' AND is_read = false
       AND data->>'conversationId' = $2
       LIMIT 1`,
      [other.user_id, conversationId]
    );
    if (existingNotif.rows.length > 0) {
      res.status(400).json({ success: false, message: 'A removal request for this conversation is already pending' });
      return;
    }

    // Send notification to the other user
    await createNotification({
      userId: other.user_id,
      type: 'canon_removal_request',
      title: 'Canon Removal Request',
      body: `${req.user!.username} wants to remove the canon from the chat between ${myParticipant.rows[0].character_name} & ${other.character_name}`,
      data: {
        conversationId,
        fromUserId: userId,
        fromUsername: req.user!.username,
        fromCharacterId: character_id,
        fromCharacterName: myParticipant.rows[0].character_name,
        toCharacterId: other.character_id,
        toCharacterName: other.character_name,
      },
      io: req.app.get('io'),
    });

    res.json({ success: true, message: `Removal request sent to ${other.username}` });
  } catch (error: any) {
    console.error('Canon removal request error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/conversations/:id/canon-removal-request/respond
 * Accept or reject a canon removal request. If accepted, canon events are removed from both characters.
 * Body: { notification_id: string, action: 'accept' | 'reject' }
 */
conversationRouter.post('/:id/canon-removal-request/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id as string;
    const { notification_id, action } = req.body;

    if (!notification_id || !['accept', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: 'notification_id and action (accept/reject) are required' });
      return;
    }

    // Get the notification
    const notifResult = await query(
      'SELECT id, data FROM notifications WHERE id = $1 AND user_id = $2',
      [notification_id, userId]
    );
    if (notifResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    const notifData = notifResult.rows[0].data;

    // Mark notification as read
    await query('UPDATE notifications SET is_read = true WHERE id = $1', [notification_id]);

    if (action === 'reject') {
      await createNotification({
        userId: notifData.fromUserId,
        type: 'canon_removal_rejected',
        title: 'Removal Request Declined',
        body: `${req.user!.username} declined removing the canon from the chat between ${notifData.fromCharacterName} & ${notifData.toCharacterName}`,
        data: { conversationId },
        io: req.app.get('io'),
      });

      res.json({ success: true, message: 'Removal request declined' });
      return;
    }

    // === ACCEPTED — remove canon from BOTH characters ===
    const fromCharId = notifData.fromCharacterId as string;
    const toCharId = notifData.toCharacterId as string;

    const removed1 = await removeCanonFromCharacter(fromCharId, conversationId);
    const removed2 = await removeCanonFromCharacter(toCharId, conversationId);

    await createNotification({
      userId: notifData.fromUserId,
      type: 'canon_removal_accepted',
      title: 'Canon Removed',
      body: `${req.user!.username} agreed. The canon from the chat between ${notifData.fromCharacterName} & ${notifData.toCharacterName} has been removed`,
      data: {
        conversationId,
        eventsRemoved: (removed1 || 0) + (removed2 || 0),
      },
      io: req.app.get('io'),
    });

    res.json({
      success: true,
      message: 'Canon events removed from both characters',
      data: { eventsRemoved1: removed1, eventsRemoved2: removed2 },
    });
  } catch (error: any) {
    console.error('Canon removal respond error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * Helper: Remove canon events from a single character for a specific conversation
 */
async function removeCanonFromCharacter(characterId: string, conversationId: string): Promise<number> {
  const charResult = await query('SELECT id, history FROM characters WHERE id = $1', [characterId]);
  if (charResult.rows.length === 0) return 0;

  const history = charResult.rows[0].history || [];
  const before = history.length;
  const filtered = history.filter((h: any) => !(h.conversationId === conversationId && h.source === 'canon_chat'));
  const removed = before - filtered.length;

  if (removed > 0) {
    await query('UPDATE characters SET history = $1 WHERE id = $2', [JSON.stringify(filtered), characterId]);
  }

  return removed;
}
