# Standard Workflow

1) Define
- Write the user story clearly
- Capture Acceptance Criteria (AC)
- Identify risks/assumptions

2) Design
- Sketch data flow and UI
- Plan tests per AC (unit, component/integration, E2E)

3) Build (TDD-friendly)
- Write failing unit/component tests
- Implement minimal code to pass
- Add one E2E per AC to validate end-to-end contract

4) Verify
- Lint, type check, run all tests
- Manual smoke as needed

5) Review & Merge
- Complete PR checklist
- Ensure docs updated
