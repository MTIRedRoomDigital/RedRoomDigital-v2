import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 text-center">
      {/* Glitch-style 404 */}
      <div className="relative mb-8">
        <h1 className="text-[120px] md:text-[180px] font-extrabold leading-none">
          <span className="text-red-500">4</span>
          <span className="text-slate-600">0</span>
          <span className="text-amber-400">4</span>
        </h1>
      </div>

      <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
        Lost in the Multiverse
      </h2>

      <p className="text-slate-400 max-w-md mb-8">
        This page doesn&apos;t exist in any known world. The character you&apos;re looking for
        may have wandered off, or this realm was never created.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
        >
          Return Home
        </Link>
        <Link
          href="/explore"
          className="px-6 py-3 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-semibold rounded-xl transition-colors"
        >
          Explore Characters
        </Link>
      </div>
    </div>
  );
}
