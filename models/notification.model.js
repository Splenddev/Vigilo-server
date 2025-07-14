// models/notification.model.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'approval',
      'media',
      'announcement',
      'class-reminder',
      'assignment-deadline',
      'info',
      'flag_alert',
      'attendance',
      'schedule',
    ],
    required: true,
  },

  message: {
    type: String,
    required: true,
  },

  image: {
    type: String,
  },

  userMedia: {
    type: String,
    default: '',
  },

  unread: {
    type: Boolean,
    default: true,
  },

  actionApprove: {
    type: String,
    default: null,
  },

  actionDeny: {
    type: String,
    default: null,
  },

  for: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  },

  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },

  relatedType: {
    type: String,
    enum: [
      'attendance',
      'media',
      'schedule',
      'assignment',
      'group',
      'plea',
      'joinRequest',
    ],
  },

  link: {
    type: String,
  },

  isBroadcast: {
    type: Boolean,
    default: false,
  },
  isArchived: {
    type: Boolean,
    default: false,
  },

  targetRole: {
    type: String, // 'student', 'class_rep', 'all'
    enum: ['student', 'class_rep', 'all'],
  },

  targetGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Notification =
  mongoose.models.Notification ||
  mongoose.model('Notification', notificationSchema);

export default Notification;
