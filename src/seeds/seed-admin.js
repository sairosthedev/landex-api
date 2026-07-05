import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import config from '../config/index.js';
import { User } from '../models/index.js';
import { ROLES } from '../constants/index.js';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@landex.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';

async function seedAdmin() {
  await connectDatabase();

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, config.auth.bcryptRounds);
  const user = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase() },
    {
      email: ADMIN_EMAIL.toLowerCase(),
      phoneNumber: process.env.SEED_ADMIN_PHONE || '+263770000001',
      passwordHash,
      firstName: 'LandEx',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
      roles: [ROLES.ADMIN],
      deletedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  console.log(`Admin user ready: ${user.email}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log('  Sign in at the frontend admin portal with these credentials.');

  await disconnectDatabase();
}

seedAdmin().catch((err) => {
  console.error('Admin seed failed:', err);
  process.exit(1);
});
