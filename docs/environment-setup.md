# Environment Variables Setup

This project uses a **Single Source of Truth** approach for environment variables management.

## Overview

All environment variables are defined in the **root `.env` file**, and scripts automatically generate environment files for backend and frontend with the appropriate variables.

```
Root .env (Master)
    ├── scripts/generate-backend-env.js → backend/.env
    └── scripts/generate-frontend-env.js → frontend/.env.local
```

## Quick Start

### 1. Initial Setup

```bash
# Copy the example file
cp .env.example .env

# Edit .env and fill in your values
nano .env  # or use your preferred editor

# Generate backend/.env and frontend/.env.local
npm run setup:env
```

### 2. Start Development

```bash
# Using Docker (recommended)
npm run dev

# Or start individually
cd backend && npm run dev
cd frontend && npm run dev
```

## File Structure

### Root `.env` (Master Configuration)

This is the **single source of truth** for all environment variables.

```env
# .env (Root)
FIREBASE_PROJECT_ID=labor-management-dev
FIREBASE_API_KEY=your-api-key
NODE_ENV=development
# ... etc
```

### Generated Files

These files are **auto-generated** from root `.env`:

- ✅ `backend/.env` - Backend environment variables
- ✅ `frontend/.env.local` - Frontend environment variables (NEXT_PUBLIC_*)

⚠️ **DO NOT EDIT THESE FILES DIRECTLY** - They will be overwritten!

## Scripts

### `npm run setup:env`

**Main setup command** - Generates all environment files from root `.env`.

```bash
npm run setup:env
```

This runs:
1. Checks if root `.env` exists
2. Generates `backend/.env`
3. Generates `frontend/.env.local`
4. Validates generated files

### `npm run setup:env:backend`

Generate only `backend/.env`:

```bash
npm run setup:env:backend
```

### `npm run setup:env:frontend`

Generate only `frontend/.env.local`:

```bash
npm run setup:env:frontend
```

## How It Works

### Backend Variables

The script extracts these variables from root `.env` and puts them in `backend/.env`:

- Server configuration (PORT, NODE_ENV)
- Firebase configuration (all FIREBASE_*)
- Cloudflare R2 (CLOUDFLARE_R2_*)
- Security (JWT_SECRET, BCRYPT_ROUNDS)
- CORS, Logging, Rate Limiting

### Frontend Variables

The script converts root `.env` variables to `NEXT_PUBLIC_*` format for `frontend/.env.local`:

```
Root .env:                          Frontend .env.local:
FIREBASE_PROJECT_ID          →      NEXT_PUBLIC_FIREBASE_PROJECT_ID
FIREBASE_API_KEY             →      NEXT_PUBLIC_FIREBASE_API_KEY
...etc
```

**Special handling:**
- Emulator hosts are converted from container names to `localhost` (for browser access)
- Backend API URL is automatically set based on BACKEND_PORT

## Environment Differences

### Development (Docker)

```env
# Root .env
FIRESTORE_EMULATOR_HOST=firebase-emulator:8080
FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
```

Generated frontend uses `localhost` instead:
```env
# frontend/.env.local (auto-generated)
NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=localhost:8080
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
```

### Production

Set these in root `.env` for production:

```env
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
CORS_ORIGIN=https://your-domain.com
```

## Updating Environment Variables

Whenever you update the root `.env`:

```bash
# Edit root .env
nano .env

# Regenerate all files
npm run setup:env

# Restart services if running
docker-compose restart
```

## Troubleshooting

### Error: `.env` not found

```bash
cp .env.example .env
# Edit .env with your values
npm run setup:env
```

### Variables not updating

Make sure to regenerate after editing `.env`:

```bash
npm run setup:env
docker-compose restart
```

### Frontend can't connect to Firebase Emulator

Check that emulator hosts use `localhost` in frontend:

```bash
cat frontend/.env.local | grep EMULATOR
# Should show localhost:8080, localhost:9099
```

If not, regenerate:

```bash
npm run setup:env:frontend
```

## Migration from Old Setup

If you have existing `backend/.env` and `frontend/.env.local`:

### Option 1: Keep your values (Recommended)

```bash
# 1. Copy your current values to root .env
cat backend/.env >> .env
cat frontend/.env.local >> .env

# 2. Edit root .env to remove duplicates and organize
nano .env

# 3. Regenerate
npm run setup:env
```

### Option 2: Start fresh

```bash
# Backup old files
mv backend/.env backend/.env.backup
mv frontend/.env.local frontend/.env.local.backup

# Create new from example
cp .env.example .env
nano .env

# Generate
npm run setup:env
```

## Benefits of This Approach

✅ **Single Source of Truth** - All config in one place
✅ **No Duplication** - Don't repeat yourself
✅ **Consistency** - Backend and frontend always use same values
✅ **Easy Updates** - Change once, apply everywhere
✅ **Type Safety** - Scripts validate variable names
✅ **Docker Compatible** - Handles container vs localhost differences

## Files Overview

```
Project Root
│
├── .env                          ← Master configuration (edit this)
├── .env.example                  ← Template with documentation
│
├── scripts/
│   ├── setup-env.js              ← Main setup script
│   ├── generate-backend-env.js   ← Backend generator
│   └── generate-frontend-env.js  ← Frontend generator
│
├── backend/
│   └── .env                      ← Auto-generated (don't edit)
│
└── frontend/
    └── .env.local                ← Auto-generated (don't edit)
```

## Additional Commands

```bash
# Start development (Docker)
npm run dev

# Start with rebuild
npm run dev:build

# Stop containers
npm run down

# View logs
npm run logs
npm run logs:backend
npm run logs:frontend
npm run logs:firebase
```

## Security Notes

- ⚠️ **Never commit** `.env` files to git
- ⚠️ Keep `.env.example` updated but **without real values**
- ⚠️ Use different values for production
- ✅ `.gitignore` is already configured to exclude `.env` files

## Support

If you encounter issues:

1. Check this documentation
2. Verify `.env` file format (no spaces around `=`)
3. Run `npm run setup:env` again
4. Check Docker logs: `npm run logs`

For more help, contact the development team.
