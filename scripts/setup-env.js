#!/usr/bin/env node
/**
 * Setup Environment Variables
 *
 * This script sets up environment variables for the entire project.
 * It generates backend/.env and frontend/.env.local from the root .env file.
 *
 * Usage:
 *   npm run setup:env
 *   or
 *   node scripts/setup-env.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const ROOT_ENV = path.join(ROOT_DIR, '.env');
const ROOT_ENV_EXAMPLE = path.join(ROOT_DIR, '.env.example');

console.log('');
console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║   Labor Management System - Environment Setup        ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('');

function checkRootEnv() {
  console.log('📋 Step 1: Checking root .env file...');

  if (!fs.existsSync(ROOT_ENV)) {
    console.log('');
    console.log('⚠️  Root .env file not found!');
    console.log('');
    console.log('Creating .env from .env.example...');

    if (!fs.existsSync(ROOT_ENV_EXAMPLE)) {
      console.error('❌ Error: .env.example not found!');
      process.exit(1);
    }

    fs.copyFileSync(ROOT_ENV_EXAMPLE, ROOT_ENV);
    console.log('✅ Created .env file');
    console.log('');
    console.log('⚠️  IMPORTANT: Please edit .env and fill in your actual values!');
    console.log('   Then run this script again: npm run setup:env');
    console.log('');
    process.exit(0);
  }

  console.log('✅ Root .env file exists');
  console.log('');
}

function runScript(scriptPath, description) {
  console.log(`🔧 ${description}...`);

  try {
    execSync(`node "${scriptPath}"`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (error) {
    console.error(`❌ Error running ${scriptPath}`);
    process.exit(1);
  }
}

function validateGeneratedFiles() {
  console.log('🔍 Step 4: Validating generated files...');
  console.log('');

  const backendEnv = path.join(ROOT_DIR, 'backend', '.env');
  const frontendEnv = path.join(ROOT_DIR, 'frontend', '.env.local');

  const files = [
    { path: backendEnv, name: 'backend/.env' },
    { path: frontendEnv, name: 'frontend/.env.local' },
  ];

  let allValid = true;

  for (const file of files) {
    if (fs.existsSync(file.path)) {
      const size = fs.statSync(file.path).size;
      console.log(`   ✅ ${file.name} (${size} bytes)`);
    } else {
      console.log(`   ❌ ${file.name} - NOT FOUND`);
      allValid = false;
    }
  }

  console.log('');

  if (!allValid) {
    console.error('❌ Some files were not generated correctly!');
    process.exit(1);
  }

  return true;
}

function printSummary() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   🎉 Environment Setup Complete!                     ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Generated files:');
  console.log('  ✅ backend/.env');
  console.log('  ✅ frontend/.env.local');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review the generated files');
  console.log('  2. Start your development servers:');
  console.log('     - Docker: docker-compose up');
  console.log('     - Local: npm run dev (in backend and frontend dirs)');
  console.log('');
  console.log('📝 Note: If you update .env, run this script again:');
  console.log('   npm run setup:env');
  console.log('');
}

// Main execution
async function main() {
  try {
    // Step 1: Check root .env
    checkRootEnv();

    // Step 2: Generate backend .env
    runScript(
      path.join(__dirname, 'generate-backend-env.js'),
      'Step 2: Generating backend/.env'
    );

    // Step 3: Generate frontend .env.local
    runScript(
      path.join(__dirname, 'generate-frontend-env.js'),
      'Step 3: Generating frontend/.env.local'
    );

    // Step 4: Validate
    validateGeneratedFiles();

    // Print summary
    printSummary();

    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
