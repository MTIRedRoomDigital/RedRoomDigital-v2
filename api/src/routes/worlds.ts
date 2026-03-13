import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth';

export const worldRouter = Router();

// World limits per subscription tier
const WORLD_LIMITS = { free: 0, premium: 1, ultimate: Infinity };

/**
 * GET /api/worlds
 * Browse public worlds with optional search and pagination
 */
worldRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 50);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;

    let whereClause = 'WHERE w.is_public = true';
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (w.name ILIKE $${params.length} OR w.description ILIKE $${params.length} OR w.setting ILIKE $${params.length})`;
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM worlds w ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await query(
      `SELECT w.*, u.username AS creator_name,
              (SELECT COUNT(*) FROM characters c WHERE c.world_id = w.id) AS character_count
       FROM worlds w
       JOIN users u ON w.creator_id = u.id
       ${whereClause}
       ORDER BY w.member_count DESC, w.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Browse worlds error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/worlds/:id
 * Get world details including lore, campaigns, members
 */
worldRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT w.*, u.username AS creator_name
       FROM worlds w
       JOIN users u ON w.creator_id = u.id
       WHERE w.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'World not found' });
      return;
    }

    // Get campaigns in this world
    const campaigns = await query(
      'SELECT * FROM campaigns WHERE world_id = $1 ORDER BY sort_order',
      [req.params.id]
    );

    // Get character count
    const charCount = await query(
      'SELECT COUNT(*) FROM characters WHERE world_id = $1',
      [req.params.id]
    );

    // Get members with user info
    const members = await query(
      `SELECT wm.*, u.username, u.avatar_url
       FROM world_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.world_id = $1
       ORDER BY wm.is_worldmaster DESC, wm.joined_at ASC`,
      [req.params.id]
    );

    // Get characters in this world
    const characters = await query(
      `SELECT c.id, c.name, c.avatar_url, c.description, c.tags, c.chat_count,
              c.creator_id, u.username AS creator_name
       FROM characters c
       JOIN users u ON c.creator_id = u.id
       WHERE c.world_id = $1 AND c.is_public = true
       ORDER BY c.created_at DESC
       LIMIT 12`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        campaigns: campaigns.rows,
        character_count: parseInt(charCount.rows[0].count),
        members: members.rows,
        characters: characters.rows,
      },
    });
  } catch (error: any) {
    console.error('Get world error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/worlds
 * Create a new world (requires premium+, enforces tier limits)
 */
worldRouter.post('/', authenticate, requireSubscription('premium'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tier = req.user!.subscription as keyof typeof WORLD_LIMITS;

    // Check world limit
    const countResult = await query(
      'SELECT COUNT(*) FROM worlds WHERE creator_id = $1',
      [userId]
    );
    const currentCount = parseInt(countResult.rows[0].count);
    const limit = WORLD_LIMITS[tier];

    if (currentCount >= limit) {
      res.status(403).json({
        success: false,
        message: `You've reached your world limit (${limit}). Upgrade to Ultimate for unlimited worlds.`,
      });
      return;
    }

    const { name, description, lore, rules, setting, is_public, banner_url, thumbnail_url } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'World name is required' });
      return;
    }

    const result = await query(
      `INSERT INTO worlds (creator_id, name, description, lore, rules, setting, is_public, banner_url, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, name, description, lore, JSON.stringify(rules || {}), setting, is_public !== false, banner_url || null, thumbnail_url || null]
    );

    // Auto-add creator as WorldMaster
    await query(
      'INSERT INTO world_members (world_id, user_id, is_worldmaster) VALUES ($1, $2, true)',
      [result.rows[0].id, userId]
    );

    // Update member count
    await query(
      'UPDATE worlds SET member_count = 1 WHERE id = $1',
      [result.rows[0].id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Create world error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PUT /api/worlds/:id
 * Update a world (owner/WorldMaster only)
 */
worldRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const worldId = req.params.id;

    // Check ownership or WorldMaster status
    const worldResult = await query(
      'SELECT creator_id FROM worlds WHERE id = $1',
      [worldId]
    );

    if (worldResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'World not found' });
      return;
    }

    const isCreator = worldResult.rows[0].creator_id === userId;

    if (!isCreator) {
      const wmResult = await query(
        'SELECT is_worldmaster FROM world_members WHERE world_id = $1 AND user_id = $2',
        [worldId, userId]
      );
      if (!wmResult.rows[0]?.is_worldmaster) {
        res.status(403).json({ success: false, message: 'Only the world creator or WorldMasters can edit this world' });
        return;
      }
    }

    const { name, description, lore, rules, setting, is_public, banner_url, thumbnail_url } = req.body;

    const result = await query(
      `UPDATE worlds SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        lore = COALESCE($3, lore),
        rules = COALESCE($4, rules),
        setting = COALESCE($5, setting),
        is_public = COALESCE($6, is_public),
        banner_url = COALESCE($7, banner_url),
        thumbnail_url = COALESCE($8, thumbnail_url)
       WHERE id = $9
       RETURNING *`,
      [name, description, lore, rules ? JSON.stringify(rules) : null, setting, is_public, banner_url, thumbnail_url, worldId]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Update world error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/worlds/:id
 * Delete a world (owner only)
 */
worldRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      'DELETE FROM worlds WHERE id = $1 AND creator_id = $2 RETURNING id',
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'World not found or you are not the owner' });
      return;
    }

    res.json({ success: true, message: 'World deleted' });
  } catch (error: any) {
    console.error('Delete world error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/worlds/:id/join
 * Join a public world
 */
worldRouter.post('/:id/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const worldId = req.params.id;

    // Check world exists and is public
    const worldResult = await query(
      'SELECT id, is_public, max_characters, member_count FROM worlds WHERE id = $1',
      [worldId]
    );

    if (worldResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'World not found' });
      return;
    }

    if (!worldResult.rows[0].is_public) {
      res.status(403).json({ success: false, message: 'This world is private' });
      return;
    }

    // Check if already a member
    const existing = await query(
      'SELECT id FROM world_members WHERE world_id = $1 AND user_id = $2',
      [worldId, userId]
    );

    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'You are already a member of this world' });
      return;
    }

    // Join
    await query(
      'INSERT INTO world_members (world_id, user_id) VALUES ($1, $2)',
      [worldId, userId]
    );

    // Update member count
    await query(
      'UPDATE worlds SET member_count = member_count + 1 WHERE id = $1',
      [worldId]
    );

    res.json({ success: true, message: 'Joined world successfully' });
  } catch (error: any) {
    console.error('Join world error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/worlds/:id/leave
 * Leave a world (can't leave if you're the creator)
 */
worldRouter.post('/:id/leave', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const worldId = req.params.id;

    // Check if creator (can't leave your own world)
    const worldResult = await query(
      'SELECT creator_id FROM worlds WHERE id = $1',
      [worldId]
    );

    if (worldResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'World not found' });
      return;
    }

    if (worldResult.rows[0].creator_id === userId) {
      res.status(400).json({ success: false, message: 'World creators cannot leave their own world. Delete it instead.' });
      return;
    }

    const result = await query(
      'DELETE FROM world_members WHERE world_id = $1 AND user_id = $2 RETURNING id',
      [worldId, userId]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ success: false, message: 'You are not a member of this world' });
      return;
    }

    // Update member count
    await query(
      'UPDATE worlds SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1',
      [worldId]
    );

    res.json({ success: true, message: 'Left world successfully' });
  } catch (error: any) {
    console.error('Leave world error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/worlds/:id/members
 * Get members list for a world
 */
worldRouter.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT wm.user_id, wm.is_worldmaster, wm.joined_at,
              u.username, u.avatar_url
       FROM world_members wm
       JOIN users u ON wm.user_id = u.id
       WHERE wm.world_id = $1
       ORDER BY wm.is_worldmaster DESC, wm.joined_at ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    console.error('Get members error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
