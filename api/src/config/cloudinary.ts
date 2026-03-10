import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Create a multer middleware configured with Cloudinary storage.
 * Images are uploaded directly to Cloudinary (no local storage needed).
 */
export function createUploadMiddleware(options: {
  folder: string;
  transformation?: Record<string, unknown>[];
}) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: `redroomdigital/${options.folder}`,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: options.transformation || [{ width: 500, height: 500, crop: 'fill' }],
    } as any,
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  });
}

export { cloudinary };
