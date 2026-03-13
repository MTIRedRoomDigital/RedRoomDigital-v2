import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { userConnected, userDisconnected, userActivity } from '../services/presence';

/**
 * WebSocket Setup (Socket.IO)
 *
 * HOW REAL-TIME CHAT WORKS:
 * 1. Client connects with their JWT token
 * 2. Server verifies the token and identifies the user
 * 3. User "joins" conversation rooms (like chat rooms)
 * 4. When someone sends a message, it's broadcast to everyone in that room
 * 5. Typing indicators and status updates also go through here
 *
 * PRESENCE TRACKING:
 * - On connect: mark user as online
 * - On disconnect: mark user as offline (when all tabs closed)
 * - On heartbeat/typing: update last activity (for "away" detection)
 */
export function setupSocket(io: SocketServer) {
  // Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as {
        userId: string;
      };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`🔌 User connected: ${userId}`);

    // Join user's personal room (for notifications)
    socket.join(`user:${userId}`);

    // Track presence — mark user as online
    userConnected(userId, socket.id);

    // Join a conversation room
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`👤 User ${userId} joined conversation ${conversationId}`);
      userActivity(userId);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicator
    socket.on('typing', (data: { conversationId: string; characterName: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_typing', {
        userId,
        characterName: data.characterName,
      });
      userActivity(userId);
    });

    // Stop typing
    socket.on('stop_typing', (data: { conversationId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('user_stop_typing', {
        userId,
      });
    });

    // Heartbeat — client sends this every 60 seconds to stay "online" (not "away")
    socket.on('heartbeat', () => {
      userActivity(userId);
    });

    // Handle disconnect — remove socket from presence tracking
    socket.on('disconnect', () => {
      userDisconnected(userId, socket.id);
      console.log(`🔌 User disconnected: ${userId}`);
    });
  });

  console.log('🔌 Socket.IO initialized');
}
