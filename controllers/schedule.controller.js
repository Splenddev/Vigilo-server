import mongoose from 'mongoose';
import {
  detectConflicts,
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
