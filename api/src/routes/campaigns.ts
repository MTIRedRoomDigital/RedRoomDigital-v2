import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createNotification } from '../services/notifications';
import { summarizeForWorldCanon } from '../services/ai';

export const campaignRouter = Router();

/**
 * Campaigns — World-Changing Events
 *
 * HOW THIS WORKS:
 * - WorldMasters create campaigns: events that can permanently change a world
 *   (a building destroyed, a war fought, someone becoming mayor)
 * - Characters join the campaign (world members sign up)
 * - When the WorldMaster starts the campaign, a multi-character conversation is created
 * - Users take turns sending messages (round-robin) or can skip their turn
 * - When the campaign ends, the WorldMaster reviews the results
 * - If approved, AI summarizes what happened and adds it to world canon + character histories
 * - Everyone can see campaigns and their outcomes (not just participants)
 */

// ── Helper: check if user is WorldMaster ──────────────────────────
async function isWorldMasterOf(worldId: string, userId: string): Promise<boolean> {
  const worldOwner = await query('SELECT creator_id FROM worlds WHERE id = $1', [worldId]);
  if (worldOwner.rows[0]?.creator_id === userId) return true;
  const wm = await query(
    'SELECT is_worldmaster FROM world_members WHERE world_id = $1 AND user_id = $2',
    [worldId, userId]
  );
  return !!wm.rows[0]?.is_worldmaster;
}

// ========== CAMPAIGN CRUD ==========

/**
 * GET /api/campaigns/world/:worldId
 * Get all campaigns in a world (public — anyone can see)
 */
campaignRouter.get('/world/:worldId', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, u.username AS creator_name,
              (SELECT COUNT(*) FROM campaign_participants cp WHERE cp.campaign_id = c.id) AS participant_count
       FROM campaigns c
       JOIN users u ON c.creator_id = u.id
       WHERE c.world_id = $1
       ORDER BY
         CASE c.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'completed' THEN 2 WHEN 'archived' THEN 3 END,
         c.created_at DESC`,
      [req.params.worldId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('List campaigns error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/campaigns/:id
 * Get campaign details with participants (public — anyone can see)
 */
campaignRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, u.username AS creator_name, w.name AS world_name, w.id AS world_id
       FROM campaigns c
       JOIN users u ON c.creator_id = u.id
       JOIN worlds w ON c.world_id = w.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    // Get participants with character info
    const participants = await query(
      `SELECT cp.*, ch.name AS character_name, ch.avatar_url AS character_avatar,
              ch.description AS character_description,
              u.username AS owner_name, u.id AS owner_id
       FROM campaign_participants cp
       JOIN characters ch ON cp.character_id = ch.id
       JOIN users u ON cp.user_id = u.id
       WHERE cp.campaign_id = $1
       ORDER BY cp.turn_order ASC`,
      [req.params.id]
    );

    // Get message count if conversation exists
    let message_count = 0;
    if (result.rows[0].conversation_id) {
      const msgCount = await query(
        'SELECT COUNT(*) FROM messages WHERE conversation_id = $1',
        [result.rows[0].conversation_id]
      );
      message_count = parseInt(msgCount.rows[0].count);
    }

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        participants: participants.rows,
        message_count,
      },
    });
  } catch (error: any) {
    console.error('Get campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns
 * Create a new campaign (WorldMaster only)
 */
campaignRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { world_id, name, description, premise, max_participants, min_participants } = req.body;

    if (!world_id || !name) {
      res.status(400).json({ success: false, message: 'World ID and campaign name are required' });
      return;
    }

    if (!await isWorldMasterOf(world_id, userId)) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can create campaigns' });
      return;
    }

    const sortResult = await query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM campaigns WHERE world_id = $1',
      [world_id]
    );

    const result = await query(
      `INSERT INTO campaigns (world_id, creator_id, name, description, premise, max_participants, min_participants, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        world_id, userId, name, description || null, premise || null,
        max_participants || 6, min_participants || 2,
        sortResult.rows[0].next_order,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Create campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PUT /api/campaigns/:id
 * Update a campaign (WorldMaster only)
 */
campaignRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaign = await query('SELECT world_id FROM campaigns WHERE id = $1', [req.params.id]);

    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    if (!await isWorldMasterOf(campaign.rows[0].world_id, userId)) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can edit campaigns' });
      return;
    }

    const { name, description, premise, status, max_participants, min_participants } = req.body;

    const result = await query(
      `UPDATE campaigns SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        premise = COALESCE($3, premise),
        status = COALESCE($4, status),
        max_participants = COALESCE($5, max_participants),
        min_participants = COALESCE($6, min_participants),
        updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, description, premise, status, max_participants, min_participants, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Update campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/campaigns/:id
 * Delete a campaign (WorldMaster only)
 */
campaignRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaign = await query('SELECT world_id FROM campaigns WHERE id = $1', [req.params.id]);

    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    if (!await isWorldMasterOf(campaign.rows[0].world_id, userId)) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can delete campaigns' });
      return;
    }

    await query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error: any) {
    console.error('Delete campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========== JOIN / LEAVE CAMPAIGN ==========

/**
 * POST /api/campaigns/:id/join
 * Join a campaign with a character (world members only)
 */
campaignRouter.post('/:id/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { character_id } = req.body;

    if (!character_id) {
      res.status(400).json({ success: false, message: 'character_id is required' });
      return;
    }

    // Get campaign
    const campaign = await query(
      'SELECT * FROM campaigns WHERE id = $1',
      [req.params.id]
    );
    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const camp = campaign.rows[0];

    if (camp.status !== 'draft') {
      res.status(400).json({ success: false, message: 'Can only join campaigns that haven\'t started yet' });
      return;
    }

    // Verify user owns the character
    const charResult = await query(
      'SELECT id, name, world_id FROM characters WHERE id = $1 AND creator_id = $2',
      [character_id, userId]
    );
    if (charResult.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You do not own this character' });
      return;
    }

    // Verify user is a world member
    const member = await query(
      'SELECT id FROM world_members WHERE world_id = $1 AND user_id = $2',
      [camp.world_id, userId]
    );
    if (member.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You must be a member of this world to join campaigns' });
      return;
    }

    // Check participant limit
    const currentCount = await query(
      'SELECT COUNT(*) FROM campaign_participants WHERE campaign_id = $1',
      [req.params.id]
    );
    if (parseInt(currentCount.rows[0].count) >= (camp.max_participants || 6)) {
      res.status(400).json({ success: false, message: 'Campaign is full' });
      return;
    }

    // Check if already joined (any character from this user)
    const existing = await query(
      'SELECT id FROM campaign_participants WHERE campaign_id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'You already have a character in this campaign' });
      return;
    }

    // Get next turn order
    const turnResult = await query(
      'SELECT COALESCE(MAX(turn_order), -1) + 1 AS next_turn FROM campaign_participants WHERE campaign_id = $1',
      [req.params.id]
    );

    await query(
      `INSERT INTO campaign_participants (campaign_id, character_id, user_id, turn_order)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, character_id, userId, turnResult.rows[0].next_turn]
    );

    // Notify the WorldMaster
    await createNotification({
      userId: camp.creator_id,
      type: 'campaign_join',
      title: 'Character Joined Campaign',
      body: `${charResult.rows[0].name} joined "${camp.name}"`,
      data: { campaignId: req.params.id, characterName: charResult.rows[0].name, fromUserId: userId },
      io: req.app.get('io'),
    });

    res.json({ success: true, message: `${charResult.rows[0].name} joined the campaign!` });
  } catch (error: any) {
    console.error('Join campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns/:id/leave
 * Leave a campaign (only before it starts)
 */
campaignRouter.post('/:id/leave', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const campaign = await query('SELECT status FROM campaigns WHERE id = $1', [req.params.id]);
    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    if (campaign.rows[0].status !== 'draft') {
      res.status(400).json({ success: false, message: 'Cannot leave a campaign that has already started' });
      return;
    }

    const result = await query(
      'DELETE FROM campaign_participants WHERE campaign_id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ success: false, message: 'You are not in this campaign' });
      return;
    }

    // Re-order turns
    const remaining = await query(
      'SELECT id FROM campaign_participants WHERE campaign_id = $1 ORDER BY turn_order ASC',
      [req.params.id]
    );
    for (let i = 0; i < remaining.rows.length; i++) {
      await query('UPDATE campaign_participants SET turn_order = $1 WHERE id = $2', [i, remaining.rows[i].id]);
    }

    res.json({ success: true, message: 'Left the campaign' });
  } catch (error: any) {
    console.error('Leave campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========== CAMPAIGN LIFECYCLE ==========

/**
 * POST /api/campaigns/:id/start
 * Start the campaign — creates the multi-character conversation (WorldMaster only)
 */
campaignRouter.post('/:id/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id as string;

    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const camp = campaign.rows[0];

    if (!await isWorldMasterOf(camp.world_id, userId)) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can start campaigns' });
      return;
    }

    if (camp.status !== 'draft') {
      res.status(400).json({ success: false, message: 'Campaign has already started or is completed' });
      return;
    }

    // Check minimum participants
    const participants = await query(
      `SELECT cp.*, ch.name AS character_name
       FROM campaign_participants cp
       JOIN characters ch ON cp.character_id = ch.id
       WHERE cp.campaign_id = $1
       ORDER BY cp.turn_order ASC`,
      [campaignId]
    );

    if (participants.rows.length < (camp.min_participants || 2)) {
      res.status(400).json({
        success: false,
        message: `Need at least ${camp.min_participants || 2} participants to start. Currently have ${participants.rows.length}.`,
      });
      return;
    }

    // Create the campaign conversation
    const conv = await query(
      `INSERT INTO conversations (context, world_id, title, chat_mode, campaign_id, is_active)
       VALUES ('within_world', $1, $2, 'live', $3, true)
       RETURNING *`,
      [camp.world_id, `Campaign: ${camp.name}`, campaignId]
    );

    const conversationId = conv.rows[0].id;

    // Add all participants to the conversation
    for (const p of participants.rows) {
      await query(
        `INSERT INTO conversation_participants (conversation_id, character_id, user_id)
         VALUES ($1, $2, $3)`,
        [conversationId, p.character_id, p.user_id]
      );
    }

    // Update campaign status and link conversation
    await query(
      `UPDATE campaigns SET status = 'active', conversation_id = $1, current_turn = 0, updated_at = NOW()
       WHERE id = $2`,
      [conversationId, campaignId]
    );

    // Notify all participants that the campaign has started
    for (const p of participants.rows) {
      if (p.user_id !== userId) {
        await createNotification({
          userId: p.user_id,
          type: 'campaign_started',
          title: 'Campaign Started!',
          body: `"${camp.name}" has begun! It's time to write history.`,
          data: { campaignId, conversationId, campaignName: camp.name },
          io: req.app.get('io'),
        });
      }
    }

    res.json({ success: true, data: { conversationId }, message: 'Campaign started!' });
  } catch (error: any) {
    console.error('Start campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns/:id/message
 * Send a message in a campaign conversation (turn-based)
 */
campaignRouter.post('/:id/message', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id as string;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ success: false, message: 'Content is required' });
      return;
    }

    // Get campaign
    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const camp = campaign.rows[0];
    if (camp.status !== 'active') {
      res.status(400).json({ success: false, message: 'Campaign is not active' });
      return;
    }

    // Get participants in turn order
    const participants = await query(
      `SELECT cp.*, ch.name AS character_name
       FROM campaign_participants cp
       JOIN characters ch ON cp.character_id = ch.id
       WHERE cp.campaign_id = $1 AND cp.is_active = true
       ORDER BY cp.turn_order ASC`,
      [campaignId]
    );

    const activeParticipants = participants.rows;
    if (activeParticipants.length === 0) {
      res.status(400).json({ success: false, message: 'No active participants' });
      return;
    }

    // Check whose turn it is
    const currentTurnIndex = camp.current_turn % activeParticipants.length;
    const currentPlayer = activeParticipants[currentTurnIndex];

    if (currentPlayer.user_id !== userId) {
      res.status(403).json({
        success: false,
        message: `It's not your turn. Waiting for ${currentPlayer.character_name}.`,
      });
      return;
    }

    // Insert message
    const result = await query(
      `INSERT INTO messages (conversation_id, sender_character_id, sender_user_id, sender_type, content)
       VALUES ($1, $2, $3, 'user', $4)
       RETURNING *`,
      [camp.conversation_id, currentPlayer.character_id, userId, content]
    );

    // Get full message with character info
    const fullMessage = await query(
      `SELECT m.*, c.name AS sender_name, c.avatar_url AS sender_avatar
       FROM messages m
       JOIN characters c ON m.sender_character_id = c.id
       WHERE m.id = $1`,
      [result.rows[0].id]
    );

    // Advance turn
    const nextTurn = camp.current_turn + 1;
    await query('UPDATE campaigns SET current_turn = $1, updated_at = NOW() WHERE id = $2', [nextTurn, campaignId]);

    // Update conversation timestamp
    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [camp.conversation_id]);

    // Update unread count for other participants
    await query(
      `UPDATE conversation_participants SET unread_count = unread_count + 1
       WHERE conversation_id = $1 AND user_id != $2`,
      [camp.conversation_id, userId]
    );

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${camp.conversation_id}`).emit('new_message', fullMessage.rows[0]);

      // Also emit turn update
      const nextPlayerIndex = nextTurn % activeParticipants.length;
      io.to(`conversation:${camp.conversation_id}`).emit('turn_update', {
        currentTurn: nextTurn,
        currentPlayerId: activeParticipants[nextPlayerIndex].user_id,
        currentCharacterName: activeParticipants[nextPlayerIndex].character_name,
      });
    }

    // Notify the next player it's their turn
    const nextPlayerIndex = nextTurn % activeParticipants.length;
    const nextPlayer = activeParticipants[nextPlayerIndex];
    if (nextPlayer.user_id !== userId) {
      await createNotification({
        userId: nextPlayer.user_id,
        type: 'campaign_turn',
        title: 'Your Turn!',
        body: `It's ${nextPlayer.character_name}'s turn in "${camp.name}"`,
        data: { campaignId, conversationId: camp.conversation_id, campaignName: camp.name },
        io: req.app.get('io'),
      });
    }

    res.json({
      success: true,
      data: fullMessage.rows[0],
      nextTurn: {
        currentTurn: nextTurn,
        currentPlayerUserId: nextPlayer.user_id,
        currentCharacterName: nextPlayer.character_name,
      },
    });
  } catch (error: any) {
    console.error('Campaign message error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns/:id/skip
 * Skip your turn in a campaign
 */
campaignRouter.post('/:id/skip', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id as string;

    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaign.rows.length === 0 || campaign.rows[0].status !== 'active') {
      res.status(400).json({ success: false, message: 'Campaign not found or not active' });
      return;
    }

    const camp = campaign.rows[0];

    const participants = await query(
      `SELECT cp.*, ch.name AS character_name
       FROM campaign_participants cp
       JOIN characters ch ON cp.character_id = ch.id
       WHERE cp.campaign_id = $1 AND cp.is_active = true
       ORDER BY cp.turn_order ASC`,
      [campaignId]
    );

    const activeParticipants = participants.rows;
    const currentTurnIndex = camp.current_turn % activeParticipants.length;
    const currentPlayer = activeParticipants[currentTurnIndex];

    if (currentPlayer.user_id !== userId) {
      res.status(403).json({ success: false, message: 'It\'s not your turn' });
      return;
    }

    // Insert a system message noting the skip
    await query(
      `INSERT INTO messages (conversation_id, sender_character_id, sender_user_id, sender_type, content)
       VALUES ($1, $2, $3, 'user', $4)`,
      [camp.conversation_id, currentPlayer.character_id, userId, `*${currentPlayer.character_name} stays silent, yielding their turn.*`]
    );

    // Advance turn
    const nextTurn = camp.current_turn + 1;
    await query('UPDATE campaigns SET current_turn = $1, updated_at = NOW() WHERE id = $2', [nextTurn, campaignId]);

    const nextPlayerIndex = nextTurn % activeParticipants.length;
    const nextPlayer = activeParticipants[nextPlayerIndex];

    // Emit turn update
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${camp.conversation_id}`).emit('turn_update', {
        currentTurn: nextTurn,
        currentPlayerId: nextPlayer.user_id,
        currentCharacterName: nextPlayer.character_name,
      });
    }

    // Notify next player
    if (nextPlayer.user_id !== userId) {
      await createNotification({
        userId: nextPlayer.user_id,
        type: 'campaign_turn',
        title: 'Your Turn!',
        body: `${currentPlayer.character_name} skipped. It's ${nextPlayer.character_name}'s turn in "${camp.name}"`,
        data: { campaignId, conversationId: camp.conversation_id },
        io: req.app.get('io'),
      });
    }

    res.json({
      success: true,
      message: 'Turn skipped',
      nextTurn: {
        currentTurn: nextTurn,
        currentPlayerUserId: nextPlayer.user_id,
        currentCharacterName: nextPlayer.character_name,
      },
    });
  } catch (error: any) {
    console.error('Skip turn error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns/:id/end
 * End a campaign — marks it as completed and sends approval to WorldMaster (WorldMaster only)
 */
campaignRouter.post('/:id/end', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id as string;

    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const camp = campaign.rows[0];
    if (!await isWorldMasterOf(camp.world_id, userId)) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can end campaigns' });
      return;
    }

    if (camp.status !== 'active') {
      res.status(400).json({ success: false, message: 'Campaign is not active' });
      return;
    }

    // End the conversation
    if (camp.conversation_id) {
      await query('UPDATE conversations SET is_active = false WHERE id = $1', [camp.conversation_id]);
    }

    // Mark campaign as completed
    await query(
      `UPDATE campaigns SET status = 'completed', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );

    // Notify all participants
    const participants = await query(
      `SELECT cp.user_id, ch.name AS character_name
       FROM campaign_participants cp
       JOIN characters ch ON cp.character_id = ch.id
       WHERE cp.campaign_id = $1`,
      [campaignId]
    );

    for (const p of participants.rows) {
      if (p.user_id !== userId) {
        await createNotification({
          userId: p.user_id,
          type: 'campaign_ended',
          title: 'Campaign Ended',
          body: `"${camp.name}" has concluded. The WorldMaster will review the results.`,
          data: { campaignId, campaignName: camp.name },
          io: req.app.get('io'),
        });
      }
    }

    res.json({ success: true, message: 'Campaign ended. You can now review and approve the results.' });
  } catch (error: any) {
    console.error('End campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns/:id/approve
 * Approve campaign results — AI summarizes and adds to world canon + character histories (WorldMaster only)
 */
campaignRouter.post('/:id/approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id as string;

    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const camp = campaign.rows[0];
    if (!await isWorldMasterOf(camp.world_id, userId)) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can approve campaign results' });
      return;
    }

    if (camp.status !== 'completed') {
      res.status(400).json({ success: false, message: 'Campaign must be ended before approval' });
      return;
    }

    if (!camp.conversation_id) {
      res.status(400).json({ success: false, message: 'No conversation found for this campaign' });
      return;
    }

    // Get all messages for the AI to summarize
    const messages = await query(
      `SELECT m.content, c.name AS sender_name, c.id AS sender_char_id
       FROM messages m
       JOIN characters c ON m.sender_character_id = c.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [camp.conversation_id]
    );

    if (messages.rows.length === 0) {
      res.status(400).json({ success: false, message: 'No messages in this campaign' });
      return;
    }

    // Get participants
    const participants = await query(
      `SELECT cp.character_id, ch.name AS character_name
       FROM campaign_participants cp
       JOIN characters ch ON cp.character_id = ch.id
       WHERE cp.campaign_id = $1`,
      [campaignId]
    );

    // Get world info
    const world = await query('SELECT name FROM worlds WHERE id = $1', [camp.world_id]);

    // AI summarizes the campaign
    const summary = await summarizeForWorldCanon(
      camp.conversation_id,
      camp.name,
      world.rows[0].name,
      participants.rows.map((p: any) => ({ id: p.character_id, name: p.character_name }))
    );

    // Add world canon events
    const worldHistory = await query('SELECT world_history FROM worlds WHERE id = $1', [camp.world_id]);
    const currentHistory = worldHistory.rows[0]?.world_history || [];
    const newWorldEvents = summary.worldEvents.map((e: any) => ({
      ...e,
      source: 'campaign',
      campaignId,
      campaignName: camp.name,
      date: new Date().toISOString(),
    }));

    await query(
      `UPDATE worlds SET world_history = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify([...currentHistory, ...newWorldEvents]), camp.world_id]
    );

    // Update each character's history
    for (const charUpdate of summary.characterUpdates) {
      const charHistory = await query('SELECT history FROM characters WHERE id = $1', [charUpdate.characterId]);
      const existingHistory = charHistory.rows[0]?.history || [];

      const newEvents = charUpdate.events.map((e: any) => ({
        ...e,
        source: 'campaign',
        campaignId,
      }));

      await query(
        `UPDATE characters SET history = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify([...existingHistory, ...newEvents]), charUpdate.characterId]
      );
    }

    // Store the outcome on the campaign
    await query(
      `UPDATE campaigns SET outcome = $1, status = 'archived', updated_at = NOW() WHERE id = $2`,
      [summary.outcome, campaignId]
    );

    // Notify all participants that the campaign is now canon
    for (const p of participants.rows) {
      await createNotification({
        userId: (await query('SELECT creator_id FROM characters WHERE id = $1', [p.character_id])).rows[0].creator_id,
        type: 'campaign_approved',
        title: 'Campaign Approved!',
        body: `"${camp.name}" results are now part of ${world.rows[0].name}'s history!`,
        data: { campaignId, worldId: camp.world_id, campaignName: camp.name },
        io: req.app.get('io'),
      });
    }

    res.json({
      success: true,
      message: 'Campaign results approved and added to world canon!',
      data: {
        worldEvents: newWorldEvents,
        characterUpdates: summary.characterUpdates,
        outcome: summary.outcome,
      },
    });
  } catch (error: any) {
    console.error('Approve campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns/:id/reject
 * Reject campaign results — archives without adding to canon (WorldMaster only)
 */
campaignRouter.post('/:id/reject', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const campaignId = req.params.id as string;

    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const camp = campaign.rows[0];
    if (!await isWorldMasterOf(camp.world_id, userId)) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can reject campaign results' });
      return;
    }

    await query(
      `UPDATE campaigns SET status = 'archived', outcome = 'Rejected by WorldMaster', updated_at = NOW() WHERE id = $1`,
      [campaignId]
    );

    // Notify participants
    const participants = await query(
      `SELECT cp.user_id, ch.name AS character_name
       FROM campaign_participants cp
       JOIN characters ch ON cp.character_id = ch.id
       WHERE cp.campaign_id = $1`,
      [campaignId]
    );

    for (const p of participants.rows) {
      if (p.user_id !== userId) {
        await createNotification({
          userId: p.user_id,
          type: 'campaign_rejected',
          title: 'Campaign Not Approved',
          body: `The WorldMaster decided "${camp.name}" results won't become canon.`,
          data: { campaignId, campaignName: camp.name },
          io: req.app.get('io'),
        });
      }
    }

    res.json({ success: true, message: 'Campaign results rejected' });
  } catch (error: any) {
    console.error('Reject campaign error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/campaigns/:id/messages
 * Get campaign messages (paginated) — accessible to anyone (campaigns are public)
 */
campaignRouter.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const campaign = await query('SELECT conversation_id FROM campaigns WHERE id = $1', [req.params.id]);
    if (campaign.rows.length === 0 || !campaign.rows[0].conversation_id) {
      res.status(404).json({ success: false, message: 'Campaign conversation not found' });
      return;
    }

    const conversationId = campaign.rows[0].conversation_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) FROM messages WHERE conversation_id = $1', [conversationId]);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT m.*, c.name AS sender_name, c.avatar_url AS sender_avatar
       FROM messages m
       JOIN characters c ON m.sender_character_id = c.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    res.json({
      success: true,
      data: {
        messages: result.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    console.error('Get campaign messages error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/campaigns/:id/turn
 * Get whose turn it is (for polling)
 */
campaignRouter.get('/:id/turn', async (req: Request, res: Response) => {
  try {
    const campaign = await query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (campaign.rows.length === 0 || campaign.rows[0].status !== 'active') {
      res.json({ success: true, data: null });
      return;
    }

    const camp = campaign.rows[0];
    const participants = await query(
      `SELECT cp.*, ch.name AS character_name
       FROM campaign_participants cp
       JOIN characters ch ON cp.character_id = ch.id
       WHERE cp.campaign_id = $1 AND cp.is_active = true
       ORDER BY cp.turn_order ASC`,
      [req.params.id]
    );

    const activeParticipants = participants.rows;
    if (activeParticipants.length === 0) {
      res.json({ success: true, data: null });
      return;
    }

    const currentIndex = camp.current_turn % activeParticipants.length;
    const currentPlayer = activeParticipants[currentIndex];

    res.json({
      success: true,
      data: {
        currentTurn: camp.current_turn,
        currentPlayerUserId: currentPlayer.user_id,
        currentCharacterId: currentPlayer.character_id,
        currentCharacterName: currentPlayer.character_name,
        participants: activeParticipants.map((p: any) => ({
          userId: p.user_id,
          characterId: p.character_id,
          characterName: p.character_name,
          turnOrder: p.turn_order,
        })),
      },
    });
  } catch (error: any) {
    console.error('Get turn error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
