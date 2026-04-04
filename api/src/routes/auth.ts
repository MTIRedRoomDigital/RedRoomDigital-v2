import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendPasswordResetEmail, sendVerificationEmail } from '../lib/email';

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

    // Create user (email_verified defaults to false)
    const result = await query(
      `INSERT INTO users (username, email, password_hash, email_verified)
       VALUES ($1, $2, $3, false)
       RETURNING id, username, email, role, subscription, avatar_url, created_at, email_verified`,
      [username, email.toLowerCase(), passwordHash]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: 604800 }
    );

    // Send verification email (don't block registration if email fails)
    try {
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await query(
        `INSERT INTO email_verification_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [user.id, verifyToken]
      );
      await sendVerificationEmail(email.toLowerCase(), verifyToken);
    } catch (emailErr: any) {
      console.error('Verification email failed:', emailErr.message);
    }

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

    // OAuth-only users don't have a password — they must log in via their social provider
    if (!user.password_hash) {
      const provider = user.oauth_provider || 'social';
      res.status(401).json({
        success: false,
        message: `This account uses ${provider.charAt(0).toUpperCase() + provider.slice(1)} login. Please use the "Continue with ${provider.charAt(0).toUpperCase() + provider.slice(1)}" button instead.`,
      });
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
      { expiresIn: 604800 }
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

// ═══════════════════════════════════════════════════════════════
// PASSWORD RESET
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auth/forgot-password
 * Request a password reset email
 */
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    // Always return success to prevent email enumeration attacks
    const user = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (user.rows.length === 0) {
      res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
      return;
    }

    // Invalidate any existing tokens for this user
    await query('UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false', [user.rows[0].id]);

    // Create new token (expires in 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.rows[0].id, token]
    );

    await sendPasswordResetEmail(email.toLowerCase(), token);
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error: any) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/reset-password
 * Set a new password using a reset token
 */
authRouter.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    // Find valid token
    const result = await query(
      `SELECT * FROM password_reset_tokens
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset link. Please request a new one.' });
      return;
    }

    const resetToken = result.rows[0];

    // Update password
    const passwordHash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetToken.user_id]);

    // Mark token as used
    await query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

    res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (error: any) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// EMAIL VERIFICATION
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auth/verify-email
 * Verify email address using token from email link
 */
authRouter.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, message: 'Token is required' });
      return;
    }

    const result = await query(
      `SELECT * FROM email_verification_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid or expired verification link.' });
      return;
    }

    const verifyToken = result.rows[0];

    // Mark user as verified
    await query('UPDATE users SET email_verified = true WHERE id = $1', [verifyToken.user_id]);

    // Delete used token
    await query('DELETE FROM email_verification_tokens WHERE id = $1', [verifyToken.id]);

    res.json({ success: true, message: 'Email verified successfully!' });
  } catch (error: any) {
    console.error('Verify email error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email (requires auth)
 */
authRouter.post('/resend-verification', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await query('SELECT id, email, email_verified FROM users WHERE id = $1', [req.user!.id]);
    if (user.rows[0].email_verified) {
      res.json({ success: true, message: 'Email is already verified.' });
      return;
    }

    // Delete old tokens
    await query('DELETE FROM email_verification_tokens WHERE user_id = $1', [req.user!.id]);

    // Create new token
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [req.user!.id, token]
    );

    await sendVerificationEmail(user.rows[0].email, token);
    res.json({ success: true, message: 'Verification email sent.' });
  } catch (error: any) {
    console.error('Resend verification error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// OAUTH: Google & Facebook
// ═══════════════════════════════════════════════════════════════

/**
 * HOW OAUTH WORKS (for the non-developer):
 *
 * 1. User clicks "Continue with Google" on our login page
 * 2. We redirect them to Google's login page (with our app ID)
 * 3. User logs in with Google and approves our app
 * 4. Google redirects back to our /callback URL with a temporary code
 * 5. We exchange that code for the user's Google profile (name, email, avatar)
 * 6. We create a new account (or find existing one) and log them in with JWT
 * 7. User lands back on our site, logged in — no password needed!
 *
 * Same flow for Facebook, just different URLs and API endpoints.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper: find or create a user from OAuth profile
async function findOrCreateOAuthUser(provider: string, oauthId: string, email: string, name: string, avatarUrl: string | null) {
  // 1. Check if this exact OAuth account already exists
  const existing = await query(
    'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
    [provider, oauthId]
  );

  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    if (user.is_banned) throw new Error('Account is banned');
    await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);
    return user;
  }

  // 2. Check if a user with this email already exists (link accounts)
  if (email) {
    const emailUser = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (emailUser.rows.length > 0) {
      const user = emailUser.rows[0];
      if (user.is_banned) throw new Error('Account is banned');
      // Link the OAuth account to the existing user
      await query(
        'UPDATE users SET oauth_provider = $1, oauth_id = $2, last_seen_at = NOW() WHERE id = $3',
        [provider, oauthId, user.id]
      );
      return user;
    }
  }

  // 3. Create a new user — no password needed for OAuth
  // Generate a unique username from their name
  let username = name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20) || 'user';
  const usernameCheck = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (usernameCheck.rows.length > 0) {
    username = `${username}${Math.floor(Math.random() * 9999)}`;
  }

  const result = await query(
    `INSERT INTO users (username, email, oauth_provider, oauth_id, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [username, email?.toLowerCase() || `${provider}_${oauthId}@oauth.local`, provider, oauthId, avatarUrl]
  );

  return result.rows[0];
}

// Helper: generate JWT and redirect to frontend
function oauthRedirect(res: Response, user: any) {
  const token = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: 604800 }
  );
  res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
}

// ── GOOGLE ────────────────────────────────────────────────────

/**
 * GET /api/auth/google
 * Redirect to Google's OAuth consent screen
 */
authRouter.get('/google', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ success: false, message: 'Google OAuth not configured' });
    return;
  }

  const redirectUri = `${process.env.API_URL || 'http://localhost:4000'}/api/auth/google/callback`;
  const scope = 'openid email profile';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=select_account`;

  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 * Handle Google's redirect with the auth code
 */
authRouter.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code) {
      res.redirect(`${FRONTEND_URL}/login?error=no_code`);
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.API_URL || 'http://localhost:4000'}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Google token exchange failed:', tokenData);
      res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
      return;
    }

    // Get user profile from Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile: any = await profileRes.json();
    if (!profile.id) {
      res.redirect(`${FRONTEND_URL}/login?error=profile_failed`);
      return;
    }

    // Find or create user
    const user = await findOrCreateOAuthUser(
      'google',
      profile.id,
      profile.email,
      profile.name || profile.email?.split('@')[0] || 'User',
      profile.picture || null
    );

    oauthRedirect(res, user);
  } catch (error: any) {
    console.error('Google OAuth error:', error.message);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`);
  }
});

// ── FACEBOOK ──────────────────────────────────────────────────

/**
 * GET /api/auth/facebook
 * Redirect to Facebook's OAuth consent screen
 */
authRouter.get('/facebook', (req: Request, res: Response) => {
  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) {
    res.status(500).json({ success: false, message: 'Facebook OAuth not configured' });
    return;
  }

  const redirectUri = `${process.env.API_URL || 'http://localhost:4000'}/api/auth/facebook/callback`;
  const scope = 'email,public_profile';
  const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;

  res.redirect(url);
});

/**
 * GET /api/auth/facebook/callback
 * Handle Facebook's redirect with the auth code
 */
authRouter.get('/facebook/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code) {
      res.redirect(`${FRONTEND_URL}/login?error=no_code`);
      return;
    }

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.API_URL || 'http://localhost:4000'}/api/auth/facebook/callback`;

    // Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );

    const tokenData: any = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Facebook token exchange failed:', tokenData);
      res.redirect(`${FRONTEND_URL}/login?error=token_failed`);
      return;
    }

    // Get user profile from Facebook
    const profileRes = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture.type(large)&access_token=${tokenData.access_token}`
    );

    const profile: any = await profileRes.json();
    if (!profile.id) {
      res.redirect(`${FRONTEND_URL}/login?error=profile_failed`);
      return;
    }

    // Find or create user
    const user = await findOrCreateOAuthUser(
      'facebook',
      profile.id,
      profile.email,
      profile.name || 'User',
      profile.picture?.data?.url || null
    );

    oauthRedirect(res, user);
  } catch (error: any) {
    console.error('Facebook OAuth error:', error.message);
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`);
  }
});

// ═══════════════════════════════════════════════════════════════

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
