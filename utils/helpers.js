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

export function applyTimeOffset(baseDate, entryStr) {
  const [hStr, mStr] = entryStr.toUpperCase().split('H');
  const hours = parseInt(hStr) || 0;
  const minutes = parseInt(mStr?.replace('M', '')) || 0;
  return new Date(baseDate.getTime() + (hours * 60 + minutes) * 60000);
}
