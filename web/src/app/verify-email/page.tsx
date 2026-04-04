'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-slate-700 animate-pulse" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    api.post('/api/auth/verify-email', { token }).then((res) => {
      if (res.success) {
        setStatus('success');
        setMessage('Your email has been verified!');
      } else {
        setStatus('error');
        setMessage(res.message || 'Verification failed.');
      }
    });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/">
          <img src="/logo.png" alt="RedRoomDigital" className="h-16 mx-auto mb-6" />
        </Link>

        {status === 'verifying' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
            <div className="text-4xl mb-4 animate-pulse">📧</div>
            <h2 className="text-xl font-semibold text-white">Verifying your email...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-white mb-2">Email verified!</h2>
            <p className="text-slate-400 mb-6">{message}</p>
            <Link
              href="/"
              className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-semibold text-white mb-2">Verification failed</h2>
            <p className="text-slate-400 mb-6">{message}</p>
            <Link href="/login" className="text-red-400 hover:text-red-300 font-medium">
              Go to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
