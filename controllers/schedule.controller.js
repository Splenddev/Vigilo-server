//schedule.controller.js
import mongoose from 'mongoose';
import {
  detectConflicts,
  detectCourseConflicts,
  normalisePayload,
  validateClassType,
  validateLeadTime,
} from '../utils/schedule.utils.js';
import scheduleModel from '../models/schedule.model.js';
import createHttpError from 'http-errors';

export const createSchedule = async (req, res, next) => {
  try {
    /* 1.  Normalise & audit-trail */
    const rawPayload = { ...req.body, createdBy: req.user?.id };
    if (
      !rawPayload.createdBy ||
      !mongoose.Types.ObjectId.isValid(rawPayload.createdBy)
    )
      throw createHttpError(400, 'Invalid or missing creator ID.');

    const payload = normalisePayload(rawPayload);

    validateClassType(payload);
    validateLeadTime(payload);
    await detectConflicts(payload);
    await detectCourseConflicts(payload);

    const doc = await scheduleModel.create(payload);

    return res.status(201).json({
      message: 'Schedule created successfully',
      data: doc,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message, errors: err.errors });
    }
    next(err);
  }
};

const ALLOWED_REPEAT = ['once', 'weekly', 'bi-weekly', 'monthly'];
const ALLOWED_POPULATE = ['createdBy', 'attendanceRecords', 'media', 'group'];

export const getSchedulesByGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { active, repeat, populate } = req.query;

    // 1️⃣ Validate groupId
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      throw createHttpError(400, 'Invalid groupId');
    }

    // 2️⃣ Build query
    const query = { groupId };

    if (typeof active !== 'undefined') {
      query.isActive = active === 'true';
    }

    if (repeat && ALLOWED_REPEAT.includes(repeat)) {
      query.repeat = repeat;
    }

    // 3️⃣ Execute query
    let findQuery = scheduleModel.find(query).sort({ createdAt: -1 });

    if (populate) {
      populate
        .split(',')
        .map((field) => field.trim())
        .filter((field) => ALLOWED_POPULATE.includes(field))
        .forEach((field) => {
          findQuery = findQuery.populate(field);
        });
    }

    const schedules = await findQuery.lean().exec();

    return res.status(200).json({
      message: `Found ${schedules.length} schedule(s) for group ${groupId}`,
      data: schedules,
    });
  } catch (err) {
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'Invalid ObjectId format' });
    }
    next(err);
  }
};
