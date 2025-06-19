import Group from '../models/group.js';
import User from '../models/userModel.js';

export const createGroup = async (req, res) => {
  try {
    const user = req.user; // From auth middleware

    const {
      groupName,
      course = '',
      description = '',
      classRules = '',
      assistantReps = [],
      attendancePolicy = {},
      visibility = 'public',
      academicYear = '',
      groupLink = '',
      department,
      faculty,
      level,
      schedules = [],
      tags = [],
    } = req.body;

    if (user.role !== 'class-rep') {
      return res
        .status(403)
        .json({ error: 'Only class reps can create groups' });
    }

    if (!groupName || !department || !faculty || !level) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const exists = await Group.findOne({ groupName, level, department });
    if (exists) {
      return res.status(409).json({ error: 'Group already exists' });
    }

    let validAssistantReps = [];
    if (Array.isArray(assistantReps) && assistantReps.length > 0) {
      validAssistantReps = await User.find({
        matricNumber: { $in: assistantReps.map((rep) => rep.trim()) },
      }).select('_id');

      if (validAssistantReps.length !== assistantReps.length) {
        return res.status(400).json({
          error:
            'One or more assistant reps are invalid or not registered users.',
        });
      }
    }

    const bannerUrl = req.file?.path || '';

    const group = await Group.create({
      groupName,
      course,
      bannerUrl,
      description,
      classRules,
      assistantReps,
      attendancePolicy,
      visibility,
      academicYear,
      groupLink,
      department,
      faculty,
      level,
      tags,
      schedules,

      createdBy: user._id,
      creator: {
        _id: user._id,
        name: user.name,
        matricNumber: user.matricNumber,
        role: user.role,
      },
      members: [
        {
          _id: user._id,
          name: user.name,
          matricNumber: user.matricNumber,
          role: user.role,
        },
      ],
    });

    const groupObj = group.toObject({ virtuals: true });
    user.group = groupObj._id;
    await user.save();

    res.status(201).json(groupObj);
  } catch (err) {
    console.error('Group creation failed:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
};

export const findGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('schedules')
      .populate('attendances')
      .populate('assistantReps', 'name matricNumber')
      .lean({ virtuals: true });

    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
