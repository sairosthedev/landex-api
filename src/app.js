import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { connectDatabase, isDatabaseConnected } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import listingImageRoutes from './routes/listingImageRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';
import buyerRoutes from './routes/buyerRoutes.js';
import professionalRoutes from './routes/professionalRoutes.js';
import paymentRoutes, { webhookRouter } from './routes/paymentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import trustRoutes from './routes/trustRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(morgan('dev'));

app.get('/health', async (_req, res) => {
  try {
    await connectDatabase();
    res.json({
      status: 'UP',
      db: isDatabaseConnected() ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'DEGRADED',
      db: 'disconnected',
      message: err instanceof Error ? err.message : 'Database unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  try {
    await connectDatabase();
    next();
  } catch (err) {
    next(err);
  }
});

app.use('/api/v1/payments/webhooks', webhookRouter);

app.use(express.json({ limit: '24mb' }));
app.use(express.urlencoded({ extended: true }));

const api = express.Router();
api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/listings', listingRoutes);
api.use('/documents', documentRoutes);
api.use('/verifications', verificationRoutes);
api.use('/enquiries', enquiryRoutes);
api.use('/buyers/me', buyerRoutes);
api.use('/professionals', professionalRoutes);
api.use('/payments', paymentRoutes);
api.use('/notifications', notificationRoutes);
api.use('/admin', adminRoutes);
api.use('/', listingImageRoutes);
api.use('/', trustRoutes);

app.use('/api/v1', api);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
