import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Create a new user account
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      res.status(400).json({ success: false, message: 'Username, email, and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    // Check if user already exists
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Email or username already taken' });
      return;
    }

    // Hash password (bcrypt adds salt automatically)
    // The "12" is the salt rounds - higher = more secure but slower
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, role, subscription, avatar_url, created_at`,
      [username, email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string }
    );

    res.status(201).json({
      success: true,
      data: { user, token },
    });
  } catch (error: any) {
    console.error('Register error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/login
 * Log in with email and password
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    // Find user by email
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];

    // Check if banned
    if (user.is_banned) {
      res.status(403).json({ success: false, message: 'Account is banned', reason: user.ban_reason });
      return;
    }

    // Compare password with hash
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    // Update last seen
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string }
    );

    // Don't send password hash back
    const { password_hash, ...safeUser } = user;

    res.json({
      success: true,
      data: { user: safeUser, token },
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/logout
 * Log out (client-side token removal, server updates last_seen)
 */
authRouter.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [req.user!.id]);
    res.json({ success: true, message: 'Logged out' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
/**
 * GET /api/auth/stats
 * Public platform stats for the landing page
 */
authRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [usersResult, charsResult, worldsResult] = await Promise.all([
      query('SELECT COUNT(*) FROM users'),
      query('SELECT COUNT(*) FROM characters'),
      query('SELECT COUNT(*) FROM worlds'),
    ]);
    res.json({
      success: true,
      data: {
        users: parseInt(usersResult.rows[0].count),
        characters: parseInt(charsResult.rows[0].count),
        worlds: parseInt(worldsResult.rows[0].count),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, username, email, avatar_url, bio, role, subscription,
              kayfabe_strikes, created_at
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
