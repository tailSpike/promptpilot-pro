## 📄 `/docs/WORKFLOW_ENGINE.md`

```markdown
# ⚙️ Workflow Engine — PromptPilot Pro

This document explains how workflows are executed today, how triggers interact with the engine, and where future enhancements will land.

---

## 1. Execution flow
1. **Launch** — A workflow is started manually via the UI/API or by a trigger. The request lands on `POST /api/workflows/:id/execute`.
2. **Validation** — Inputs are validated against stored `WorkflowVariable` definitions (type, required flag, defaults).
3. **Preparation** — A `workflow_executions` record is created with metadata about the trigger, payload, and initial status (`PENDING`).
4. **Step iteration** — Steps execute sequentially by `order`. For each step:
   - The associated prompt (if any) is loaded.
   - Variables are resolved from prior step outputs or execution inputs.
   - Model calls and step logic run (PROMPT, CONDITION, etc.).
   - Outputs and errors are persisted to `workflow_step_executions`.
5. **Completion** — Execution status flips to `COMPLETED` or `FAILED`, with timestamps captured for analytics.

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

## 4. Observability
- Console logs trace trigger initialization, execution attempts, and scheduling changes.
- Response payloads include IDs so developers can inspect database records.
- Future work: structured logging + UI surfacing of execution timelines.

---

## 5. Integration roadmap
- [ ] Invoke `WorkflowService.executeWorkflow` directly from `TriggerService` when cron/webhook/API triggers fire.
- [ ] Persist HMAC verification results for webhook triggers.
- [ ] Attach execution metrics (duration, status) back to trigger detail responses.
- [ ] Add component tests for `WorkflowTriggers` UI and expand Cypress coverage to the full trigger lifecycle.

For schema details see [`docs/DATA_MODELS.md`](DATA_MODELS.md); for trigger API contracts see [`docs/API.md`](API.md).
```

---