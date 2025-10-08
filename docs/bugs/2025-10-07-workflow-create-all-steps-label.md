# Bug: Cypress workflow-create-all-steps spec fails due to label casing

- **Date discovered:** 2025-10-07
- **Detected in CI run:** GitHub Actions run [18329034102](https://github.com/tailSpike/promptpilot-pro/actions/runs/18329034102)
- **Status:** ✅ Fixed locally (awaiting PR on `bug/workflow-create-steps-label`)

## Summary
The Cypress spec `workflow-create-all-steps-ui.cy.ts` fails because UI label updates outpaced the test selectors. The prompt configuration form now renders `Max tokens` (lowercase "t") and replaces the single `Model` dropdown with a "Model Ensemble" section that uses `Provider`, `Model name`, and `Display label` fields. The original assertions targeted the old casing and the removed `Model` select, causing retries to time out.

## Impact
- Blocks the `feature/epic4-story1-multi-model` branch from merging because the quality gate fails when Cypress E2E suite reports a failing spec.
- Prevents validation of multi-model workflow features in CI until the test is adjusted.

## Reproduction steps
1. Checkout `feature/epic4-story1-multi-model` (or any branch containing commit `6b2d4df` that updated the workflow editor labels).
2. Run the recorded Cypress suite:
   ```powershell
   npm --prefix frontend run test:e2e -- --spec cypress/e2e/workflow-create-all-steps-ui.cy.ts
   ```
3. Observe the failure:
   ```
   CypressError: Timed out retrying after 4000ms: Expected to find content: 'Max Tokens' within the element:
   <div.border.border-gray-200.rounded-lg.p-4> but never did.
   ```

## Expected vs. actual
| | Expected | Actual |
|---|---|---|
| UI label | `Max Tokens` | `Max tokens` |
| Cypress assertion | `cy.contains('Max Tokens')` finds the label | Selector fails and test aborts |

## Proposed fix
Update the Cypress spec to:

- Use a case-insensitive regex when locating the `Max tokens` numeric input.
- Target the new "Model Ensemble" controls by selecting the `Provider`, `Model name`, and `Display label` fields instead of the removed `Model` dropdown.

This keeps the test aligned with the redesigned prompt configuration UI while remaining resilient to future copy tweaks.

## Attachments / References
- Cypress log snippet saved at `tmp/cypress_log.txt` (local reproduction)
- CI artifacts: `.github#962` (Cypress recorded run failure details)

## Next steps
- [x] Document the failing scenario (this file).
- [x] Update the Cypress spec to cover the new label casing and ensemble controls.
- [x] Re-run targeted Cypress tests locally.
- [ ] Push `bug/workflow-create-steps-label` and open PR.
