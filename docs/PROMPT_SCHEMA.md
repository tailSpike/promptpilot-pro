## 📄 `/docs/PROMPT_SCHEMA.md`

```markdown
# 🧾 Prompt Schema — PromptPilot Pro

This document defines the structure and validation rules for AI prompts used in the platform.

---

## 🧠 Prompt Object

```json
{
  "id": "prompt_123",
  "name": "Summarize Notes",
  "content": "Summarize the following notes: {{notes}}",
  "variables": ["notes"],
  "metadata": {
    "category": "summarization",
    "tags": ["meeting", "summary"]
  },
  "version": "1.2.0"
}
```

---

## 🧪 Validation Rules

- `content` must include all declared `variables`
- `name` must be unique within a workspace
- `version` follows semantic versioning
- `metadata.tags` must be lowercase, alphanumeric

---

## 🔄 Versioning Strategy

- Major changes → `1.x.x`
- Minor edits → `x.1.x`
- Metadata-only → `x.x.1`

---

## 🧩 Future Extensions

- Prompt chaining
- Conditional logic blocks
- Embedded model hints
```

---