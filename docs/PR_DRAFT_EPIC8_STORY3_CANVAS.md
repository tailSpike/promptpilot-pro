# PR Draft — Epic 8 Story 3: Canvas Builder (Advanced)

## Summary
Implements a minimal Canvas Builder V2 behind feature flags with deterministic routing via query params. Adds Cypress acceptance coverage and basic component tests. Integrates with WorkflowEditor V2 mode selection and persists canvas state to localStorage on form submit.

## Acceptance Criteria & Tests
- Canvas mode renders when V2 is enabled (query params ?v2=1&canvas=1) — covered by frontend/cypress/e2e/builder-canvas-v2.cy.ts.
- Quick-add nodes from step library (PROMPT, TRANSFORM) — covered.
- Connect nodes via output→input handles; show edge popover mapping — covered.
- Zoom in/out controls and minimap visible — covered.
- Save persists positions/edges (localStorage) and rehydrate on reload — covered.

## Manual Test Cases (mirrors E2E)
1. Ensure feature flags return builder.v2.linear=true, builder.v2.canvas=true.
2. Visit /workflows/:id/edit?v2=1&canvas=1.
3. Verify Canvas renders; open library and add PROMPT + TRANSFORM.
4. Connect output handle of first node to input handle of second; set mapping path and Apply.
5. Zoom in twice and out once; confirm minimap visible.
6. Click Save; reload; verify nodes and at least one edge rehydrate.

## How to Run Locally (Windows PowerShell)
- Lint + unit tests: npm run lint ; npm run test:frontend
- Curated E2E (builds, starts servers, runs Cypress): node scripts/run-e2e.js --spec cypress/e2e/builder-canvas-v2.cy.ts --headed

## Docs Updated
- Added Builder V2 – Canvas Mode section to docs/DEV_GUIDE.md
- Added docs/CANVAS_BUILDER_V2_TEST_GUIDE.md (manual verification)

## Notes / Scope
- Canvas layout persistence is localStorage-only in this slice.
- Server-side persistence and drag-to-reposition are follow-ups.

## Risks
- None known. E2E/Unit/Lint are green locally. CI flake avoided by deterministic routing via query params.