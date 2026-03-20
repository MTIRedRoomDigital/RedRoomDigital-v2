'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function Footer() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Hide footer on individual chat pages — the chat UI fills the viewport
  if (pathname?.match(/^\/chats\/[^/]+$/)) {
    return null;
  }

  return (
    <footer className="border-t border-slate-800 bg-slate-900/50 mt-20">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-xl font-bold">
              <span className="text-red-500">Red</span>
              <span className="text-white">Room</span>
              <span className="text-amber-400">Digital</span>
            </Link>
            <p className="text-sm text-slate-500 mt-3 leading-relaxed">
              AI-powered character creation, world building, and collaborative roleplaying.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Platform</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/explore" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Explore Characters
                </Link>
              </li>
              <li>
                <Link href="/worlds" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Browse Worlds
                </Link>
              </li>
              <li>
                <Link href="/forum" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Community Forum
                </Link>
              </li>
              {!user && (
                <li>
                  <Link href="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Create */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Create</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/characters/create" className="text-sm text-slate-400 hover:text-white transition-colors">
                  New Character
                </Link>
              </li>
              <li>
                <Link href="/worlds/create" className="text-sm text-slate-400 hover:text-white transition-colors">
                  New World
                </Link>
              </li>
              {!user && (
                <li>
                  <Link href="/register" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Sign Up
                  </Link>
                </li>
              )}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Info</h4>
            <ul className="space-y-2.5">
              <li>
                <Link href="/terms" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} RedRoomDigital. All rights reserved.
          </p>
          <p className="text-xs text-slate-600">
            Stay in kayfabe. Always.
          </p>
        </div>
      </div>
    </footer>
  );
}
