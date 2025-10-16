# 🚀 PromptPilot Pro

PromptPilot Pro is an AI workflow platform to design, execute, and monitor structured prompts and automations. This monorepo includes a TypeScript API (Express + Prisma), a React dashboard (Vite), and a lightweight scheduler.

---

## ✨ Features
- Authenticated workspace with folders and scoped resources
- Prompt authoring with variables, metadata, and version history
- Workflow builder with PROMPT, CONDITION, TRANSFORM, DELAY, WEBHOOK, DECISION steps
- Preview and inspect step-by-step results before saving
- Triggers: Manual, Scheduled (cron), Webhook, API, Event (extensible)
- Type-safe stack: React + Vite frontend, Express + Prisma backend
- CI: Lint, build, unit/integration tests, and Cypress smoke flows

---

## 🧭 Architecture (high-level)
- Monorepo: `backend/` (API, Prisma, scheduling), `frontend/` (SPA), `docs/` (guides), `scripts/`
- API: Express routes with service layer (e.g., `WorkflowService`, `TriggerService`), Zod validation, Prisma data access
- Scheduler: `TriggerService` provisions cron jobs and handles lifecycle
- Database: SQLite for dev/test; PostgreSQL-ready via `DATABASE_URL`

---

## ⚡ Quick start

### Prerequisites
- Node.js 18+ (20 recommended) and npm 9+
- PowerShell 5.1+ (Windows) or Bash/Zsh (macOS/Linux)

### One-command bootstrap (Windows PowerShell)
```powershell
git clone https://github.com/tailSpike/promptpilot-pro.git
cd promptpilot-pro
./start.ps1
./status.ps1   # optional
```

### Manual setup (cross-platform)
```bash
npm run install:all

# Terminal 1: backend
cd backend
npx prisma generate
npx prisma db push
npm run dev

# Terminal 2: frontend
cd frontend
npm run dev
```
Frontend: http://localhost:5173 • Backend: http://localhost:3001

---

## 🔧 Configuration
Create `.env` files in `backend/` and `frontend/`.

backend/.env
```
DATABASE_URL="file:./prisma/dev.db"     # use postgres:// for production
JWT_SECRET="your-super-secret-jwt-key"
PORT=3001
FRONTEND_URL="http://localhost:5173"
CORS_ORIGIN="http://localhost:5173"

# Optional model provider credentials (omit to use safe simulated responses)
OPENAI_API_KEY="sk-..."
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_API_KEY="azr-..."
AZURE_OPENAI_API_VERSION="2025-04-01-preview"
ANTHROPIC_API_KEY="sk-ant-..."
GEMINI_API_KEY="AIza..."

# Restrict which providers can be used in workflow steps
ALLOWED_MODEL_PROVIDERS="openai,azure,anthropic,google,custom"
```

frontend/.env
```
VITE_API_URL="http://localhost:3001"
```

---

## 🧰 Common scripts
| Command | Description |
|--------|-------------|
| `npm run dev` | Start backend and frontend together |
| `npm run build` | Build both workspaces |
| `npm run start` | Serve compiled assets (API + Vite preview) |
| `npm run lint` / `npm run lint:fix` | Lint (optionally fix) across workspaces |
| `npm run test:backend` | Jest unit + integration (SQLite) |
| `npm run test:frontend` | Vitest unit/component (non-interactive) |
| `npm run test:e2e` | Build, reset DB, launch, run Cypress headless |
| `npm run ci` | Local mirror of CI pipeline |

Workspace-specific scripts live in `backend/package.json` and `frontend/package.json`.

---

## ✅ Testing & quality
- Backend: Jest unit + integration on SQLite
- Frontend: Vitest (non-interactive by default)
- E2E: Cypress specs for core flows
- Static analysis: ESLint + TypeScript rules, pre-push hooks

---

## �️ Project structure (brief)
```
promptpilot-pro/
├─ backend/      # Express API, Prisma, scheduler
├─ frontend/     # React + Vite SPA
├─ docs/         # Architecture, API, guides
├─ scripts/      # Cross-platform automation
└─ *.ps1         # Start/stop/status (Windows)
```

---

## 📚 Documentation
- Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- API reference: [`docs/API.md`](docs/API.md)
- Data models: [`docs/DATA_MODELS.md`](docs/DATA_MODELS.md)
- Workflow engine: [`docs/WORKFLOW_ENGINE.md`](docs/WORKFLOW_ENGINE.md)
- Developer guide: [`docs/DEV_GUIDE.md`](docs/DEV_GUIDE.md)

---

## 🤝 Contributing
Please see [`CONTRIBUTING.md`](CONTRIBUTING.md). Issues and PRs are welcome.

## 📄 License
MIT License. See package metadata for details.

---

Questions? Open an issue or start a discussion.