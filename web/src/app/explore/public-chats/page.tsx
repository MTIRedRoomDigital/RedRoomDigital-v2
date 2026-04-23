'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PublicChatsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/explore?tab=public-chats');
  }, [router]);
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 text-center text-slate-400">
      Redirecting…
    </div>
  );
}
