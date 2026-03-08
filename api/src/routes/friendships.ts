import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/friends
 * Get user's friends list (accepted friendships)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await query(
      `SELECT f.id AS friendship_id, f.created_at AS friends_since,
              CASE
                WHEN f.requester_id = $1 THEN f.addressee_id
                ELSE f.requester_id
              END AS friend_id,
              u.username, u.avatar_url, u.bio, u.subscription, u.last_seen_at
       FROM friendships f
       JOIN users u ON u.id = CASE
         WHEN f.requester_id = $1 THEN f.addressee_id
         ELSE f.requester_id
       END
       WHERE (f.requester_id = $1 OR f.addressee_id = $1)
         AND f.status = 'accepted'
       ORDER BY u.username ASC`,
      [userId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Friends list error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch friends' });
  }
});

/**
 * GET /api/friends/pending
 * Get pending friend requests (incoming)
 */
router.get('/pending', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT f.id AS friendship_id, f.created_at,
              u.id AS user_id, u.username, u.avatar_url, u.bio, u.subscription
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user!.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch pending requests' });
  }
});

/**
 * POST /api/friends/request/:userId
 * Send a friend request
 */
router.post('/request/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = req.params.userId;
    const myId = req.user!.id;

    if (targetId === myId) {
      res.status(400).json({ success: false, message: "You can't friend yourself" });
      return;
    }

    // Check existing friendship
    const existing = await query(
      `SELECT id, status FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [myId, targetId]
    );

    if (existing.rows.length > 0) {
      const status = existing.rows[0].status;
      if (status === 'accepted') {
        res.status(400).json({ success: false, message: 'Already friends' });
        return;
      }
      if (status === 'pending') {
        res.status(400).json({ success: false, message: 'Friend request already pending' });
        return;
      }
      if (status === 'blocked') {
        res.status(400).json({ success: false, message: 'Cannot send request' });
        return;
      }
    }

    await query(
      `INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)`,
      [myId, targetId]
    );

    // Create notification for the target user
    await query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'friend_request', 'New Friend Request', $2, $3)`,
      [targetId, `${req.user!.username} sent you a friend request`, JSON.stringify({ fromUserId: myId })]
    );

    res.status(201).json({ success: true, message: 'Friend request sent' });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ success: false, message: 'Failed to send request' });
  }
});

/**
 * PUT /api/friends/:friendshipId/accept
 * Accept a friend request
 */
router.put('/:friendshipId/accept', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE friendships SET status = 'accepted', updated_at = NOW()
       WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
       RETURNING requester_id`,
      [req.params.friendshipId, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    // Notify requester
    await query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'friend_request', 'Friend Request Accepted', $2, $3)`,
      [result.rows[0].requester_id, `${req.user!.username} accepted your friend request!`,
       JSON.stringify({ fromUserId: req.user!.id })]
    );

    res.json({ success: true, message: 'Friend request accepted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to accept request' });
  }
});

/**
 * PUT /api/friends/:friendshipId/decline
 * Decline/remove a friendship
 */
router.put('/:friendshipId/decline', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      `DELETE FROM friendships WHERE id = $1
       AND (requester_id = $2 OR addressee_id = $2)`,
      [req.params.friendshipId, req.user!.id]
    );
    res.json({ success: true, message: 'Friendship removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove friendship' });
  }
});

/**
 * GET /api/friends/status/:userId
 * Check friendship status with another user
 */
router.get('/status/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id AS friendship_id, status, requester_id, addressee_id
       FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)`,
      [req.user!.id, req.params.userId]
    );

    if (result.rows.length === 0) {
      res.json({ success: true, data: { status: 'none' } });
      return;
    }

    const f = result.rows[0];
    res.json({
      success: true,
      data: {
        friendshipId: f.friendship_id,
        status: f.status,
        isSender: f.requester_id === req.user!.id,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to check status' });
  }
});

export { router as friendshipRouter };
