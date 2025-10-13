## 📄 `/docs/API.md`

```markdown
# 🔌 API Reference — PromptPilot Pro

All endpoints are prefixed with `/api`. Unless noted, endpoints require a valid JWT bearer token obtained from the authentication APIs.

---

## 1. Authentication & health

### POST `/api/auth/register`
Registers a new user.
```json
{
  "email": "user@example.com",
  "password": "strong-password",
  "name": "Aviator"
}
```
**Response**
```json
{
  "token": "JWT",
  "user": {
    "id": "user_cuid",
    "email": "user@example.com",
    "name": "Aviator"
  }
}
```

### POST `/api/auth/login`
Authenticates an existing user. Response matches registration.

### GET `/api/health`
Public health check that returns `{ "status": "ok" }` when the backend is alive.

---

## 2. Folders

### GET `/api/folders`
Returns the folder hierarchy for the authenticated user. Each node includes `_count` metadata for prompts and children.

### POST `/api/folders`
Create a folder.
```json
{
  "name": "Campaigns",
  "description": "Marketing workflows",
  "color": "#3B82F6",
  "parentId": null
}
```

### GET `/api/folders/:id`
Fetch folder details.

### PUT `/api/folders/:id`
Update folder metadata.

### DELETE `/api/folders/:id`
Delete the folder. Include optional `moveToFolderId` query param to re-parent contents before deletion.

---

## 3. Prompts

### GET `/api/prompts`
List prompts with optional query parameters (`folderId`, `search`, pagination).

### POST `/api/prompts`
Create a prompt.
```json
{
  "name": "Summarise Notes",
  "content": "Summarise the following notes: {{notes}}",
  "variables": [
    { "name": "notes", "type": "text", "description": "Raw meeting notes" }
  ],
  "metadata": { "category": "reporting" },
  "folderId": null,
  "isPublic": false
}
```

### GET `/api/prompts/:id`
Retrieve prompt details including current version and execution count.

### PUT `/api/prompts/:id`
Update prompt metadata, content, or variables. Supports semantic version change types via `changeType` and `commitMessage`.

### DELETE `/api/prompts/:id`
Remove a prompt.

### POST `/api/prompts/:id/execute`
Execute a prompt with runtime variables.
```json
{
  "variables": {
    "notes": "Weekly highlights..."
  }
}
```

---

## 4. Workflows

### GET `/api/workflows`
List workflows owned by the user. Supports `folderId`, `search`, `limit`, `offset` query params.

### POST `/api/workflows`
Create a workflow.
```json
{
  "name": "Weekly Report",
  "description": "Summarise notes and mail them",
  "folderId": null,
  "tags": ["weekly", "report"],
  "isActive": true
}
```

### GET `/api/workflows/:id`
Return workflow details including steps, recent executions, and owner metadata.

### PUT `/api/workflows/:id`
Update workflow metadata (`name`, `description`, `isActive`).

### DELETE `/api/workflows/:id`
Delete a workflow and its dependent entities.

---

## 5. Workflow steps

### POST `/api/workflows/:id/steps`
Create a step. `type` determines which config fields are required.
```json
{
  "name": "Draft summary",
  "type": "PROMPT",
  "order": 0,
  "promptId": "prompt_cuid",
  "config": {
    "variables": {
      "notes": "workflowInput.weeklyNotes"
    },
    "modelSettings": {
      "model": "gpt-4",
      "temperature": 0.6
    }
  }
}
```

### PUT `/api/workflows/:id/steps/:stepId`
Update step name, order, prompt, or config payload.

### DELETE `/api/workflows/:id/steps/:stepId`
Remove a step.

### POST `/api/workflows/:id/execute`
Kick off a workflow execution. Responds with the persisted execution record while work continues asynchronously.
```json
{
  "input": {
    "weeklyNotes": "Highlights from the week"
  },
  "triggerType": "MANUAL"
}
```
**Response**
```json
{
  "id": "exec_cuid",
  "workflowId": "workflow_cuid",
  "status": "PENDING",
  "input": { "weeklyNotes": "Highlights from the week" },
  "metadata": {
    "stepCount": 4,
    "inputVariableCount": 1
  },
  "createdAt": "2025-09-29T19:45:10.322Z"
}
```

### POST `/api/workflows/:id/preview`
Preview workflow execution without persisting results.
```json
{
  "input": {
    "weeklyNotes": "Highlights from the week"
  },
  "useSampleData": false
}
```
**Response**
```json
{
  "workflowId": "workflow_cuid",
  "status": "COMPLETED",
  "usedSampleData": false,
  "input": { "weeklyNotes": "Highlights from the week" },
  "finalOutput": { "summary": "..." },
  "totalDurationMs": 1834,
  "stats": {
    "stepsExecuted": 4,
    "tokensUsed": 182
  },
  "warnings": [],
  "stepResults": [
    {
      "stepId": "step_cuid",
      "name": "Draft summary",
      "type": "PROMPT",
      "order": 0,
      "durationMs": 642,
      "inputSnapshot": { "weeklyNotes": "Highlights from the week" },
      "output": { "summary": "..." },
      "warnings": []
    }
  ]
}
```

#### 409 — Revoked provider credentials
When all targeted providers for the preview only have revoked credentials for the requester, the API fails fast with a structured conflict response:
```json
{
  "status": "FAILED",
  "usedSampleData": false,
  "totalDurationMs": 0,
  "stats": { "stepsExecuted": 0, "tokensUsed": 0 },
  "warnings": ["Credential revoked. Re-authorize before running this workflow."],
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
- Applies when `simulateOnly` is false (default) and the preview would need external provider calls.
- If at least one provider has an ACTIVE credential, the preview continues using available credentials.

---

## 6. Libraries & sharing

> **Feature flag:** Requires `collaboration.sharing` to be enabled via `FEATURE_FLAG_COLLABORATION_SHARING`.

### POST `/api/libraries/:id/shares`
Share a prompt library (folder) with another workspace member.
```json
{
  "inviteeEmail": "teammate@example.com"
}
```
**Responses**
- `201` with share metadata (invitee, inviter, folder) when successful
- `404` when the folder is not owned by the requester
- `429` when exceeding the hourly invite rate limit
- `400` for invalid email or duplicate active share

### DELETE `/api/libraries/:id/shares/:shareId`
Revoke an existing share. Response body includes `message` confirmation.

### GET `/api/libraries/:id/shares`
List active shares for the owner, returning invitee details and audit metadata.

### GET `/api/libraries/shared-with-me`
List libraries the authenticated user can view, including owner and inviter information.

### GET `/api/libraries/:id`
Fetch a shared library summary (owner, prompt count, timestamps). Enforces access via ownership or viewer share.

### GET `/api/libraries/:id/prompts`
Return prompts within the library when the requester is the owner or has viewer access.

### GET `/api/users/search?q=term`
Member lookup used by the share modal. Requires at least two characters and returns up to ten matches.

---

## 7. Triggers & scheduling

### GET `/api/workflows/:workflowId/triggers`
List triggers for the workflow with recent execution summaries.

### POST `/api/workflows/:workflowId/triggers`
Create a trigger. Config requirements vary by `type`.
```json
{
  "name": "Every weekday at 8am",
  "type": "SCHEDULED",
  "config": {
    "cron": "0 8 * * 1-5",
    "timezone": "America/New_York"
  }
}
```
 When creating or updating a scheduled trigger, include a timezone (IANA name, e.g., "America/New_York"). If omitted, the server defaults to UTC.
 Scheduled triggers will expose nextRunAt computed from cron + timezone; clients should treat this as read-only.

### GET `/api/triggers/:id`
Fetch trigger details with the latest executions.

### PUT `/api/triggers/:id`
Update trigger metadata or config. Changing the type resets config to avoid stale fields.

### DELETE `/api/triggers/:id`
Delete a trigger and stop any scheduled jobs.

### POST `/api/triggers/:id/execute`
Manual trigger execution (authenticated).

Headers:
- `Authorization: Bearer <JWT>`

Body (optional):
```json
{ "input": { "any": "json" } }
```

Responses:
- `200` with execution record when accepted.
- `401` when not authenticated or not owned by the user.

Example (PowerShell):
```powershell
$token = "<your_jwt>"
$triggerId = "<manual_trigger_id>"
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3001/api/triggers/$triggerId/execute" -Headers @{ Authorization = "Bearer $token" } -Body (@{ input = @{ source = "docs" } } | ConvertTo-Json) -ContentType 'application/json'
```

---

### POST `/api/triggers/:id/invoke`
API trigger execution using a generated API key (no user auth).

Headers:
- `X-API-Key: <apiKey>` (from the trigger’s `config.apiKey`)

Body (optional):
```json
{ "input": { "any": "json" } }
```

Responses:
- `202` with `{ message, executionId }` when accepted.
- `401` when the API key is missing/invalid (in non-production, key checks may be bypassed for tests).
- `404` if the trigger doesn’t exist or isn’t an API type.

Example (PowerShell):
```powershell
$triggerId = "<api_trigger_id>"
$apiKey = "<api_key_from_trigger_config>"
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3001/api/triggers/$triggerId/invoke" -Headers @{ 'X-API-Key' = $apiKey } -Body (@{ input = @{ source = "docs" } } | ConvertTo-Json) -ContentType 'application/json'
```

### POST `/api/webhooks/:triggerId`
Webhook entry point for `WEBHOOK` triggers.

Auth options (choose one):
- Header: `X-Webhook-Secret: <secret>`
- Body: `{ "secret": "<secret>", "input": { ... } }`
- Query: `?secret=<secret>`

Body (optional):
```json
{ "input": { "any": "json" } }
```

Responses:
- `202` with `{ message, executionId }` when accepted.
- `401` when the secret is missing/invalid (in non-production, secret checks may be bypassed for tests).
- `400/404` when the trigger is not a webhook or does not exist.

Example (PowerShell with header):
```powershell
$triggerId = "<webhook_trigger_id>"
$secret = "<webhook_secret_from_trigger_config>"
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3001/api/webhooks/$triggerId" -Headers @{ 'X-Webhook-Secret' = $secret } -Body (@{ input = @{ source = "docs" } } | ConvertTo-Json) -ContentType 'application/json'
```

---

### POST `/api/events`
Dispatch an application event to matching `EVENT` triggers (authenticated).

Headers:
- `Authorization: Bearer <JWT>`

Body:
```json
{ "eventType": "order.created", "payload": { "id": "123" }, "workflowId": "optional-workflow-id" }
```

Responses:
- `202` with `{ message, count, executionIds }` when dispatched.
- `400` when `eventType` is missing.
- `401` for missing/invalid authentication.

Example (PowerShell):
```powershell
$token = "<your_jwt>"
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:3001/api/events" -Headers @{ Authorization = "Bearer $token" } -Body (@{ eventType = 'cypress.test'; payload = @{ ok = $true } } | ConvertTo-Json) -ContentType 'application/json'
```

---

## 8. Error handling
Errors follow a consistent shape:
```json
{
  "error": "Invalid input",
  "details": [
    {
      "path": ["config", "cron"],
      "message": "Cron expression is required"
    }
  ]
}
```
- `400` for validation failures (Zod errors).
- `401` for missing/invalid authentication.
- `403` reserved for future multi-tenant features.
- `404` when resources are not found or not owned by the user.
- `500` for unexpected server errors.

---

## 9. Rate limiting & security
- JWT secret configured via `JWT_SECRET`; rotate regularly in production.
- Webhook and API triggers generate random 256-bit secrets that should be stored securely by clients.
- Add reverse proxies (Nginx/Cloudflare) for rate limiting and TLS termination in production.

Refer to [`docs/WORKFLOW_ENGINE.md`](WORKFLOW_ENGINE.md) for trigger lifecycle details and [`docs/DEV_GUIDE.md`](DEV_GUIDE.md) for testing expectations.

---

## 10. Importable examples

- Postman collection: `docs/examples/postman-triggers.collection.json`
- OpenAPI (for SmartBear SwaggerHub/ReadyAPI): `docs/examples/openapi-triggers.yaml`
- Bruno collection: `docs/examples/bruno/promptpilot-triggers/` (open this folder in Bruno; edit `environments/local.bru`)

These cover manual execute, API invoke, webhook, and event dispatch with variables for base URL, JWT, and secrets.
````
