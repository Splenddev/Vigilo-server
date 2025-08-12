import ScheduleInstance from '../models/scheduleInstance.model.js';
import createHttpError from 'http-errors';

export const getScheduleInstanceById = async (req, res, next) => {
  try {
    const { scheduleId } = req.params;
    if (!scheduleId) {
      throw createHttpError(400, 'Missing ScheduleInstance ID.');
    }

    const instance = await ScheduleInstance.find({ scheduleId })
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
