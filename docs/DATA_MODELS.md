# 🧬 DATA MODELS — PromptPilot Pro

This document defines the core entities used in PromptPilot Pro, a modular AI workflow platform. These models support prompt creation, workflow orchestration, execution logging, feedback, and user management.

---

## 📄 Prompt

Represents a reusable, structured AI prompt with variables and metadata.

```ts
Prompt {
  id: string
  name: string
  content: string // e.g. "Summarize the following notes: {{notes}}"
  variables: string[] // e.g. ["notes"]
  metadata: {
    category: string
    tags: string[]
  }
  version: string // semantic versioning
  createdBy: User.id
  createdAt: Date
  updatedAt: Date
}
```

---

## 🔗 Workflow

Represents a chain of prompts with logic, triggers, and model settings.

```ts
Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
  triggers: Trigger[] // e.g. manual, scheduled, webhook
  owner: User.id
  status: "draft" | "published" | "archived"
  createdAt: Date
  updatedAt: Date
}
```

---

## 🔧 WorkflowStep

Represents a single step in a workflow.

```ts
WorkflowStep {
  id: string
  promptId: Prompt.id
  model: ModelProfile.id
  inputMapping: Record<string, string> // maps workflow inputs to prompt variables
  outputKey: string // key to store output for downstream steps
  order: number
}
```

---

## 📊 ExecutionLog

Captures the result of a workflow or prompt execution.

```ts
ExecutionLog {
  id: string
  workflowId: Workflow.id
  stepId: WorkflowStep.id
  promptId: Prompt.id
  input: Record<string, any>
  output: string
  modelUsed: string
  status: "success" | "error" | "timeout"
  timestamp: Date
  durationMs: number
}
```

---

## 🧠 Feedback

Stores user ratings and annotations on prompt outputs.

```ts
Feedback {
  id: string
  executionId: ExecutionLog.id
  userId: User.id
  rating: number // 1–5
  comment: string
  tags: string[]
  createdAt: Date
}
```

---

## 👤 User

Represents an authenticated user with role and preferences.

```ts
User {
  id: string
  email: string
  name: string
  role: "admin" | "architect" | "collaborator" | "viewer"
  preferences: {
    defaultModel: string
    theme: "light" | "dark"
  }
  createdAt: Date
  lastLogin: Date
}
```

---

## 🧩 ModelProfile

Defines model-specific settings and credentials.

```ts
ModelProfile {
  id: string
  name: string // e.g. "GPT-4", "Claude 2"
  provider: string // e.g. "OpenAI", "Anthropic"
  apiKey: string // stored securely
  parameters: {
    temperature: number
    maxTokens: number
    topP?: number
  }
  createdBy: User.id
  createdAt: Date
}
```

---

## 🌐 IntegrationHook

Represents external triggers or delivery endpoints.

```ts
IntegrationHook {
  id: string
  type: "webhook" | "slack" | "email"
  targetUrl: string
  authToken?: string
  linkedWorkflowId: Workflow.id
  createdAt: Date
}
```

---

