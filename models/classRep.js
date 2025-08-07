import mongoose from 'mongoose';
import User from './userModel.js';

const classRepSchema = new mongoose.Schema({
  department: { type: String, required: true },
  faculty: { type: String, required: true },
  level: { type: String, required: true },

  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null,
  },
});

const ClassRep =
  mongoose.models.ClassRep || User.discriminator('class-rep', classRepSchema);

export default ClassRep;
