// models/Group.js
import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    courseCode: String,
    level: String,
    classRep: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

const Group = mongoose.models.Group || mongoose.model('Group', groupSchema);
export default Group;
