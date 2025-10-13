# ⚙️ Epic 4 — Story 3: Adaptive Model Routing & Cost Guardrails

## Story snapshot
- **User story:** As an operations lead, I want adaptive routing and guardrails around model usage so I can balance quality, latency, and cost automatically.
- **Acceptance criteria:**
  - Workflow prompt steps support per-model budgets (tokens, dollars, latency) with automated enforcement.
  - Routing engine can dynamically pick the best model based on live metrics and fallback rules.
  - UI surfaces projected vs. actual spend and latency per model, with warnings when limits are approached.

## Current state (baseline)
- Multi-model execution (Epic 4 Story 1) delivers parallel/fallback orchestration but always runs every configured provider in the defined order.
- `WorkflowStep.config.models[]` lacks cost or latency metadata; only basic parameters like temperature/max tokens are stored.
- Execution results include raw outputs but no aggregated telemetry (latency, cost, retry counts).
- No mechanism exists to halt execution when token usage exceeds a soft or hard limit.
- UI surfaces output content only; users infer cost and performance manually from provider consoles.

## Research highlights

### Intelligent routing patterns
- **Adaptive fan-out:** Instead of broadcasting to all providers, use heuristics (e.g., historical accuracy, latency) to pick the top candidate at runtime. Reference: <https://netflixtechblog.com/adaptive-stream-routing-architectures>.
- **Multi-armed bandit approaches:** Weight model selection with exploit/explore strategies (e.g., ε-greedy) to gradually favour better-performing models. Primer: <https://lilianweng.github.io/posts/2020-10-06-rl-bandit/>.
- **Cost-aware cascading:** Google Vertex AI guidance stresses monitoring token budgets per call to avoid runaway charges. See: <https://cloud.google.com/vertex-ai/docs/generative-ai/pricing>.

### Provider billing references
- **OpenAI usage dashboards** expose cost per model with 1-minute delay; API responses include `usage` payloads when available. <https://platform.openai.com/docs/guides/usage>
- **Anthropic Claude** returns token counts via `usage.input_tokens` / `usage.output_tokens`. <https://docs.anthropic.com/en/api/reference/responses>
- **Google Gemini** emits `usageMetadata` with token and character counts. <https://ai.google.dev/gemini-api/docs/models/gemini>

### Guardrail UX inspiration
- AWS Cost Explorer surfaces forecasted spend vs. budget threshold with coloured bands. We can mirror this in Workflow Editor via progress bars and alerts.
- Datadog SLO dashboards highlight burn rate and time-to-breach. Translate to "estimated prompts remaining" before hitting token caps.

## Implementation plan

### Data & configuration
- Extend `WorkflowStep.config.models[]` with guardrail fields:
  - `costLimit` (USD cents) and `tokenLimit` (integer)
  - `latencyTargetMs` (soft goal) and `dropIfOverBudget` (boolean)
  - `routingWeight` (initial probability for adaptive routing)
- Store provider telemetry in execution records: `modelTelemetry: { costUsd, tokensUsed, latencyMs, retries }`.
- Add system-level defaults in `config/modelGuardrails.ts` with sensible budget ceilings per provider.
- Introduce feature flag `models.adaptiveRouting` for gradual rollout.

### Backend services
- Enhance `ModelDispatcher`:
  - Calculate estimated cost prior to invocation (using provider pricing tables) and short-circuit if limit exceeded.
  - Capture response `usage` metadata, compute actual cost, and update execution context.
  - Implement adaptive routing module:
    - Maintain rolling averages per workflow/model combination (persist via Redis or Postgres table `ModelPerformanceMetric`).
    - Run ε-greedy selection to decide primary model; fallback list remains as safety net.
  - Emit structured events (`model.selection`, `model.budgetBreached`, `model.latencyWarning`) to the logging pipeline.
- Update `executePromptStep` to:
  - Respect guardrail decisions (skip providers exceeding limits).
  - Annotate outputs with routing rationale (selected because of lower latency, etc.).
  - Aggregate telemetry into `stepResult.modelSummary` for UI consumption.
- Provide admin API endpoints:
  - `GET /api/models/performance` — summary dashboard data.
  - `POST /api/models/rebalance` — manual reset of routing weights.

### Frontend (Workflow Builder & Monitoring)
- **Workflow Editor updates:**
  - Guardrails panel per model card: inputs for token limit, cost limit, latency target, and drop behaviour.
  - Visual budget indicator (progress bar) tied to historical usage, with inline helper text linking to pricing docs.
  - Routing strategy selector toggles between `Manual`, `Adaptive`, `Cost-First`, `Latency-First` (all map to backend heuristics).
- **Execution history UI:**
  - New "Model telemetry" tab showing charts for latency, cost, and success rate.
  - Tooltip explanations for adaptive choices (e.g., "Claude selected due to 20% lower latency last 10 runs").
  - Highlight guardrail breaches with badges and recommendations.
- **Admin dashboard widget:** Quick view of daily spend vs. budget cap with ability to adjust guardrails globally.

### Documentation & enablement
- Update `README.md` and `docs/DEV_GUIDE.md` with guardrail configuration instructions.
- Add pricing references and environment variable requirements (e.g., `OPENAI_BILLING_ALERT_THRESHOLD`) to `docs/INTEGRATIONS.md`.
- Extend `docs/WORKFLOW_ENGINE.md` with architecture diagram showing adaptive routing loop and telemetry storage.
- Produce migration notes covering new database tables/seeds in `docs/DATA_MODELS.md`.

### Testing strategy
- **Unit tests:**
  - Guardrail evaluation (cost/token/latency) with edge cases (zero limits, missing pricing data).
  - Adaptive routing selection logic (ε-greedy, fallback, weight updates).
  - Model telemetry aggregation and serialization.
- **Integration tests:**
  - Workflow execution hitting token cap (verifies drop behaviour).
  - Budget breach notifications triggered and persisted.
  - Admin API returning rolling metrics.
- **Frontend tests:**
  - React Testing Library coverage for guardrail inputs and validation messages.
  - Cypress E2E scenario configuring limits, running workflow, and verifying telemetry UI.
  - Visual regression snapshots for telemetry charts.
- **Chaos/Resilience:**
  - Simulate provider outage causing fallback selection, ensure telemetry still records partial data.
  - Force pricing table update mid-run and confirm guardrails recompute correctly.

### Instrumentation & telemetry
- Emit structured logs to `model_guardrails` channel with fields: `workflowId`, `stepId`, `provider`, `estimatedCost`, `actualCost`, `latencyMs`, `decisionType`.
- Add Prometheus metrics:
  - `model_selection_count{provider}`
  - `model_guardrail_breach_total{type}`
  - `model_latency_ms_bucket`
- Feed metrics into Grafana dashboard with alerts (budget burn rate > 2x, latency target breach > 3 consecutive runs).
- Extend existing analytics pipeline to correlate guardrail events with workflow outcomes (success/failure).

### Dependencies & open questions
- Confirm pricing table source of truth—static JSON vs. fetched from provider APIs. Consider scheduled job to refresh monthly.
- Decide retention policy for telemetry metrics (e.g., 30-day rolling window) and storage size implications.
- Evaluate need for per-tenant budgets vs. global defaults.
- Determine how guardrails interact with manual reruns (should limits reset or carry over?).
- Clarify UX for when all providers breach limits — do we fail fast or prompt user intervention?

## Manual verification checklist
1. **Configure guardrails**
   - Create a workflow with a multi-model prompt step.
   - Set cost limit `$0.10` and token limit `2,000` for OpenAI; set latency target `1,500 ms` for Anthropic.
   - Expected: Guardrail values persist after saving, with inline helper text showing provider pricing link.
2. **Execute within limits**
   - Run the workflow with moderate input.
   - Expected: Execution succeeds, telemetry panel shows costs below thresholds, adaptive strategy note indicates baseline weights.
3. **Trigger cost breach**
   - Increase prompt length or lower cost limit to `$0.01` and rerun.
   - Expected: OpenAI invocation skipped with warning banner; fallback provider executes; execution result notes guardrail breach.
4. **Latency-driven selection**
   - Simulate slow provider (toggle dev flag or latency injection).
   - Expected: Adaptive routing selects faster provider; UI records decision rationale.
5. **Admin metrics review**
   - Visit admin dashboard guardrail widget.
   - Expected: Daily spend chart updates, budget remaining indicator reflects recent runs.
6. **Reset routing weights**
   - Call `POST /api/models/rebalance` (via admin UI or API client).
   - Expected: Next execution uses evenly distributed weights and telemetry logs reset action.

Document actual results and attach telemetry screenshots in the release ticket before marking the story complete.

## Local run instructions
Run from repository root unless specified.

```powershell
# Install dependencies (backend + frontend workspaces)
npm install

# Generate Prisma client and apply migrations for telemetry tables
npm run db:migrate --workspace backend

# Seed sample pricing tables
npm run seed:model-pricing --workspace backend

# Launch backend with adaptive routing flag enabled
$env:FEATURE_MODELS_ADAPTIVE="1"; npm run start:test

# In a new shell, start frontend dev server
npm --prefix frontend run dev

# Optional automated suites
npm --prefix backend run test:all
npm --prefix frontend run test -- --run
npm --prefix frontend run cypress:run -- --spec cypress/e2e/workflow-guardrails.cy.ts
```

**Environment variables:**
- `FEATURE_MODELS_ADAPTIVE=1` — enables adaptive routing UI & backend logic.
- `MODEL_PRICING_TABLE_PATH` — optional override for pricing JSON; defaults to `config/model-pricing.json`.
- `GUARDRAIL_ALERT_WEBHOOK` — optional Slack/MS Teams webhook for budget breach alerts.
- Standard provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) for live telemetry.

Stop services with `Ctrl+C` when finished. Capture telemetry dashboard screenshots for QA sign-off.
