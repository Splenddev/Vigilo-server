// utils/notify/sendUserNotification.js
import Notification from '../models/notification.model.js';

export const sendNotification = async ({
  type,
  message,
  forUser,
  fromUser = null,
  groupId = null,
  relatedId = null,
  relatedType = null,
  actionApprove = null,
  actionDeny = null,
  image = null,
  userMedia = null,
  link = '',
  io = null,
}) => {
  if (!forUser) return null;

  const notification = await Notification.create({
    type,
    message,
    for: forUser,
    from: fromUser,
    groupId,
    relatedId,
    relatedType,
    actionApprove,
    actionDeny,
    image,
    userMedia,
    link,
    isBroadcast: false,
  });

  if (io) {
    const payload = {
      id: notification._id,
      type: notification.type,
      message: notification.message,
      link: notification.link,
      image: notification.image,
      actionApprove: notification.actionApprove,
      actionDeny: notification.actionDeny,
      createdAt: notification.createdAt,
      from: fromUser,
    };

    io.to(forUser.toString()).emit('notification:new', payload);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📨 Sent notification to user ${forUser}`);
    }
  }

  return notification;
};
