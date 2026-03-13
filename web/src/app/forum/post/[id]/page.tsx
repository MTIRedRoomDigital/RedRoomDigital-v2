'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface Reply {
  id: string;
  content: string;
  author_name: string;
  author_avatar: string | null;
  author_subscription: string;
  author_id: string;
  created_at: string;
}

interface PostData {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_subscription: string;
  category_id: string;
  category_name: string;
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  replies: Reply[];
}

export default function PostPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<PostData>(`/api/forum/posts/${id}`).then((res) => {
      if (res.success && res.data) setPost(res.data as any);
      setLoading(false);
    });
  }, [id]);

  const handleReply = async () => {
    if (!replyContent.trim() || replying) return;
    setReplying(true);

    const res = await api.post<Reply>(`/api/forum/posts/${id}/replies`, {
      content: replyContent,
    });

    if (res.success && res.data) {
      setPost((prev) =>
        prev ? { ...prev, replies: [...prev.replies, res.data as Reply], reply_count: prev.reply_count + 1 } : prev
      );
      setReplyContent('');
    }
    setReplying(false);
  };

  const tierBadge = (sub: string) => {
    if (sub === 'ultimate') return { color: 'text-purple-400', bg: 'bg-purple-900/30', label: 'ULTIMATE' };
    if (sub === 'premium') return { color: 'text-amber-400', bg: 'bg-amber-900/30', label: 'PREMIUM' };
    return null;
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-1/3 mb-4" />
          <div className="h-32 bg-slate-800 rounded-xl mb-4" />
          <div className="h-20 bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">📝</div>
        <h1 className="text-2xl font-bold text-white mb-2">Post Not Found</h1>
        <Link href="/forum" className="text-red-400 hover:text-red-300">Back to Forum</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-sm text-slate-400 mb-4 flex items-center gap-2">
        <Link href="/forum" className="hover:text-white transition-colors">Forum</Link>
        <span>/</span>
        <Link href={`/forum/${post.category_id}`} className="hover:text-white transition-colors">{post.category_name}</Link>
      </div>

      {/* Post */}
      <div className="p-6 bg-slate-800 border border-slate-700 rounded-xl mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white font-bold shrink-0">
            {post.author_name[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/users/${post.author_id}`} className="font-medium text-white hover:text-red-400 transition-colors">{post.author_name}</Link>
              {tierBadge(post.author_subscription) && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${tierBadge(post.author_subscription)!.bg} ${tierBadge(post.author_subscription)!.color}`}>
                  {tierBadge(post.author_subscription)!.label}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">{formatDate(post.created_at)}</p>
          </div>
          <div className="ml-auto text-xs text-slate-500 flex gap-3">
            <span>{post.view_count} views</span>
            <span>{post.reply_count} replies</span>
          </div>
        </div>

        {post.is_pinned && (
          <div className="text-xs text-amber-400 mb-2">📌 Pinned Post</div>
        )}

        <h1 className="text-xl font-bold text-white mb-3">{post.title}</h1>
        <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">{post.content}</div>
      </div>

      {/* Replies */}
      <h3 className="text-lg font-semibold text-white mb-3">
        Replies ({post.replies.length})
      </h3>

      {post.replies.length === 0 ? (
        <p className="text-sm text-slate-500 mb-6">No replies yet. Be the first!</p>
      ) : (
        <div className="space-y-3 mb-6">
          {post.replies.map((reply) => (
            <div key={reply.id} className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {reply.author_name[0].toUpperCase()}
                </div>
                <Link href={`/users/${reply.author_id}`} className={`text-sm font-medium hover:text-red-400 transition-colors ${reply.author_subscription === 'premium' ? 'text-amber-400' : reply.author_subscription === 'ultimate' ? 'text-purple-400' : 'text-slate-300'}`}>
                  {reply.author_name}
                </Link>
                <span className="text-xs text-slate-600">{formatDate(reply.created_at)}</span>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap pl-9">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reply Box */}
      {user && !post.is_locked ? (
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            rows={3}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={handleReply}
              disabled={!replyContent.trim() || replying}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-semibold"
            >
              {replying ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>
      ) : post.is_locked ? (
        <div className="text-center py-4 text-sm text-slate-500">
          🔒 This post is locked. No new replies.
        </div>
      ) : (
        <div className="text-center py-4">
          <Link href="/login" className="text-sm text-red-400 hover:text-red-300">Log in to reply</Link>
        </div>
      )}
    </div>
  );
}
