---

## 📄 `/docs/DEV_GUIDE.md`

```markdown
# 🧑‍💻 Developer Guide — PromptPilot Pro

Welcome! This guide covers day-to-day workflows for contributing to PromptPilot Pro.

---

## 1. Tooling & stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router.
- **Backend**: Node.js 20-compatible, Express 5, Prisma ORM, Zod validation, node-cron scheduling.
- **Database**: SQLite for development/test (Prisma migrations); PostgreSQL for production.
- **Testing**: Jest (backend unit + integration), Vitest (frontend unit/component), Cypress (E2E).
- **Automation**: PowerShell & Bash scripts for lifecycle management, GitHub Actions CI.

---

## 2. Repository layout
```
backend/   # Express API + scheduler + Prisma schema
frontend/  # React SPA + Cypress specs
docs/      # Living documentation (architecture, API, workflows)
scripts/   # Cross-platform helper scripts
```

---

## 3. Local setup checklist
1. `npm run install:all`
2. `npm run db:setup` (runs `prisma generate` + `prisma db push`)
3. Copy `.env.example` (if available) or follow README instructions for `backend/.env` & `frontend/.env`
4. `npm run dev` to launch both services, or `./start.ps1` on Windows
5. Verify `http://localhost:3001/api/health` returns OK and the SPA loads on `http://localhost:5173`

---

## 4. Coding standards
- Use TypeScript everywhere; keep types close to usage.
- Run `npm run lint` before pushing—pre-push hooks enforce lint + tests.
- Write small, focused commits with [Conventional Commits](https://www.conventionalcommits.org/) prefixes (`feat:`, `fix:`, `chore:`).
- Keep services thin; push business logic into dedicated helpers where possible.
- Prefer functional React components and hooks.

---

## 5. Testing matrix

| Layer | Command | Notes |
|-------|---------|-------|
| Backend unit | `npm run test:unit:backend` | Runs against in-memory SQLite |
| Backend integration | `npm run test:integration` | Exercises REST routes + Prisma |
| Frontend unit/component | `npm run test:frontend` | Vitest + Testing Library |
| E2E | `npm run test:e2e` | Builds, resets DB, starts servers, runs Cypress headless (workflow preview + trigger suites) |
| Lint | `npm run lint` | ESLint for both workspaces |

### Definition of done
- New features include unit coverage for core logic and (if UI-facing) component tests.
- Integration tests validate REST endpoints and Prisma queries for new surfaces.
- Add or update Cypress specs when user flows change; prefer smoke coverage for new screens.
- Update documentation (`README.md`, relevant files in `docs/`) whenever behaviour changes.

### Known gaps (post Epic 2 Story 3)
- ✅ Backend trigger unit & integration tests exist.
- ✅ Cypress preview flows now cover manual payloads, sample data, and validation paths.
- 🚧 Cypress trigger flows occasionally fail; stabilise specs under `frontend/cypress/e2e/workflow-triggers.cy.ts` (expand coverage + tighten selectors).
- 🚧 Component tests for `WorkflowTriggers` UI slated for follow-up.
- 🚧 Component snapshot tests for `WorkflowPreviewResults` are pending to catch layout regressions.
- 🚧 `TriggerService` currently logs scheduled executions; integrate with `WorkflowService` before marking the feature fully delivered.

---

## 6. Git workflow
1. Create a feature branch from `main`.
2. Implement changes + tests.
3. `npm run lint && npm run test` before opening a PR.
4. Document the change set in the PR template (see `.github/pull_request_template.md`).
5. Keep PRs scoped; large epics should be broken into reviewable chunks.

---

## 7. Troubleshooting
- **Prisma errors**: run `npm run db:reset` to rebuild the SQLite database.
- **Scheduler logs**: check backend console output for cron status (initialisation, next run time, errors).
- **E2E flakiness**: use `npm run e2e:open` for interactive debugging; ensure test database is reset via `npm run prepare:e2e`.
- **JWT issues**: confirm `JWT_SECRET` matches between local `.env` and generated tokens.

---

## 8. Resources
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for architectural context.
- [`docs/API.md`](API.md) for endpoint contracts.
- [`docs/WORKFLOW_ENGINE.md`](WORKFLOW_ENGINE.md) for trigger + execution details.
- [`docs/EPICS.md`](EPICS.md) for high-level roadmap and story status.

Happy building! Pairing and code reviews are highly encouraged—reach out in issues or discussions when you need a second set of eyes.
````