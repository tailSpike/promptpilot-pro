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

### 3.1 AI provider integration (OpenAI, Anthropic, Gemini)
When automated discovery is blocked, direct contributors to the official provider onboarding flows below. PromptPilot Pro reads standard environment variables, so no additional UI forms are required.

| Provider | Steps | Env variable | Official docs |
|----------|-------|--------------|---------------|
| **OpenAI (GPT‑4/5 family)** | 1. Visit the [API Keys dashboard](https://platform.openai.com/api-keys) and create a key.<br>2. In `backend/.env`, add `OPENAI_API_KEY=sk-...` (or set globally via `setx OPENAI_API_KEY "sk-..."`).<br>3. Optionally pin a default model via `OPENAI_DEFAULT_MODEL=gpt-5`. | `OPENAI_API_KEY` | Quickstart + SDK install: <https://platform.openai.com/docs/quickstart><br>Rate limits & exponential backoff: <https://platform.openai.com/docs/guides/rate-limits> |
| **Anthropic (Claude 3/4 family)** | 1. Generate a key in the [Anthropic Console](https://console.anthropic.com/account/keys).<br>2. Add `ANTHROPIC_API_KEY=sk-ant-...` to `backend/.env` (PowerShell: `setx ANTHROPIC_API_KEY "sk-ant-..."`).<br>3. Capture optional headers such as `ANTHROPIC_VERSION=2023-06-01`. | `ANTHROPIC_API_KEY` | Getting started: <https://docs.anthropic.com/en/api/getting-started><br>Error catalogue: <https://docs.anthropic.com/en/api/errors> |
| **Google Gemini** | 1. Request an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).<br>2. Store it as `GEMINI_API_KEY=AIza...` in `backend/.env` (PowerShell: `setx GEMINI_API_KEY "AIza..."`).<br>3. If using Google Cloud projects, ensure billing is enabled before production use. | `GEMINI_API_KEY` | Quickstart: <https://ai.google.dev/gemini-api/docs/get-started><br>Rate limits & tiers: <https://ai.google.dev/gemini-api/docs/rate-limits> |

**Project configuration tips**
- Check `.env` into `.gitignore`; never commit provider secrets.
- Restart the backend after updating environment variables so the dispatcher refreshes credentials.
- Document enabled providers per environment via `workflow.multiModel.providers=openai,anthropic,google` (final name TBD during implementation).

**Retry recommendations**
- Default to exponential backoff with jitter for `429`, `500`, `502`, and provider-specific overload codes (`529` from Anthropic). Suggested baseline: initial delay 1s, multiplier 2.0, jitter 40%, max attempts 5.
- Log provider `request-id`/`x-request-id` headers for escalations.
- Encourage batching where possible to stay within RPM limits (see OpenAI and Gemini rate limit guides linked above).

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
| E2E | `npm run test:e2e` | Builds, resets DB, starts servers, runs Cypress headless (workflow preview, trigger suites, library sharing) |
| Lint | `npm run lint` | ESLint for both workspaces |

### Definition of done
- New features include unit coverage for core logic and (if UI-facing) component tests.
- Integration tests validate REST endpoints and Prisma queries for new surfaces.
- Add or update Cypress specs when user flows change; prefer smoke coverage for new screens.
- Update documentation (`README.md`, relevant files in `docs/`) whenever behaviour changes.

### Known gaps (post Epic 2 Story 3)
- ✅ Backend trigger unit & integration tests exist.
- ✅ Cypress preview flows now cover manual payloads, sample data, and validation paths.
- ✅ Library sharing skeleton guarded by `FEATURE_FLAG_COLLABORATION_SHARING`; backend integration + Cypress coverage ensure invite → view → revoke flow stays green.
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

## 8. Manual verification — Library sharing skeleton

Follow these steps before sign-off to validate the collaboration slice end to end:

1. **Bootstrap env vars**
	- Ensure `backend/.env` exports `FEATURE_FLAG_COLLABORATION_SHARING=on` (already set in the repo default).
	- Confirm `frontend/.env` points `VITE_API_URL` at `http://localhost:3001`.
2. **Start services**
	- Run the backend in one terminal: `npm run dev:backend`
	- Run the frontend in another: `npm run dev:frontend`
3. **Invite flow**
	- Log in as the owner account (or register a fresh owner) and create a library folder.
	- From the folder header click **Share library**, search for an existing teammate email, and send an invite.
	- Verify the toast confirmation, audit log (`library.share.created`), and analytics log in the backend console.
4. **Shared with me view**
	- Log in as the invitee. Switch to **Shared with me** and open the shared library.
	- Confirm prompts render read-only (no edit/delete actions) and metadata shows owner + inviter names.
5. **Revocation**
	- Return to the owner session, revoke the invite from the modal, and confirm the invitee list updates immediately.
	- As the invitee, refresh **Shared with me** and verify the library disappears.
6. **Rate limit guard (optional)**
	- Issue >20 invites within an hour to trigger the 429 error and toast messaging.

> Tip: `npm run test:e2e` already automates invite → view → revoke; the manual pass ensures UX polish and telemetry checks.

---

## 9. Resources
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for architectural context.
- [`docs/API.md`](API.md) for endpoint contracts.
- [`docs/WORKFLOW_ENGINE.md`](WORKFLOW_ENGINE.md) for trigger + execution details.
- [`docs/EPICS.md`](EPICS.md) for high-level roadmap and story status.

Happy building! Pairing and code reviews are highly encouraged—reach out in issues or discussions when you need a second set of eyes.
````