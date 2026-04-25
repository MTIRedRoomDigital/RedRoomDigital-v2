'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Poll for unread notifications every 30 seconds
  useEffect(() => {
    if (!user) return;

    const fetchCount = () => {
      api.get<{ count: number }>('/api/notifications/unread-count').then((res) => {
        if (res.success && res.data) setUnreadCount((res.data as any).count);
      });
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Real-time notification updates via Socket.IO
  useEffect(() => {
    if (!user) return;

    const socket = connectSocket();

    const handleNotification = () => {
      // Increment badge count instantly when a notification arrives
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [user]);

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
          <img src="/logo.png" alt="RedRoomDigital" className="h-9 w-9 rounded-md object-cover" />
          <span className="text-xl font-bold hidden sm:inline">
            <span className="text-red-500">Red</span>
            <span className="text-white">Room</span>
            <span className="text-amber-400">Digital</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-300">
          <Link href="/explore" className="hover:text-white transition-colors">
            Explore
          </Link>
          <Link href="/forum" className="hover:text-white transition-colors">
            Forum
          </Link>
          <Link href="/guide" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
            Guide
            {!user && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                New? Start here
              </span>
            )}
          </Link>
          {!user && (
            <Link href="/pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
          ) : user ? (
            <>
              {/* Search icon */}
              <Link href="/search" className="p-2 text-slate-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </Link>
              {/* Create dropdown — Character / World / Campaign */}
              <div className="relative group hidden sm:block">
                <button
                  className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors inline-flex items-center gap-1"
                >
                  + Create
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 top-full mt-2 w-52 py-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <Link href="/characters/create" className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors">
                    <span className="text-lg leading-none mt-0.5">🎭</span>
                    <div>
                      <div className="text-sm font-medium text-white">Character</div>
                      <div className="text-[11px] text-slate-500">Build a roleplay persona</div>
                    </div>
                  </Link>
                  <Link href="/worlds/create" className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors">
                    <span className="text-lg leading-none mt-0.5">🌍</span>
                    <div>
                      <div className="text-sm font-medium text-white">World</div>
                      <div className="text-[11px] text-slate-500">A shared setting for characters</div>
                    </div>
                  </Link>
                  <Link href="/campaigns/create" className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-700 transition-colors">
                    <span className="text-lg leading-none mt-0.5">⚔️</span>
                    <div>
                      <div className="text-sm font-medium text-white">Campaign</div>
                      <div className="text-[11px] text-slate-500">A world-changing event</div>
                    </div>
                  </Link>
                </div>
              </div>
              {/* Notification Bell */}
              <Link href="/notifications" className="relative p-2 text-slate-400 hover:text-white transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              {/* Desktop user dropdown */}
              <div className="relative group hidden md:block">
                <button className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
                  {(user as any).avatar_url ? (
                    <img src={(user as any).avatar_url} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white font-bold text-xs">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  <span>{user.username}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    user.subscription === 'ultimate' ? 'bg-purple-900/30 text-purple-400' :
                    user.subscription === 'premium' ? 'bg-amber-900/30 text-amber-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {user.subscription}
                  </span>
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                  <Link href="/profile" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                    My Profile
                  </Link>
                  <Link href="/characters" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                    My Characters
                  </Link>
                  <Link href="/worlds" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                    My Worlds
                  </Link>
                  <Link href="/friends" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                    My Friends
                  </Link>
                  <Link href="/chats" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                    My Chats
                  </Link>
                  <Link href="/subscription" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                    Subscription
                  </Link>
                  <Link href="/settings" className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
                    Settings
                  </Link>
                  <hr className="my-1 border-slate-700" />
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700"
                  >
                    Log Out
                  </button>
                </div>
              </div>
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-1.5 text-sm text-slate-300 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Sign Up
              </Link>
              {/* Mobile hamburger for non-auth */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-700 bg-slate-900 px-4 py-4 space-y-1">
          <Link href="/explore" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
            Explore
          </Link>
          <Link href="/forum" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
            Forum
          </Link>
          <Link href="/guide" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
            Guide
          </Link>
          {!user && (
            <Link href="/pricing" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
              Pricing
            </Link>
          )}
          <Link href="/search" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
            Search
          </Link>
          {user && (
            <>
              <hr className="border-slate-700 my-2" />
              <Link href="/characters/create" onClick={() => setMobileOpen(false)} className="block py-2.5 text-red-400 hover:text-red-300 font-medium">
                + Create Character
              </Link>
              <Link href="/worlds/create" onClick={() => setMobileOpen(false)} className="block py-2.5 text-amber-400 hover:text-amber-300 font-medium">
                + Create World
              </Link>
              <Link href="/campaigns/create" onClick={() => setMobileOpen(false)} className="block py-2.5 text-amber-400 hover:text-amber-300 font-medium">
                + Create Campaign
              </Link>
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
                My Profile
              </Link>
              <Link href="/characters" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
                My Characters
              </Link>
              <Link href="/friends" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
                My Friends
              </Link>
              <Link href="/chats" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
                My Chats
              </Link>
              <Link href="/settings" onClick={() => setMobileOpen(false)} className="block py-2.5 text-slate-300 hover:text-white">
                Settings
              </Link>
              <hr className="border-slate-700 my-2" />
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="block py-2.5 text-red-400 hover:text-red-300 w-full text-left"
              >
                Log Out
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
