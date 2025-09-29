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

If you plan to implement an integration, document the usage pattern in this file and add a reference example in the docs or `/examples` directory.
```

---