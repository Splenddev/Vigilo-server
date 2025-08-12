export async function syncScheduleInstancesWithGroup(groupId, updatedMembers) {
  const futureInstances = await ScheduleInstance.find({
    scheduleId: groupId,
    classDate: { $gte: new Date() },
  });

  for (const instance of futureInstances) {
    // Map current studentPresence for quick lookup
    const currentPresenceMap = new Map(
      instance.studentPresence.map((sp) => [sp.studentId.toString(), sp])
    );

    // Add new members
    updatedMembers.forEach((member) => {
      if (!currentPresenceMap.has(member._id.toString())) {
        instance.studentPresence.push({
          studentId: member._id,
          status: 'absent',
        });
      }
    });

    // Remove members no longer in group
    instance.studentPresence = instance.studentPresence.filter((sp) =>
      updatedMembers.some((m) => m._id.toString() === sp.studentId.toString())
    );

    await instance.save();
  }
}
