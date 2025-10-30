# Labor Management System

ระบบจัดการแรงงานและรายงานประจำวัน

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- npm or yarn

### Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd LaborManagementSystem

# 2. Setup environment variables
cp .env.example .env
nano .env  # Edit with your values

# 3. Generate environment files for backend and frontend
npm run setup:env

# 4. Start with Docker
npm run dev
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Firebase Emulator UI**: http://localhost:4001

### Default Login Credentials

```
Username: admin
Password: Admin123!
```

## 📁 Project Structure

```
LaborManagementSystem/
├── .env                    # Master environment configuration
├── .env.example            # Environment template
├── docker-compose.yml      # Docker services configuration
├── package.json            # Root package.json with scripts
│
├── backend/                # Express.js backend
│   ├── src/
│   ├── scripts/
│   └── .env               # Auto-generated (don't edit)
│
├── frontend/              # Next.js frontend
│   ├── src/
│   └── .env.local        # Auto-generated (don't edit)
│
├── firebase/             # Firebase emulator configuration
│   └── firebase.json
│
├── scripts/              # Setup and utility scripts
│   ├── setup-env.js
│   ├── generate-backend-env.js
│   └── generate-frontend-env.js
│
└── docs/                 # Documentation
    └── environment-setup.md
```

## 🔧 Environment Configuration

This project uses a **Single Source of Truth** approach for environment variables.

**All configuration is in the root `.env` file**, and scripts automatically generate environment files for backend and frontend.

📖 **Full documentation**: [docs/environment-setup.md](docs/environment-setup.md)

### Quick Commands

```bash
# Generate all environment files from root .env
npm run setup:env

# Generate backend/.env only
npm run setup:env:backend

# Generate frontend/.env.local only
npm run setup:env:frontend
```

⚠️ **Important**:
- Edit only the **root `.env`** file
- Run `npm run setup:env` after changes
- **Do not** edit `backend/.env` or `frontend/.env.local` directly (they are auto-generated)

## 🐳 Docker Commands

```bash
# Start all services
npm run dev

# Start with rebuild
npm run dev:build

# Stop all services
npm run down

# View logs
npm run logs                # All services
npm run logs:backend        # Backend only
npm run logs:frontend       # Frontend only
npm run logs:firebase       # Firebase emulator only
```

## 🛠 Development

### Backend (Express.js)

```bash
cd backend

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

### Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
npm start
```

## 🔥 Firebase Emulator

The project uses Firebase Emulator Suite for local development:

- **Firestore**: localhost:8080
- **Authentication**: localhost:9099
- **Emulator UI**: http://localhost:4001

Data is persisted in Docker volume `labor_firebase_data`.

### Create Admin User

```bash
docker exec labor-backend node scripts/create-admin.js
```

## 📊 Technology Stack

### Backend
- Node.js 20+
- Express.js
- TypeScript
- Firebase Admin SDK
- Cloudflare R2 (Object Storage)

### Frontend
- Next.js 14
- React 18
- TypeScript
- Material-UI
- Firebase SDK

### Infrastructure
- Docker & Docker Compose
- Firebase Emulator Suite
- Cloudflare R2

## 📝 API Documentation

API endpoint: `http://localhost:4000/api`

### Available Endpoints

```
GET  /api                    # API information
GET  /health                 # Health check

POST /api/auth/login         # Login
POST /api/auth/logout        # Logout
POST /api/auth/refresh       # Refresh token

GET  /api/users              # Get all users
GET  /api/users/:id          # Get user by ID
POST /api/users              # Create user
PUT  /api/users/:id          # Update user
DELETE /api/users/:id        # Delete user

GET  /api/daily-reports      # Get daily reports
POST /api/daily-reports      # Create daily report
# ... more endpoints
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests
cd frontend
npm test
npm run test:coverage
```

## 🔒 Security

- JWT-based authentication
- bcrypt password hashing
- CORS configuration
- Rate limiting
- Helmet.js security headers

**Production checklist**:
- [ ] Change all default secrets in `.env`
- [ ] Use Firebase production project
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS
- [ ] Set up proper logging
- [ ] Configure Sentry or error tracking

## 📚 Documentation

- [Environment Setup](docs/environment-setup.md) - Detailed environment configuration guide
- More documentation coming soon...

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

MIT

## 🆘 Troubleshooting

### Environment variables not updating

```bash
npm run setup:env
docker-compose restart
```

### Docker containers not starting

```bash
docker-compose down
docker-compose up --build
```

### Firebase connection issues

Check that emulator is running:
```bash
curl http://localhost:4001
```

### Cannot login

Reset admin user:
```bash
docker exec labor-backend node scripts/create-admin.js
```

For more help, see the [Environment Setup Guide](docs/environment-setup.md) or contact the development team.

---

Generated with ❤️ by the Labor Management System Team
# LaborManagementSystem
