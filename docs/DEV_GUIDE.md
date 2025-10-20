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

| Provider | Steps | Env variable(s) | Official docs |
|----------|-------|-----------------|---------------|
| **OpenAI (GPT‑4/5 family)** | 1. Visit the [API Keys dashboard](https://platform.openai.com/api-keys) and create a key.<br>2. In `backend/.env`, add `OPENAI_API_KEY=sk-...` (or set globally via `setx OPENAI_API_KEY "sk-..."`).<br>3. Optionally pin a default model via `OPENAI_DEFAULT_MODEL=gpt-5`. | `OPENAI_API_KEY` | Quickstart + SDK install: <https://platform.openai.com/docs/quickstart><br>Rate limits & exponential backoff: <https://platform.openai.com/docs/guides/rate-limits> |
| **Azure OpenAI Responses** | 1. Provision an Azure OpenAI resource and deployment.<br>2. Add `AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com` and `AZURE_OPENAI_API_KEY=azr-...` to `backend/.env`.<br>3. Leave `AZURE_OPENAI_API_VERSION` at the repo default (`2025-04-01-preview`) unless your region requires an earlier version. | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_VERSION` | Quickstart: <https://learn.microsoft.com/azure/ai-services/openai/> |
| **Anthropic (Claude 3/4 family)** | 1. Generate a key in the [Anthropic Console](https://console.anthropic.com/account/keys).<br>2. Add `ANTHROPIC_API_KEY=sk-ant-...` to `backend/.env` (PowerShell: `setx ANTHROPIC_API_KEY "sk-ant-..."`).<br>3. Capture optional headers such as `ANTHROPIC_VERSION=2023-06-01`. | `ANTHROPIC_API_KEY` | Getting started: <https://docs.anthropic.com/en/api/getting-started><br>Error catalogue: <https://docs.anthropic.com/en/api/errors> |
| **Google Gemini** | 1. Request an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).<br>2. Store it as `GEMINI_API_KEY=AIza...` in `backend/.env` (PowerShell: `setx GEMINI_API_KEY "AIza..."`).<br>3. If using Google Cloud projects, ensure billing is enabled before production use. | `GEMINI_API_KEY` | Quickstart: <https://ai.google.dev/gemini-api/docs/get-started><br>Rate limits & tiers: <https://ai.google.dev/gemini-api/docs/rate-limits> |

**Project configuration tips**
- Check `.env` into `.gitignore`; never commit provider secrets.
- Restart the backend after updating environment variables so the dispatcher refreshes credentials.
- Restrict which providers appear in the UI by setting `ALLOWED_MODEL_PROVIDERS=openai,azure,anthropic,google,custom` in `backend/.env`.

**Retry recommendations**
- Default to exponential backoff with jitter for `429`, `500`, `502`, and provider-specific overload codes (`529` from Anthropic). Suggested baseline: initial delay 1s, multiplier 2.0, jitter 40%, max attempts 5.
- Log provider `request-id`/`x-request-id` headers for escalations.
- Encourage batching where possible to stay within RPM limits (see OpenAI and Gemini rate limit guides linked above).

---

## 3.2 Local live provider smoke (optional)

You can run a lightweight Cypress spec against provider public endpoints without starting the app. Each test SKIPS if its required env var(s) aren’t present.

Environment variables (PowerShell examples for Windows):

- OpenAI:
	- Set: `setx CYPRESS_OPENAI_API_KEY "sk-..."`
	- Test hits: `GET https://api.openai.com/v1/models` with `Authorization: Bearer ...`
- Anthropic:
	- Set: `setx CYPRESS_ANTHROPIC_API_KEY "sk-ant-..."`
	- Test hits: `POST https://api.anthropic.com/v1/messages` with headers `x-api-key` and `anthropic-version: 2023-06-01`
- Google Gemini:
	- Set: `setx CYPRESS_GEMINI_API_KEY "AIza..."`
	- Test hits: `GET https://generativelanguage.googleapis.com/v1beta/models?key=...`
- Azure OpenAI:
	- Set endpoint: `setx CYPRESS_AZURE_OPENAI_ENDPOINT "https://your-resource.openai.azure.com"`
	- Set key: `setx CYPRESS_AZURE_OPENAI_API_KEY "azr-..."`
	- Optional version: `setx CYPRESS_AZURE_OPENAI_API_VERSION "2024-10-21"`
	- Test hits: `GET {endpoint}/openai/deployments?api-version=...` and asserts a `value` array is returned

Then run from the repo root:

- Headless: `npm run cypress:run -- --spec "frontend/cypress/e2e/provider-smoke.cy.ts"`
- Interactive: `cd frontend; npm run cypress:open` and run “Provider Smoke - External Connectivity (optional)”

References (verified):
- Anthropic Messages: https://docs.anthropic.com/en/api/messages
- Gemini Models list: https://ai.google.dev/api/rest/v1beta/models
- Azure OpenAI data plane versioning + endpoints: https://learn.microsoft.com/azure/ai-foundry/openai/reference#data-plane-inference

Notes
- On Windows, `setx` writes to the user environment; restart your terminal for the change to take effect.
- These checks are for connectivity only; they do not depend on the app’s Integration Keys console.

---

## 3.3 Live providers via app E2E (Integration Keys)

The spec `frontend/cypress/e2e/workflow-live-providers.cy.ts` runs a full in-app flow that:
- Registers a temporary user via the API.
- Stores provider credentials using the Integration Keys API (encrypted-at-rest).
- Creates a simple one-step prompt workflow per provider.
- Runs a workflow preview and asserts that the provider result is not simulated, `success === true`, and `outputText` is non-empty. This ensures the provider actually returned content and not just a 200 with an empty payload.

Per-provider prerequisites (self-skipping when missing):
- Anthropic: `setx CYPRESS_ANTHROPIC_API_KEY "sk-ant-..."`
- Gemini: `setx CYPRESS_GEMINI_API_KEY "AIza..."`
- OpenAI: `setx CYPRESS_OPENAI_API_KEY "sk-..."`

Model notes
- The Gemini test uses `gemini-2.0-flash` by default to align with current v1beta availability. If your account has different access, adjust the model via Integration Keys metadata or by editing the spec. You can always verify availability via the Models list endpoint in section 3.2.
 - The OpenAI test uses `gpt-4o-mini` by default. You can change the model via Integration Keys metadata or by editing the spec.

Run the spec headless from the repo root:
- `npm run cypress:run -- --spec "frontend/cypress/e2e/workflow-live-providers.cy.ts"`

Or open Cypress UI and choose the spec:
- `cd frontend; npm run cypress:open`

Notes
- The tests permit top-level statuses of COMPLETED or FAILED due to transient rate limits/safety filters, but they require that the provider entry is non-simulated, success=true, and contains non-empty text when a key is present.
- The workflow uses safe prompts to avoid content filters and keeps token usage minimal.

### 3.3.1 Windows convenience launcher for Cypress

To avoid Cypress UI skipping tests due to missing env at process start, use the root script `open-cypress.ps1`. It injects `CYPRESS_baseUrl`, `CYPRESS_apiUrl`, and passes through provider keys from either base vars or `CYPRESS_*`.

Examples (PowerShell, run from repo root):

```powershell
# Open Cypress UI with env injected
./open-cypress.ps1

# Open a specific spec interactively
./open-cypress.ps1 -Spec "frontend/cypress/e2e/workflow-live-providers.cy.ts"

# Run headless with a specific spec
./open-cypress.ps1 -Headless -Spec "frontend/cypress/e2e/workflow-live-providers.cy.ts"

# Override URLs if needed
./open-cypress.ps1 -ApiUrl "http://127.0.0.1:3001" -BaseUrl "http://127.0.0.1:4173"

# Start servers automatically then open Cypress UI (avoids baseUrl warning)
./open-cypress.ps1 -StartServers

# Start servers then run headless with a specific spec
./open-cypress.ps1 -StartServers -Headless -Spec "frontend/cypress/e2e/workflow-live-providers.cy.ts"
```

Provider key resolution:
- Uses `CYPRESS_*` values if already set in the current process.
- Otherwise, copies from base env vars if present: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AZURE_OPENAI_*`.

Tip: If you used `setx` to set user-level variables, open a new terminal or the script will read them from the User environment automatically.

---

### 3.4 Builder V2 – Canvas Mode

The Canvas Builder (V2) is an experimental UI for composing workflows using nodes and edges. It is gated behind feature flags and query params for deterministic testing and CI.

- Feature flags returned by `/api/feature-flags`:
	- `builder.v2.linear`: enables V2 in general
	- `builder.v2.canvas`: enables Canvas mode option in V2
	- `workflow.run.inline`: unrelated to Canvas, used by Linear V2 for inline runs

- Query params for deterministic routing:
	- `?v2=1` enables Builder V2 for the current session
	- `?canvas=1` prefers Canvas mode when V2 is enabled

- Local persistence keys:
	- `ppp-builder-v2-mode`: remembers last selected V2 mode (`linear` or `canvas`)
	- `ppp-canvas-last-saved:<workflowId>`: stores minimal canvas state (nodes, edges, zoom) on form submit for rehydration; Save is disabled until the workflow has an ID

- Test IDs (for QA/E2E):
	- `builder-v2-canvas`: root of the Canvas builder
	- `canvas-step-library-button`: toggles quick-add library
	- `canvas-add-step-<TYPE>`: quick-add PROMPT/TRANSFORM
	- `canvas-node-<id>`, `canvas-edge-<id>`: nodes and edges
	- `handle-output`, `handle-input`: connection handles on a node
	- `edge-popover`, `edge-mapping-path`, `edge-mapping-apply`: edge mapping UI
	- `canvas-zoom-in`, `canvas-zoom-out`, `canvas-minimap`: zoom/minimap UI

Manual verification (mirrors the Cypress spec `frontend/cypress/e2e/builder-canvas-v2.cy.ts`):
1) Ensure feature flags return `builder.v2.linear=true`, `builder.v2.canvas=true` (in tests this is intercepted).
2) Create a workflow and visit `/workflows/:id/edit?v2=1&canvas=1`.
3) Verify Canvas renders (`[data-testid="builder-v2-canvas"]`).
4) Open Step Library and quick-add a PROMPT and a TRANSFORM; verify at least two nodes appear.
5) Connect PROMPT → TRANSFORM by mousedown on `handle-output` of the first node and mouseup on `handle-input` of the second.
6) In the popover, set mapping path (e.g., `output.text`) and Apply.
7) Zoom in twice, zoom out once; confirm mini-map visible.
8) Click Save (submits the editor form). Canvas state persists to localStorage.
9) Reload the same URL; verify nodes and at least one edge rehydrate.

Scope notes:
- For this story, persistence is localStorage-only; server-side layout persistence is a follow-up.
- Deterministic Canvas render in tests uses `?v2=1&canvas=1` to avoid UI toggle races.

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
 - The scheduler computes and persists `nextRunAt` for scheduled triggers using cron + timezone via cron-parser. This powers a friendly "Next run" label in the UI. The frontend may store lightweight UI-only metadata in `config.__ui` (e.g., last used schedule mode) which is ignored by the backend.

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