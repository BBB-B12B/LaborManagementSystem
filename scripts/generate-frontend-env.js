#!/usr/bin/env node
/**
 * Generate Frontend .env.local from Root .env
 *
 * This script reads the root .env file and generates frontend/.env.local
 * with only the NEXT_PUBLIC_* variables and other frontend-specific variables.
 */

const fs = require('fs');
const path = require('path');

const ROOT_ENV = path.join(__dirname, '..', '.env');
const FRONTEND_ENV = path.join(__dirname, '..', 'frontend', '.env.local');

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

function generateFrontendEnv() {
  console.log('🔧 Generating frontend/.env.local from root .env...\n');

  // Parse root .env
  const rootEnv = parseEnvFile(ROOT_ENV);

  // Build frontend .env.local content
  let frontendContent = `# ============================================
# Frontend Environment Variables
# ============================================
# ⚠️  AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
# Generated from root .env by scripts/generate-frontend-env.js
# Run 'npm run setup:env' to regenerate
# ============================================

`;

  // Firebase Configuration (convert to NEXT_PUBLIC_*)
  frontendContent += `# ============================================
# Firebase Configuration
# ============================================
# These variables are exposed to the browser
NEXT_PUBLIC_FIREBASE_PROJECT_ID=${rootEnv['FIREBASE_PROJECT_ID'] || ''}
NEXT_PUBLIC_FIREBASE_API_KEY=${rootEnv['FIREBASE_API_KEY'] || ''}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${rootEnv['FIREBASE_AUTH_DOMAIN'] || ''}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${rootEnv['FIREBASE_STORAGE_BUCKET'] || ''}
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${rootEnv['FIREBASE_MESSAGING_SENDER_ID'] || ''}
NEXT_PUBLIC_FIREBASE_APP_ID=${rootEnv['FIREBASE_APP_ID'] || ''}
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${rootEnv['FIREBASE_MEASUREMENT_ID'] || ''}

`;

  // Firebase Emulator Configuration
  const firestoreEmulator = rootEnv['FIRESTORE_EMULATOR_HOST'] || '';
  const authEmulator = rootEnv['FIREBASE_AUTH_EMULATOR_HOST'] || '';

  // Convert container hostnames to localhost for frontend (browser access)
  const firestoreEmulatorBrowser = firestoreEmulator.replace('firebase-emulator:', 'localhost:');
  const authEmulatorBrowser = authEmulator.replace('firebase-emulator:', 'localhost:');
  const emulatorEnabled =
    rootEnv['NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED'] ??
    rootEnv['FIREBASE_EMULATOR_ENABLED'] ??
    '';

  frontendContent += `# ============================================
# Firebase Emulator (Development Only)
# ============================================
# Frontend runs in browser, so it needs localhost instead of container names
NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=${firestoreEmulatorBrowser}
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=${authEmulatorBrowser}
NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED=${emulatorEnabled}

`;

  // Backend API URL
  const backendPort = rootEnv['BACKEND_PORT'] || '4000';
  frontendContent += `# ============================================
# Backend API Configuration
# ============================================
NEXT_PUBLIC_API_URL=http://localhost:${backendPort}/api

`;

  // Environment
  frontendContent += `# ============================================
# Application Environment
# ============================================
NEXT_PUBLIC_ENV=${rootEnv['NODE_ENV'] || 'development'}

`;

  // Write frontend/.env.local
  fs.writeFileSync(FRONTEND_ENV, frontendContent);

  console.log('✅ Generated: frontend/.env.local');
  console.log('   - Converted Firebase config to NEXT_PUBLIC_* variables');
  console.log('   - Adjusted emulator hosts for browser access (localhost)');
  console.log('');
}

// Run
try {
  generateFrontendEnv();
} catch (error) {
  console.error('❌ Error generating frontend/.env.local:', error.message);
  process.exit(1);
}
