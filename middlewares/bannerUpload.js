import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    return {
      folder: 'user_profiles',
      allowed_formats: ['jpg', 'png', 'jpeg'],
      public_id: `banner-${Date.now()}`,
      transformation: [{ aspect_ratio: '3:1', crop: 'fill', gravity: 'auto' }],
    };
  },
});

const upload = multer({ storage });

export default upload;
