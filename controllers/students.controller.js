import StudentAttendance from '../models/student.attendance.model.js';

export const getDetailedStudentAttendanceSummary = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Fetch all attendance records for this student in the group
    const records = await StudentAttendance.find({ studentId }).lean();

    if (!records.length) {
      return res.status(404).json({
        success: false,
        message: 'No attendance records found for this student in this group.',
      });
    }

    const total = records.length;

    // Status counters
    let onTime = 0,
      late = 0,
      absent = 0,
      other = 0;
    let completedCheckOut = 0,
      leftEarly = 0,
      missedCheckOut = 0;
    let presentFinal = 0,
      partialFinal = 0,
      absentFinal = 0;

    // Plea
    let pleaSubmitted = 0,
      pleaApproved = 0,
      pleaRejected = 0,
      pleaPending = 0;

    // Discipline
    let warnings = 0,
      penalties = 0,
      rewards = 0,
      flagged = 0,
      verified = 0;

    // Timing
    let totalArrivalDelta = 0,
      totalPresenceDuration = 0,
      hasDurationCount = 0;

    // Geo
    let geoCheckIns = 0,
      totalDistance = 0,
      geoDistanceCount = 0;

    for (const r of records) {
      // Check-in status
      switch (r.finalStatus) {
        case 'on_time':
          onTime++;
          break;
        case 'present':
          onTime++;
          break;
        case 'late':
          late++;
          break;
        case 'absent':
          absent++;
          break;
        default:
          other++;
          break;
      }

      // Check-out status
      switch (r.checkOutStatus) {
        case 'completed':
          completedCheckOut++;
          break;
        case 'left_early':
          leftEarly++;
          break;
        case 'missed':
          missedCheckOut++;
          break;
      }

      // Final status
      switch (r.finalStatus) {
        case 'present':
          presentFinal++;
          break;
        case 'partial':
          partialFinal++;
          break;
        case 'absent':
          absentFinal++;
          break;
      }

      // Pleas
      if (r.plea?.status) {
        pleaSubmitted++;
        if (r.plea.status === 'approved') pleaApproved++;
        else if (r.plea.status === 'rejected') pleaRejected++;
        else if (r.plea.status === 'pending') pleaPending++;
      }

      // Discipline
      if (r.flagged?.isFlagged) flagged++;
      warnings += r.warningsIssued || 0;
      penalties += r.penaltyPoints || 0;
      rewards += r.rewardPoints || 0;
      if (r.verifiedByRep) verified++;

      // Timing
      if (typeof r.arrivalDeltaMinutes === 'number') {
        totalArrivalDelta += r.arrivalDeltaMinutes;
      }

      const checkInTime = r.checkIn?.time;
      const checkOutTime = r.checkOut?.time;

      if (checkInTime && checkOutTime) {
        const duration = Math.max(0, (checkOutTime - checkInTime) / 60000); // minutes
        totalPresenceDuration += duration;
        hasDurationCount++;
      }

      // Geo
      if (r.checkIn?.method === 'geo') geoCheckIns++;
      const distance = r.checkIn?.distanceFromClassMeters;
      if (typeof distance === 'number') {
        totalDistance += distance;
        geoDistanceCount++;
      }
    }

    const percent = (val) => ((val / total) * 100).toFixed(1) + '%';

    return res.status(200).json({
      success: true,
      studentId,
      totalSessions: total,

      statusSummary: {
        onTime: percent(onTime),
        late: percent(late),
        absent: percent(absent),
        other: percent(other),
      },

      checkOutSummary: {
        completed: percent(completedCheckOut),
        leftEarly: percent(leftEarly),
        missed: percent(missedCheckOut),
      },

      finalStatusSummary: {
        present: percent(presentFinal),
        partial: percent(partialFinal),
        absent: percent(absentFinal),
      },

      pleaSummary: {
        submitted: pleaSubmitted,
        approved: pleaApproved,
        rejected: pleaRejected,
        pending: pleaPending,
        successRate: pleaSubmitted
          ? ((pleaApproved / pleaSubmitted) * 100).toFixed(1) + '%'
          : '0%',
      },

      disciplineSummary: {
        warnings,
        penaltyPoints: penalties,
        rewardPoints: rewards,
        flaggedSessions: flagged,
        verifiedByRep: verified,
      },

      timingSummary: {
        averageArrivalDeltaMins: totalArrivalDelta
          ? (totalArrivalDelta / total).toFixed(1)
          : 'N/A',
        averagePresenceDurationMins: hasDurationCount
          ? (totalPresenceDuration / hasDurationCount).toFixed(1)
          : 'N/A',
      },

      geoSummary: {
        geoCheckIns,
        avgDistanceMeters: geoDistanceCount
          ? (totalDistance / geoDistanceCount).toFixed(1)
          : 'N/A',
      },
    });
  } catch (err) {
    console.error('Error computing student summary:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
