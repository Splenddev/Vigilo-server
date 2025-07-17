import Notification from '../models/notification.model.js';
import createHttpError from 'http-errors';

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await Notification.find({ for: userId })
      .sort({ createdAt: -1 }) // newest first
      .limit(100); // optional limit

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications.',
    });
  }
};

// ───────────────────────────────────────────────
// PATCH /app/notifications/mark-all-read
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { for: userId, unread: true },
      { $set: { unread: false } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (err) {
    console.error('Error marking notifications as read:', err);
    res.status(500).json({
      success: false,
      message: 'Could not mark notifications as read.',
    });
  }
};

// ───────────────────────────────────────────────
// DELETE /app/notifications/:id
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const notif = await Notification.findOne({
      _id: id,
      for: userId,
    });

    if (!notif) {
      throw createHttpError(404, 'Notification not found or not yours.');
    }

    await notif.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted.',
    });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to delete notification.',
    });
  }
};
