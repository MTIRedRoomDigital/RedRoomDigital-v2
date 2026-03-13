import { io, Socket } from 'socket.io-client';

/**
 * Socket.IO Client
 *
 * HOW THIS WORKS:
 * - We keep a single socket connection per browser tab
 * - It connects to the API server using the user's JWT token
 * - The server authenticates the connection and knows who you are
 * - You can then join/leave "rooms" (conversations) for real-time messaging
 * - A heartbeat is sent every 60 seconds to keep presence status as "online"
 */

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = localStorage.getItem('rrd_token');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  socket = io(apiUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
    // Start heartbeat to keep presence status "online" (not "away")
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket?.connected) {
        socket.emit('heartbeat');
      }
    }, 60000);
  });

  socket.on('connect_error', (err) => {
    console.error('🔌 Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
