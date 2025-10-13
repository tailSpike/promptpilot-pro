Title: EPIC 8 Story 1 — Linear Builder V2 (feature-flagged) with E2E; gate provider-keys E2E; manual testing guide

## Summary
Implements the first iteration of the Linear Builder V2 experience behind a feature flag. Adds a minimal, testable UI flow, integrates with the existing editor via a toggle, and provides end-to-end Cypress coverage. To keep CI stable in environments without provider credentials, the integration-keys E2E spec is gated behind an environment flag. A manual testing guide is included for reviewers.

## Scope of changes
- Backend
  - Add feature flag `builder.v2.linear` to centralized flag management and expose via `/api/feature-flags`.

- Frontend
  - Introduce `LinearBuilderV2` component (scaffold) with:
    - Step creation with default PROMPT content
    - Variable Inspector and Data Inspector (drawer)
    - Inline validation hooks
    - Preview execution with timeline and run-to-here/re-run controls
    - Data-testid coverage for reliable E2E selectors
  - Integrate a V2 toggle in `WorkflowEditor` to switch between Builder V1 and V2.
  - Usability improvements post-initial review:
    - Data Inspector is now a plain text area for `workflow.input` plus an "Additional variables" editor that composes `workflow.<key>` pairs
    - Advanced JSON modal to edit composed inputs directly; changes sync both ways with the plain text and variables list
    - Execution Timeline shows a short output snippet per step (interpolated text), in addition to status and controls

- Cypress E2E
  - Add `builder-linear-v2.cy.ts` exercising:
    - Feature-flagged routing and toggling into V2
    - Mapping via click-to-bind, inline validation, inspectors
    - Preview timeline and controls
  - Gate `workflow-provider-keys.cy.ts` behind `CYPRESS_RUN_PROVIDER_KEYS` env flag to avoid CI failures without provider keys.

- Docs
  - Add `docs/MANUAL_TESTING_EPIC8_STORY1_LINEAR_BUILDER_V2.md` for step-by-step manual verification.

## Feature flag
- Key: `builder.v2.linear`
- Defaults: enabled in development/test/e2e
- UI toggle: `data-testid="builder-v2-toggle"` within the Workflow Editor
- Container data-testid: `builder-v2-linear`

## How to test
1) Automated E2E
- Default run (provider-keys spec gated):
  - `npm run test:e2e`
- To include provider-keys spec:
  - Windows PowerShell session: `$env:CYPRESS_RUN_PROVIDER_KEYS = 'true'`; then `npm run test:e2e`

2) Manual testing
- Follow: `docs/MANUAL_TESTING_EPIC8_STORY1_LINEAR_BUILDER_V2.md`
- Key checkpoints use data-testids and match E2E selectors.

## CI status
- Local CI run (lint, build, unit/integration/e2e) passes.
- Provider keys spec is pending by default unless explicitly enabled via env.

## Risks & limitations
- The V2 builder is an initial scaffold; UX and layout are intentionally minimal to support TDD and fast iteration.
- Keep `data-testid` attributes in sync with tests/docs to avoid brittle E2E.
- External provider E2E are intentionally opt-in to prevent CI flakiness.

## Notable files
- Backend: `backend/src/lib/featureFlags.ts`
- Frontend: `frontend/src/components/LinearBuilderV2.tsx`, `frontend/src/components/WorkflowEditor.tsx`
- Cypress: `frontend/cypress/e2e/builder-linear-v2.cy.ts`, `frontend/cypress/e2e/workflow-provider-keys.cy.ts`
- Docs: `docs/MANUAL_TESTING_EPIC8_STORY1_LINEAR_BUILDER_V2.md`

## Checklist
- [x] Feature gated behind `builder.v2.linear`
- [x] Toggle in editor to switch to V2
- [x] E2E coverage for core V2 flow
- [x] Provider-keys spec gated by env
- [x] Manual testing guide added
- [x] All tests green locally
