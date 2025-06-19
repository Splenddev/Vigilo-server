import mongoose from 'mongoose';

// === Time Schema (embedded) ===
const timeSchema = new mongoose.Schema(
  {
    start: {
      type: String, // e.g., "08:00"
      required: true,
      validate: {
        validator: (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        message: (props) => `${props.value} is not a valid time (HH:mm)`,
      },
    },
    end: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
        message: (props) => `${props.value} is not a valid time (HH:mm)`,
      },
    },
  },
  { _id: false }
);

// === Daily Schedule Schema ===
const dailyScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      required: true,
    },
    time: {
      type: timeSchema,
      required: true,
    },
  },
  { _id: false }
);

// === Main Schedule Schema ===
const scheduleSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
      unique: true, // 1 schedule per group
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Class rep
      required: true,
    },
    days: {
      type: [dailyScheduleSchema],
      required: true,
      validate: {
        validator: (value) => value.length > 0,
        message: 'At least one schedule day must be provided.',
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// === Model Export ===
const Schedule =
  mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);
export default Schedule;
