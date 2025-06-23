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
      visibility = '',
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

    const exists = await Group.findOne({
      groupName,
      level,
      department,
      faculty,
    });
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
          success: false,
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
      success: true,
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
  const user = req.user;

  if (!user) return res.status(404).json({ message: 'User not found' });

  const { _id: userId, name, department, level, avatar } = user;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: 'Group not found' });
    }

    // Check if user has already sent a request
    const already = group.joinRequests.some((jr) => jr.user.equals(userId));
    if (already) {
      return res
        .status(400)
        .json({ success: false, message: 'Join request already sent.' });
    }

    // Push to joinRequests
    group.joinRequests.push({ user: userId, name, department, level, avatar });
    await group.save();

    // Save requested group on user
    user.requestedJoinGroup = groupId;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Join request sent successfully.',
      groupId,
    });
  } catch (err) {
    console.error('requestJoinGroup error:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while submitting join request.',
    });
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

export const approveJoinRequest = async (req, res) => {
  const { groupId, studentId } = req.params;
  const repUser = req.user;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found. Please check the group ID.',
      });
    }

    // Only group creator can approve
    if (group.createdBy.toString() !== repUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized to manage join requests for this group.',
      });
    }

    const requestIndex = group.joinRequests.findIndex(
      (r) => r.user.toString() === studentId
    );

    if (requestIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'No pending join request found for the specified student.',
      });
    }

    const request = group.joinRequests[requestIndex];

    // Avoid duplicate membership
    const alreadyMember = group.members.some(
      (member) => member._id.toString() === studentId
    );

    if (alreadyMember) {
      return res.status(409).json({
        success: false,
        message: 'This user is already a member of the group.',
      });
    }

    // Add to members
    group.members.push({
      _id: request.user,
      name: request.name,
      department: request.department,
      level: request.level,
      avatar: request.avatar,
      role: 'student',
      joinedAt: new Date(),
      matricNumber: request.matricNumber,
    });

    // Remove join request
    group.joinRequests.splice(requestIndex, 1);

    await group.save();

    return res.status(200).json({
      success: true,
      message: `${request.name} has been successfully approved and added to the group.`,
      memberId: request.user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'An error occurred while approving the join request.',
      error: err.message,
    });
  }
};

export const rejectJoinRequest = async (req, res) => {
  const { groupId, studentId } = req.params;
  const repUser = req.user;

  try {
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found. Please check the group ID.',
      });
    }

    if (group.createdBy.toString() !== repUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized to reject join requests for this group.',
      });
    }

    const requestIndex = group.joinRequests.findIndex(
      (r) => r.user.toString() === studentId
    );

    if (requestIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'No pending join request found for the specified student.',
      });
    }

    const rejected = group.joinRequests[requestIndex];

    // Remove the request
    group.joinRequests.splice(requestIndex, 1);
    await group.save();

    return res.status(200).json({
      success: true,
      message: `${rejected.name}'s join request has been successfully rejected.`,
      studentId: rejected.user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'An error occurred while rejecting the join request.',
      error: err.message,
    });
  }
};
