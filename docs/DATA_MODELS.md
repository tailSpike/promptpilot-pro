# 🧬 Data Models — PromptPilot Pro

The platform's entities are defined in `backend/prisma/schema.prisma`. This document highlights the most important models and how they relate to each other.

---

## Users & organisation

### `User`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (cuid) | Primary key |
| `email` | `String` | Unique login identifier |
| `password` | `String` | Bcrypt-hashed |
| `role` | `Role` enum (`USER` \| `ADMIN`) | Access level |
| `createdAt`, `updatedAt` | `DateTime` | Audit timestamps |

Users own folders, prompts, and workflows. Cascading deletes ensure user cleanup removes dependent records.

### `Folder`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` (cuid) |
| `name` | `String` |
| `color` | `String?` | Optional hex swatch |
| `parentId` | `String?` | Self-referential for hierarchy |
| `userId` | `String` | Owner |

Folders group prompts and workflows. The `FolderHierarchy` relation models nested structures.

---

## Prompt catalogue

### `Prompt`
| Field | Type | Notes |
|-------|------|-------|
| `variables` | `Json` | Array of variable descriptors consumed by the UI |
| `metadata` | `Json?` | Category/tags/notes |
| `version` | `String` | Semantic version string |
| `currentVersionId` | `String?` | Points to the active `PromptVersion` |

Each prompt can live inside a folder, expose current version metadata, and back prompt executions.

### `PromptVersion`
Captures immutable snapshots with semantic versioning (`majorVersion`, `minorVersion`, `patchVersion`). Branch metadata (`PromptBranch`) links experimental work to base versions.

### `PromptExecution`
Stores historical executions with raw input/output payloads and optional `versionId` linkage.

---

## Workflow engine

### `Workflow`
| Field | Type | Notes |
|-------|------|-------|
| `isActive` | `Boolean` | Soft enable/disable for execution |
| `tags`, `metadata` | `Json?` | Arbitrary categorisation |
| `templateId` | `String?` | Links to `WorkflowTemplate` for clones |

### `WorkflowStep`
| Field | Type | Notes |
|-------|------|-------|
| `type` | `StepType` enum (`PROMPT`, `CONDITION`, `TRANSFORM`, `DELAY`, `WEBHOOK`, `DECISION`) |
| `order` | `Int` | Unique per workflow |
| `config` | `Json` | Step-specific configuration payload |

### `WorkflowVariable`
Per-workflow input schema describing variable names, datatypes, defaults, and validation rules.

### `WorkflowExecution`
| Field | Type | Notes |
|-------|------|-------|
| `status` | `ExecutionStatus` enum (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`) |
| `input`, `output` | `Json` | Captured payloads |
| `triggerType` | `String` | e.g. `MANUAL`, `SCHEDULED` |
| `triggerId` | `String?` | Links back to the originating `WorkflowTrigger` |

### `WorkflowStepExecution`
Stores per-step execution data (input/output, retries, duration) tied to a parent execution.

---

## Triggering & scheduling

### `WorkflowTrigger`
| Field | Type | Notes |
|-------|------|-------|
| `type` | `TriggerType` enum (`MANUAL`, `SCHEDULED`, `WEBHOOK`, `API`, `EVENT`) |
| `isActive` | `Boolean` | Enables/disables runtime scheduling |
| `config` | `Json` | Trigger-specific settings (cron, timezone, secret, apiKey, etc.) |
| `lastTriggeredAt`, `nextRunAt` | `DateTime?` | Populated by scheduler callbacks |

The config schema is validated within `TriggerService`. Secrets/API keys are generated automatically when absent.

### `WorkflowTemplate`
Represents reusable workflow blueprints. Instances reference the source template via `templateId`.

---

## Enums
- `Role` — user roles.
- `TriggerType` — trigger variants.
- `StepType` — workflow step categories.
- `ExecutionStatus` — execution lifecycle states.
- `VersionChangeType` — semantic change classification for prompt versions.

---

## Diagram
Simplified relationship view:
```
User ─┬─< Folder ─┬─< Prompt ─┬─< PromptVersion
      │          │           └─< PromptExecution
      │          └─< Workflow ─┬─< WorkflowStep ─┬─< WorkflowStepExecution
      │                        │                 └─ WorkflowVariable
      │                        └─< WorkflowTrigger ─┬─< WorkflowExecution
      │                                             └─ (manual/webhook/API events)
      └─< PromptBranch
```

For the authoritative definition, inspect [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma).

