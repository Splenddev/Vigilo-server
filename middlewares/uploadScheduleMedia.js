import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import path from 'path';
import cloudinary from '../config/cloudinary.js';
import { mimeToResource } from '../utils/cloudinary.utils.js';

/** 1️⃣ Cloudinary Storage Setup */
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const { scheduleId } = req.params;
    const resource_type = mimeToResource(file.mimetype);

    return {
      folder: `schedule-media/${scheduleId ?? 'general'}`,
      resource_type,
      public_id:
        path.parse(file.originalname).name.replace(/\s+/g, '_') +
        '-' +
        Date.now(),
      transformation:
        resource_type === 'image'
          ? [{ width: 1600, height: 1600, crop: 'limit' }]
          : undefined,
    };
  },
});

/** 2️⃣ Allowed MIME Types */
const allowedMimes = new Set([
  // documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // images
  'image/jpeg',
  'image/png',
  'image/webp',
  // video
  'video/mp4',
  'video/webm',
  'video/x-msvideo',
  // audio
  'audio/mpeg',
  'audio/aac',
  'audio/wav',
  'audio/x-ms-wma',
]);

const fileFilter = (req, file, cb) => {
  if (allowedMimes.has(file.mimetype)) cb(null, true);
  else cb(new Error('Unsupported file type'), false);
};

/** 3️⃣ Export Multer Instance */
const uploadScheduleMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

export default uploadScheduleMedia;
