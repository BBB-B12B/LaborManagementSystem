import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

const toBooleanFlag = (value: string | undefined, defaultValue: boolean): boolean => {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

export const config = {
  // Node environment
  nodeEnv,

  // Server
  port: parseInt(process.env.PORT || '4000', 10),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Rate limiting
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),

  // Security
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',

  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'labor-management-dev',
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080',
    authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099',
    useEmulator: toBooleanFlag(
      process.env.FIREBASE_EMULATOR_ENABLED,
      nodeEnv === 'development'
    ),
  },

  // Cloudflare R2
  cloudflareR2: {
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || '',
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY || '',
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'labor-management-uploads',
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || '',
  },
};

if (!config.firebase.useEmulator) {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_EMULATOR_HOST;
}

// Validate required environment variables
const requiredEnvVars = ['FIREBASE_PROJECT_ID'];

if (config.nodeEnv === 'production') {
  requiredEnvVars.push('JWT_SECRET', 'CLOUDFLARE_R2_ENDPOINT', 'CLOUDFLARE_R2_ACCESS_KEY');
}

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  if (config.nodeEnv === 'production') {
    process.exit(1);
  }
}
