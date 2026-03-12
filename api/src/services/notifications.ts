import { query } from '../db/pool';
import { Server as SocketServer } from 'socket.io';

/**
 * Notification Service
 *
 * HOW THIS WORKS:
 * - Every notification is saved to the database AND pushed via Socket.IO
 * - The database keeps a permanent record (so users see them on page load)
 * - Socket.IO delivers them instantly (so the bell badge updates in real-time)
 * - All notification creation goes through this one function for consistency
 */

interface CreateNotificationParams {
  userId: string;
  type: string;       // 'friend_request' | 'friend_accepted' | 'chat_message' | 'quest_invite' | etc.
  title: string;
  body: string;
  data: Record<string, unknown>;  // JSONB payload (e.g., { fromUserId, conversationId })
  io?: SocketServer;              // Pass to emit real-time; undefined = DB-only
}

export async function createNotification(params: CreateNotificationParams) {
  const { userId, type, title, body, data, io } = params;

  const result = await query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, body, JSON.stringify(data)]
  );

  const notification = result.rows[0];

  // Push real-time update to the user's personal Socket.IO room
  if (io) {
    io.to(`user:${userId}`).emit('notification', notification);
  }

  return notification;
}
