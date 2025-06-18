import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'user_profiles',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ aspect_ratio: '3:1', crop: 'fill', gravity: 'auto' }],
  },
});

const upload = multer({ storage });

export default upload;
