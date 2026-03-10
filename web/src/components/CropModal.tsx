'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

interface CropModalProps {
  imageUrl: string;
  aspect: number; // width/height ratio — 1 for square avatars, 3 for banners
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

/**
 * Crop Modal
 *
 * Shows a full-screen overlay where users can drag/zoom to reposition
 * their uploaded image. Uses react-easy-crop under the hood.
 *
 * Flow: User selects file → CropModal opens → they adjust → hit "Crop & Upload" → we
 * produce a cropped Blob that gets uploaded to Cloudinary.
 */
export function CropModal({ imageUrl, aspect, onCropComplete, onCancel }: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropAreaComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;

    setProcessing(true);

    try {
      const croppedBlob = await getCroppedImage(imageUrl, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (err) {
      console.error('Crop failed:', err);
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <h3 className="text-white font-semibold text-sm">Adjust Photo</h3>
        <button
          onClick={handleCrop}
          disabled={processing}
          className="px-4 py-1.5 text-sm bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors"
        >
          {processing ? 'Processing...' : 'Crop & Upload'}
        </button>
      </div>

      {/* Crop Area */}
      <div className="relative flex-1">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropAreaComplete}
          cropShape={aspect === 1 ? 'round' : 'rect'}
          showGrid={false}
          style={{
            containerStyle: { background: '#0f172a' },
            cropAreaStyle: { border: '2px solid #ef4444' },
          }}
        />
      </div>

      {/* Zoom Slider */}
      <div className="flex items-center gap-4 px-6 py-4 bg-slate-900 border-t border-slate-700">
        <span className="text-xs text-slate-400">🔍</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-red-500"
        />
        <span className="text-xs text-slate-400 w-10 text-right">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}

/**
 * Helper: Takes an image URL and crop area, returns a cropped Blob
 * using the Canvas API. This runs entirely in the browser — no server needed.
 */
async function getCroppedImage(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      0.92
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}
