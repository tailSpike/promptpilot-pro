> Please follow the Standard Workflow when authoring this issue: [docs/STANDARD_WORKFLOW.md](../docs/STANDARD_WORKFLOW.md)

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
 - [ ] Process: This story follows the Standard Workflow linked above

## E2E Test Plan

- [ ] Add Cypress tests that (Testing Trophy aligned – keep E2E lean):
  - [ ] Verify persistence after Save by asserting post-redirect state
  - [ ] Verify variables hydration including Additional variables
  - [ ] Verify idempotent Save (no duplicates after second Save)
  - [ ] Verify delete flows (removed items stay removed post-save)
  - [ ] Keep to one E2E per Acceptance Criterion (add more only if strictly necessary)

## Notes

- Links, diagrams, and context.
