export const getFileTypeFromExt = (ext = '') => {
  const extToType = {
    // documents
    '.pdf': 'doc',
    '.doc': 'doc',
    '.docx': 'doc',
    '.ppt': 'doc',
    '.pptx': 'doc',
    '.xls': 'doc',
    '.xlsx': 'doc',

    // images
    '.png': 'image',
    '.jpeg': 'image',
    '.jpg': 'image',
    '.webp': 'image',

    // video
    '.mp4': 'video',
    '.webm': 'video',
    '.avi': 'video',

    // audio
    '.mp3': 'audio',
    '.aac': 'audio',
    '.wav': 'audio',
    '.wma': 'audio',
  };

  return extToType[ext.toLowerCase()] || null;
};
