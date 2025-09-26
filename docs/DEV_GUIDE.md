
---

## 📄 `/docs/DEV_GUIDE.md`

```markdown
# 🧑‍💻 Developer Guide — PromptPilot Pro

This guide outlines best practices for contributing to PromptPilot Pro.

---

## 🧱 Tech Stack

### Core Technologies
- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + TypeScript + Express.js
- **Database**: SQLite (dev) + PostgreSQL (prod) + Prisma ORM
- **Authentication**: JWT tokens + bcrypt password hashing

### Development Tools
- **Testing**: Jest (backend) + Vitest (frontend) + Cypress (E2E)
- **Automation**: PowerShell + Bash scripts for cross-platform support
- **Scheduling**: node-cron for workflow triggers
- **Security**: HMAC-SHA256 for webhook validation
- **CI/CD**: GitHub Actions with multi-node testing

### Infrastructure
- **Development**: Local SQLite + npm workspaces monorepo
- **Production**: PostgreSQL + Railway/Vercel deployment
- **Monitoring**: GitHub CLI integration for CI monitoring

---

## 📁 Folder Structure
```
/frontend/              # React + TypeScript + Vite SPA
├── src/components/     # Reusable UI components  
├── src/pages/         # Route-level page components
├── src/services/      # API integration layer
└── cypress/           # E2E test specifications

/backend/              # Node.js + Express API server
├── src/services/      # Business logic layer (auth, workflows, triggers)
├── src/routes/        # HTTP route handlers
├── src/middleware/    # Authentication & validation
├── prisma/           # Database schema & migrations
└── __tests__/        # Unit & integration tests

/scripts/             # Development automation scripts
/docs/               # Architecture & API documentation
/*.ps1               # PowerShell development lifecycle scripts
```

---

## 🧼 Code Hygiene

- Use Prettier for formatting (`npm run format`)
- Use ESLint for linting (`npm run lint`)
- Write meaningful commit messages (`feat:`, `fix:`, `chore:`)
- Prefer functional components and hooks in React
- Use async/await and typed interfaces in backend

---

## 🧪 Testing Strategy

### Comprehensive Test Coverage (145+ total tests)
- **Backend Unit Tests (41)**: Pure business logic without database calls
- **Backend Integration Tests (25+)**: Real SQLite database operations  
- **Frontend E2E Tests (79)**: Complete user journeys with Cypress
- **Service Layer Testing**: Business logic isolated from HTTP handlers
- **Real Database Testing**: No ORM mocking for integration tests

### Testing Commands
```bash
# Run all tests across entire project
npm run test:all

# Backend testing
cd backend
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only  
npm run test:all          # Both unit + integration

# Frontend testing  
cd frontend
npm run test              # Component tests
npm run e2e               # End-to-end tests
npm run e2e:open          # Interactive Cypress
```

### CI/CD Testing
- **Multi-Node CI**: Tests run on Node.js 18.x and 20.x
- **Full Pipeline**: Backend CI + Frontend CI + Security + E2E + Quality Gates
- **100% Success Rate**: Comprehensive GitHub Actions validation

---

## 🔐 Secrets & Environment

- Use `.env.local` for local development  
- Never commit `.env` files  
- Use Railway/Vercel secrets for staging/prod

---

## 🧠 Development Principles

- Build in vertical slices (prompt → workflow → execution)  
- Keep logic modular and testable  
- Document edge cases and assumptions  
- Prioritize clarity over cleverness

---

## 🧭 Onboarding Checklist

### Quick Start (5 minutes)
- [ ] Clone repo: `git clone https://github.com/tailSpike/promptpilot-pro.git`
- [ ] Navigate: `cd promptpilot-pro`  
- [ ] Start services: `.\start.ps1` (Windows) or `./scripts/start.sh` (Linux/macOS)
- [ ] Verify: `.\status.ps1` - should show both services running
- [ ] Test: Open http://localhost:5173 in browser

### Deep Dive (30 minutes)
- [ ] Read [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md) - Architecture overview
- [ ] Read [EPICS.md](EPICS.md) - Feature implementation status  
- [ ] Explore [API.md](API.md) - Complete endpoint documentation
- [ ] Run tests: `npm run test:all` - should see 145+ tests pass
- [ ] Check CI: `gh run list` - view recent pipeline runs

### Development Environment
- [ ] Install PowerShell (Windows) or ensure Bash is available
- [ ] Install Node.js v18+ (v20+ recommended)
- [ ] Install GitHub CLI: `gh --version` for CI monitoring
- [ ] Setup git hooks: `npm run setup:hooks`

### Pro Tips
- Use `.\start.ps1` / `.\stop.ps1` for service management
- Monitor CI with `gh run view <run-id>` for detailed logs
- Check `.\status.ps1` if services aren't responding
- Ask questions early—collaboration accelerates learning