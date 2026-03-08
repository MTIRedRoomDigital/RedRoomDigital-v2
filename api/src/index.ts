import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the api directory (not the working directory)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { authRouter } from './routes/auth';
import { characterRouter } from './routes/characters';
import { worldRouter } from './routes/worlds';
import { conversationRouter } from './routes/conversations';
import { userRouter } from './routes/users';
import { campaignRouter } from './routes/campaigns';
import { subscriptionRouter } from './routes/subscriptions';
import { forumRouter } from './routes/forum';
import { notificationRouter } from './routes/notifications';
import { friendshipRouter } from './routes/friendships';
import { setupSocket } from './socket';
import { pool } from './db/pool';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;

// Parse CORS origins from env
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];

// Socket.IO setup
const io = new SocketServer(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(morgan('dev'));

// Stripe webhook needs raw body BEFORE json parsing
// express.raw() gives us the Buffer that Stripe needs for signature verification
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io accessible to routes
app.set('io', io);

// Health check
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/characters', characterRouter);
app.use('/api/worlds', worldRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/users', userRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/subscriptions', subscriptionRouter);
app.use('/api/forum', forumRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/friends', friendshipRouter);

// Socket.IO
setupSocket(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   RedRoomDigital API Server          ║
  ║   Running on http://localhost:${PORT}   ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}        ║
  ╚══════════════════════════════════════╝
  `);
});

export { app, io };
