## 📄 `/docs/API.md`

```markdown
# 🔌 API Contracts — PromptPilot Pro

This document defines the core RESTful endpoints for PromptPilot Pro. These APIs support prompt creation, workflow execution, feedback submission, and model integration.

---

## 🧾 Authentication

- JWT-based sessions  
- Role-based access control (RBAC)  
- Token passed via `Authorization: Bearer <token>`

---

## � Folder Endpoints

### `POST /folders`
Create a new folder  
**Body:**
```json
{
  "name": "My Folder",
  "description": "Optional description",
  "color": "#3B82F6",
  "parentId": "optional-parent-folder-id"
}
```

### `GET /folders`
Retrieve all folders in hierarchical structure
**Response:**
```json
{
  "message": "Folders retrieved successfully",
  "folders": [
    {
      "id": "folder_123",
      "name": "My Folder",
      "description": "A sample folder",
      "color": "#3B82F6",
      "parentId": null,
      "children": [
        {
          "id": "folder_456",
          "name": "Subfolder",
          "parentId": "folder_123",
          "children": [],
          "_count": { "prompts": 5, "children": 0 }
        }
      ],
      "_count": { "prompts": 10, "children": 1 }
    }
  ]
}
```

### `GET /folders/:id`
Retrieve folder details with contents

### `PUT /folders/:id`
Update folder properties
**Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "color": "#EF4444",
  "parentId": "new-parent-id"
}
```

### `DELETE /folders/:id`
Delete folder and optionally move contents
**Query Parameters:**
- `moveToFolderId` (optional): ID of folder to move contents to

---

## �📘 Prompt Endpoints

### `POST /prompts`
Create a new prompt  
**Body:**
```json
{
  "name": "Summarize Notes",
  "content": "Summarize the following notes: {{notes}}",
  "variables": ["notes"],
  "metadata": {
    "category": "summarization",
    "tags": ["meeting", "summary"]
  },
  "folderId": "optional-folder-id",
  "isPublic": false
}
```

### `GET /prompts/:id`
Retrieve prompt details

### `PUT /prompts/:id`
Update prompt content or metadata

### `DELETE /prompts/:id`
Archive or delete prompt

---

## 🔗 Workflow Endpoints

### `POST /workflows`
Create a new workflow  
**Body:**
```json
{
  "name": "Weekly Report Generator",
  "steps": [
    {
      "promptId": "prompt_123",
      "model": "gpt-4",
      "inputMapping": { "notes": "weeklyNotes" },
      "outputKey": "summary"
    }
  ],
  "triggers": ["manual"]
}
```

### `GET /workflows/:id`
Retrieve workflow details

### `POST /workflows/:id/execute`
Run a workflow with input payload  
**Body:**
```json
{
  "inputs": {
    "weeklyNotes": "Here are the notes from this week..."
  }
}
```

---

## 📊 Execution & Feedback

### `GET /logs/:id`
Fetch execution log and output

### `POST /feedback`
Submit feedback on a prompt output  
**Body:**
```json
{
  "executionId": "exec_456",
  "rating": 4,
  "comment": "Good summary, but missed key point",
  "tags": ["clarity", "coverage"]
}
```

---

## 🧠 Model Integration

### `GET /models`
List available AI models

### `POST /models/test`
Send a test prompt to a selected model  
**Body:**
```json
{
  "model": "claude-2",
  "prompt": "Summarize this: {{text}}",
  "variables": { "text": "Here are the meeting notes..." }
}
```

---

## 🛡️ Admin & Access

### `POST /auth/login`
Authenticate user and return JWT

### `GET /users/me`
Retrieve current user profile

### `POST /users/invite`
Invite a team member to workspace

```

---

## 📄 `/docs/MVP_SCOPE.md`

```markdown
# 🚀 MVP Scope — PromptPilot Pro

This document outlines the minimum viable product (MVP) for PromptPilot Pro. The goal is to deliver a usable, scalable foundation for prompt creation and workflow automation.

---

## ✅ Included in MVP

### Core Features
- Prompt Composer with variables and metadata
- Workflow Builder with linear chaining
- Execution Engine for single-model flows
- OpenAI GPT-4 integration
- Execution logging and feedback submission
- User authentication and workspace management

### Developer Experience
- Walking skeleton with README and DEV_GUIDE
- CI pipeline with linting and basic tests
- Docker-based local setup
- Modular folder structure and clear data models

---

## ❌ Excluded from MVP (Post-MVP Roadmap)

- Multi-model switching within workflows
- Conditional branching and loop logic
- Prompt marketplace and monetization
- Plugin SDK for external integrations
- Advanced analytics (A/B testing, heatmaps)
- Team collaboration features (comments, suggestions)

---

## 📈 Success Metrics

- Can create and run a workflow end-to-end
- Can view execution logs and submit feedback
- Can onboard a new user and share a prompt
- CI passes with no errors on every commit
- App deploys to staging with working flows

```
