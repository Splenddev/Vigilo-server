import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const COLLECTION_NAME = 'attendances';

async function dropOldIndex() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection(COLLECTION_NAME);

    const indexes = await collection.indexes();
    console.log('📜 Current indexes:', indexes);

    const targetIndexName = 'groupId_1_scheduleId_1';

    const indexExists = indexes.find((idx) => idx.name === targetIndexName);
    if (indexExists) {
      await collection.dropIndex(targetIndexName);
      console.log(`🗑️ Dropped index: ${targetIndexName}`);
    } else {
      console.log(`ℹ️ Index "${targetIndexName}" not found. Nothing to drop.`);
    }

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (err) {
    console.error('❌ Error while dropping index:', err.message);
    process.exit(1);
  }
}

dropOldIndex();
