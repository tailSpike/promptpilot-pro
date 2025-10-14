# Acceptance Criteria Template

Behavior (user-visible):
  - ...
Persistence/Reload:
  - After Save, reload/edit page shows the saved state
  - Idempotent Save: re-saving does not duplicate records
  - Deletion persists across reloads
Validation/Errors:
  - Inline validation for missing/invalid input
  - Server errors surfaced meaningfully
Flags/Access (if any):
  - Feature flag behavior documented
Testing:
  - Unit + Component/Integration for logic and UI
  - One E2E per AC, with persistence/reload asserted
