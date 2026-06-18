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
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS
const corsOrigins = config.corsOrigin.split(',').map((origin) => origin.trim());
app.use(
  cors({
    origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0],
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

// Trust the Cloud Run / load-balancer proxy hop so req.ip reflects the real
// client IP (from X-Forwarded-For) instead of the proxy address. Without this,
// every request looks like it comes from the same proxy IP and all users
// collapse into a single shared rate-limit bucket.
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindow,
  max: config.rateLimitMax,
  message: 'Too many requests, please try again later.',
  // Key the limit per authenticated user so each person gets their own quota
  // (users behind a shared office NAT would otherwise share one IP bucket).
  // This limiter runs before route-level auth, so req.user is not populated yet;
  // we read the uid from the bearer token payload WITHOUT verifying it — this is
  // for bucketing only, not a security boundary. Falls back to IP when no token.
  keyGenerator: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = JSON.parse(
          Buffer.from(authHeader.slice(7).split('.')[1], 'base64').toString('utf8')
        );
        const uid = payload.user_id || payload.uid || payload.sub;
        if (uid) return `user:${uid}`;
      } catch {
        // malformed/unexpected token → fall back to IP keying below
      }
    }
    return `ip:${req.ip}`;
  },
  skip: (req) => {
    if (config.nodeEnv === 'development') {
      return true;
    }
    const path = req.path || '';
    // /auth must never be throttled; heartbeat polls every 60s and is cheap.
    return path.startsWith('/auth') || path.startsWith('/activity/heartbeat');
  },
});
app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
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
// Only runs when NOT loaded by Firebase CLI for function deployment.
// Firebase sets FUNCTION_TARGET or K_SERVICE env vars when loading for analysis.
// ============================================
// NOTE: only FUNCTION_TARGET (set by the Functions Framework) means "loaded as a Cloud Function".
// K_SERVICE is ALSO set on Cloud Run, where we DO want app.listen() — so do not check it here.
const isRunningAsCloudFunction = !!process.env.FUNCTION_TARGET;

if (!isRunningAsCloudFunction) {
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

  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
  });
}

export default app;

// ============================================
// Firebase Cloud Functions
// ============================================
// หมายเหตุ: Cloud Functions ทั้งหมดถูก manage ใน functions/src/index.ts แล้ว
// ไม่มีการ export Firebase trigger functions จาก backend อีกต่อไป
// (เคยมี onScanDataChanged ที่นี่ แต่ซ้ำกับ functions/ จึงถูก remove ออก)
