//schedule.controller.js
import mongoose from 'mongoose';
import {
  detectConflicts,
  detectScheduleConflicts,
  normalisePayload,
  validateClassType,
  validateCourseScheduleTemplate,
} from '../utils/schedule.utils.js';
import scheduleModel from '../models/schedule.model.js';
import createHttpError from 'http-errors';
import Course from '../models/course.model.js';

export const createSchedule = async (req, res, next) => {
  try {
    const rawPayload = { ...req.body, createdBy: req.user?.id };

    if (
      !rawPayload.createdBy ||
      !mongoose.Types.ObjectId.isValid(rawPayload.createdBy)
    ) {
      throw createHttpError(400, 'Invalid or missing creator ID.');
    }

    if (
      !rawPayload.course ||
      !mongoose.Types.ObjectId.isValid(rawPayload.course)
    ) {
      throw createHttpError(400, 'Invalid or missing course ID.');
    }

    const course = await Course.findById(rawPayload.course);

    if (!course) throw createHttpError(404, 'Course not found.');

    if (course.completed)
      throw createHttpError(400, 'Cannot schedule a completed course.');

    const payload = normalisePayload(rawPayload);

    if (payload.groupId.toString() !== course.group.toString()) {
      throw createHttpError(400, 'Schedule group must match course group.');
    }

    validateClassType(payload);
    validateCourseScheduleTemplate(payload, course);
    await detectConflicts(payload);
    await detectScheduleConflicts(payload);

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
