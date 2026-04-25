import { Router, Response } from 'express';
import { query } from '../db/pool';
import { authenticate, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router();

/**
 * GET /api/dashboard
 * Returns all data needed for the logged-in user's dashboard homepage.
 * Single endpoint to minimize round trips.
 */
dashboardRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Run all queries in parallel
    const [
      recentChatsResult,
      friendsResult,
      notificationsResult,
      topCharsResult,
      topWorldsResult,
      topUsersResult,
      recommendedResult,
      myCharsResult,
    ] = await Promise.all([
      // 1. Recent chats (last 5 active conversations)
      query(
        `SELECT conv.id, conv.title, conv.chat_mode, conv.updated_at, conv.is_active,
                cp.character_id AS my_character_id,
                my_char.name AS my_character_name, my_char.avatar_url AS my_character_avatar
         FROM conversations conv
         JOIN conversation_participants cp ON conv.id = cp.conversation_id
         JOIN characters my_char ON cp.character_id = my_char.id
         WHERE cp.user_id = $1 AND (conv.is_test IS NULL OR conv.is_test = false)
         ORDER BY conv.updated_at DESC
         LIMIT 5`,
        [userId]
      ).then(async (result) => {
        // Get partner info for each chat
        const chats = await Promise.all(
          result.rows.map(async (conv: any) => {
            const partner = await query(
              `SELECT c.name AS character_name, c.avatar_url AS character_avatar, cp.is_ai_controlled
               FROM conversation_participants cp
               JOIN characters c ON cp.character_id = c.id
               WHERE cp.conversation_id = $1 AND cp.user_id != $2
               LIMIT 1`,
              [conv.id, userId]
            );
            return {
              ...conv,
              partner_name: partner.rows[0]?.character_name || 'Unknown',
              partner_avatar: partner.rows[0]?.character_avatar || null,
              partner_is_ai: partner.rows[0]?.is_ai_controlled || false,
            };
          })
        );
        return chats;
      }),

      // 2. Friends with online status
      query(
        `SELECT u.id, u.username, u.avatar_url, u.last_active,
                CASE WHEN u.last_active > NOW() - INTERVAL '5 minutes' THEN 'online'
                     WHEN u.last_active > NOW() - INTERVAL '30 minutes' THEN 'away'
                     ELSE 'offline' END AS status
         FROM friendships f
         JOIN users u ON (CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END) = u.id
         WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
         ORDER BY u.last_active DESC NULLS LAST
         LIMIT 10`,
        [userId]
      ),

      // 3. Unread notifications count + latest 3
      query(
        `SELECT id, type, title, body, data, is_read, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId]
      ),

      // 4. Leaderboard: Top characters by likes
      query(
        `SELECT c.id, c.name, c.avatar_url, c.like_count, c.chat_count,
                u.username AS creator_name
         FROM characters c
         JOIN users u ON c.creator_id = u.id
         WHERE c.is_public = true AND c.is_nsfw = false AND c.like_count > 0
         ORDER BY c.like_count DESC, c.chat_count DESC
         LIMIT 5`
      ),

      // 5. Leaderboard: Top worlds by member count
      query(
        `SELECT w.id, w.name, w.thumbnail_url, w.setting, w.like_count,
                w.member_count, w.character_count,
                u.username AS creator_name
         FROM worlds w
         JOIN users u ON w.creator_id = u.id
         WHERE w.is_public = true AND w.is_nsfw = false
         ORDER BY w.member_count DESC, w.character_count DESC
         LIMIT 5`
      ),

      // 6. Leaderboard: Top users by total chats
      query(
        `SELECT u.id, u.username, u.avatar_url, u.subscription,
                COUNT(DISTINCT cp.conversation_id) AS total_chats
         FROM users u
         JOIN conversation_participants cp ON cp.user_id = u.id
         JOIN conversations conv ON cp.conversation_id = conv.id AND (conv.is_test IS NULL OR conv.is_test = false)
         GROUP BY u.id
         ORDER BY total_chats DESC
         LIMIT 5`
      ),

      // 7. Recommended characters (AI-enabled, public, not owned by user, random)
      query(
        `SELECT c.id, c.name, c.avatar_url, c.description, c.tags, c.like_count, c.chat_count,
                u.username AS creator_name, w.name AS world_name
         FROM characters c
         JOIN users u ON c.creator_id = u.id
         LEFT JOIN worlds w ON c.world_id = w.id
         WHERE c.is_public = true AND c.is_nsfw = false AND c.is_ai_enabled = true AND c.creator_id != $1
         ORDER BY RANDOM()
         LIMIT 6`,
        [userId]
      ),

      // 8. My characters quick stats
      query(
        `SELECT id, name, avatar_url, chat_count, like_count
         FROM characters
         WHERE creator_id = $1
         ORDER BY updated_at DESC
         LIMIT 4`,
        [userId]
      ),
    ]);

    // Count unread notifications
    const unreadCount = notificationsResult.rows.filter((n: any) => !n.is_read).length;

    res.json({
      success: true,
      data: {
        recent_chats: recentChatsResult,
        friends: friendsResult.rows,
        notifications: {
          items: notificationsResult.rows,
          unread_count: unreadCount,
        },
        leaderboards: {
          top_characters: topCharsResult.rows,
          top_worlds: topWorldsResult.rows,
          top_users: topUsersResult.rows,
        },
        recommended_characters: recommendedResult.rows,
        my_characters: myCharsResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
