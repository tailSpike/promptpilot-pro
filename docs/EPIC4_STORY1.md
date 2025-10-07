# 🧠 Epic 4 — Story 1: Multi-Model Prompt Execution

## Story snapshot
- **User story:** As a user, I want to run prompts across multiple AI models so I can compare outputs.
- **Acceptance criteria:**
  - Model selector supports GPT-4, Claude, Gemini, etc.
  - Parameters are configurable per workflow step.
  - Execution engine supports multi-model chaining.

## Current state (baseline)
- Workflow prompt steps currently serialize a single `config.model` value and invoke a mocked responder.
- `WorkflowStep.config` is stored as JSON but lacks structure for multiple providers or per-model parameters.
- Preview and execution pipelines share the same single-model code path (`executePromptStep`).
- There is no first-class provider configuration, environment variable guidance, or retry logic for upstream APIs.

## Research highlights

### Orchestration patterns
- **Fan-out + aggregation:** Route a single prompt to multiple providers in parallel and collate responses (LangChain routing guidance). Reference: <https://python.langchain.com/docs/how_to/routing/>.
- **Fallback chains:** Attempt primary model first, then cascade when throttled or errored. Keep per-model retry/backoff budgets.
- **Adapter layer:** Normalize provider-specific SDK calls behind a dispatcher with consistent response envelopes (content, tokens, latency, warnings).

### Provider integration prerequisites
- **OpenAI (GPT family)**
  - Generate API keys in the dashboard: <https://platform.openai.com/api-keys>.
  - Follow the official quickstart for SDK installation and environment variables (`OPENAI_API_KEY`): <https://platform.openai.com/docs/quickstart>.
  - Rate-limit and exponential backoff recommendations: <https://platform.openai.com/docs/guides/rate-limits>.
- **Anthropic (Claude family)**
  - Create keys via Anthropic Console: <https://console.anthropic.com/account/keys>.
  - API getting started (headers, limits, examples): <https://docs.anthropic.com/en/api/getting-started>.
  - Error taxonomy and mitigation: <https://docs.anthropic.com/en/api/errors>.
- **Google Gemini**
  - Obtain keys in AI Studio: <https://aistudio.google.com/app/apikey>.
  - Quickstart (SDK setup, `GEMINI_API_KEY` env var, first request): <https://ai.google.dev/gemini-api/docs/get-started>.
  - Rate limit tiers and quotas: <https://ai.google.dev/gemini-api/docs/rate-limits>.

> 💡 **When automated lookups are blocked:** Share these official links with users so they can complete provider onboarding directly. Once keys are issued, PromptPilot Pro simply reads the documented environment variables.

### Retry & resilience guidance
- Implement exponential backoff with jitter for 429/5XX errors (OpenAI backoff examples in the rate limits guide).
- Recognize provider-specific HTTP status codes (`429`, `529` for Anthropic; Google returns `429` with quota details in body).
- Expose retry policy knobs per provider (max attempts, base delay) and surface actionable warnings in step results.
- Capture request identifiers (`request-id`, `x-request-id`) for support escalation.

## Implementation plan

### Data & configuration
- Extend `WorkflowStep.config` schema with `models: ModelConfig[]`, where each item contains:
  - `provider` (`openai`, `anthropic`, `google`, `custom`)
  - `model` (provider-specific identifier)
  - `parameters` (temperature, top_p, max_output_tokens, etc.)
  - `routing` (`parallel`, `fallback`, optional weight or priority)
- Add backend config guardrail (`ALLOWED_MODEL_PROVIDERS` in `backend/.env`).
- Introduce provider credential variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`) with documentation hooks.

### Backend services
- Create `ModelDispatcher` with adapters per provider encapsulating SDK/API calls, retries, and normalization.
- Enhance `executePromptStep` to:
  - Resolve configured models.
  - Execute per routing mode (parallel Promise.all vs sequential fallback).
  - Record output metadata (tokens used, latency, retry count, provider warnings).
  - Merge outputs into workflow context (`currentInput`) under deterministic keys (`modelOutputs[provider][model]`).
- Share dispatcher logic with preview flow to maintain parity.
- Centralize retry strategy (exponential backoff, jitter, max attempts) with provider-specific defaults.
- Handle missing credentials gracefully: throw descriptive errors directing users to provider setup docs above.

### Frontend (Workflow Builder & Preview)
- Update prompt step form to manage multiple model entries:
  - Model list with provider selector, autocompleted defaults, parameter editors.
  - Routing mode selector with inline explanations.
  - Validation for duplicate providers/models and missing credentials.
- Preview UI enhancements:
  - Display per-model output cards with tokens, latency, retry indicators.
  - Provide diff/comparison affordances (initially text side-by-side, future structured diff).
- Add onboarding banner that links to provider setup section when no credentials detected.

### Documentation & onboarding
- Update `README.md` and `docs/DEV_GUIDE.md` with provider setup steps, env variable names, and pointers to official docs.
- Add troubleshooting tips (rate limits, credential rotation) and recommended retry settings.
- Capture multi-model architecture in `docs/WORKFLOW_ENGINE.md`.

### Testing strategy
- **Unit tests:**
  - Model dispatcher per provider (happy path, retries, error propagation).
  - Step execution normalization (parallel vs fallback).
- **Integration tests:**
  - Workflow execution with mock providers returning varied payloads.
  - Preview responses verifying structure, warnings, and token aggregation.
- **Frontend tests:**
  - Component tests for model configuration form.
  - Cypress flow covering configuration → preview → comparison.
- **Manual verification:**
  - Credential misconfiguration handling.
  - High token warning messaging.

### Instrumentation & telemetry
- Log provider name, model, response time, retry count, and status per prompt step.
- Surface cumulative token usage per provider in execution result.
- Add feature flag (`workflow.multiModel`) to allow progressive rollout.

## Dependencies & open questions
- Confirm environment variable naming convention aligns with existing secret management (terraform, GitHub Actions secrets).
- Decide on default provider ordering for fallback (e.g., prefer `openai` → `anthropic` → `google`).
- Evaluate need for provider-specific parameter validation (e.g., `top_p` vs `max_output_tokens`).
- Determine storage strategy for provider diagnostics (logs only vs persisted in execution output).

## Next steps checklist

## Manual verification checklist
> Follow these steps after completing the setup in the run instructions below. Capture screenshots or console logs for any discrepancies.

1. **Create baseline workflow**
  - Launch the application and sign in with a test account.
  - Navigate to *Workflows → New Workflow* and create a workflow named “Multi-model QA”.
  - Expected: Workflow appears in the list with status `Active`.
2. **Add multi-model prompt step**
  - Open the workflow, click *Add Step → Prompt*.
  - Enable *Multi-model execution* and add providers for OpenAI, Anthropic, and Gemini using default model presets.
  - Expected: Provider badges render for each model, form validation prevents duplicate provider/model combos.
3. **Configure per-model parameters**
  - For each provider, adjust temperature (e.g., OpenAI `0.4`, Anthropic `0.2`, Gemini `0.3`) and set custom max token values.
  - Expected: Parameter inputs persist per provider after saving and re-opening the step modal.
4. **Set routing mode**
  - Choose *Parallel* routing with concurrency `2` and preferred order matching the provider order.
  - Expected: Routing pill summary updates to “Parallel · 3 providers · concurrency 2”.
5. **Preview prompt execution**
  - Click *Preview Outputs*, enter sample input text (e.g., “Summarize today’s release highlights”), and run preview.
  - Expected: Three output cards render (one per provider) with latency and token metadata; warnings surface if credentials are missing.
6. **Run full workflow execution**
  - Return to workflow editor and click *Run Workflow* to store execution history.
  - Expected: Execution completes without error; history detail view shows aggregated `modelOutputs` payload for all providers.
7. **Retry handling sanity check**
  - Temporarily unset one provider’s API key and repeat the preview.
  - Expected: Failed provider shows retry warnings while other providers still return outputs; UI surfaces actionable guidance.

Record actual results alongside each step. Flag any deviations as blockers for launch.

## Local run instructions
Use these commands to prepare an environment that mirrors automated verification. Run from the repository root unless noted.

```powershell
# Install workspace dependencies
npm install

# Seed databases and Prisma client
env:NODE_ENV="development"; npm run db:setup

# Launch backend in test mode (uses 3001 by default)
npm run start:test

# In a new terminal: launch frontend dev server
npm run start:frontend:dev

# Optional: execute automated test suites referenced in validation
npm run test:backend
npm run test:frontend -- --run
```

**Environment variables:**
- `OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` — required for real provider calls. For manual smoke tests without live keys, leave unset to observe warning states in Step 7 above.
- `DATABASE_URL`, `TEST_DATABASE_URL` default to the Prisma SQLite files checked into `backend/prisma` and generally require no changes for local validation.

Ensure both backend and frontend servers continue running while performing the manual checklist. Stop processes with `Ctrl+C` when finished.
