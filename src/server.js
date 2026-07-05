import app from './app.js';
import config, { validateConfig } from './config/index.js';
import { connectDatabase } from './config/database.js';

async function start() {
  validateConfig();
  await connectDatabase();
  app.listen(config.port, () => {
    console.log(`LandEx MERN API listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
