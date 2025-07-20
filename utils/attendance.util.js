export const getFinalStatus = ({
  checkInStatus,
  checkOutStatus,
  pleaStatus = null,
}) => {
  // 1. Plea approved overrides other logic
  if (pleaStatus === 'approved') {
    return 'excused';
  }

  // 2. If both check-in and check-out were missed
  if (checkInStatus === 'absent' && checkOutStatus === 'missed') {
    return 'absent';
  }

  // 3. Partial presence logic
  const partialConditions = [
    // Only checked in or checked out
    checkInStatus !== 'absent' && checkOutStatus === 'missed',
    checkInStatus === 'absent' && checkOutStatus !== 'missed',

    // Left early or arrived late
    checkInStatus === 'late' && checkOutStatus === 'on_time',
    checkInStatus === 'on_time' && checkOutStatus === 'left_early',
    checkInStatus === 'late' && checkOutStatus === 'left_early',
  ];

  if (partialConditions.some(Boolean)) {
    return 'partial';
  }

  // 4. Fully present
  if (checkInStatus === 'on_time' && checkOutStatus === 'on_time') {
    return 'present';
  }

  // Default fallback
  return 'absent';
};
