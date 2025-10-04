## 📄 `/docs/WORKFLOW_ENGINE.md`

```markdown
# ⚙️ Workflow Engine — PromptPilot Pro

This document explains how workflows are executed today, how triggers interact with the engine, and where future enhancements will land.

---

## 1. Execution flow
1. **Launch** — A workflow is started manually via the UI/API or by a trigger. The request lands on `POST /api/workflows/:id/execute` and immediately records a `workflow_executions` row with `PENDING` status.
2. **Validation** — Inputs are validated against stored `WorkflowVariable` definitions (type, required flag, defaults).
3. **Preparation** — A `workflow_executions` record is created with metadata about the trigger, payload, and initial status (`PENDING`).
4. **Step iteration** — Steps execute sequentially by `order`. For each step:
   - The associated prompt (if any) is loaded.
   - Variables are resolved from prior step outputs or execution inputs.
   - Model calls and step logic run (PROMPT, CONDITION, etc.).
   - Outputs and errors are persisted to `workflow_step_executions`.
5. **Completion** — Execution status flips to `COMPLETED` or `FAILED`, with timestamps captured for analytics. Failures capture error payloads for debugging, while successful runs persist final outputs for follow-up previews or audits.

> **Note:** The trigger-to-execution bridge is partially stubbed today; scheduled/webhook/API triggers acknowledge the request while the workflow execution pipeline is wired in. See "Integration roadmap" below.

---

## 2. Trigger interaction

### Manual triggers
- UI buttons call `POST /api/triggers/:id/execute`.
- Endpoint validates ownership, records the intent, and (soon) will call `WorkflowService.executeWorkflow`.

### Scheduled triggers
- Stored cron expressions & timezones live inside `WorkflowTrigger.config`.
- `TriggerService.initializeScheduledTriggers()` registers node-cron tasks on boot.
- When cron fires, the service logs the execution intent, calculates next run times, and (next milestone) will enqueue a workflow execution.

### Webhooks & API triggers
- Webhook endpoint `POST /api/webhooks/:triggerId` verifies the trigger exists, returns 200, and will validate HMAC signatures once execution is wired in.
- API triggers require generated API keys stored in `config.apiKey`. Clients hit `POST /api/triggers/:id/execute` with that key.

### Event triggers
- Placeholder for future platform events (internal bus or external integrations). Config schema already supports event filtering.

---

## 3. Retry & resilience
- Step-level retry metadata (`retryConfig`, `retryCount`) is stored with each `WorkflowStepExecution`.
- Default policy: 0 retries (configurable per step). Future work will add exponential backoff and dead-letter queues for repeated failures.
- Trigger scheduler gracefully stops all cron jobs on shutdown to avoid duplicate executions.

---

## 4. Preview flows

The non-persistent preview API (`POST /api/workflows/:id/preview`) lets builders dry-run a workflow without writing to execution history. Key behaviours:

- **Input hydration** — Accepts a manual `input` payload or `useSampleData = true`, which hydrates sample values from `WorkflowVariable` definitions.
- **Step sandboxing** — Executes the same orchestration pipeline as production runs but clones all step inputs/outputs before returning them to avoid mutation side-effects.
- **Result contract** — Returns `WorkflowPreviewResult` containing run status, per-step timing, warnings, token estimates, and the final output snapshot.
- **Safe fallbacks** — If deep cloning fails (e.g., circular structures), the service gracefully falls back to returning the raw value instead of crashing.
- **UI hooks** — The React dashboard surfaces previews with toggleable sample data, JSON validation guards, warning banners, and a detail view per step.

Preview runs are cached client-side only; subsequent API work will allow persisting previews for team review.

---

## 4. Observability
- Console logs trace trigger initialization, execution attempts, and scheduling changes.
- Response payloads include IDs so developers can inspect database records.
- Future work: structured logging + UI surfacing of execution timelines.

---

## 5. Multi-model execution enhancements (Epic 4 Story 1)
- Prompt steps will accept a `models` array with provider metadata (OpenAI, Anthropic, Gemini, custom) while maintaining backward compatibility with legacy single-model configs.
- Execution and preview flows will call a shared dispatcher that fan-outs requests in parallel or fallback mode, capturing tokens, latency, retries, and provider warnings per response.
- Missing credentials produce actionable errors that point builders to official setup docs noted in [`docs/EPIC4_STORY1.md`](EPIC4_STORY1.md) and the updated developer guide.
- Retry policies will default to exponential backoff with jitter for `429/5XX` responses and respect provider-specific limits (see OpenAI/Gemini rate limit references).
- Execution payloads will expose consolidated fields:
   - `modelOutputs` — per-provider/model content, metadata, and diagnostics.
   - `aggregateTokens` — totals across providers to inform cost tooling.
   - `warnings` — surfaced to the UI so builders understand degraded paths.
- Feature flag: `workflow.multiModel` to allow staged rollout across environments.

## 6. Integration roadmap
- [ ] Invoke `WorkflowService.executeWorkflow` directly from `TriggerService` when cron/webhook/API triggers fire.
- [ ] Persist HMAC verification results for webhook triggers.
- [ ] Attach execution metrics (duration, status) back to trigger detail responses.
- [ ] Add component tests for `WorkflowTriggers` UI and expand Cypress coverage to the full trigger lifecycle.

For schema details see [`docs/DATA_MODELS.md`](DATA_MODELS.md); for trigger API contracts see [`docs/API.md`](API.md).
```

---