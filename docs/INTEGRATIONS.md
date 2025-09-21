## 📄 `/docs/INTEGRATIONS.md`

```markdown
# 🌐 External Integrations — PromptPilot Pro

This document outlines supported integrations and how workflows can be triggered or extended externally.

---

## 🔗 Supported Platforms

- Slack (incoming messages → workflow trigger)
- Zapier (workflow → action chain)
- Notion (output → page append)
- Webhooks (custom triggers and delivery)

---

## 🧾 IntegrationHook Object

```json
{
  "id": "hook_001",
  "type": "webhook",
  "targetUrl": "https://example.com/receive",
  "authToken": "abc123",
  "linkedWorkflowId": "workflow_789"
}
```

---

## 🔐 Security

- All hooks require token-based auth
- Rate limits apply to external triggers
- Logs include source IP and timestamp

---

## 📦 Future Integrations

- Google Sheets
- Discord
- Email delivery
- Custom plugin SDK
```

---