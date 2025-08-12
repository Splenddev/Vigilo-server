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
