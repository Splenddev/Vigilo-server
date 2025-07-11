import Notification from '../models/notification.model.js';

export const sendNotification = async (options) => {
  const {
    type,
    message,
    forUser = null,
    fromUser = null,
    groupId = null,
    relatedId = null,
    relatedType = null,
    actionApprove = null,
    actionDeny = null,
    image = null,
    userMedia = null,
    link = '',
    isBroadcast = false,
    targetRole = null,
    targetGroupId = null,
    io = null,
  } = options;

  // ─── Skip if neither target is defined ───
  if (!forUser && !isBroadcast) return null;

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
    isBroadcast,
    targetRole,
    targetGroupId,
  });

  // ─── Real-time emit (Socket.IO) ───
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
      from: fromUser, // Include sender for client context
    };

    if (forUser) {
      io.to(forUser.toString()).emit('notification:new', payload);

      if (process.env.NODE_ENV !== 'production') {
        console.log(`📨 Sent notification to user ${forUser}`);
      }
    } else if (isBroadcast && targetGroupId) {
      io.to(`group:${targetGroupId.toString()}`).emit('notification:new', {
        ...payload,
        targetRole,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`📡 Broadcast notification to group:${targetGroupId}`);
      }
    }
  }

  return notification;
};
