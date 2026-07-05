import serverless from 'serverless-http';
import app from '../src/app.js';
import { validateConfig } from '../src/config/index.js';
import { connectDatabase } from '../src/config/database.js';

let handler;

async function bootstrap() {
  validateConfig();
  await connectDatabase();
  handler = serverless(app);
}

const ready = bootstrap();

export default async function vercelHandler(req, res) {
  await ready;
  return handler(req, res);
}
