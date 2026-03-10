import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createUploadMiddleware } from '../config/cloudinary';

export const uploadRouter = Router();

// Pre-configured upload middlewares for different image types
const avatarUpload = createUploadMiddleware({
  folder: 'avatars',
  transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
});

const bannerUpload = createUploadMiddleware({
  folder: 'banners',
  transformation: [{ width: 1200, height: 400, crop: 'fill' }],
});

const thumbnailUpload = createUploadMiddleware({
  folder: 'thumbnails',
  transformation: [{ width: 600, height: 400, crop: 'fill' }],
});

/**
 * POST /api/upload?type=avatar|banner|thumbnail
 * Upload an image to Cloudinary.
 * Returns the URL to use when creating/updating entities.
 */
uploadRouter.post('/', authenticate, (req: AuthRequest, res: Response) => {
  const type = (req.query.type as string) || 'avatar';

  const uploaders: Record<string, ReturnType<typeof createUploadMiddleware>> = {
    avatar: avatarUpload,
    banner: bannerUpload,
    thumbnail: thumbnailUpload,
  };

  const upload = uploaders[type] || avatarUpload;

  upload.single('image')(req as any, res as any, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
        return;
      }
      console.error('Upload error:', err);
      res.status(400).json({ success: false, message: err.message || 'Upload failed' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, message: 'No image file provided' });
      return;
    }

    // multer-storage-cloudinary puts the URL in req.file.path
    const url = (req.file as any).path || (req.file as any).secure_url;

    res.json({
      success: true,
      data: { url },
    });
  });
});
