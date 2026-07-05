import app from './app.js';
import config, { validateConfig } from './config/index.js';
import { connectDatabase } from './config/database.js';
import { ensureDefaultFeeSchedules } from './services/paymentService.js';
import { repairSubmittedListingStatuses } from './services/verificationService.js';

async function start() {
  validateConfig();
  await connectDatabase();
  await ensureDefaultFeeSchedules();
  await repairSubmittedListingStatuses();
  app.listen(config.port, () => {
    console.log(`LandEx MERN API listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
