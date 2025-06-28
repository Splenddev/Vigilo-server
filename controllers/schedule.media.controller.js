import cloudinary from '../config/cloudinary.js';
import scheduleModel from '../models/schedule.model.js';
import path from 'path';
import {
  fileTypeToResource,
  mimeToResource,
} from '../utils/cloudinary.utils.js';
import { getFileTypeFromExt } from '../utils/helpers.js';
import createHttpError from 'http-errors';
import Group from '../models/group.js';
import mongoose from 'mongoose';

export const addScheduleMedia = async (req, res, next) => {
  try {
    const { scheduleId } = req.params;
    const { requireApproval = false } = req.body;

    const files = req.files || [];

    let links = [];
    if (req.body.links) {
      try {
        links = JSON.parse(req.body.links);
      } catch {
        throw createHttpError(400, 'links must be valid JSON');
      }
    }

    if (!files.length && !links.length) {
      throw createHttpError(400, 'No files or links provided');
    }

    const schedule = await scheduleModel.findById(scheduleId);
    if (!schedule) throw createHttpError(404, 'Schedule not found');

    const group = await Group.findById(schedule.groupId);
    if (!group) throw createHttpError(404, 'Parent group not found');

    const now = new Date();

    /** Build media objects */
    const mediaDocs = [
      // ─ uploaded files ─
      ...files.map((file) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const fileType = getFileTypeFromExt(ext);

        if (!fileType) {
          throw createHttpError(400, `Unsupported extension: ${ext}`);
        }
        return {
          fileType,
          allowedExt: [ext],
          src: file.path,
          name: file.originalname,
          dateAdded: now.toISOString().slice(0, 10), // YYYY‑MM‑DD
          timeAdded: now.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          }),
          uploadedBy: req.user.id,
          approved:
            req.user.role === 'class-rep' ? true : !schedule.mediaNeedsApproval,
          cloudinaryId: file.filename,
          resourceType: file.resource_type || fileTypeToResource(fileType),
        };
      }),

      ...links.map((l) => ({
        fileType: 'link',
        allowedExt: [],
        src: l.url,
        name: l.title ?? l.url,
        dateAdded: now.toISOString().slice(0, 10),
        timeAdded: now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        uploadedBy: req.user.id,
        approved:
          req.user.role === 'class-rep' ? true : !schedule.mediaNeedsApproval,
        cloudinaryId: null,
        resourceType: 'raw',
      })),
    ];

    schedule.media.push(...mediaDocs); // schedule-level
    group.mediaUploads.push(...mediaDocs); // NEW: group-level

    await Promise.all([schedule.save(), group.save()]);

    res.status(201).json({
      message: 'Media uploaded',
      data: mediaDocs,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteScheduleMedia = async (req, res, next) => {
  try {
    const { scheduleId, mediaId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(scheduleId))
      throw createHttpError(400, 'Invalid scheduleId');

    // 🔍 Step 1: Fetch schedule to get groupId and validate
    const { schedule, media } = req;
    if (!schedule) throw createHttpError(404, 'Schedule not found');

    // 🔍 Step 2: Fetch group using schedule.groupId
    const group = await Group.findById(schedule.groupId);
    if (!group) throw createHttpError(404, 'Group not found');

    // 🧼 Step 3: Locate media in group.mediaUploads
    if (!media) throw createHttpError(404, 'Media item not found in group');

    // ✅ Step 4: Destroy asset on Cloudinary if not a link
    if (media.fileType !== 'link') {
      try {
        await cloudinary.uploader.destroy(media.cloudinaryId, {
          resource_type: media.resourceType,
        });
      } catch (err) {
        console.warn(
          '⚠️ Cloudinary deletion failed or asset not found:',
          media.cloudinaryId
        );
      }
    }

    media.deleteOne();
    await group.save();

    schedule.media = schedule.media.filter(
      (m) => m._id.toString() !== mediaId.toString()
    );
    await schedule.save();

    res.status(200).json({ message: 'Media deleted successfully' });
  } catch (err) {
    next(err);
  }
};
