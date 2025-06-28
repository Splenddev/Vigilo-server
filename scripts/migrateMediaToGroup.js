import mongoose from 'mongoose';
import dotenv from 'dotenv';
import scheduleModel from '../models/schedule.model.js';
import Group from '../models/group.js';

dotenv.config(); // to load MONGODB_URI

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to DB');

    const schedules = await scheduleModel.find({
      media: { $exists: true, $ne: [] },
    });

    console.log(`🔍 Found ${schedules.length} schedules with media`);

    let migratedCount = 0;

    for (const schedule of schedules) {
      const group = await Group.findById(schedule.groupId);
      if (!group) {
        console.warn(`⚠️ Group not found for schedule: ${schedule._id}`);
        continue;
      }

      // Filter out already-added media to avoid duplicates (by cloudinaryId or src)
      const existingSrcs = new Set(group.mediaUploads.map((m) => m.src));

      const newMedia = schedule.media.filter((m) => !existingSrcs.has(m.src));

      if (newMedia.length > 0) {
        newMedia.forEach((m) => {
          m.scheduleId = schedule._id; // add scheduleId for traceability
        });

        group.mediaUploads.push(...newMedia);
        await group.save();
        migratedCount += newMedia.length;

        console.log(`📦 Migrated ${newMedia.length} → group ${group._id}`);
      }
    }

    console.log(
      `🎉 Migration complete. Total migrated media: ${migratedCount}`
    );
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

migrate();
