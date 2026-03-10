'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';

interface ImageUploadProps {
  currentImageUrl: string | null;
  onUploadComplete: (url: string) => void;
  uploadType: 'avatar' | 'banner' | 'thumbnail';
  shape?: 'circle' | 'square' | 'banner';
  fallback?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  circle: { sm: 'w-8 h-8', md: 'w-16 h-16', lg: 'w-24 h-24' },
  square: { sm: 'w-12 h-12', md: 'w-20 h-20', lg: 'w-28 h-28' },
  banner: { sm: 'w-full h-24', md: 'w-full h-36', lg: 'w-full h-48' },
};

export function ImageUpload({
  currentImageUrl,
  onUploadComplete,
  uploadType,
  shape = 'circle',
  fallback,
  size = 'md',
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayUrl = previewUrl || currentImageUrl;
  const dimensions = sizeMap[shape]?.[size] || sizeMap.circle.md;
  const roundedClass = shape === 'circle' ? 'rounded-full' : shape === 'banner' ? 'rounded-xl' : 'rounded-2xl';

  const handleClick = () => {
    if (!uploading) {
      inputRef.current?.click();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum 5MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    // Show instant preview
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setError('');

    const res = await api.upload<{ url: string }>(
      `/api/upload?type=${uploadType}`,
      file
    );

    setUploading(false);

    if (res.success && res.data) {
      const url = (res.data as any).url;
      onUploadComplete(url);
      // Keep preview until parent re-renders with new URL
    } else {
      setError(res.message || 'Upload failed');
      setPreviewUrl(null);
    }

    // Reset input so same file can be selected again
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={className}>
      <div
        onClick={handleClick}
        className={`relative ${dimensions} ${roundedClass} overflow-hidden cursor-pointer group`}
      >
        {/* Image or Fallback */}
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Upload"
            className={`${dimensions} ${roundedClass} object-cover`}
          />
        ) : (
          fallback || (
            <div className={`${dimensions} ${roundedClass} bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-2xl`}>
              📷
            </div>
          )
        )}

        {/* Hover Overlay */}
        <div className={`absolute inset-0 ${roundedClass} bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center`}>
          {uploading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-lg">📷</span>
              <span className="text-xs text-white mt-1">
                {displayUrl ? 'Change' : 'Upload'}
              </span>
            </>
          )}
        </div>

        {/* Loading overlay (always visible when uploading) */}
        {uploading && (
          <div className={`absolute inset-0 ${roundedClass} bg-black/60 flex items-center justify-center`}>
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}
