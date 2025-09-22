# 🚀 PromptPilot Pro

PromptPilot Pro is a comprehensive AI prompt management platform that enables users to create, organize, and execute structured prompts with variables for consistent AI workflows.

## ✨ Current Features

- **User Authentication**: JWT-based secure login and registration
- **Prompt Management**: Create, edit, delete, and organize prompts with variables
- **Variable System**: Define dynamic variables ({{name}}, {{company}}) for prompt reusability
- **Public/Private Sharing**: Control prompt visibility and sharing permissions
- **Search & Filtering**: Find prompts by name, content, or variables
- **Responsive UI**: Modern React interface with Tailwind CSS

## 🏗️ Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + TypeScript + Express + Prisma ORM
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Testing**: Jest (Unit + Integration) + Cypress (E2E)
- **CI/CD**: GitHub Actions with automated testing and linting

---

## 🛠️ Local Development

### Prerequisites
- Node.js v18+ 
- SQLite (included) or PostgreSQL for production

### Quick Start
```bash
# Clone the repository
git clone https://github.com/tailSpike/promptpilot-pro.git
cd promptpilot-pro

# Backend setup
cd backend
npm install
npx prisma generate
npx prisma db push    # Creates SQLite database
npm run dev           # Runs on http://localhost:3001

# Frontend setup (new terminal)
cd frontend  
npm install
npm run dev           # Runs on http://localhost:5173

```

### Environment Variables
Create `.env` files in both backend and frontend directories:

**Backend (.env):**
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key"
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"
```

**Frontend (.env):**
```env
VITE_API_URL="http://localhost:3001"
```

## 🧪 Testing

The project features a comprehensive testing architecture:

### Backend Testing
```bash
cd backend

# Run all tests
npm run test:all

# Unit tests (pure business logic)
npm run test:unit

# Integration tests (real database)
npm run test:integration

# Test coverage
npm run test:coverage

# Linting
npm run lint
```

### Frontend Testing
```bash
cd frontend

# Unit tests
npm run test

# E2E tests
npm run cypress:run

# Linting
npm run lint
```

### Testing Architecture
- **Unit Tests (33)**: Pure business logic without database calls
- **Integration Tests (4)**: Real SQLite database operations  
- **Service Layer**: Extracted business logic for better testability
- **No ORM Mocking**: Uses real database for integration testing

## 🚀 API Overview

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login  
- `GET /api/health` - Health check

### Prompt Management Endpoints
- `GET /api/prompts` - List prompts (with search, pagination)
- `POST /api/prompts` - Create new prompt
- `GET /api/prompts/:id` - Get specific prompt
- `PUT /api/prompts/:id` - Update prompt
- `DELETE /api/prompts/:id` - Delete prompt
- `POST /api/prompts/:id/execute` - Execute prompt with variables

## 📁 Project Structure

```
promptpilot-pro/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── services/       # Business logic layer
│   │   ├── routes/         # HTTP route handlers  
│   │   ├── middleware/     # Auth, validation middleware
│   │   ├── lib/           # Shared utilities (Prisma client)
│   │   └── __tests__/     # Unit + Integration tests
│   ├── prisma/            # Database schema & migrations
│   └── jest.config.*.js   # Separate test configurations
├── frontend/              # React + Vite SPA
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/        # Route-level components
│   │   └── utils/        # Frontend utilities
│   └── cypress/          # E2E test specs
└── docs/                 # Architecture documentation
```

## 🏆 Development Principles

- **Service Layer Architecture**: Business logic separated from HTTP handlers
- **Real Database Testing**: Integration tests use actual SQLite database
- **Type Safety**: Full TypeScript coverage on frontend and backend
- **Test-Driven**: Comprehensive test suite with 37+ test scenarios
- **Clean Code**: ESLint + Prettier for consistent code style
- **CI/CD Ready**: GitHub Actions pipeline with automated testing

## 📚 Documentation

Detailed documentation available in `/docs`:
- [System Design](docs/SYSTEM_DESIGN.md) - Architecture overview
- [API Documentation](docs/API.md) - Endpoint specifications  
- [Developer Guide](docs/DEV_GUIDE.md) - Contributing guidelines
- [Data Models](docs/DATA_MODELS.md) - Database schema
- [Epic Planning](docs/EPICS.md) - Feature roadmap

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm run test:all`)
4. Commit changes (`git commit -m 'feat: add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📜 License

This project is proprietary software owned by Rodney Palmer. All rights reserved.
