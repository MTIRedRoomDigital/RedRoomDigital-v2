'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-6xl mb-6">💥</div>

      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
        Something Went Wrong
      </h2>

      <p className="text-slate-400 max-w-md mb-8">
        An unexpected error occurred. The realm may be unstable &mdash; try again
        or head back to safety.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
        >
          Try Again
        </button>
        <a
          href="/"
          className="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold rounded-xl transition-colors"
        >
          Return Home
        </a>
      </div>
    </div>
  );
}
