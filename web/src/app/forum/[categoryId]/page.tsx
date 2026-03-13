'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_subscription: string;
  reply_count: number;
  view_count: number;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
}

export default function CategoryPage() {
  const { categoryId } = useParams();
  const { user } = useAuth();

  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!categoryId) return;
    api.get<{ category: Category; posts: Post[] }>(`/api/forum/categories/${categoryId}/posts`).then((res) => {
      if (res.success && res.data) {
        const d = res.data as any;
        setCategory(d.category);
        setPosts(d.posts);
      }
      setLoading(false);
    });
  }, [categoryId]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreating(true);

    const res = await api.post<Post>(`/api/forum/categories/${categoryId}/posts`, {
      title: newTitle,
      content: newContent,
    });

    if (res.success && res.data) {
      // Reload posts
      const refresh = await api.get<{ category: Category; posts: Post[] }>(`/api/forum/categories/${categoryId}/posts`);
      if (refresh.success && refresh.data) {
        setPosts((refresh.data as any).posts);
      }
      setNewTitle('');
      setNewContent('');
      setShowCreate(false);
    }
    setCreating(false);
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const tierColor = (sub: string) => {
    if (sub === 'ultimate') return 'text-purple-400';
    if (sub === 'premium') return 'text-amber-400';
    return 'text-slate-400';
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3 mb-6" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link href="/forum" className="text-sm text-slate-400 hover:text-white transition-colors mb-4 inline-block">
        &larr; Back to Forum
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{category?.name || 'Category'}</h1>
        {user && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            {showCreate ? 'Cancel' : '+ New Post'}
          </button>
        )}
      </div>

      {category?.description && (
        <p className="text-slate-400 text-sm mb-6">{category.description}</p>
      )}

      {/* Create Post Form */}
      {showCreate && (
        <div className="p-5 bg-slate-800 border border-slate-700 rounded-xl mb-6">
          <h3 className="font-semibold text-white mb-3">New Post</h3>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Post title..."
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 mb-3"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={5}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none mb-3"
          />
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || !newContent.trim() || creating}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-semibold"
            >
              {creating ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-slate-400 mb-2">No posts yet</p>
          {user && !showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Be the first to post!
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/forum/post/${post.id}`}
              className="block p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-red-500/40 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                  {post.author_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {post.is_pinned && <span className="text-xs text-amber-400">📌</span>}
                    <h3 className="font-semibold text-white group-hover:text-red-400 transition-colors truncate">
                      {post.title}
                    </h3>
                    {post.is_locked && <span className="text-xs text-slate-500">🔒</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/users/${post.author_id}`; }} className={`${tierColor(post.author_subscription)} hover:text-red-400 cursor-pointer transition-colors`}>{post.author_name}</span>
                    <span>{timeAgo(post.created_at)}</span>
                    <span>{post.reply_count} replies</span>
                    <span>{post.view_count} views</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
