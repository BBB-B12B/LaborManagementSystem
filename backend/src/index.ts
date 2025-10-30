import express, { Express } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './api/middleware/errorHandler';

// Initialize Express app
const app: Express = express();
const PORT = config.port || 4000;

// ============================================
// Middleware
// ============================================

// Security
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression
app.use(compression());

// Static uploads directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    if (config.nodeEnv === 'development') {
      return true;
    }
    const path = req.path || '';
    return path.startsWith('/auth');
  },
});
app.use('/api/', limiter);

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================
// Routes
// ============================================

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
import apiRoutes from './api/routes';

app.get('/api', (_req, res) => {
  res.json({
    message: 'Labor Management System API',
    version: '0.1.0',
    status: 'development',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      dailyReports: '/api/daily-reports',
      overtime: '/api/overtime',
      projects: '/api/projects',
      skills: '/api/skills',
      dailyContractors: '/api/daily-contractors',
      wagePeriods: '/api/wage-periods',
      scanData: '/api/scan-data',
    },
  });
});

// Mount API routes
app.use('/api', apiRoutes);

// ============================================
// Error Handling
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`CORS Origin: ${config.corsOrigin}`);

  if (config.nodeEnv === 'development') {
    logger.info('🔥 Firebase Emulators:');
    logger.info(`   - Firestore: ${config.firebase.firestoreEmulatorHost}`);
    logger.info(`   - Auth: ${config.firebase.authEmulatorHost}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;
