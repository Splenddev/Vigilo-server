// utils/notify/broadcastGroupNotification.js
import Notification from '../../models/notification.model.js';

export const sendGroupNotification = async ({
  type,
  message,
  fromUser = null,
  targetGroupId,
  targetRole = null,
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
  if (!targetGroupId) return null;

  const notification = await Notification.create({
    type,
    message,
    from: fromUser,
    groupId,
    relatedId,
    relatedType,
    actionApprove,
    actionDeny,
    image,
    userMedia,
    link,
    isBroadcast: true,
    targetRole,
    targetGroupId,
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
      targetRole,
    };

    io.to(`group:${targetGroupId.toString()}`).emit(
      'notification:new',
      payload
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📡 Broadcast to group:${targetGroupId}`);
    }
  }

  return notification;
};
