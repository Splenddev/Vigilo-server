import mongoose from 'mongoose';

// === Embedded Schemas ===

const attendancePolicySchema = new mongoose.Schema(
  {
    minPercentage: {
      type: Number,
      default: 75,
      min: 0,
      max: 100,
    },
    allowPlea: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const joinRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const memberSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: String,
    matricNumber: String,
    role: {
      type: String,
      enum: ['student', 'class-rep', 'assistant-rep'],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// === Main Group Schema ===

const groupSchema = new mongoose.Schema(
  {
    groupName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    course: {
      type: String,
      trim: true,
      default: '',
    },
    bannerUrl: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    classRules: {
      type: String,
      trim: true,
      default: '',
    },
    assistantReps: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    attendancePolicy: {
      type: attendancePolicySchema,
      default: () => ({}),
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    academicYear: {
      type: String,
      trim: true,
      default: '',
      match: [/^\d{4}\/\d{4}$/, 'Academic year must be in YYYY/YYYY format'],
    },
    groupLink: {
      type: String,
      trim: true,
      default: '',
    },
    faculty: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: String,
      required: true,
      trim: true,
      enum: ['100L', '200L', '300L', '400L', '500L', '600L', 'Final'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    creator: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: String,
      matricNumber: String,
      role: {
        type: String,
        enum: ['student', 'class-rep'],
      },
    },
    joinRequests: {
      type: [joinRequestSchema],
      default: [],
    },
    members: {
      type: [memberSchema],
      default: [],
      validate: {
        validator: function (value) {
          const ids = value.map((v) => v._id.toString());
          return new Set(ids).size === ids.length;
        },
        message: 'Duplicate member IDs are not allowed.',
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    schedules: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Schedule',
      },
    ],
    attendances: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// === Virtuals ===

groupSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

// === Index Suggestions ===

groupSchema.index({ visibility: 1 });
groupSchema.index({ department: 1, level: 1 });
groupSchema.index({ 'members._id': 1 });

// === Model Export ===

const Group = mongoose.models.Group || mongoose.model('Group', groupSchema);
export default Group;
