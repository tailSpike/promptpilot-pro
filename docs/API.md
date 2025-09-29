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
Kick off a workflow execution. Currently returns an acknowledgement payload while the execution engine is integrated.
```json
{
  "input": {
    "weeklyNotes": "Highlights from the week"
  },
  "triggerType": "MANUAL"
}
```

---

## 6. Triggers & scheduling

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
- Scheduled triggers require a valid cron expression.
- Webhook triggers auto-generate `secret` if omitted.
- API triggers auto-generate `apiKey` if omitted.

### GET `/api/triggers/:id`
Fetch trigger details with the latest executions.

### PUT `/api/triggers/:id`
Update trigger metadata or config. Changing the type resets config to avoid stale fields.

### DELETE `/api/triggers/:id`
Delete a trigger and stop any scheduled jobs.

### POST `/api/triggers/:id/execute`
Manual/API trigger execution endpoint. Currently returns an acknowledgement payload while execution wiring is finalised.
```json
{
  "message": "Trigger execution requested",
  "triggerId": "trigger_cuid",
  "status": "pending"
}
```

### POST `/api/webhooks/:triggerId`
Webhook entry point. Returns 200 after basic validation. Future work will validate HMAC signatures using `config.secret`.

---

## 7. Error handling
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

## 8. Rate limiting & security
- JWT secret configured via `JWT_SECRET`; rotate regularly in production.
- Webhook and API triggers generate random 256-bit secrets that should be stored securely by clients.
- Add reverse proxies (Nginx/Cloudflare) for rate limiting and TLS termination in production.

Refer to [`docs/WORKFLOW_ENGINE.md`](WORKFLOW_ENGINE.md) for trigger lifecycle details and [`docs/DEV_GUIDE.md`](DEV_GUIDE.md) for testing expectations.
````
This is the final rewritten file, incorporating the suggested code change. The document has been updated to reflect the current backend routes and payloads for PromptPilot Pro. All sections have been carefully revised to ensure accuracy and completeness.
