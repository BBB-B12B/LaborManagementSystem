#!/usr/bin/env node
/**
 * Generate Backend .env from Root .env
 *
 * This script reads the root .env file and generates backend/.env
 * with only the variables needed by the backend application.
 */

const fs = require('fs');
const path = require('path');

const ROOT_ENV = path.join(__dirname, '..', '.env');
const BACKEND_ENV = path.join(__dirname, '..', 'backend', '.env');

// Variables that backend needs
const BACKEND_VARS = [
  // Server
  'NODE_ENV',
  'PORT',
  'BACKEND_PORT',

  // Firebase
  'FIREBASE_PROJECT_ID',
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',

  // Firebase Emulator
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_EMULATOR_HOST',

  // Firebase Service Account (Production)
  'FIREBASE_SERVICE_ACCOUNT_KEY',

  // Cloudflare R2
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY',
  'CLOUDFLARE_R2_SECRET_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',

  // Security
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'BCRYPT_ROUNDS',
  'SESSION_SECRET',
  'SESSION_MAX_AGE',

  // CORS
  'CORS_ORIGIN',

  // Logging
  'LOG_LEVEL',

  // Rate Limiting
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',

  // Error Tracking
  'SENTRY_DSN',
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: ${filePath} not found`);
    console.error(`Please create .env file from .env.example first:`);
    console.error(`  cp .env.example .env`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse key=value
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  }

  return env;
}

function generateBackendEnv() {
  console.log('🔧 Generating backend/.env from root .env...\n');

  // Parse root .env
  const rootEnv = parseEnvFile(ROOT_ENV);

  // Build backend .env content
  let backendContent = `# ============================================
# Backend Environment Variables
# ============================================
# ⚠️  AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
# Generated from root .env by scripts/generate-backend-env.js
# Run 'npm run setup:env' to regenerate
# ============================================

`;

  // Add sections
  const sections = {
    'Server Configuration': ['NODE_ENV', 'PORT', 'BACKEND_PORT'],
    'CORS Configuration': ['CORS_ORIGIN'],
    'Firebase Configuration': [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_API_KEY',
      'FIREBASE_AUTH_DOMAIN',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_MESSAGING_SENDER_ID',
      'FIREBASE_APP_ID',
      'FIREBASE_MEASUREMENT_ID',
    ],
    'Firebase Emulator (Development)': [
      'FIRESTORE_EMULATOR_HOST',
      'FIREBASE_AUTH_EMULATOR_HOST',
      'FIREBASE_EMULATOR_HOST',
    ],
    'Firebase Service Account (Production)': [
      'FIREBASE_SERVICE_ACCOUNT_KEY',
    ],
    'Cloudflare R2 Storage': [
      'CLOUDFLARE_R2_ENDPOINT',
      'CLOUDFLARE_R2_ACCESS_KEY',
      'CLOUDFLARE_R2_SECRET_KEY',
      'CLOUDFLARE_R2_BUCKET_NAME',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
    ],
    'Security Configuration': [
      'JWT_SECRET',
      'JWT_EXPIRES_IN',
      'BCRYPT_ROUNDS',
      'SESSION_SECRET',
      'SESSION_MAX_AGE',
    ],
    'Logging': ['LOG_LEVEL'],
    'Rate Limiting': ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS'],
    'Error Tracking': ['SENTRY_DSN'],
  };

  for (const [section, vars] of Object.entries(sections)) {
    backendContent += `# ============================================\n`;
    backendContent += `# ${section}\n`;
    backendContent += `# ============================================\n`;

    for (const varName of vars) {
      const value = rootEnv[varName];
      if (value !== undefined) {
        // Special handling for PORT
        if (varName === 'PORT' && !value) {
          backendContent += `${varName}=${rootEnv['BACKEND_PORT'] || '4000'}\n`;
        } else {
          backendContent += `${varName}=${value}\n`;
        }
      }
    }

    backendContent += '\n';
  }

  // Write backend/.env
  fs.writeFileSync(BACKEND_ENV, backendContent);

  console.log('✅ Generated: backend/.env');
  console.log(`   - Copied ${Object.keys(rootEnv).filter(k => BACKEND_VARS.includes(k)).length} variables`);
  console.log('');
}

// Run
try {
  generateBackendEnv();
} catch (error) {
  console.error('❌ Error generating backend/.env:', error.message);
  process.exit(1);
}
