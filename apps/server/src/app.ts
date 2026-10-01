import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/authRoutes.js';
import recordRoutes from './routes/recordRoutes.js';
import accessRoutes from './routes/accessRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import vitalsRoutes from './routes/vitalsRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import blockchainRoutes from './routes/blockchainRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import { collectionRouter } from './controllers/collectionController.js';
import { summaryController } from './controllers/summaryController.js';
import { authMiddleware } from './middleware/auth.js';
import legacyRoutes from './routes/legacyRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config/index.js';

export function createApp(): express.Application {
  const app = express();

  // Behind a reverse proxy (nginx, a load balancer) set TRUST_PROXY=1 so rate limits and
  // the session list see the visitor's address instead of the proxy's.
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  // 1. Security Headers
  app.use(helmet());

  // 2. CORS configuration
  // Only the configured front-end origins may call the API from a browser (CLIENT_ORIGINS in .env).
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients (curl, tests, server-to-server) send no Origin header
        if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    })
  );

  // 3. Rate limiting (15 min window, 500 requests for local dev / testing)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    skip: () => config.nodeEnv === 'development' || config.nodeEnv === 'test',
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP. Please try again in 15 minutes.' }
  });
  app.use(limiter);

  // 4. Request logging & body parsing
  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 5. Health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      mongoConnected: mongoose.connection.readyState === 1,
      // the client shows a "sample data" banner while the demo accounts are switched on
      demoMode: config.demoAccounts,
      network: 'Ethereum Sepolia (Local Verification Active)'
    });
  });

  // 6. Mount modular API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/records', recordRoutes);
  app.use('/api/access', accessRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/vitals', vitalsRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/blockchain', blockchainRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/prescriptions', prescriptionRoutes);
  app.use('/api/staff', collectionRouter('staff'));
  app.use('/api/admissions', collectionRouter('admissions'));
  app.use('/api/samples', collectionRouter('samples'));
  app.use('/api/claims', collectionRouter('claims'));
  app.use('/api/policyholders', collectionRouter('policyholders'));
  app.use('/api/organisations', collectionRouter('organisations'));
  app.get('/api/summary', authMiddleware(), (req, res) => summaryController.get(req, res));

  // 7. Mount legacy compatibility routes
  app.use('/', legacyRoutes);

  // 8. Global error handling
  app.use(errorHandler);

  return app;
}
