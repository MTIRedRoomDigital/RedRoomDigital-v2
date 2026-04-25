import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getUserStatus } from '../services/presence';
import { recalcUserContradictions } from './conversations';

export const userRouter = Router();

/**
 * GET /api/users/profile
 * Get current user's profile with their characters
 */
userRouter.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await query(
      `SELECT id, username, email, avatar_url, bio, role, subscription,
              kayfabe_strikes, contradiction_score, contradictions, contradictions_updated_at, created_at
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    const characters = await query(
      'SELECT * FROM characters WHERE creator_id = $1 ORDER BY created_at DESC',
      [req.user!.id]
    );

    const worlds = await query(
      'SELECT * FROM worlds WHERE creator_id = $1 ORDER BY created_at DESC',
      [req.user!.id]
    );

    res.json({
      success: true,
      data: {
        ...user.rows[0],
        characters: characters.rows,
        worlds: worlds.rows,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
userRouter.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { username, bio, avatar_url } = req.body;

    const result = await query(
      `UPDATE users SET
        username = COALESCE($1, username),
        bio = COALESCE($2, bio),
        avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4
       RETURNING id, username, email, avatar_url, bio, role, subscription`,
      [username, bio, avatar_url, req.user!.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ success: false, message: 'Username already taken' });
      return;
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * PUT /api/users/password
 * Change user password
 */
userRouter.put('/password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, message: 'Current and new passwords are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.id]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/users/search
 * Search users, characters, and worlds
 */
userRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 2) {
      res.json({ success: true, data: { users: [], characters: [], worlds: [] } });
      return;
    }

    const searchTerm = `%${q}%`;

    const [users, characters, worlds] = await Promise.all([
      query(
        `SELECT id, username, avatar_url, subscription
         FROM users WHERE username ILIKE $1
         ORDER BY username LIMIT 10`,
        [searchTerm]
      ),
      query(
        `SELECT c.id, c.name, c.description, c.avatar_url, c.tags, u.username AS creator_name
         FROM characters c JOIN users u ON c.creator_id = u.id
         WHERE c.is_public = TRUE AND c.is_nsfw = FALSE AND (c.name ILIKE $1 OR c.description ILIKE $1)
         ORDER BY c.chat_count DESC LIMIT 10`,
        [searchTerm]
      ),
      query(
        `SELECT w.id, w.name, w.description, w.setting, u.username AS creator_name
         FROM worlds w JOIN users u ON w.creator_id = u.id
         WHERE w.is_public = TRUE AND w.is_nsfw = FALSE AND (w.name ILIKE $1 OR w.description ILIKE $1)
         ORDER BY w.member_count DESC LIMIT 10`,
        [searchTerm]
      ),
    ]);

    res.json({
      success: true,
      data: {
        users: users.rows,
        characters: characters.rows,
        worlds: worlds.rows,
      },
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/users/:id/presence
 * Get a user's online status (online / away / offline)
 */
userRouter.get('/:id/presence', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const status = getUserStatus(req.params.id as string);
    res.json({ success: true, data: { userId: req.params.id, status } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/users/:id/public
 * Get a public user profile (anyone can view)
 */
userRouter.get('/:id/public', async (req, res: Response) => {
  try {
    const user = await query(
      `SELECT id, username, avatar_url, bio, subscription, created_at,
              contradiction_score, contradictions, contradictions_updated_at,
              (SELECT COUNT(*) FROM characters WHERE creator_id = users.id AND is_public = TRUE) AS character_count,
              (SELECT COUNT(*) FROM worlds WHERE creator_id = users.id AND is_public = TRUE) AS world_count,
              (SELECT COUNT(*) FROM friendships
               WHERE (requester_id = users.id OR addressee_id = users.id) AND status = 'accepted') AS friend_count
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    if (user.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Get public characters
    const characters = await query(
      `SELECT id, name, avatar_url, description, tags, chat_count
       FROM characters WHERE creator_id = $1 AND is_public = TRUE
       ORDER BY created_at DESC LIMIT 6`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...user.rows[0],
        characters: characters.rows,
      },
    });
  } catch (err) {
    console.error('Public profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/users/characters
 * Get current user's characters
 */
userRouter.get('/characters', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, w.name AS world_name
       FROM characters c
       LEFT JOIN worlds w ON c.world_id = w.id
       WHERE c.creator_id = $1
       ORDER BY c.created_at DESC`,
      [req.user!.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/users/recalc-contradictions
 * Manually trigger a contradiction recalculation for the current user.
 * The user score is a cheap weighted aggregate of their characters — no AI cost —
 * so there's no cooldown. Useful after editing a character's canon.
 */
userRouter.post('/recalc-contradictions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await recalcUserContradictions(req.user!.id);
    res.json({ success: true, message: 'Recalculated' });
  } catch (error: any) {
    console.error('User recalc error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== BLOCK SYSTEM ====================

/**
 * POST /api/users/:id/block
 * Block a user. Prevents them from chatting with you or viewing your characters.
 */
userRouter.post('/:id/block', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.id;

    if (blockerId === blockedId) {
      res.status(400).json({ success: false, message: 'You cannot block yourself' });
      return;
    }

    // Check user exists
    const userExists = await query('SELECT id FROM users WHERE id = $1', [blockedId]);
    if (userExists.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Check if already blocked
    const existing = await query(
      'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );

    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'User is already blocked' });
      return;
    }

    await query(
      'INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)',
      [blockerId, blockedId]
    );

    // Also remove any existing friendship
    await query(
      'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [blockerId, blockedId]
    );

    res.json({ success: true, message: 'User blocked' });
  } catch (error: any) {
    console.error('Block error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/users/:id/block
 * Unblock a user.
 */
userRouter.delete('/:id/block', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.id;

    await query(
      'DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [blockerId, blockedId]
    );

    res.json({ success: true, message: 'User unblocked' });
  } catch (error: any) {
    console.error('Unblock error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/users/blocked
 * Get list of users the current user has blocked.
 */
userRouter.get('/blocked', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT ub.id, ub.blocked_id, ub.created_at,
              u.username, u.avatar_url
       FROM user_blocks ub
       JOIN users u ON ub.blocked_id = u.id
       WHERE ub.blocker_id = $1
       ORDER BY ub.created_at DESC`,
      [req.user!.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/users/:id/block-status
 * Check if a user is blocked by or has blocked the current user.
 */
userRouter.get('/:id/block-status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const otherId = req.params.id;

    const blocked = await query(
      'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [userId, otherId]
    );

    const blockedBy = await query(
      'SELECT id FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2',
      [otherId, userId]
    );

    res.json({
      success: true,
      data: {
        is_blocked: blocked.rows.length > 0,
        is_blocked_by: blockedBy.rows.length > 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
