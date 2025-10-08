# 🔐 Epic 4 — Story 2: Provider Integration Keys & Live Verification

## Story snapshot
- **User story:** As a prompt engineer, I want to register provider API keys inside PromptPilot Pro so workflows can run against real models during development and automated tests.
- **Primary touchpoint:** Dedicated web settings page that lets users paste provider secrets, review status, and manage rotations without leaving the browser.
- **Acceptance criteria:**
  - Secure web UI (paste-in form) and API for storing encrypted provider credentials per workspace (OpenAI, Anthropic, Gemini, Azure OpenAI, etc.).
  - Backend can inject decrypted keys into runtime when executing preview, test, and full workflow runs.
  - Automated test matrix exercises live providers (or sandbox tenants) at least once per CI cycle and surfaces failures with actionable diagnostics.

## Current state (baseline)
- Provider credentials are injected via environment variables on the server. Individual users cannot supply their own keys for testing.
- Workflow preview and Cypress suites rely on mocked responses; no confidence that production providers behave as expected.
- There is no credential rotation workflow, audit logging, or encryption-at-rest story aligned with SOC2-ready practices.
- Feature flags (`workflow.multiModel`) exist but do not gate access based on credential availability.

## Research highlights

### Secure storage patterns
- **KMS-backed encryption:** Use cloud KMS (AWS KMS, Azure Key Vault, GCP KMS) or libsodium sealed boxes to encrypt secrets before persisting. OWASP Secrets Cheat Sheet: <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>.
- **Rotating credentials:** Reference Hashicorp Vault rotation workflows to design key replacement UX (<https://developer.hashicorp.com/vault/docs/concepts/rotation>).
- **Audit trails:** SOC2 auditors expect immutable logs of who accessed/updated secrets. Consider leveraging Postgres `jsonb` audit tables or external services like Panther.

### Testing inspirations
- **Stripe live + test keys split**: encourage separate environments and enforce guardrails preventing accidental use of production keys in CI.
- **OpenAI organization usage reports**: allow tagging requests; we can tag CI traffic to monitor spend (<https://platform.openai.com/docs/guides/usage>).
- **Contract testing**: Pact-like patterns emphasise hitting real providers with smoke flows at least daily (<https://docs.pact.io/>).

### Compliance considerations
- Encryption keys must be rotated at least annually.
- Secrets must be redacted from logs; only metadata should appear in audit reports.
- Provide customer export/delete mechanics (GDPR article 17) for stored credentials.

## Implementation plan

### Data & configuration
- Introduce `IntegrationCredential` model:
  - `id`, `workspaceId`, `provider`, `label`, `encryptedSecret`, `createdBy`, `createdAt`, `lastRotatedAt`, `status` (`active`, `expiring`, `revoked`).
  - Optional `metadata` (e.g., `sandbox: true`, `usageTag`: `ci-smoke`).
- Create KMS abstraction (`KeyVaultService`) with pluggable adapters (AWS KMS default; fallback to libsodium + master key env var for local dev).
- Add configuration entries under `config/providers.ts` mapping provider → required scopes, endpoint template, sandbox availability.

### Backend services
- Credential lifecycle APIs (`/api/integrations/credentials`):
  - `POST` create (encrypt secret, store metadata, emit audit event).
  - `GET` list and redact secret values.
  - `PATCH` rotate: requires new secret, bumps `lastRotatedAt`, archives old secret (optional grace).
  - `DELETE` revoke: marks status and blocks future execution.
- Extend workflow execution pipeline:
  - Resolve credentials by `workspaceId` + provider at run time.
  - Fail fast with descriptive error if missing.
  - Attach credential usage metadata to execution logs (provider id, key label) without storing the raw secret.
- Update preview + test endpoints to share the same credential resolution path.
- Implement audit logging (e.g., `AuditEventService.record(eventType, actorId, payload)` storing hashed secret fingerprint).

### Frontend (Console)
- New "Integration Keys" settings area:
  - Credential table with provider, label, status, last rotated, usage tags.
  - Guided add-key wizard highlighting provider-specific steps and documentation links.
  - Rotate & revoke actions with confirmation modals and copyable CI usage instructions.
- Workflow builder guardrails:
  - Banner on prompt steps when required provider credential is missing.
  - CTA redirects users to integration settings.
- Test execution UI additions:
  - Display which credential was used for each run.
  - Flag runs executed with sandbox keys to avoid confusing latency/cost expectations.

### Automated verification
- **CI smoke suite:**
  - New GitHub Actions workflow `provider-smoke.yml` scheduled nightly + triggered on credential changes.
  - Runs minimal prompt across each configured provider using workspace-specific CI keys.
  - Captures latency, token usage, and response status; fails build if providers unreachable.
- **Cypress updates:**
  - Add e2e spec `workflow-provider-keys.cy.ts` that provisions sandbox keys via UI, runs preview, validates live response banner.
- **Contract tests:**
  - Lightweight Jest suite hitting providers with pact-like assertions (status codes, schema, error handling).

### Documentation & enablement
- Update `docs/DEV_GUIDE.md` with key management workflow and CLI helpers.
- Add `docs/INTEGRATIONS.md` sections for key creation per provider, rate limit notes, sandbox endpoints.
- Produce `docs/SECURITY.md` appendix covering encryption model, audit logging, and access controls.
- Provide runbooks for expired key alerts in `docs/STANDARD_WORKFLOW.md`.

### Testing strategy
- **Unit tests:** KMS adapter (encrypt/decrypt cycle), credential service validations, audit log emission.
- **Integration tests:** API endpoints with sqlite-backed test harness ensuring secrets stored encrypted.
- **E2E tests:** Cypress flow for adding key + executing preview.
- **Security tests:** Static analysis ensuring secrets are not logged; optional zap/gitleaks enforcement for repo.

### Instrumentation & telemetry
- Metrics:
  - `integration_credentials_total{provider,status}`
  - `credential_rotations_total{provider}`
  - `provider_smoke_failures_total{provider}`
- Alerts when smoke suite fails twice consecutively or credential nearing expiry (configurable threshold, default 30 days).
- Log secret fingerprints (SHA-256 of plaintext) to detect duplicates across workspaces without storing raw data.

### Dependencies & open questions
- Confirm hosting environment (AWS/GCP/Azure) to choose default KMS implementation.
- Decide whether to support per-user vs. per-workspace credentials initially.
- Determine spend guardrails for CI smoke tests to avoid unexpected charges.
- Evaluate need for customer-managed encryption keys (CMEK) for enterprise tier.

## Manual verification checklist
1. **Add credential**
   - Navigate to *Settings → Integration Keys*.
   - Add OpenAI key labelled "QA Sandbox".
   - Expected: Key appears with status `Active`, no plaintext exposed, audit log entry recorded.
2. **Run workflow preview**
   - Configure prompt step using OpenAI provider.
   - Execute preview.
   - Expected: Live response returned; run details show "QA Sandbox" credential tag.
3. **Rotate credential**
   - Replace key with new token.
   - Expected: `lastRotatedAt` updates, old executions maintain historical reference.
4. **CI smoke suite**
   - Trigger `provider-smoke.yml` manually in GitHub Actions.
   - Expected: All providers return 200 responses; workflow prints latency + token usage to job summary.
5. **Revoke credential**
   - Mark key as revoked.
   - Expected: Subsequent workflow preview fails with explicit "Credential revoked" error and remediation link.
6. **Audit review**
   - Export audit log for the workspace.
   - Expected: Events logged for create, rotate, revoke with actor id and secret fingerprint.

Record observations in the release ticket; attach screenshots of the integrations UI and CI run summary.

## Local run instructions

```powershell
# Install workspace deps
npm install

# Run backend migrations for IntegrationCredential + audit tables
npm run db:migrate --workspace backend

# Start backend with KMS emulator (libsodium fallback)
$env:KMS_DRIVER="local"; npm run start:test

# Launch frontend console for manual verification
npm --prefix frontend run dev

# Execute provider smoke tests locally (requires sandbox keys)
npm --prefix backend run test:providers
npm --prefix frontend run cypress:run -- --spec cypress/e2e/workflow-provider-keys.cy.ts
```

**Environment variables:**
- `KMS_DRIVER` (`aws`, `azure`, `gcp`, `local`)
- `KMS_MASTER_KEY` (required for `local` driver)
- Provider-specific keys (sandbox friendly) for manual smoke tests.

## Development API keys per provider

We rely on vendor-issued sandbox or non-production keys so engineers can verify integrations without touching production secrets:

- **OpenAI**: Generate a personal API key from the OpenAI dashboard (<https://platform.openai.com/api-keys>). Use an organization-scoped key tied to the shared "PromptPilot Dev" org when possible; otherwise create a temporary key with the *Pay-as-you-go* tier and cap spend via usage limits.
- **Azure OpenAI**: Request access in the Azure portal, then create a resource in the shared `promptpilot-dev` subscription. Capture the *Keys and Endpoint* pair (`OPENAI_API_KEY`, `OPENAI_API_BASE`). Limit key scope to `deployment=dev-gpt-4o-mini` and regenerate after the sprint.
- **Anthropic**: Use the sandbox project issued under our Anthropic account (<https://console.anthropic.com>). Create a standard API key with the "Development" label so Anthropic throttles usage appropriately. Keys expire monthly; set a calendar reminder to refresh.
- **Google Gemini**: Enable the *Generative Language API* in the internal `promptpilot-dev` Google Cloud project and create an API key via the Credentials screen. Restrict the key to the Gemini API and toggle the *Test* quota profile.

Document any new providers (e.g., Cohere, Mistral) by adding similar acquisition notes and linking to their developer portals. Always prefer provider-specific test tenants with enforced spend caps.

Stop servers with `Ctrl+C` when finished. Rotate any temporary keys created during testing.
