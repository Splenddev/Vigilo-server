import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    let folder = 'misc';
    if (file.fieldname === 'instructorImage') folder = 'instructors';
    else if (file.fieldname === 'thumbnail') {
      folder = 'course_thumbnails';
    } else {
      folder = 'user_profiles';
    }

    return {
      folder,
      allowed_formats: ['jpg', 'png', 'jpeg'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }],
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only JPG/PNG allowed'));
  },
});

export default upload;
