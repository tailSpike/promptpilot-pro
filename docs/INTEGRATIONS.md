## 📄 `/docs/INTEGRATIONS.md`

```markdown
# 🌐 External Integrations — PromptPilot Pro

PromptPilot Pro exposes multiple trigger types that allow external systems to launch workflows. This document summarises the current capabilities and planned integrations.

---

## 1. Supported today

### Webhook triggers
- Endpoint: `POST /api/webhooks/:triggerId`
- Security: HMAC secret generated per trigger (`config.secret`). Include signature headers in outbound requests (HMAC enforcement on the backend is scheduled next).
- Payload: Arbitrary JSON. Future iterations will provide schema validation hints.

### API triggers
- Endpoint: `POST /api/triggers/:id/execute`
- Authentication: Include `x-api-key` header using the generated `config.apiKey`.
- Use cases: Internal services or scripts that need deterministic workflow kicks.

### Manual triggers
- UI-driven, but useful for integrating with CLI scripts or GitHub Actions via the API trigger path.

---

## 2. Near-term roadmap
- **Webhook signature verification**: Validate incoming payloads using `config.secret` and standard headers (`x-signature`, `x-timestamp`).
- **Payload mapping**: Allow storing JSONPath expressions that map webhook fields to workflow variables.
- **Outgoing webhooks**: Support delivering workflow outputs to external URLs.

---

## 3. Longer-term ideas
- Slack and Teams command handlers that translate messages into workflow executions.
- Zapier/Make connectors using the API trigger surface.
- Native integrations for Notion, Google Sheets, and email to distribute outputs.
- Event bus listeners (Kafka/EventBridge) via the `EVENT` trigger type.

---

## 4. Provider credentials

The new **Integration Keys** console lets workspace owners store encrypted API credentials for model providers. The experience is now enabled by default and appears under **Settings → Integration Keys** in the navigation.

### Available providers

The backend ships with a registry in `backend/src/config/providers.ts` that currently covers OpenAI, Anthropic, Google Gemini, and Azure OpenAI. Update this file to surface extra providers or scopes.

### API surface

- `GET /api/integrations/providers` — list metadata for configured providers.
- `GET /api/integrations/credentials` — fetch stored credentials for the authenticated user.
- `POST /api/integrations/credentials` — create a credential (secret encrypted with AES-256-GCM via `KeyVaultService`).
- `PATCH /api/integrations/credentials/:id` — rotate a key (provide `secret`) or update labels/metadata.
- `DELETE /api/integrations/credentials/:id` — revoke a credential (soft delete).

All write operations emit audit logs via `AuditService`. Secrets never leave the server decrypted.

### Console workflow

1. Go to **Settings → Integration Keys**.
2. Choose a provider, supply a label (e.g., `QA Sandbox`), and paste the API key.
3. Optional JSON metadata can tag sandbox credentials for CI use.
4. Existing keys can be rotated or revoked with quick actions.

> ℹ️  For sandboxes without real providers, the UI accepts fake secrets; however, do not store production credentials in shared preview environments yet — KMS adapters beyond the local fallback are planned in Epic 4 Story 3.

If you plan to implement an integration, document the usage pattern in this file and add a reference example in the docs or `/examples` directory.
```

---

### 5. CI: Live provider smoke checks (optional)

The repository includes a scheduled and on-demand GitHub Actions workflow to verify external model providers are reachable with your CI-injected secrets. This runs a lightweight Cypress spec that only hits public provider endpoints; it does not start the app.

- Workflow file: `.github/workflows/provider-smoke.yml`
- Cypress spec: `frontend/cypress/e2e/provider-smoke.cy.ts`

Secrets to configure in your repository (Settings → Secrets and variables → Actions → New repository secret):

- `OPENAI_API_KEY` (maps to `CYPRESS_OPENAI_API_KEY`)
- `ANTHROPIC_API_KEY` (maps to `CYPRESS_ANTHROPIC_API_KEY`)
- `GEMINI_API_KEY` (maps to `CYPRESS_GEMINI_API_KEY`)
- `AZURE_OPENAI_API_KEY` (maps to `CYPRESS_AZURE_OPENAI_API_KEY`)
- `AZURE_OPENAI_ENDPOINT` (maps to `CYPRESS_AZURE_OPENAI_ENDPOINT`, e.g., `https://your-resource.openai.azure.com`)
- `AZURE_OPENAI_API_VERSION` (maps to `CYPRESS_AZURE_OPENAI_API_VERSION`, optional)

Notes
- Tests are self-skipping: if a provider’s secret(s) aren’t present, that provider’s test is skipped instead of failing.
- Azure API version default in the spec is `2024-02-15-preview`. If your region/resource requires a different version (for example, a newer GA), set `AZURE_OPENAI_API_VERSION` accordingly in repo secrets.
- The Azure test calls `GET {endpoint}/openai/deployments?api-version=...` and expects a response with a `value` array.
- Artifacts (screenshots/videos) are uploaded only if present.

Manual runs
- From the Actions tab, select “Provider Smoke (Live Providers)” → “Run workflow”.
- Cron schedule runs daily at 05:00 UTC.

Security of stored keys
- Keys saved via the Integration Keys console are encrypted at-rest using AES-256-GCM by the backend KeyVault service.
- CI secrets remain within GitHub Actions and are injected only for the smoke workflow job. They are not persisted in the app database.

Runbook note
- After rotating any CI provider secrets (in GitHub → Settings → Secrets and variables → Actions), manually trigger the “Provider Smoke (Live Providers)” workflow to validate connectivity immediately. The job summary will display a per-provider table with status, latency, and tokens (when available).

---

### 6. Revoked credentials behavior (Preview runs)

When all targeted providers for a workflow preview have only revoked credentials for the current user/workspace, the backend fails fast with an explicit 409 response so the UI can surface an actionable message instead of silently simulating.

Status: 409 Conflict

```json
{
  "status": "FAILED",
  "usedSampleData": false,
  "totalDurationMs": 0,
  "stats": { "stepsExecuted": 0, "tokensUsed": 0 },
  "warnings": ["Credential revoked. Re-authorise before running this workflow."],
  "stepResults": [],
  "finalOutput": null,
  "error": {
    "code": "provider.credentials.revoked",
    "message": "Credential revoked",
    "providers": ["openai", "anthropic"]
  }
}
```

Notes
- Applies when preview runs would require external provider calls and `simulateOnly` is not set.
- If at least one ACTIVE credential exists for any targeted provider, the preview continues using available credentials.
- Use Integration Keys to rotate a new credential, then re-run the preview to clear this warning.