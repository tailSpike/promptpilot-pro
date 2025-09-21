## 📄 `/docs/WORKFLOW_ENGINE.md`

```markdown
# ⚙️ Workflow Engine — PromptPilot Pro

This document describes the logic, execution flow, and retry strategy for the workflow engine.

---

## 🧩 Execution Flow

1. Workflow triggered (manual, scheduled, or API)
2. Steps parsed in order
3. Each step:
   - Loads prompt
   - Injects variables
   - Sends to model
   - Stores output
4. Outputs passed to next step
5. Final result logged and returned

---

## 🔁 Retry Logic

- Max retries: 3
- Backoff strategy: exponential
- Timeout per step: 30s
- Failure states: logged with error code

---

## 🧠 Model Switching

- Each step can specify a different model
- Model parameters (temperature, maxTokens) are configurable
- Future support for fallback models

---

## 🧪 Testing Strategy

- Mock model responses
- Simulated workflows with sample inputs
- Step-level assertions
```

---