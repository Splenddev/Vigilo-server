import Notification from '../models/notification.model.js';

export const hasRecentlySentNotification = async ({
  type,
  fromUser,
  forUser,
  groupId,
  withinMinutes = 5,
}) => {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);

  const recent = await Notification.findOne({
    type,
    from: fromUser,
    for: forUser,
    groupId,
    createdAt: { $gte: since },
  });

  return !!recent; // true if already sent recently
};
