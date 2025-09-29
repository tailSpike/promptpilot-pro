## 📄 `/docs/PROMPT_SCHEMA.md`

```markdown
# 🧾 Prompt Schema — PromptPilot Pro

Prompt definitions live in the `prompts` table and power both standalone executions and workflow steps. This document describes the canonical shape consumed by the frontend and persisted by the backend.

---

## Prompt object
```json
{
  "id": "prompt_cuid",
  "name": "Summarise Notes",
  "description": "Weekly summary helper",
  "content": "Summarise the following notes: {{notes}}",
  "variables": [
    {
      "name": "notes",
      "type": "text",
      "description": "Raw notes to summarise",
      "required": true,
      "defaultValue": null,
      "options": []
    }
  ],
  "metadata": {
    "category": "reporting",
    "tags": ["weekly", "summary"]
  },
  "version": "1.4.0",
  "isPublic": false,
  "folderId": null,
  "createdAt": "2025-09-27T18:12:04.000Z",
  "updatedAt": "2025-09-28T09:03:10.000Z"
}
```
- `variables` is stored as JSON in the database but deserialised into strongly typed objects in the API layer.
- `metadata` is optional and may contain any JSON payload.
- `version` tracks semantic versioning; the backend also stores `PromptVersion` records for history/diffs.

---

## Validation rules
- Every variable referenced in `content` must be declared in `variables`.
- Variable names are lowerCamelCase and unique within the prompt.
- `type` is one of `text`, `number`, `boolean`, or `select`.
- Select variables can declare `options` (string array) and optional default values.
- Prompts must belong to a user; `folderId` is optional.

---

## Version lifecycle
1. Editing a prompt can create a new `PromptVersion` record when `changeType` and `commitMessage` are supplied.
2. `currentVersionId` on `Prompt` points to the active version; rolling back simply updates that pointer.
3. Branching is supported through `PromptBranch` for future collaborative workflows.

---

## Future extensions
- Custom variable validators (regex, min/max values).
- Prompt-level metadata templates (persona, tone, channel).
- Inline model hints per prompt (preferred model/temperature).

For more on data relationships see [`docs/DATA_MODELS.md`](DATA_MODELS.md).
```

---