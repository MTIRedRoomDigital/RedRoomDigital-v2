import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/forum/categories
 * List all forum categories with post counts
 */
router.get('/categories', async (_req, res: Response) => {
  try {
    const result = await query(
      `SELECT c.*, COUNT(p.id) AS post_count
       FROM forum_categories c
       LEFT JOIN forum_posts p ON c.id = p.category_id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Forum categories error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/forum/categories/:id/posts
 * List posts in a category with pagination
 */
router.get('/categories/:id/posts', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get category info
    const catResult = await query('SELECT * FROM forum_categories WHERE id = $1', [id]);
    if (catResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    // Get posts with author info
    const postsResult = await query(
      `SELECT p.*, u.username AS author_name, u.avatar_url AS author_avatar,
              u.subscription AS author_subscription
       FROM forum_posts p
       JOIN users u ON p.author_id = u.id
       WHERE p.category_id = $1
       ORDER BY p.is_pinned DESC, p.updated_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) FROM forum_posts WHERE category_id = $1',
      [id]
    );

    res.json({
      success: true,
      data: {
        category: catResult.rows[0],
        posts: postsResult.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    console.error('Forum posts error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
});

/**
 * GET /api/forum/posts/:id
 * Get a single post with replies
 */
router.get('/posts/:id', async (req, res: Response) => {
  try {
    const { id } = req.params;

    // Increment view count
    await query('UPDATE forum_posts SET view_count = view_count + 1 WHERE id = $1', [id]);

    // Get post with author
    const postResult = await query(
      `SELECT p.*, u.username AS author_name, u.avatar_url AS author_avatar,
              u.subscription AS author_subscription, c.name AS category_name, c.id AS category_id
       FROM forum_posts p
       JOIN users u ON p.author_id = u.id
       JOIN forum_categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    if (postResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    // Get replies with authors
    const repliesResult = await query(
      `SELECT r.*, u.username AS author_name, u.avatar_url AS author_avatar,
              u.subscription AS author_subscription
       FROM forum_replies r
       JOIN users u ON r.author_id = u.id
       WHERE r.post_id = $1
       ORDER BY r.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...postResult.rows[0],
        replies: repliesResult.rows,
      },
    });
  } catch (err) {
    console.error('Forum post error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
});

/**
 * POST /api/forum/categories/:id/posts
 * Create a new forum post
 */
router.post('/categories/:id/posts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;
    const categoryId = req.params.id;

    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ success: false, message: 'Title and content are required' });
      return;
    }

    // Verify category exists
    const cat = await query('SELECT id FROM forum_categories WHERE id = $1', [categoryId]);
    if (cat.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    const result = await query(
      `INSERT INTO forum_posts (category_id, author_id, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [categoryId, req.user!.id, title.trim(), content.trim()]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
});

/**
 * POST /api/forum/posts/:id/replies
 * Reply to a forum post
 */
router.post('/posts/:id/replies', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { content, parent_reply_id } = req.body;
    const postId = req.params.id;

    if (!content?.trim()) {
      res.status(400).json({ success: false, message: 'Content is required' });
      return;
    }

    // Verify post exists
    const post = await query('SELECT id FROM forum_posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }

    const result = await query(
      `INSERT INTO forum_replies (post_id, author_id, content, parent_reply_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, req.user!.id, content.trim(), parent_reply_id || null]
    );

    // Increment reply count
    await query('UPDATE forum_posts SET reply_count = reply_count + 1, updated_at = NOW() WHERE id = $1', [postId]);

    // Get reply with author info
    const full = await query(
      `SELECT r.*, u.username AS author_name, u.avatar_url AS author_avatar,
              u.subscription AS author_subscription
       FROM forum_replies r JOIN users u ON r.author_id = u.id
       WHERE r.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({ success: true, data: full.rows[0] });
  } catch (err) {
    console.error('Create reply error:', err);
    res.status(500).json({ success: false, message: 'Failed to create reply' });
  }
});

/**
 * DELETE /api/forum/posts/:id
 * Delete a post (author or admin only)
 */
router.delete('/posts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const post = await query('SELECT author_id FROM forum_posts WHERE id = $1', [req.params.id]);
    if (post.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Post not found' });
      return;
    }
    if (post.rows[0].author_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }
    await query('DELETE FROM forum_posts WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
});

export { router as forumRouter };
