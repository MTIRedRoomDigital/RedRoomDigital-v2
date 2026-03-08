import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/notifications
 * Get user's notifications (newest first)
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unread === 'true';

    const where = unreadOnly
      ? 'WHERE user_id = $1 AND is_read = FALSE'
      : 'WHERE user_id = $1';

    const result = await query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $2`,
      [req.user!.id, limit]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user!.id]
    );

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        unreadCount: parseInt(countResult.rows[0].count),
      },
    });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Quick check for unread notification count (for badge)
 */
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user!.id]
    );
    res.json({ success: true, data: { count: parseInt(result.rows[0].count) } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch count' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user!.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
});

export { router as notificationRouter };
