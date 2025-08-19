import scheduleModel from '../models/schedule.model.js';
import createHttpError from 'http-errors';
import { startOfDay } from 'date-fns';
import scheduleInstanceModel from '../models/scheduleInstance.model.js';

export const getScheduleInstanceById = async (req, res, next) => {
  try {
    const { scheduleId } = req.params;
    if (!scheduleId) {
      throw createHttpError(400, 'Missing scheduleInstance ID.');
    }

    const instance = await scheduleInstanceModel
      .find({ scheduleId })
      .populate({
        path: 'scheduleId',
        select: 'courseTitle courseCode lecturerName groupId',
      })
      .populate({
        path: 'studentPresence.studentId',
        select: 'name email',
      })
      .lean();

    if (!instance) {
      throw createHttpError(404, 'Schedule instance not found.');
    }

    res.json({ success: true, data: instance });
  } catch (error) {
    console.log(error);
  }
};

export const getTodayInstances = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = startOfDay(new Date());

    // Step 1: find schedules this user is part of
    const schedules = await scheduleModel
      .find({ createdBy: userId })
      .select('_id')
      .lean();

    const scheduleIds = schedules.map((s) => s._id);

    console.log(scheduleIds);

    if (scheduleIds.length === 0) {
      return res.json({ success: true, promptMessage: null, instances: [] });
    }

    const instances = await scheduleInstanceModel
      .find({
        scheduleId: { $in: scheduleIds },
        classDate: today,
        classStatus: 'unconfirmed',
      })
      .populate('scheduleId')
      .lean();

    // Step 3: build the prompt
    let promptMessage = null;
    if (instances.length > 0) {
      promptMessage = `You have ${instances.length} class instance(s) today. Please confirm their status.`;
    }

    console.log(instances);

    res.json({ success: true, promptMessage, instances });
  } catch (err) {
    console.error("Error fetching today's schedule instances:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateScheduleInstanceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { classStatus, rescheduledToDate, updatedTime, lecturerMessage } =
      req.body;

    if (!classStatus) {
      throw createHttpError(400, 'classStatus is required');
    }

    // Validate status
    const allowedStatuses = [
      'unconfirmed',
      'pending_approval',
      'rescheduled',
      'postponed',
      'holding',
      'cancelled',
      'makeup',
      'offsite',
    ];

    if (!allowedStatuses.includes(classStatus)) {
      throw createHttpError(400, 'Invalid classStatus');
    }

    // Find the schedule instance
    const instance = await scheduleInstanceModel.findById(id);
    if (!instance) {
      throw createHttpError(404, 'Schedule instance not found');
    }

    // For rescheduled/postponed/makeup, require new date
    const requiresDate = ['rescheduled', 'postponed', 'makeup'];
    if (requiresDate.includes(classStatus) && !rescheduledToDate) {
      throw createHttpError(400, `${classStatus} requires rescheduledToDate`);
    }

    // Update fields
    instance.classStatus = classStatus;

    if (requiresDate.includes(classStatus)) {
      instance.rescheduledToDate = new Date(rescheduledToDate);
      instance.updatedTime = updatedTime || { start: null, end: null };
    } else {
      instance.rescheduledToDate = null;
      instance.updatedTime = { start: null, end: null };
    }

    // Add lecturer message if provided
    if (lecturerMessage && lecturerMessage.trim() !== '') {
      instance.lecturerMessages.push({
        text: lecturerMessage.trim(),
        type: 'info',
        author: req.user?.name || 'Class Rep', // assuming req.user exists
      });
    }

    const updatedInstance = await instance.save();

    res.status(200).json(updatedInstance);
  } catch (err) {
    next(err);
  }
};
