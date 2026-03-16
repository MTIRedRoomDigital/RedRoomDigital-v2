import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getUserStatus } from '../services/presence';

export const userRouter = Router();

/**
 * GET /api/users/profile
 * Get current user's profile with their characters
 */
userRouter.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await query(
      `SELECT id, username, email, avatar_url, bio, role, subscription,
              kayfabe_strikes, created_at
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
         WHERE c.is_public = TRUE AND (c.name ILIKE $1 OR c.description ILIKE $1)
         ORDER BY c.chat_count DESC LIMIT 10`,
        [searchTerm]
      ),
      query(
        `SELECT w.id, w.name, w.description, w.setting, u.username AS creator_name
         FROM worlds w JOIN users u ON w.creator_id = u.id
         WHERE w.is_public = TRUE AND (w.name ILIKE $1 OR w.description ILIKE $1)
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
      'SELECT * FROM characters WHERE creator_id = $1 ORDER BY created_at DESC',
      [req.user!.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
