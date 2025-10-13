# Manual Testing Guide — EPIC 8 Story 1: Linear Builder V2

This guide walks through manual verification of the Linear Builder V2 experience behind a feature flag. It complements automated E2E tests and can be used by reviewers during PR validation.

## Prerequisites
- Backend and frontend running via the project start script.
- Feature flag for Builder V2 enabled (default in dev/test/e2e). The API should return `builder.v2.linear: true` at `/api/feature-flags`.
- A test user session (local storage token is sufficient for local development).

## Smoke flow
1. Navigate to the new workflow editor
   - Go to `/workflows/new`.
   - Confirm editor loads.
   - Toggle V2 via the button with `data-testid="builder-v2-toggle"`.
   - Expect a container with `data-testid="builder-v2-linear"` to be visible.

2. Add a PROMPT step
   - Click `data-testid="add-step"`.
   - Choose `data-testid="step-type-PROMPT"`.
   - A step card (`data-testid="step-card"`) should appear with a prompt content input.
   - Ensure the prompt content input (`data-testid="input-field-promptContent"`) is prefilled or add content such as: `Hello {{name}}!`.

3. Bind an input via Variable Inspector
   - Open the Variable Inspector (`data-testid="variable-inspector"`).
   - Click a variable/binding token (`data-testid="binding-expression"`, e.g., name) and confirm it toggles into the prompt field as `{{name}}`.

4. Data Inspector
   - Open the Data Inspector drawer (`data-testid="data-inspector-toggle"`, then verify `data-testid="data-inspector"`).
   - Provide sample input data if supported (e.g., `{ "name": "Ada" }`).
   - Drawer should remain visible while interacting with the step card.

5. Inline validation
   - Intentionally break validation (e.g., clear prompt content) and confirm inline warnings appear (`data-testid="validation-inline"`).
   - Restore valid content and confirm warnings disappear.

6. Preview execution
   - Click `data-testid="preview-run"`.
   - Confirm an execution timeline appears: `data-testid="execution-timeline"` and statuses via `data-testid="execution-timeline-status"`.
   - Use timeline controls: `data-testid="timeline-run-to-here"` and `data-testid="timeline-rerun-step"`.
   - Expected outcome: final output renders, and status transitions to success (COMPLETED) under normal conditions.

## Expected results
- Feature flag toggle renders Linear Builder V2 UI.
- Step creation and prompt content entry are smooth.
- Variable and Data Inspectors function as described.
- Preview runs show deterministic placeholder/timeline feedback in dev.

## Troubleshooting
- If the Preview button is disabled:
  - Ensure the prompt content field is not empty and validation passes.
  - Check the console for validation or feature flag errors.
- If Linear Builder V2 does not appear:
  - Confirm `/api/feature-flags` includes `builder.v2.linear: true`.
  - Verify the toggle `builder-v2-toggle` exists and is switched on.
- If Data Inspector assertions fail:
  - Ensure you opened the Data Inspector before checking its contents.

## Notes
- Automated coverage exists in `frontend/cypress/e2e/builder-linear-v2.cy.ts`.
- Tests rely on `data-testid` attributes referenced above—avoid renaming without updating tests and docs.
