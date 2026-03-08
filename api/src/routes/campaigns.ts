import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

export const campaignRouter = Router();

/**
 * Campaigns & Quests
 *
 * HOW THIS WORKS:
 * - WorldMasters create campaigns inside their worlds (like DnD campaign arcs)
 * - Each campaign can have multiple quests (individual missions/chapters)
 * - Characters can join quests as participants
 * - Quests have objectives that can be tracked and completed
 *
 * Think of it like a DnD module: Campaign = the overarching story, Quests = individual adventures
 */

// ========== CAMPAIGNS ==========

/**
 * GET /api/campaigns/world/:worldId
 * Get all campaigns in a world
 */
campaignRouter.get('/world/:worldId', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, u.username AS creator_name,
              (SELECT COUNT(*) FROM quests q WHERE q.campaign_id = c.id) AS quest_count
       FROM campaigns c
       JOIN users u ON c.creator_id = u.id
       WHERE c.world_id = $1
       ORDER BY c.sort_order ASC, c.created_at ASC`,
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
 * Get campaign details with quests
 */
campaignRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, u.username AS creator_name,
              w.name AS world_name
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

    // Get quests in this campaign
    const quests = await query(
      `SELECT q.*,
              (SELECT COUNT(*) FROM quest_participants qp WHERE qp.quest_id = q.id) AS participant_count
       FROM quests q
       WHERE q.campaign_id = $1
       ORDER BY q.sort_order ASC, q.created_at ASC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        quests: quests.rows,
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
    const { world_id, name, description, narrative_arc } = req.body;

    if (!world_id || !name) {
      res.status(400).json({ success: false, message: 'World ID and campaign name are required' });
      return;
    }

    // Verify user is a WorldMaster of this world
    const wm = await query(
      `SELECT wm.is_worldmaster FROM world_members wm
       WHERE wm.world_id = $1 AND wm.user_id = $2`,
      [world_id, userId]
    );

    const worldOwner = await query(
      'SELECT creator_id FROM worlds WHERE id = $1',
      [world_id]
    );

    const isWorldMaster = wm.rows[0]?.is_worldmaster || worldOwner.rows[0]?.creator_id === userId;

    if (!isWorldMaster) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can create campaigns' });
      return;
    }

    // Get next sort order
    const sortResult = await query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM campaigns WHERE world_id = $1',
      [world_id]
    );

    const result = await query(
      `INSERT INTO campaigns (world_id, creator_id, name, description, narrative_arc, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [world_id, userId, name, description, narrative_arc, sortResult.rows[0].next_order]
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

    // Get campaign and verify ownership
    const campaign = await query(
      `SELECT c.world_id FROM campaigns c
       JOIN worlds w ON c.world_id = w.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    // Verify WorldMaster
    const wm = await query(
      `SELECT wm.is_worldmaster FROM world_members wm
       WHERE wm.world_id = $1 AND wm.user_id = $2`,
      [campaign.rows[0].world_id, userId]
    );

    const worldOwner = await query(
      'SELECT creator_id FROM worlds WHERE id = $1',
      [campaign.rows[0].world_id]
    );

    if (!wm.rows[0]?.is_worldmaster && worldOwner.rows[0]?.creator_id !== userId) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can edit campaigns' });
      return;
    }

    const { name, description, narrative_arc, status } = req.body;

    const result = await query(
      `UPDATE campaigns SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        narrative_arc = COALESCE($3, narrative_arc),
        status = COALESCE($4, status)
       WHERE id = $5
       RETURNING *`,
      [name, description, narrative_arc, status, req.params.id]
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

    const campaign = await query(
      'SELECT c.world_id FROM campaigns c WHERE c.id = $1',
      [req.params.id]
    );

    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const worldOwner = await query(
      'SELECT creator_id FROM worlds WHERE id = $1',
      [campaign.rows[0].world_id]
    );

    const wm = await query(
      'SELECT is_worldmaster FROM world_members WHERE world_id = $1 AND user_id = $2',
      [campaign.rows[0].world_id, userId]
    );

    if (!wm.rows[0]?.is_worldmaster && worldOwner.rows[0]?.creator_id !== userId) {
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

// ========== QUESTS ==========

/**
 * GET /api/campaigns/:campaignId/quests
 * Get all quests in a campaign
 */
campaignRouter.get('/:campaignId/quests', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT q.*,
              (SELECT COUNT(*) FROM quest_participants qp WHERE qp.quest_id = q.id) AS participant_count
       FROM quests q
       WHERE q.campaign_id = $1
       ORDER BY q.sort_order ASC, q.created_at ASC`,
      [req.params.campaignId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/campaigns/quests/:id
 * Get quest details with participants
 */
campaignRouter.get('/quests/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT q.*, c.name AS campaign_name, w.name AS world_name, w.id AS world_id
       FROM quests q
       JOIN campaigns c ON q.campaign_id = c.id
       JOIN worlds w ON c.world_id = w.id
       WHERE q.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Quest not found' });
      return;
    }

    // Get participants
    const participants = await query(
      `SELECT qp.*, ch.name AS character_name, ch.avatar_url AS character_avatar,
              u.username AS owner_name
       FROM quest_participants qp
       JOIN characters ch ON qp.character_id = ch.id
       JOIN users u ON ch.creator_id = u.id
       WHERE qp.quest_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        participants: participants.rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns/:campaignId/quests
 * Create a quest (WorldMaster only)
 */
campaignRouter.post('/:campaignId/quests', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Get campaign and verify WorldMaster
    const campaign = await query(
      'SELECT c.world_id FROM campaigns c WHERE c.id = $1',
      [req.params.campaignId]
    );

    if (campaign.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Campaign not found' });
      return;
    }

    const worldOwner = await query('SELECT creator_id FROM worlds WHERE id = $1', [campaign.rows[0].world_id]);
    const wm = await query('SELECT is_worldmaster FROM world_members WHERE world_id = $1 AND user_id = $2',
      [campaign.rows[0].world_id, userId]);

    if (!wm.rows[0]?.is_worldmaster && worldOwner.rows[0]?.creator_id !== userId) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can create quests' });
      return;
    }

    const { name, description, objectives, rewards, lore_reveals } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Quest name is required' });
      return;
    }

    const sortResult = await query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM quests WHERE campaign_id = $1',
      [req.params.campaignId]
    );

    const result = await query(
      `INSERT INTO quests (campaign_id, name, description, objectives, rewards, lore_reveals, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.campaignId,
        name,
        description,
        JSON.stringify(objectives || []),
        JSON.stringify(rewards || {}),
        lore_reveals,
        sortResult.rows[0].next_order,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Create quest error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/campaigns/quests/:id/join
 * Join a quest with a character
 */
campaignRouter.post('/quests/:id/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { character_id } = req.body;

    if (!character_id) {
      res.status(400).json({ success: false, message: 'Character ID is required' });
      return;
    }

    // Verify user owns the character
    const char = await query(
      'SELECT id FROM characters WHERE id = $1 AND creator_id = $2',
      [character_id, userId]
    );

    if (char.rows.length === 0) {
      res.status(403).json({ success: false, message: 'You do not own this character' });
      return;
    }

    // Check quest exists and is active
    const quest = await query('SELECT status FROM quests WHERE id = $1', [req.params.id]);
    if (quest.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Quest not found' });
      return;
    }

    if (quest.rows[0].status !== 'active') {
      res.status(400).json({ success: false, message: 'This quest is not active' });
      return;
    }

    // Check if already joined
    const existing = await query(
      'SELECT id FROM quest_participants WHERE quest_id = $1 AND character_id = $2',
      [req.params.id, character_id]
    );

    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Character is already on this quest' });
      return;
    }

    await query(
      'INSERT INTO quest_participants (quest_id, character_id) VALUES ($1, $2)',
      [req.params.id, character_id]
    );

    res.json({ success: true, message: 'Joined quest successfully' });
  } catch (error: any) {
    console.error('Join quest error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PUT /api/campaigns/quests/:id
 * Update a quest (WorldMaster only)
 */
campaignRouter.put('/quests/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const quest = await query(
      `SELECT q.campaign_id, c.world_id FROM quests q
       JOIN campaigns c ON q.campaign_id = c.id
       WHERE q.id = $1`,
      [req.params.id]
    );

    if (quest.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Quest not found' });
      return;
    }

    const worldOwner = await query('SELECT creator_id FROM worlds WHERE id = $1', [quest.rows[0].world_id]);
    const wm = await query('SELECT is_worldmaster FROM world_members WHERE world_id = $1 AND user_id = $2',
      [quest.rows[0].world_id, userId]);

    if (!wm.rows[0]?.is_worldmaster && worldOwner.rows[0]?.creator_id !== userId) {
      res.status(403).json({ success: false, message: 'Only WorldMasters can edit quests' });
      return;
    }

    const { name, description, objectives, rewards, lore_reveals, status } = req.body;

    const result = await query(
      `UPDATE quests SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        objectives = COALESCE($3, objectives),
        rewards = COALESCE($4, rewards),
        lore_reveals = COALESCE($5, lore_reveals),
        status = COALESCE($6, status)
       WHERE id = $7
       RETURNING *`,
      [
        name,
        description,
        objectives ? JSON.stringify(objectives) : null,
        rewards ? JSON.stringify(rewards) : null,
        lore_reveals,
        status,
        req.params.id,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Update quest error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
