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