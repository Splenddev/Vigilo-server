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

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (id) {
      // 🔁 Toggle unread value for a single notification
      const notification = await Notification.findOne({ _id: id, for: userId });

      if (!notification) {
        throw createHttpError(404, 'Notification not found or not yours.');
      }

      const updated = await Notification.findByIdAndUpdate(
        id,
        { $set: { unread: !notification.unread } },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: `Notification marked as ${updated.unread ? 'unread' : 'read'}.`,
        data: updated,
      });
    } else {
      const notifications = await Notification.find({ for: userId });

      const hasUnread = notifications.some((n) => n.unread);
      const targetUnread = hasUnread ? false : true;

      const bulkUpdates = notifications.map((n) => ({
        updateOne: {
          filter: { _id: n._id },
          update: { $set: { unread: targetUnread } },
        },
      }));

      if (bulkUpdates.length > 0) {
        await Notification.bulkWrite(bulkUpdates);
      }

      return res.status(200).json({
        success: true,
        message: 'All notifications toggled (read/unread).',
      });
    }
  } catch (err) {
    console.error('Error toggling notification(s):', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to toggle notification(s).',
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    if (id) {
      // Delete specific notification
      const notif = await Notification.findOne({ _id: id, for: userId });

      if (!notif) {
        throw createHttpError(404, 'Notification not found or not yours.');
      }

      await notif.deleteOne();

      res.status(200).json({
        success: true,
        message: 'Notification deleted.',
      });
    } else {
      // Delete all notifications for user
      await Notification.deleteMany({ for: userId });

      res.status(200).json({
        success: true,
        message: 'All notifications deleted.',
      });
    }
  } catch (err) {
    console.error('Error deleting notification(s):', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Failed to delete notification(s).',
    });
  }
};
