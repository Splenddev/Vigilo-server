import createHttpError from 'http-errors';
import scheduleModel from '../models/schedule.model.js';
import mongoose from 'mongoose';

const isClassRepOrUploader = async (req, res, next) => {
  try {
    const { scheduleId, mediaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      throw createHttpError(400, 'Invalid schedule ID');
    }

    const schedule = await scheduleModel.findById(scheduleId);
    if (!schedule) throw createHttpError(404, 'Schedule not found');

    const media = schedule.media.id(mediaId);
    if (!media) throw createHttpError(404, 'Media not found');

    const userId = req.user.id;
    const userRole = req.user.role;

    const isUploader = media.uploadedBy?.toString() === userId;
    const isClassRep = userRole === 'class-rep';

    if (!isUploader && !isClassRep) {
      throw createHttpError(403, 'Not authorized to delete this media');
    }

    req.schedule = schedule;
    req.media = media;

    next();
  } catch (err) {
    next(err);
  }
};

export default isClassRepOrUploader;
