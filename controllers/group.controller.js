import Group from '../models/group.js';
import User from '../models/userModel.js';
import Attendance from '../models/attendance.model.js';
import { sendNotification } from '../utils/sendNotification.js';
import Notification from '../models/notification.model.js';
import { hasRecentlySentNotification } from '../utils/rateLimitNotification.js';
import StudentAttendance from '../models/student.attendance.model.js';

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
  const filters = { isArchived: false };

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

  const {
    _id: userId,
    name,
    department,
    level,
    profilePicture,
    matricNumber,
  } = user;

  try {
    const group = await Group.findById(groupId).populate('createdBy');
    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: 'Group not found' });
    }

    const isMember = group.members.some(
      (member) => member.user && member.user.equals(userId)
    );
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this group.',
      });
    }

    const hasGroup = user.group;
    if (hasGroup) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of another group.',
      });
    }

    const existingRequest = group.joinRequests.find((jr) =>
      jr.user.equals(userId)
    );

    // ✅ Rate limit the *action* if a join request was sent recently
    const recentlyRequested = await hasRecentlySentNotification({
      type: 'approval',
      fromUser: userId,
      forUser: group.createdBy._id,
      groupId,
      withinMinutes: 3, // configurable delay
    });

    if (recentlyRequested || existingRequest) {
      return res.status(429).json({
        success: false,
        message: `You've already submitted a join request. Please wait a few minutes before trying again.`,
      });
    }

    // ✅ Create new join request
    group.joinRequests.push({
      user: userId,
      name,
      department,
      level,
      avatar: profilePicture,
      status: 'pending',
      requestedAt: new Date(),
      matricNumber,
    });
    await group.save();

    user.requestedJoinGroup = groupId;
    await user.save();

    const classRep = group.createdBy;

    // ✅ Notify the Class Rep
    await sendNotification({
      type: 'approval',
      message: `${name} requested to join your group.`,
      forUser: classRep._id,
      fromUser: userId,
      groupId: group._id,
      relatedId: group._id,
      relatedType: 'group',
      actionApprove: 'approveJoinRequest',
      actionDeny: 'denyJoinRequest',
      image: profilePicture,
      link: `/class-rep/group-management/`,
      io: req.io,
    });

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
  const user = req.user;
  const userId = req.user._id;
  const { profilePicture } = user;
  const io = req.io;

  try {
    const group = await Group.findById(groupId).populate(
      'createdBy',
      'name _id profilePicture'
    );
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // ⛔️ Check if user is already a member
    const isMember = group.members.some(
      (member) =>
        member._id?.toString?.() === userId.toString() || // embedded _id
        member.user?.toString?.() === userId.toString() // subdoc with .user
    );

    if (isMember) {
      return res.status(400).json({
        success: false,
        message:
          'You are already a member of this group. Join request not applicable.',
      });
    }

    // ⛔️ Check if user has already canceled recently (3 min)
    const recentlyCanceled = await hasRecentlySentNotification({
      type: 'info',
      fromUser: userId,
      forUser: userId,
      groupId,
      withinMinutes: 3,
    });

    if (recentlyCanceled) {
      return res.status(429).json({
        success: false,
        message:
          'You already canceled this request recently. Please wait a few minutes before trying again.',
      });
    }

    // 🔄 Cancel request
    const index = group.joinRequests.findIndex((jr) => jr.user.equals(userId));

    if (index === -1) {
      return res
        .status(400)
        .json({ success: false, message: 'No pending request to cancel.' });
    }

    group.joinRequests.splice(index, 1);
    await group.save();

    const repId = group.createdBy?._id;

    if (repId) {
      await sendNotification({
        type: 'info',
        message: `A student canceled their join request to your group.`,
        forUser: repId,
        fromUser: userId,
        groupId,
        relatedType: 'joinRequest',
        relatedId: groupId,
        image: profilePicture || null,
        io,
      });
    }

    await sendNotification({
      type: 'info',
      message: `Your join request to "${group.groupName}" has been canceled by you.`,
      forUser: userId,
      fromUser: userId,
      groupId,
      relatedType: 'joinRequest',
      relatedId: groupId,
      io,
    });

    return res.json({
      success: true,
      message: 'Join request canceled successfully.',
    });
  } catch (err) {
    console.error('cancelJoinRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const approveJoinRequest = async (req, res) => {
  const { groupId, studentId } = req.params;
  const repUser = req.user;
  const io = req.io;

  try {
    // 1. Fetch the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: 'Group not found.' });
    }

    if (group.createdBy.toString() !== repUser._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: 'Not authorized.' });
    }

    // 2. Check join request
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

    // 3. Ensure user isn't already a member
    const alreadyMember = group.members.some(
      (member) => member._id.toString() === studentId
    );
    if (alreadyMember) {
      return res.status(409).json({
        success: false,
        message: `This user is already a member of ${group.groupName}.`,
      });
    }

    // 4. Add to group members
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

    // 5. Remove from joinRequests
    group.joinRequests.splice(requestIndex, 1);
    await group.save();

    // 6. Update student's group reference
    const student = await User.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: 'Student not found.' });
    }
    student.group = groupId;
    await student.save();

    // 7. Add StudentAttendance record if attendance is active
    const today = new Date().toISOString().split('T')[0];
    const activeAttendance = await Attendance.findOne({
      groupId,
      classDate: today,
      status: 'active',
    });

    if (activeAttendance) {
      const existing = await StudentAttendance.findOne({
        attendanceId: activeAttendance._id,
        studentId: student._id,
      });

      if (!existing) {
        await StudentAttendance.create({
          attendanceId: activeAttendance._id,
          studentId: student._id,
          name: student.name,
          status: 'absent',
          joinedAfterAttendanceCreated: true,
          flagged: {
            isFlagged: true,
            flaggedBy: repUser._id,
            flaggedAt: new Date(),
            note: 'Student joined group after attendance was created.',
            reasons: [
              {
                type: 'joined_after_attendance_created', // not "code"
                note: 'Student was not in the group when attendance was started.',
                severity: 'medium', // optional, but good to include
                detectedBy: 'system', // or 'rep' if flagged manually
              },
            ],
          },
        });

        console.log(`[✅] ${student.name} added to today's attendance`);
      }
    }

    // 8. Notify student
    await sendNotification({
      type: 'info',
      forUser: student._id,
      fromUser: repUser._id,
      message: `Your request to join "${group.groupName}" was approved.`,
      groupId,
      relatedType: 'group',
      relatedId: group._id,
      io,
    });

    // 9. Notify class rep as confirmation
    await sendNotification({
      type: 'info',
      forUser: repUser._id,
      fromUser: student._id,
      message: `You approved ${request.name}'s join request.`,
      groupId,
      relatedType: 'group',
      relatedId: group._id,
      io,
    });

    // 10. Archive old approval-related notifications
    await Notification.updateMany(
      {
        from: student._id,
        for: repUser._id,
        groupId,
        type: 'approval',
        relatedType: 'group',
        relatedId: group._id,
        isArchived: false,
      },
      {
        $set: {
          isArchived: true,
          actionApprove: null,
          actionDeny: null,
        },
      }
    );

    // 11. Emit socket updates
    io.to(student._id.toString()).emit('user:refresh');
    io.to(repUser._id.toString()).emit('group:notification', {
      groupId: group._id,
      action: 'member-approved',
      updatedBy: student._id,
    });

    return res.status(200).json({
      success: true,
      message: `${request.name} has been approved and added to the group.`,
      memberId: student._id,
    });
  } catch (err) {
    console.error('❌ approveJoinRequest error:', err);
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
  const io = req.io;

  try {
    // 🔍 1. Find the group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found. Please check the group ID.',
      });
    }

    // 🔐 2. Check Class Rep permissions
    if (group.createdBy.toString() !== repUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized to reject join requests for this group.',
      });
    }

    // 🧼 3. Look for the pending request
    const requestIndex = group.joinRequests.findIndex(
      (r) => r.user.toString() === studentId
    );

    if (requestIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'No pending join request found for the specified student.',
      });
    }

    const rejectedRequest = group.joinRequests[requestIndex];

    // ❌ 4. Remove the request from the array
    group.joinRequests.splice(requestIndex, 1);
    await group.save();

    // 🔔 5. Notify the student
    await sendNotification({
      type: 'info',
      forUser: studentId,
      fromUser: repUser._id,
      message: `Your request to join "${group.groupName}" has been rejected.`,
      groupId: group._id,
      relatedId: group._id,
      relatedType: 'group',
      io,
    });

    // 🗃️ 6. Archive any past approval-related notifications
    await Notification.updateMany(
      {
        for: studentId,
        from: repUser._id,
        groupId: group._id,
        relatedType: 'group',
        type: 'approval',
        isArchived: false,
      },
      { $set: { isArchived: true } }
    );

    // ✅ 7. Return success
    return res.status(200).json({
      success: true,
      message: `Join request from ${rejectedRequest.name || 'the student'} has been rejected.`,
      studentId: rejectedRequest.user,
    });
  } catch (err) {
    console.error('❌ rejectJoinRequest error:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while rejecting the join request.',
      error: err.message,
    });
  }
};

export const leaveGroup = async (req, res) => {
  const user = req.user;
  const io = req.io;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. User not found.',
    });
  }

  const { group: groupId } = user;

  if (!groupId) {
    return res.status(400).json({
      success: false,
      message: 'You are not part of any group.',
    });
  }

  try {
    const group = await Group.findById(groupId).populate('createdBy');
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.',
      });
    }

    if (group.creator._id.toString() === user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'REP_MUST_ASSIGN',
        message:
          'As the Class Rep, you must assign a new Class Rep before leaving the group.',
      });
    }

    const userIdStr = user._id.toString();

    // ❌ Remove from members
    group.members = group.members.filter((m) => m._id.toString() !== userIdStr);

    // ❌ Remove from join requests
    group.joinRequests = group.joinRequests.filter(
      (r) => r.user.toString() !== userIdStr
    );

    await group.save();

    // ❌ Clear user's group info
    user.group = null;
    user.requestedJoinGroup = null;
    await user.save();

    // ❌ Remove from today's active attendance via StudentAttendance
    const todayISO = new Date().toISOString().split('T')[0];
    const activeAttendance = await Attendance.findOne({
      groupId,
      classDate: todayISO,
      status: 'active',
    });

    if (activeAttendance) {
      await StudentAttendance.deleteOne({
        attendanceId: activeAttendance._id,
        studentId: user._id,
      });
    }

    // 🔔 Notify Class Rep
    const repId = group.createdBy?._id?.toString();
    if (repId) {
      await sendNotification({
        type: 'info',
        message: `${user.name} has left your group: ${group.groupName}.`,
        forUser: repId,
        fromUser: user._id,
        groupId,
        relatedId: groupId,
        relatedType: 'group',
        image: user.profilePicture || null,
        io,
      });
    }

    // 📦 Archive old group-related notifications
    await Notification.updateMany(
      {
        for: user._id,
        groupId,
        relatedType: 'group',
        isArchived: false,
        type: { $in: ['approval', 'info'] },
      },
      { $set: { isArchived: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'You have successfully left the group.',
    });
  } catch (err) {
    console.error('❌ leaveGroup error:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while leaving the group.',
      error: err.message,
    });
  }
};

export const transferLeadership = async (req, res) => {
  const { groupId, newRepId } = req.body;
  const repUser = req.user;

  try {
    const group = await Group.findById(groupId).populate('members');
    if (!group) {
      return res
        .status(404)
        .json({ success: false, message: 'Group not found.' });
    }

    // Ensure caller is the current rep
    if (group.createdBy.toString() !== repUser._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the current Class Rep can assign a new rep.',
      });
    }

    const newRep = group.members.find(
      (member) => member._id.toString() === newRepId
    );

    if (!newRep) {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not a member of this group.',
      });
    }

    group.createdBy = newRepId;
    await group.save();

    // Optional: notify both users
    await sendNotification({
      forUser: newRepId,
      fromUser: repUser._id,
      type: 'info',
      groupId,
      relatedId: groupId,
      relatedType: 'group',
      message: `🎓 You have been assigned as the new Class Rep of "${group.groupName}".`,
      io: req.io,
    });

    return res.status(200).json({
      success: true,
      message: `Leadership successfully transferred to ${newRep.name}.`,
    });
  } catch (err) {
    console.error('❌ Error transferring leadership:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while assigning the new rep.',
    });
  }
};

export const deleteGroup = async (req, res) => {
  const user = req.user;
  const io = req.io;
  const { groupId } = req.params;

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. User not found.',
    });
  }

  try {
    const group = await Group.findById(groupId).populate('members createdBy');
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found.',
      });
    }

    // Ensure only Class Rep can delete group
    if (group.createdBy._id.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the Class Rep can delete this group.',
      });
    }

    // Update each user's group info
    await Promise.all(
      group.members.map(async (member) => {
        member.group = null;
        member.requestedJoinGroup = null;
        await member.save();

        // Optional: notify members
        await sendNotification({
          forUser: member._id,
          fromUser: user._id,
          type: 'info',
          groupId,
          message: `❌ Your group "${group.groupName}" has been deleted by the Class Rep.`,
          relatedType: 'group',
          relatedId: groupId,
          io,
        });
      })
    );

    // Delete related models
    await Attendance.deleteMany({ groupId });
    await StudentAttendance.deleteMany({ groupId });
    await Notification.deleteMany({ groupId });
    // await Assignment.deleteMany({ groupId });
    // await Media.deleteMany({ groupId });

    // Delete the group itself
    await Group.findByIdAndDelete(groupId);

    return res.status(200).json({
      success: true,
      message: `Group "${group.groupName}" deleted successfully.`,
    });
  } catch (err) {
    console.error('❌ deleteGroup error:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the group.',
      error: err.message,
    });
  }
};

// export const leaveGroup = async (req, res) => {
//   const user = req.user;

//   if (!user) {
//     return res.status(401).json({
//       success: false,
//       message: 'Unauthorized. User not found.',
//     });
//   }

//   const { group: groupId } = user;

//   if (!groupId) {
//     return res.status(400).json({
//       success: false,
//       message: 'You are not part of any group.',
//     });
//   }

//   try {
//     const group = await Group.findById(groupId);
//     if (!group) {
//       return res.status(404).json({
//         success: false,
//         message: 'Group not found.',
//       });
//     }

//     const today = new Date().toISOString().split('T')[0];
//     const activeAttendance = await Attendance.findOne({
//       groupId,
//       classDate: today,
//       status: 'active',
//     });

//     // 🚫 Protection: Prevent leaving during an active session
//     if (activeAttendance) {
//       return res.status(403).json({
//         success: false,
//         message:
//           'You cannot leave the group while a class attendance session is active. Try again later.',
//       });
//     }

//     // ✅ Remove from members
//     group.members = group.members.filter(
//       (member) => member._id.toString() !== user._id.toString()
//     );

//     // ✅ Remove any pending join request
//     group.joinRequests = group.joinRequests.filter(
//       (r) => r.user.toString() !== user._id.toString()
//     );

//     await group.save();

//     // ✅ Reset user group fields
//     user.group = null;
//     user.requestedJoinGroup = null;
//     await user.save();

//     return res.status(200).json({
//       success: true,
//       message: 'You have successfully left the group.',
//     });
//   } catch (err) {
//     console.error('leaveGroup error:', err);
//     return res.status(500).json({
//       success: false,
//       message: 'An error occurred while leaving the group.',
//       error: err.message,
//     });
//   }
// };
