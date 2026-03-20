'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';

/**
 * OAuth Callback Page
 *
 * This page catches the redirect from the backend after Google/Facebook login.
 * The URL will look like: /auth/callback?token=xxxxx
 *
 * All we need to do is:
 * 1. Grab the token from the URL
 * 2. Save it to localStorage (same key the rest of the app uses)
 * 3. Refresh the user profile
 * 4. Redirect to the home page
 */

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Signing you in...</p>
        </div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (!token) {
      setError('No authentication token received. Please try again.');
      return;
    }

    // Save the token — this is the same key used by auth-context.tsx
    localStorage.setItem('rrd_token', token);

    // Refresh the user profile from the API, then redirect
    refreshUser();

    // Small delay to let the auth context update before redirecting
    setTimeout(() => {
      router.push('/profile');
    }, 500);
  }, [searchParams, router, refreshUser]);

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-white mb-2">Login Failed</h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <a
            href="/login"
            className="inline-block px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Signing you in...</p>
      </div>
    </div>
  );
}
