/**
 * Presence Service
 *
 * Tracks user online/away/offline status using an in-memory Map.
 *
 * HOW IT WORKS:
 * - When a user connects via Socket.IO, we track their socket ID
 * - A user can have multiple sockets (multiple tabs)
 * - We track their last activity timestamp to determine "away" status
 * - When all sockets disconnect, the user is "offline"
 *
 * STATUS DEFINITIONS:
 * - online: Connected + activity within last 5 minutes
 * - away: Connected + no activity for 5+ minutes
 * - offline: No active socket connections
 */

interface UserPresence {
  socketIds: Set<string>;
  lastActivity: number; // Date.now() timestamp
}

// In-memory store — ephemeral, resets on server restart
const presenceMap = new Map<string, UserPresence>();

// 5 minutes without activity = "away"
const AWAY_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Mark a user as connected (called on socket connect)
 */
export function userConnected(userId: string, socketId: string): void {
  const existing = presenceMap.get(userId);
  if (existing) {
    existing.socketIds.add(socketId);
    existing.lastActivity = Date.now();
  } else {
    presenceMap.set(userId, {
      socketIds: new Set([socketId]),
      lastActivity: Date.now(),
    });
  }
}

/**
 * Mark a user's socket as disconnected (called on socket disconnect)
 * User is only "offline" when ALL sockets are gone
 */
export function userDisconnected(userId: string, socketId: string): void {
  const existing = presenceMap.get(userId);
  if (!existing) return;

  existing.socketIds.delete(socketId);

  // If no more sockets, remove from presence map entirely
  if (existing.socketIds.size === 0) {
    presenceMap.delete(userId);
  }
}

/**
 * Update a user's last activity (called on heartbeat, typing, messages)
 */
export function userActivity(userId: string): void {
  const existing = presenceMap.get(userId);
  if (existing) {
    existing.lastActivity = Date.now();
  }
}

/**
 * Get a single user's status
 */
export function getUserStatus(userId: string): 'online' | 'away' | 'offline' {
  const presence = presenceMap.get(userId);
  if (!presence || presence.socketIds.size === 0) {
    return 'offline';
  }

  const timeSinceActivity = Date.now() - presence.lastActivity;
  if (timeSinceActivity > AWAY_THRESHOLD_MS) {
    return 'away';
  }

  return 'online';
}

/**
 * Get statuses for multiple users at once (batch lookup)
 */
export function getUserStatuses(userIds: string[]): Record<string, 'online' | 'away' | 'offline'> {
  const result: Record<string, 'online' | 'away' | 'offline'> = {};
  for (const userId of userIds) {
    result[userId] = getUserStatus(userId);
  }
  return result;
}
