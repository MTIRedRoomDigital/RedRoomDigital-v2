import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';

/**
 * JWT Authentication Middleware
 *
 * HOW IT WORKS:
 * 1. Client sends a request with header: Authorization: Bearer <token>
 * 2. This middleware extracts the token
 * 3. Verifies it's valid and not expired
 * 4. Looks up the user in the database
 * 5. Attaches the user to req.user so routes can use it
 *
 * If anything fails, it returns 401 Unauthorized.
 */

// Extend Express Request to include our user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    subscription: string;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as {
      userId: string;
    };

    // Get user from database
    const result = await query(
      'SELECT id, username, email, role, subscription FROM users WHERE id = $1 AND is_banned = false',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'User not found or banned' });
      return;
    }

    // Attach user to request
    req.user = result.rows[0];
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ success: false, message: 'Token expired' });
      return;
    }
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

/**
 * Optional Authentication Middleware
 *
 * Like authenticate(), but doesn't reject requests without a token.
 * If a valid token is present, attaches req.user. Otherwise leaves req.user undefined
 * and lets the route decide whether the anonymous request is allowed.
 *
 * Use this for endpoints that have public (read-only) and private modes —
 * e.g. viewing a conversation that may be marked `is_public`.
 */
export async function optionalAuthenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as {
      userId: string;
    };

    const result = await query(
      'SELECT id, username, email, role, subscription FROM users WHERE id = $1 AND is_banned = false',
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      req.user = result.rows[0];
    }
    next();
  } catch {
    // Bad / expired token — treat as anonymous rather than rejecting
    next();
  }
}

/**
 * Subscription Check Middleware
 *
 * Use after authenticate() to ensure user has required subscription tier.
 * Example: router.post('/worlds', authenticate, requireSubscription('premium'), createWorld);
 */
export function requireSubscription(minTier: 'free' | 'premium' | 'ultimate') {
  const tierLevel = { free: 0, premium: 1, ultimate: 2 };

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    const userLevel = tierLevel[req.user.subscription as keyof typeof tierLevel] || 0;
    const requiredLevel = tierLevel[minTier];

    if (userLevel < requiredLevel) {
      res.status(403).json({
        success: false,
        message: `This feature requires a ${minTier} subscription`,
        requiredTier: minTier,
        currentTier: req.user.subscription,
      });
      return;
    }

    next();
  };
}
