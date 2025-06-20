import Group from '../models/group.js';
import User from '../models/userModel.js';
import Schedule from '../models/schedule.model.js';
import Attendance from '../models/attendance.model.js';

export const createGroup = async (req, res) => {
  try {
    const user = req.user;
    const {
      groupName,
      course = '',
      description = '',
      classRules = '',
      visibility = 'public',
      academicYear = '',
      groupLink = '',
      department,
      faculty,
      level,
      assistantReps,
      attendancePolicy,
      tags,
      schedules,
    } = req.body;

    // Parse JSON fields
    const parsedAssistantReps = JSON.parse(assistantReps || '[]');
    const parsedPolicy = JSON.parse(attendancePolicy || '{}');
    const parsedTags = JSON.parse(tags || '[]');
    const parsedSchedules = JSON.parse(schedules || '[]');

    // Basic validation
    if (user.role !== 'class-rep') {
      return res
        .status(403)
        .json({ success: false, message: 'Only class reps can create groups' });
    }

    if (!groupName || !department || !faculty || !level) {
      return res
        .status(400)
        .json({ success: false, message: 'Required fields missing' });
    }

    const exists = await Group.findOne({ groupName, level, department });
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: 'Group already exists' });
    }

    // Resolve assistant reps to ObjectIds
    let validAssistantReps = [];
    if (Array.isArray(parsedAssistantReps) && parsedAssistantReps.length > 0) {
      const repsFound = await User.find({
        matricNumber: { $in: parsedAssistantReps.map((rep) => rep.trim()) },
      }).select('_id');

      if (repsFound.length !== parsedAssistantReps.length) {
        return res.status(400).json({
          stauccessfalse,
          message:
            'One or more assistant reps are invalid or not registered users.',
        });
      }

      validAssistantReps = repsFound.map((u) => u._id);
    }

    const bannerUrl = req.file?.path || '';

    const group = await Group.create({
      groupName,
      course,
      bannerUrl,
      description,
      classRules,
      assistantReps: validAssistantReps,
      attendancePolicy: parsedPolicy,
      visibility,
      academicYear,
      groupLink,
      department,
      faculty,
      level,
      tags: parsedTags,
      schedules: parsedSchedules,

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
          avatar: user.profilePicture,
        },
      ],
    });

    const groupObj = group.toObject({ virtuals: true });
    user.group = groupObj._id;
    await user.save();

    res.status(201).json({
      message: `Group for: ${groupName} created successfully.`,
      data: groupObj,
    });
  } catch (err) {
    console.error('Group creation failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create group' });
  }
};

export const findGroupById = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('schedules')
      .populate('attendances')
      .populate('assistantReps', 'name matricNumber')
      .lean({ virtuals: true });

    if (!group)
      return res
        .status(404)
        .json({ success: false, message: 'Group not found' });
    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
export const searchGroup = async (req, res) => {
  const { query, faculty, department, level, sortOrder = 'asc' } = req.query;
  const filters = { visibility: 'public', isArchived: false };

  if (faculty) filters.faculty = faculty;
  if (department) filters.department = department;
  if (level) filters.level = level + 'L';

  try {
    let groups = await Group.find(filters)
      .select(
        'groupName faculty department level visibility creator joinRequests bannerUrl'
      )
      .populate('creator', 'name')
      .lean();

    if (query) {
      const q = query.toLowerCase();
      groups = groups.filter(
        (g) =>
          g.groupName.toLowerCase().includes(q) ||
          g.creator?.name?.toLowerCase().includes(q)
      );
    }

    groups.sort((a, b) =>
      sortOrder === 'asc'
        ? a.groupName.localeCompare(b.groupName)
        : b.groupName.localeCompare(a.groupName)
    );

    const joinStatus = {};
    groups.forEach((g) => {
      if (!req.user) {
        joinStatus[g._id] = 'none';
      } else {
        joinStatus[g._id] = g.joinRequests.some((jr) =>
          jr.user.equals(req.user._id)
        )
          ? 'pending'
          : 'none';
      }
    });

    res.json({ success: true, groups, joinStatus });
  } catch (err) {
    console.error('FetchGroups error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const joinGroup = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const already = group.joinRequests.some((jr) => jr.user.equals(userId));
    if (already)
      return res.status(400).json({ message: 'Request already sent' });

    group.joinRequests.push({ user: userId });
    await group.save();

    res.json({ success: true, message: 'Join request sent' });
  } catch (err) {
    console.error('requestJoinGroup error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const cancelJoinRequest = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const beforeCount = group.joinRequests.length;
    group.joinRequests = group.joinRequests.filter(
      (jr) => !jr.user.equals(userId)
    );

    if (group.joinRequests.length === beforeCount) {
      return res.status(400).json({ message: 'No pending request to cancel' });
    }

    await group.save();
    res.json({ success: true, message: 'Join request canceled' });
  } catch (err) {
    console.error('cancelJoinRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
