// utils/cloudinary.utils.js
export const fileTypeToResource = (fileType) => {
  switch (fileType) {
    case 'video':
    case 'audio':
      return 'video'; // Cloudinary treats audio as video
    case 'doc': // pdf, ppt, xls … are “raw” on Cloudinary
      return 'raw';
    default: // image & link → image (link has no asset)
      return 'image';
  }
};
export const mimeToResource = (mimetype = '') => {
  if (typeof mimetype !== 'string') return 'raw';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'video'; // Cloudinary treats audio as video
  return 'raw';
};
