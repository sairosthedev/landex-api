import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { FeeSchedule } from '../models/index.js';
import { DEFAULT_FEE_SCHEDULE } from '../constants/index.js';

async function seed() {
  await connectDatabase();
  console.log('Seeding fee schedules...');

  for (const fee of DEFAULT_FEE_SCHEDULE) {
    await FeeSchedule.findOneAndUpdate(
      { feeCode: fee.feeCode },
      { ...fee, active: true },
      { upsert: true },
    );
    console.log(`  ✓ ${fee.feeCode}`);
  }

  console.log('Seed complete.');
  await disconnectDatabase();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
