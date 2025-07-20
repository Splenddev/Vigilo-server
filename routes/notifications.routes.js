import express from 'express';
import {
  getMyNotifications,
  markAsRead,
  deleteNotification,
} from '../controllers/notification.controller.js';
import { protect } from '../middlewares/auth.js';

const notificationRouter = express.Router();

notificationRouter.use(protect);

notificationRouter.get('/', getMyNotifications);

notificationRouter.patch('/:id', markAsRead);

notificationRouter.patch('/', markAsRead);

notificationRouter.delete('/:id', deleteNotification);

notificationRouter.delete('/', deleteNotification);

export default notificationRouter;
