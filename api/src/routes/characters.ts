import { Router, Request, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth';
import { learnSpeakingStyle, resetLearnedSpeakingStyle, previewVoice } from '../services/ai';

export const characterRouter = Router();

// Character limits per subscription tier
const CHARACTER_LIMITS = { free: 3, premium: 10, ultimate: Infinity };

/**
 * GET /api/characters
 * Browse/discover characters (public, paginated, with search)
 */
characterRouter.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = (page - 1) * limit;
    const search = req.query.search as string;

    let whereClause = 'WHERE c.is_public = true';
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT c.id, c.name, c.avatar_url, c.description, c.tags, c.chat_count, c.rating,
              c.world_id, c.created_at, c.like_count, c.dislike_count,
              (c.learned_speaking_style IS NOT NULL) AS has_learned_voice,
              (c.personality->>'speaking_style' IS NOT NULL) AS has_preset_voice,
              u.id AS creator_id, u.username AS creator_name,
              w.name AS world_name
       FROM characters c
       JOIN users u ON c.creator_id = u.id
       LEFT JOIN worlds w ON c.world_id = w.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM characters c ${whereClause}`,
      search ? [`%${search}%`] : []
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (error: any) {
    console.error('Get characters error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/characters/:id
 * Get a single character with full details
 */
characterRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, u.username AS creator_name, w.name AS world_name
       FROM characters c
       JOIN users u ON c.creator_id = u.id
       LEFT JOIN worlds w ON c.world_id = w.id
       WHERE c.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Character not found' });
      return;
    }

    // Get relationships
    const relationships = await query(
      `SELECT cr.*, rc.name AS related_character_name, rc.avatar_url AS related_character_avatar
       FROM character_relationships cr
       JOIN characters rc ON cr.related_character_id = rc.id
       WHERE cr.character_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        relationships: relationships.rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/characters
 * Create a new character (requires auth, enforces tier limits)
 */
characterRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tier = req.user!.subscription as keyof typeof CHARACTER_LIMITS;

    // Check character limit
    const countResult = await query(
      'SELECT COUNT(*) FROM characters WHERE creator_id = $1',
      [userId]
    );
    const currentCount = parseInt(countResult.rows[0].count);
    const limit = CHARACTER_LIMITS[tier];

    if (currentCount >= limit) {
      res.status(403).json({
        success: false,
        message: `You've reached your character limit (${limit}). Upgrade your subscription to create more.`,
        currentCount,
        limit,
      });
      return;
    }

    const {
      name, description, avatar_url, personality, background,
      likes, dislikes, world_id, is_public, is_ai_enabled, tags,
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Character name is required' });
      return;
    }

    const result = await query(
      `INSERT INTO characters
        (creator_id, name, description, avatar_url, personality, background,
         likes, dislikes, world_id, is_public, is_ai_enabled, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        userId, name, description || null, avatar_url || null,
        JSON.stringify(personality || {}), background || null,
        JSON.stringify(likes || []), JSON.stringify(dislikes || []),
        world_id || null, is_public !== false, is_ai_enabled !== false,
        tags || [],
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Create character error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PUT /api/characters/:id
 * Update a character (only owner can update)
 */
characterRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Verify ownership
    const existing = await query(
      'SELECT creator_id FROM characters WHERE id = $1',
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Character not found' });
      return;
    }

    if (existing.rows[0].creator_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'You can only edit your own characters' });
      return;
    }

    const {
      name, description, avatar_url, personality, background,
      likes, dislikes, world_id, is_public, is_ai_enabled, tags,
    } = req.body;

    const result = await query(
      `UPDATE characters SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        avatar_url = COALESCE($3, avatar_url),
        personality = COALESCE($4, personality),
        background = COALESCE($5, background),
        likes = COALESCE($6, likes),
        dislikes = COALESCE($7, dislikes),
        world_id = $8,
        is_public = COALESCE($9, is_public),
        is_ai_enabled = COALESCE($10, is_ai_enabled),
        tags = COALESCE($11, tags)
       WHERE id = $12
       RETURNING *`,
      [
        name, description, avatar_url,
        personality ? JSON.stringify(personality) : null,
        background,
        likes ? JSON.stringify(likes) : null,
        dislikes ? JSON.stringify(dislikes) : null,
        world_id, is_public, is_ai_enabled, tags,
        req.params.id,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/characters/:id
 * Delete a character (only owner can delete)
 */
characterRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM characters WHERE id = $1 AND creator_id = $2 RETURNING id',
      [req.params.id, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Character not found or not yours' });
      return;
    }

    res.json({ success: true, message: 'Character deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/characters/:id/vote
 * Like (1) or dislike (-1) a character. Sending the same vote again removes it.
 * Body: { vote: 1 | -1 }
 */
characterRouter.post('/:id/vote', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const characterId = req.params.id;
    const { vote } = req.body;

    if (vote !== 1 && vote !== -1) {
      res.status(400).json({ success: false, message: 'Vote must be 1 (like) or -1 (dislike)' });
      return;
    }

    // Check character exists
    const char = await query('SELECT id, creator_id FROM characters WHERE id = $1', [characterId]);
    if (char.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Character not found' });
      return;
    }

    // Can't vote on your own character
    if (char.rows[0].creator_id === userId) {
      res.status(400).json({ success: false, message: 'You cannot vote on your own character' });
      return;
    }

    // Check existing vote
    const existing = await query(
      'SELECT id, vote FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
      [userId, 'character', characterId]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].vote === vote) {
        // Same vote again — remove it (toggle off)
        await query('DELETE FROM votes WHERE id = $1', [existing.rows[0].id]);
      } else {
        // Change vote
        await query('UPDATE votes SET vote = $1 WHERE id = $2', [vote, existing.rows[0].id]);
      }
    } else {
      // New vote
      await query(
        'INSERT INTO votes (user_id, target_type, target_id, vote) VALUES ($1, $2, $3, $4)',
        [userId, 'character', characterId, vote]
      );
    }

    // Recount
    const likes = await query(
      "SELECT COUNT(*) FROM votes WHERE target_type = 'character' AND target_id = $1 AND vote = 1",
      [characterId]
    );
    const dislikes = await query(
      "SELECT COUNT(*) FROM votes WHERE target_type = 'character' AND target_id = $1 AND vote = -1",
      [characterId]
    );

    await query(
      'UPDATE characters SET like_count = $1, dislike_count = $2 WHERE id = $3',
      [parseInt(likes.rows[0].count), parseInt(dislikes.rows[0].count), characterId]
    );

    // Return the user's current vote
    const currentVote = await query(
      'SELECT vote FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
      [userId, 'character', characterId]
    );

    res.json({
      success: true,
      data: {
        like_count: parseInt(likes.rows[0].count),
        dislike_count: parseInt(dislikes.rows[0].count),
        user_vote: currentVote.rows[0]?.vote || null,
      },
    });
  } catch (error: any) {
    console.error('Vote error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/characters/:id/vote
 * Get the current user's vote on a character (if any)
 */
characterRouter.get('/:id/vote', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT vote FROM votes WHERE user_id = $1 AND target_type = $2 AND target_id = $3',
      [req.user!.id, 'character', req.params.id]
    );
    res.json({ success: true, data: { user_vote: result.rows[0]?.vote || null } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/characters/preview-voice
 * Pipe a canned scenario through the AI so the user can hear how their character will
 * sound before saving. Two modes, both auth-gated:
 *   - { character_id, style, scenario } — use a saved character's full context and
 *     override just the speaking-style text with what the user is currently typing.
 *     Owner-only (light info-leak guard even though the only "leaked" data is AI output).
 *   - { style, scenario, name?, description? } — create-flow preview before the
 *     character is saved. No character_id, we stitch a minimal prompt from the name/desc.
 * Body: { character_id?: string | null, style?: string | null, scenario: string,
 *         name?: string, description?: string }
 */
characterRouter.post('/preview-voice', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { character_id, style, scenario, name, description } = req.body || {};
    if (!scenario || typeof scenario !== 'string' || !scenario.trim()) {
      res.status(400).json({ success: false, message: 'scenario is required' });
      return;
    }

    if (character_id) {
      const owner = await query('SELECT creator_id FROM characters WHERE id = $1', [character_id]);
      if (owner.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Character not found' });
        return;
      }
      if (owner.rows[0].creator_id !== req.user!.id) {
        res.status(403).json({ success: false, message: 'You can only preview your own characters' });
        return;
      }
    }

    const { reply } = await previewVoice({
      characterId: character_id || null,
      styleOverride: style || null,
      scenario: scenario.trim(),
      fallbackName: name,
      fallbackDescription: description,
    });

    res.json({ success: true, data: { reply } });
  } catch (error: any) {
    console.error('Preview-voice error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

/**
 * POST /api/characters/:id/learn-style
 * Manually trigger speaking-style learning for a character. Owner-only.
 * Normally this runs automatically after every canon snapshot; this route lets
 * owners force a refresh (e.g. after a big chat arc) or bootstrap the first time.
 */
characterRouter.post('/:id/learn-style', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const charId = req.params.id as string;
    const ownerCheck = await query('SELECT creator_id FROM characters WHERE id = $1', [charId]);
    if (ownerCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Character not found' });
      return;
    }
    if (ownerCheck.rows[0].creator_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Only the character owner can trigger this' });
      return;
    }

    const result = await learnSpeakingStyle(charId, { force: true });
    if (!result.updated) {
      res.json({
        success: true,
        updated: false,
        reason: result.reason,
        message:
          result.reason?.startsWith('not-enough-samples')
            ? "Not enough messages yet — play this character in a few chats first."
            : 'No new style data to learn from yet.',
      });
      return;
    }

    res.json({
      success: true,
      updated: true,
      sample_count: result.sampleCount,
      message: `Learned voice updated from ${result.sampleCount} messages.`,
    });
  } catch (error: any) {
    console.error('Learn-style error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/characters/:id/reset-style
 * Clear a character's learned speaking style. Falls back to personality.speaking_style
 * (the preset) until the learner re-runs. Owner-only.
 */
characterRouter.post('/:id/reset-style', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const charId = req.params.id as string;
    const ownerCheck = await query('SELECT creator_id FROM characters WHERE id = $1', [charId]);
    if (ownerCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Character not found' });
      return;
    }
    if (ownerCheck.rows[0].creator_id !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Only the character owner can reset this' });
      return;
    }

    await resetLearnedSpeakingStyle(charId);
    res.json({ success: true, message: 'Learned voice cleared. Back to your preset.' });
  } catch (error: any) {
    console.error('Reset-style error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
