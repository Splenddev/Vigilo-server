import express from 'express';
import {
  getMyNotifications,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notification.controller.js';
import { protect } from '../middlewares/auth.js';

const notificationRouter = express.Router();

notificationRouter.use(protect);

notificationRouter.get('/', getMyNotifications);
notificationRouter.patch('/mark-all-read', markAllAsRead);
notificationRouter.delete('/:id', deleteNotification);

export default notificationRouter;
