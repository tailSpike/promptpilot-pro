# 🚀 PromptPilot Pro

PromptPilot Pro is a comprehensive AI prompt management platform that enables users to create, organize, and execute structured prompts with variables for consistent AI workflows.

## ✨ Current Features

### 🔐 Core Platform
- **User Authentication**: JWT-based secure login and registration
- **Prompt Management**: Create, edit, delete, and organize prompts with variables
- **Folder Organization**: Hierarchical folder system for organizing prompts with color coding
- **Variable System**: Define dynamic variables ({{name}}, {{company}}) for prompt reusability  
- **Public/Private Sharing**: Control prompt visibility and sharing permissions
- **Search & Filtering**: Find prompts by name, content, or variables

### 🔄 Workflow Automation (Epic 2 - Complete)
- **Workflow Engine**: Create multi-step automated workflows with prompt chaining
- **Step Management**: Add, edit, reorder, and delete workflow steps with drag-and-drop
- **Advanced Triggers**: 5 trigger types for workflow automation:
  - **Manual**: Instant execution with one-click
  - **Scheduled**: Cron-based automation with intuitive date/time controls
  - **Webhook**: HTTP triggers with HMAC-SHA256 security validation
  - **API**: Programmatic execution via authenticated REST endpoints
  - **Event**: System event triggers (extensible architecture)
- **Real-time Execution**: Live workflow execution with step-by-step progress tracking
- **Execution History**: Complete audit trail of workflow runs with detailed logs

### 🎨 User Experience
- **Responsive UI**: Modern React interface with Tailwind CSS
- **PowerShell Automation**: Windows-optimized scripts for development lifecycle
- **Service Management**: Automated start/stop/status scripts for local development

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
- Node.js v18+ (v20+ recommended)
- PowerShell 5.1+ (Windows) or Bash (Linux/macOS)
- SQLite (included) or PostgreSQL for production

### 🚀 Quick Start (Recommended)
```powershell 
# Clone the repository
git clone https://github.com/tailSpike/promptpilot-pro.git
cd promptpilot-pro

# One-command startup (Windows PowerShell)
.\start.ps1

# Check service status
.\status.ps1

# Stop all services
.\stop.ps1
```

### 📋 Manual Setup
```bash
# Root dependencies
npm run install:all

# Backend setup
cd backend
npx prisma generate
npx prisma db push    # Creates SQLite database
npm run dev           # Runs on http://localhost:3001

# Frontend setup (new terminal)
cd frontend  
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

## 🔧 PowerShell Automation Scripts

The project includes Windows-optimized PowerShell scripts for streamlined development:

### 🚀 Service Management
```powershell
# Start all services (backend + frontend)
.\start.ps1

# Check service status and resource usage
.\status.ps1

# Stop all services and free ports
.\stop.ps1
```

### 📊 Script Features
- **Port Management**: Automatically detects and kills processes on conflicting ports
- **Health Monitoring**: Real-time status checks with CPU and memory usage
- **Cross-Platform**: Equivalent `.sh` scripts available in `/scripts/` folder
- **Error Handling**: Graceful handling of missing processes and port conflicts
- **Color Coding**: Clear visual feedback for service states (Green=Running, Red=Stopped)

## 📦 NPM Scripts Hierarchy

The project uses a comprehensive npm scripts system for development workflow:

### 🏗️ Root Level Orchestration
```bash
# Complete project setup
npm run setup                  # Install deps + setup DB + git hooks

# Development lifecycle  
npm run dev                    # Start both backend + frontend
npm run build                  # Build both applications
npm run start                  # Start production servers

# Testing hierarchy
npm run test:all               # Complete test suite (145+ tests)
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only  
npm run test:e2e               # End-to-end tests only

# Quality assurance
npm run lint                   # Lint all projects
npm run ci                     # Complete CI pipeline locally
```

### 🎯 Workspace-Specific Commands
```bash
# Backend operations
npm run dev:backend            # Start backend dev server (port 3001)
npm run test:backend           # Run all backend tests (66+)
npm run lint:backend           # Backend linting

# Frontend operations  
npm run dev:frontend           # Start frontend dev server (port 5173)
npm run test:frontend          # Run frontend tests
npm run lint:frontend          # Frontend linting + type checking
```

## 🧪 Testing

The project features a comprehensive testing architecture with strict coverage requirements:

### 📋 Testing Requirements for Feature Completion

**All completed features MUST have comprehensive test coverage across all layers:**

#### 🎯 Required Test Coverage per Feature
1. **Unit Tests**: Business logic, utilities, pure functions
2. **Component Tests**: React components in isolation  
3. **Integration Tests**: API endpoints with real database
4. **End-to-End Tests**: Complete user workflows from UI perspective

#### ✅ Feature Completion Criteria
- **Backend**: Service layer unit tests + API integration tests
- **Frontend**: Component tests + at least one E2E test per functional flow
- **Database**: Integration tests with real SQLite operations
- **User Flows**: Complete E2E verification of user journey success paths

### 🧪 Comprehensive Testing Suite

#### Root Level Commands
```bash
# Run all tests across the entire project
npm run test:all

# Run individual test suites  
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # End-to-end tests only
```

#### Backend Testing
```bash
cd backend

# Complete test suite
npm run test:all           # All 66+ tests

# Specific test types
npm run test:unit          # Pure business logic (41 tests)
npm run test:integration   # Real database operations (25+ tests)
npm run test:coverage      # Coverage reports

# Quality checks
npm run lint              # ESLint validation
```

#### Frontend Testing  
```bash
cd frontend

# Unit/Component tests
npm run test              # Vitest runner

# End-to-End tests (79 tests across 9 spec files)
npm run e2e               # Headless Cypress
npm run e2e:open          # Interactive Cypress

# Quality checks
npm run lint              # ESLint + type checking
```

### 🏗️ Testing Architecture
- **66+ Backend Tests**: 41 unit + 25+ integration tests with real database
- **79+ E2E Tests**: Complete user journey testing with Cypress
- **Service Layer Testing**: Business logic separated from HTTP handlers
- **Real Database Integration**: No ORM mocking for integration tests
- **CI/CD Integration**: Full test suite runs on every push/PR
- **100% CI Success Rate**: Comprehensive GitHub Actions pipeline

### 🎯 Current Test Coverage Status

#### ✅ Fully Covered Features
- **User Authentication**: Unit + Integration + E2E complete
- **Prompt Management**: Unit + Integration + E2E complete
- **Folder Organization**: Unit + Integration + E2E complete
- **Workflow Engine**: Unit + Integration + E2E complete

#### 🚧 Partial Coverage (In Progress)
- **Workflow Triggers**: 
  - ✅ Unit Tests: Complete (service layer)
  - ✅ Integration Tests: Complete (API endpoints)
  - 🚧 E2E Tests: 9/14 passing (64% pass rate - trigger UI functionality)
  - ❌ Component Tests: Missing (WorkflowTriggers.tsx component testing)
  - ❌ **BLOCKING**: Trigger creation/management E2E flow needs completion

#### 📋 Testing TODO for Epic 2 Completion

**🚨 CRITICAL BLOCKERS:**
1. **Fix Trigger UI E2E Tests** (5/14 failing - 64% pass rate)
   - ❌ Trigger creation success toast detection issues
   - ❌ Modal close detection after trigger operations
   - ❌ Trigger list refresh verification after CRUD operations
   - ❌ Trigger execution feedback validation
   - ❌ Trigger deletion confirmation workflow

2. **Add Missing Component Tests** (0/3 components covered)
   - ❌ WorkflowTriggers.tsx component unit tests
   - ❌ TriggerModal component unit tests
   - ❌ TriggerList component unit tests

**📋 COMPLETION CRITERIA:**
- **E2E Tests**: Must achieve 14/14 passing (100% pass rate)
- **Component Tests**: Must cover all 3 trigger-related components
- **User Flow Verification**: Complete trigger lifecycle (create → execute → manage → delete)

**⚠️ Epic 2 Story 2 Status**: **BLOCKED** - Cannot be marked complete until all tests pass

## 🚀 API Overview

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login  
- `GET /api/health` - Health check

### Prompt Management Endpoints
- `GET /api/prompts` - List prompts (with search, pagination, folder filtering)
- `POST /api/prompts` - Create new prompt
- `GET /api/prompts/:id` - Get specific prompt
- `PUT /api/prompts/:id` - Update prompt
- `DELETE /api/prompts/:id` - Delete prompt
- `POST /api/prompts/:id/execute` - Execute prompt with variables

### Folder Management Endpoints
- `GET /api/folders` - List all folders in hierarchical structure
- `POST /api/folders` - Create new folder
- `GET /api/folders/:id` - Get specific folder with contents
- `PUT /api/folders/:id` - Update folder (name, description, color, parent)
- `DELETE /api/folders/:id` - Delete folder and move contents to parent

### 🔄 Workflow Automation Endpoints
- `GET /api/workflows` - List all workflows with filtering and pagination
- `POST /api/workflows` - Create new workflow
- `GET /api/workflows/:id` - Get workflow with steps and execution history
- `PUT /api/workflows/:id` - Update workflow details
- `DELETE /api/workflows/:id` - Delete workflow and all associated data
- `POST /api/workflows/:id/steps` - Add step to workflow
- `PUT /api/workflows/:id/steps/:stepId` - Update workflow step
- `DELETE /api/workflows/:id/steps/:stepId` - Remove workflow step
- `POST /api/workflows/:id/steps/reorder` - Reorder workflow steps

### ⚡ Trigger Management Endpoints
- `GET /api/workflows/:id/triggers` - List workflow triggers
- `POST /api/workflows/:id/triggers` - Create new trigger
- `GET /api/triggers/:id` - Get trigger details with execution history
- `PUT /api/triggers/:id` - Update trigger configuration
- `DELETE /api/triggers/:id` - Delete trigger
- `POST /api/triggers/:id/execute` - Execute trigger manually
- `POST /api/webhooks/:triggerId` - Webhook endpoint for external triggers

### 🔍 Execution Tracking Endpoints
- `GET /api/workflows/:id/executions` - Get workflow execution history
- `GET /api/executions/:id` - Get detailed execution results
- `POST /api/workflows/:id/execute` - Execute workflow manually

## 📁 Project Structure

```
promptpilot-pro/
├── backend/                      # Node.js + Express API
│   ├── src/
│   │   ├── services/            # Business logic layer 
│   │   │   ├── authService.ts   # Authentication & JWT management
│   │   │   ├── promptService.ts # Prompt CRUD operations
│   │   │   ├── folderService.ts # Folder hierarchy management
│   │   │   ├── workflowService.ts # Workflow orchestration
│   │   │   └── triggerService.ts  # Trigger scheduling & execution
│   │   ├── routes/              # HTTP route handlers
│   │   │   ├── auth.ts         # Auth endpoints
│   │   │   ├── prompts.ts      # Prompt endpoints  
│   │   │   ├── folders.ts      # Folder endpoints
│   │   │   ├── workflows.ts    # Workflow endpoints
│   │   │   └── triggers.ts     # Trigger endpoints
│   │   ├── middleware/          # Auth, validation, CORS
│   │   ├── lib/                # Shared utilities (Prisma client)
│   │   └── __tests__/          # Unit + Integration tests (66+ total)
│   ├── prisma/                 # Database schema & migrations
│   └── jest.config.*.js        # Test configurations
├── frontend/                    # React + TypeScript + Vite SPA
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── FolderTreeView.tsx    # Hierarchical folder display
│   │   │   ├── WorkflowEditor.tsx    # Visual workflow builder
│   │   │   ├── WorkflowTriggers.tsx  # Trigger management interface
│   │   │   └── StepManager.tsx       # Drag-and-drop step editor
│   │   ├── pages/              # Route-level components
│   │   ├── services/           # API services
│   │   │   ├── api.ts          # Centralized API client
│   │   │   ├── authService.ts  # Authentication calls
│   │   │   └── workflowService.ts # Workflow API calls
│   │   ├── types/              # TypeScript definitions
│   │   └── utils/              # Frontend utilities
│   └── cypress/                # E2E test specs (79 tests)
├── scripts/                    # Automation scripts
│   ├── setup-hooks.ps1/.sh    # Git hooks installation
│   └── pre-push.ps1           # Pre-push validation
├── *.ps1                       # PowerShell development scripts
│   ├── start.ps1              # Start all services
│   ├── stop.ps1               # Stop all services  
│   └── status.ps1             # Check service status
└── docs/                       # Architecture documentation
    ├── EPICS.md               # Feature roadmap & implementation status
    ├── API.md                 # Complete API documentation
    └── SYSTEM_DESIGN.md       # Architecture overview
```

## 🏆 Development Principles & DevOps

### 🏗️ Architecture Principles
- **Service Layer Architecture**: Business logic separated from HTTP handlers
- **Real Database Testing**: Integration tests use actual SQLite database  
- **Type Safety**: Full TypeScript coverage on frontend and backend
- **Clean Code**: ESLint + Prettier for consistent code style

### 🚀 Development Workflow
- **PowerShell Automation**: Windows-optimized scripts for service lifecycle
- **Cross-Platform Scripts**: Both `.ps1` and `.sh` versions for all platforms
- **Git Hooks**: Automated pre-commit and pre-push validation
- **Environment Management**: Comprehensive `.env` configuration

### 🧪 Quality Assurance 
- **Test-Driven Development**: 145+ total tests (66 backend + 79 E2E)
- **100% CI Success Rate**: Comprehensive GitHub Actions pipeline
- **Multi-Node Testing**: CI tests on Node.js 18.x and 20.x
- **Real-time Monitoring**: GitHub CLI integration for CI success tracking

### 🔄 CI/CD Pipeline
- **Automated Testing**: Full test suite on every push/PR
- **Multi-Job Pipeline**: Backend CI, Frontend CI, Security Audits, E2E Tests
- **Quality Gates**: Linting, type checking, test coverage validation
- **Environment Consistency**: Identical local/CI configurations

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
3. **Pre-flight checks & Test Coverage Requirements**:
   ```bash
   npm run test:all    # Must pass all 145+ tests
   npm run lint        # Fix any linting issues
   ```
   
   **⚠️ Feature Completion Requirements:**
   - All new features MUST have comprehensive test coverage:
     - **Unit Tests**: Business logic and utility functions
     - **Component Tests**: React components (if applicable)
     - **Integration Tests**: API endpoints with real database
     - **E2E Tests**: At least one complete user flow verification
   - All existing E2E tests must pass (currently 9/14 trigger tests failing)
   - New features cannot be considered complete without full test coverage
4. Commit changes (`git commit -m 'feat: add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. **Monitor CI success**:
   ```bash
   gh run list --limit 1           # Check latest run status
   gh run view <run-id>            # Monitor specific run
   ```
7. Open a Pull Request with detailed description

### 🔍 CI/CD Monitoring Protocol
After pushing changes, use GitHub CLI to ensure complete success:
```bash
# Check latest CI run
gh run list --limit 1

# Monitor specific run with detailed logs
gh run view <run-id> --log

# Success criteria: All jobs green + 79/79 E2E tests passing
```

## 📜 License

This project is proprietary software owned by Rodney Palmer. All rights reserved.
#   S e r v e r   L i f e c y c l e   M a n a g e m e n t 
 
 