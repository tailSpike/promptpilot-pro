# 🚀 PromptPilot Pro

PromptPilot Pro is an AI workflow operations platform that helps teams design, execute, and monitor structured prompts plus automation triggers in a single workspace. The monorepo ships a production-ready TypeScript API, a modern React dashboard, and a scheduling layer that keeps workflows on time.

---

## 🌟 Feature highlights

### Core workspace
- Secure JWT authentication, scoped resources, and folder-based organization
- Prompt authoring with variable templates, metadata, and semantic version history
- Branch-aware prompt management with diff-friendly audit trails

### Workflow automation
- Drag-and-drop workflow builder with PROMPT, CONDITION, TRANSFORM, DELAY, WEBHOOK, and DECISION steps
- Rich configuration forms, inline validation, and live preview of downstream variables
- Execution history with recent run summaries and step-level logging

### Trigger automation (Epic 2 Story 2)
- Five trigger types: **Manual**, **Scheduled**, **Webhook**, **API**, and **Event** (extensible scaffold)
- `TriggerService` drives node-cron scheduling with graceful startup/shutdown and timezone support
- Secure secrets: automatic webhook HMAC secrets & API keys scoped per trigger
- Frontend trigger console with simple/advanced scheduling modes, cron helpers, and inline examples
- Execution metadata captured on the backend for upcoming workflow-run integration

### Developer experience
- Type-safe React + Vite frontend and Express + Prisma backend
- PowerShell & Bash scripts for start/stop/status, database resets, and hook installation
- GitHub Actions CI covering linting, builds, unit/integration tests, and Cypress smoke flows

---

## 🧭 Architecture snapshot
- **Monorepo layout**: `backend/` (Express API, Prisma, scheduling), `frontend/` (React SPA), `docs/` (living architecture reference), `scripts/`.
- **API layer**: Express routes backed by service classes (`WorkflowService`, `TriggerService`, etc.) with Zod validation and Prisma data access.
- **Scheduler**: `TriggerService` hydrates active cron jobs on boot, persists configs in `workflow_triggers`, and tears them down during shutdown.
- **Database**: SQLite for development/test with Prisma migrations; PostgreSQL-ready for production via `DATABASE_URL` swap.
- **Frontend**: Vite + Tailwind UI consuming the REST API with shared TypeScript models and trigger-focused UX.

---

## ⚡ Getting started

### Prerequisites
- Node.js 18+ (20 recommended) & npm 9+
- PowerShell 5.1+ (Windows) or Bash/Zsh (macOS/Linux)
- Git
- SQLite (bundled) or PostgreSQL for production deployments

### One-command bootstrap (Windows PowerShell)
```powershell
# Clone and launch everything with managed processes
git clone https://github.com/tailSpike/promptpilot-pro.git
cd promptpilot-pro
./start.ps1

# Check service status
./status.ps1

# Stop services when finished
./stop.ps1
```

### Manual setup (cross-platform)
```bash
# Install workspace dependencies
npm run install:all

# Prepare and start the backend (terminal 1)
cd backend
npx prisma generate
npx prisma db push
npm run dev

# Start the frontend (terminal 2)
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173`, backend on `http://localhost:3001` by default.

### Environment variables
Create `.env` files in both `backend/` and `frontend/` directories.

**backend/.env**
```
DATABASE_URL="file:./prisma/dev.db"     # Swap to postgres:// for production
JWT_SECRET="your-super-secret-jwt-key"
PORT=3001
FRONTEND_URL="http://localhost:5173"
CORS_ORIGIN="http://localhost:5173"
```

**frontend/.env**
```
VITE_API_URL="http://localhost:3001"
```

---

## 🧰 Useful npm scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend & frontend concurrently |
| `npm run build` | Production build for both workspaces |
| `npm run start` | Serve compiled assets (`backend/dist`, Vite preview) |
| `npm run lint` / `npm run lint:fix` | ESLint across backend and frontend (optional fix) |
| `npm run test:backend` | Jest unit + integration suites (SQLite in-memory) |
| `npm run test:frontend` | Vitest component/unit suite |
| `npm run test:e2e` | Build, reset DB, launch services, and run Cypress headless |
| `npm run prepare:e2e` | Reset test database without executing Cypress |
| `npm run ci` | Local mirror of the GitHub Actions pipeline |

Backend-only scripts live under `backend/package.json` (`db:generate`, `db:reset`, `start:test`, etc.), while frontend scripts cover Cypress (`npm run e2e`, `npm run e2e:open`).

---

## ✅ Testing & quality gates
- **Backend**: Jest unit and integration tests execute against a real SQLite database (`npm run test:backend`).
- **Frontend**: Vitest exercises React components and utilities (`npm run test:frontend`).
- **End-to-end**: Cypress specs validate major flows, including trigger management (`npm run test:e2e`). The trigger E2E suite is still being hardened—expect intermittent failures until TODOs in `docs/DEV_GUIDE.md` are resolved.
- **Static analysis**: ESLint + TypeScript rules enforced via `npm run lint` and pre-push hooks.

---

## 🔌 API surface (authenticated unless noted)

### Authentication & health
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/health`

### Prompts & folders
- `GET /api/prompts`, `POST /api/prompts`
- `GET/PUT/DELETE /api/prompts/:id`
- `POST /api/prompts/:id/execute`
- `GET /api/folders`, `POST /api/folders`
- `GET/PUT/DELETE /api/folders/:id`

### Workflows & steps
- `GET /api/workflows` (search, folder filters, pagination)
- `POST /api/workflows`
- `GET /api/workflows/:id`
- `PUT /api/workflows/:id`
- `DELETE /api/workflows/:id`
- `POST /api/workflows/:id/steps`
- `PUT /api/workflows/:id/steps/:stepId`
- `DELETE /api/workflows/:id/steps/:stepId`
- `POST /api/workflows/:id/execute`

### Triggers & scheduling
- `GET /api/workflows/:workflowId/triggers`
- `POST /api/workflows/:workflowId/triggers`
- `GET /api/triggers/:id`
- `PUT /api/triggers/:id`
- `DELETE /api/triggers/:id`
- `POST /api/triggers/:id/execute` *(acknowledges request; execution wiring in progress)*
- `POST /api/webhooks/:triggerId` *(acknowledges webhook; HMAC validation hook ready)*

---

## 🗂️ Project structure
```
promptpilot-pro/
├── backend/
│   ├── prisma/schema.prisma          # Source of truth for data models
│   └── src/
│       ├── index.ts                  # Express bootstrap + trigger initialization
│       ├── routes/                   # REST controllers (auth, prompts, workflows, triggers)
│       ├── services/
│       │   ├── triggerService.ts     # node-cron scheduler, trigger lifecycle
│       │   └── workflowService.ts    # Workflow orchestration helpers
│       ├── middleware/               # Auth guards & error handling
│       └── __tests__/                # Unit + integration suites
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── WorkflowEditor.tsx
│       │   └── WorkflowTriggers.tsx  # Trigger management UI
│       ├── pages/
│       ├── services/api.ts           # API client wrapper
│       └── types/                    # Shared TypeScript contracts
├── docs/                             # Living documentation (architecture, APIs, guides)
├── scripts/                          # Cross-platform automation helpers
└── *.ps1 / scripts/*.sh              # Start/stop/status tooling for local dev
```

---

## 📚 Documentation & resources
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture & deployment considerations
- [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) — requirements, data flow, and future enhancements
- [`docs/DATA_MODELS.md`](docs/DATA_MODELS.md) — Prisma-backed entity catalogue
- [`docs/WORKFLOW_ENGINE.md`](docs/WORKFLOW_ENGINE.md) — execution model, scheduling, and retry strategy
- [`docs/DEV_GUIDE.md`](docs/DEV_GUIDE.md) — contributor workflow, testing expectations, open TODOs
- [`docs/API.md`](docs/API.md) — detailed endpoint reference with request/response shapes

---

## 🛣️ Status & next steps
- Scheduled triggers currently log their intent; wiring into the workflow execution engine is tracked in `TriggerService` TODOs.
- Manual trigger execution (`POST /api/triggers/:id/execute`) and webhook callbacks return acknowledgements while runtime integration is finalized.
- Cypress coverage for trigger CRUD/execution flows is in progress; see the test TODOs in `docs/DEV_GUIDE.md` before treating failures as regressions.
- `EVENT` trigger type exists for forward compatibility and will be wired to internal bus integrations in a subsequent epic.

---

Questions? Open an issue or drop by the discussions tab—we love pairing on automation ideas.