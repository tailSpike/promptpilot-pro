# 🧠 PromptPilot Pro — System Design (RESHADED)

PromptPilot Pro applies the RESHADED framework to document the current implementation and planned evolution of the platform.

---

## R — Requirements

### Functional
- Author, version, and organise prompts with reusable variables.
- Build multi-step workflows that chain prompts and store execution metadata.
- Configure triggers (manual, scheduled, webhook, API, event scaffold) that launch workflows.
- Provide audit trails for workflow executions and trigger activity.
- Offer an intuitive UI for configuring schedules, secrets, and workflow inputs.

### Non-functional
- Secure access via JWT authentication and per-user resource scoping.
- Deterministic executions aided by versioned prompts and stored configs.
- Extensible scheduling layer that supports new trigger types without major rewrites.
- Observability hooks to inspect trigger activity during development (console logging).
- Consistent developer setup across Windows, macOS, and Linux.

---

## E — Estimation (current scope)
- **Team**: 2–3 engineers can maintain the stack (one owning backend/scheduler, one frontend, one shared QA/docs).
- **Cycle time**: Trigger-centric stories ship in 1–2 week iterations.
- **Prerequisites**: Node 18+, Prisma migrations, Cypress for E2E verification.

---

## S — Storage

### Primary models (Prisma schema)
- `User`, `Folder`, `Prompt`, `PromptVersion`, `PromptBranch`
- `Workflow`, `WorkflowStep`, `WorkflowVariable`
- `WorkflowTrigger`, `WorkflowExecution`, `WorkflowStepExecution`

### Storage strategy
- SQLite for development and automated tests (fast, file-based).
- PostgreSQL recommended for production; Prisma migrations support both engines.
- JSON columns capture flexible configs (trigger settings, step payloads). Services parse/validate JSON before use.
- Execution histories keep a rolling window of recent runs per workflow to minimise payload size.

---

## H — High-level design

1. React SPA calls REST endpoints via Axios, authenticating with a JWT stored in memory (protected routes guard unauthenticated access).
2. Express routes authenticate, validate payloads with Zod, and call service classes.
3. Services wrap Prisma to perform transactional updates, JSON serialization, and enforcement of ownership rules.
4. Trigger operations create/update records and (for scheduled triggers) register cron jobs immediately.
5. Scheduler callbacks currently log intentions; planned work will enqueue workflow executions through `WorkflowService`.

---

## A — API design

- Namespaced under `/api`, with per-resource routers (`/auth`, `/prompts`, `/workflows`, `/triggers`, `/folders`).
- JSON payloads with camelCase keys. Errors return `{ error, details? }` and appropriate HTTP status codes.
- Authentication middleware enforces JWT bearer tokens on all routes except `/api/auth/*` and `/api/health`.
- See [`docs/API.md`](API.md) for complete request/response contracts.

---

## D — Data flow

### Workflow execution (current behaviour)
1. User triggers workflow via UI or API.
2. `POST /api/workflows/:id/execute` stores the execution intent and returns an acknowledgement (full execution pipeline is being integrated).
3. Workflow executions populate `workflow_executions` and `workflow_step_executions` as runs progress.
4. Trigger metadata (type, triggerId) is attached to the execution for auditing.

### Scheduled trigger lifecycle
1. User creates a trigger with cron expression and timezone.
2. Backend validates config, persists record, generates secrets/api keys when needed.
3. `TriggerService` registers/updates cron jobs immediately.
4. Cron callback logs planned execution (TODO: call workflow engine) and records activity metadata.

---

## E — Enhancements & backlog
- Wire scheduled and manual trigger execution paths into `WorkflowService.executeWorkflow`.
- Implement webhook signature verification and payload validation.
- Finish Cypress coverage for trigger CRUD/execution flows and add component tests for trigger UI.
- Introduce retry/backoff strategy for failed trigger-driven executions.
- Capture structured logs and surface them in the UI.

---

## D — Deep dive

### Security & access
- Passwords hashed with `bcryptjs`.
- JWT secret configurable via `JWT_SECRET`; middleware falls back to a default in development but production requires explicit configuration.
- Trigger secrets/API keys generated with crypto-grade randomness.
- CORS origin locked down through `CORS_ORIGIN`/`FRONTEND_URL` env variables.

### Reliability
- Node-cron tasks are recreated on boot and stopped during shutdown to avoid zombie jobs.
- Database resets for testing (`npm run prepare:e2e`) ensure deterministic Cypress runs.
- Error handling middleware serialises Zod validation errors for easier frontend debugging.

---

## Summary
PromptPilot Pro currently operates as a robust monolithic platform with clear seams for growth. The immediate roadmap focuses on completing the trigger-to-execution bridge, strengthening automated tests, and preparing the scheduler for horizontal scaling.