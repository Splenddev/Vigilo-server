import express from 'express';
import { protect } from '../middlewares/auth.js';
import { allowClassRepsOnly } from '../middlewares/role.middleware.js';
import {
  createSchedule,
  getSchedulesByGroup,
} from '../controllers/schedule.controller.js';
import uploadScheduleMedia from '../middlewares/uploadScheduleMedia.js';
import {
  addScheduleMedia,
  deleteScheduleMedia,
} from '../controllers/schedule.media.controller.js';
import isClassRepOrUploader from '../middlewares/isClassRepOrUploader .js';

const scheduleRoutes = express.Router();

// 🔐 All schedule routes require auth
scheduleRoutes.use(protect);

scheduleRoutes.post('/create', allowClassRepsOnly, createSchedule);

scheduleRoutes.get('/:groupId', getSchedulesByGroup);

scheduleRoutes.post(
  '/:scheduleId/media',
  uploadScheduleMedia.array('files', 10),
  addScheduleMedia
);
scheduleRoutes.delete(
  '/:scheduleId/media/:mediaId',
  isClassRepOrUploader,
  deleteScheduleMedia
);
// Future routes

export default scheduleRoutes;
