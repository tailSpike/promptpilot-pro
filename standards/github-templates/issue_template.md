> Please follow the Standard Workflow when authoring this issue.

## Story

As a [role], I want [capability], so that [value].

## Acceptance Criteria

- [ ] Behavior (user-visible):
  - [ ] ...
- [ ] Persistence/Reload:
  - [ ] After Save, reload/edit page shows the saved state (variables, steps, bindings)
  - [ ] Idempotent Save: re-saving does not duplicate records
  - [ ] Deletion persists across reloads
- [ ] Validation/Errors:
  - [ ] Inline validation surfaces missing/invalid inputs
  - [ ] Server errors are surfaced meaningfully
- [ ] Flags/Access:
  - [ ] Feature flag behavior documented (if any)
- [ ] Process: This story follows the Standard Workflow

## Test Plan

- [ ] Unit tests for core logic and edge cases
- [ ] Component/Integration tests for UI/service interactions
- [ ] E2E (Testing Trophy – one per AC):
  - [ ] Persistence after Save (post-redirect assertions)
  - [ ] Variables hydration (including Additional variables)
  - [ ] Idempotent Save
  - [ ] Delete flows

## Notes

- Links, diagrams, and context.
