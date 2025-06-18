import Group from '../models/group.js';

export const createGroup = async (req, res) => {
  try {
    const user = req.user; // From auth middleware

    if (user.role !== 'class-rep') {
      return res
        .status(403)
        .json({ error: 'Only class reps can create groups' });
    }

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

    const bannerUrl = req.file?.path || '';

    // Create the group
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

    // Optional: include virtuals like memberCount
    const groupObj = group.toObject({ virtuals: true });

    res.status(201).json(groupObj);
  } catch (err) {
    console.error('Group creation failed:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
};
