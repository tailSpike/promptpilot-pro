# Epic 2 Story 3: Testing & Preview System ✅ COMPLETE

## 📋 User Story
**As a workflow owner, I want to preview and test flows before deploying them so I can validate behaviour without polluting production history.**

This framing aligns with Atlassian's agile guidance to document epics with a clear persona, need, and purpose so downstream tasks carry user value context.

## 🎯 Goals & Acceptance Criteria
- Preview runs must execute the real orchestration pipeline end-to-end without persisting execution rows.
- Builders can toggle between sample payloads and manual JSON input with validation feedback.
- Step-level diagnostics (duration, token estimates, warnings, errors) surface in the UI.
- API contracts document preview request/response shapes and error handling states.
- Cypress coverage exercises happy paths, validation errors, and sample data toggles.

## 🚢 Delivered Functionality
- **Backend**
  - Added `POST /api/workflows/:id/preview` route that mirrors `execute` without writes.
  - Implemented sandbox orchestration with deep-cloned inputs/outputs to avoid mutation side-effects.
  - Surfaced structured warnings and per-step statistics in the response envelope.
  - Hardened Zod schemas for manual payload validation and sample-data hydration.
- **Frontend**
  - Workflow detail page includes a Preview drawer with sample/manual payload toggle.
  - JSON editor validates input and highlights schema mismatches before submission.
  - Step-by-step result explorer renders durations, token estimates, warnings, and raw outputs.
  - Final output sandbox keeps preview artefacts visually distinct from persisted executions.
- **Tooling**
  - Cypress E2E spec `workflow-preview.cy.ts` covers manual payloads, sample data, validation failures, and warning rendering.
  - Added retry safeguards (`retries.runMode = 2`) to stabilise preview suites in CI.

## 🧪 Testing Summary
- **Cypress**: `workflow-preview.cy.ts`
  - Happy path preview with manual JSON input.
  - Sample data auto-fill and toggle reset flows.
  - Invalid JSON and backend validation error messaging.
  - Warning banner rendering and dismissal persistence.
- **Backend**: Jest unit coverage for preview orchestration helpers and schema guards.
- **Frontend**: Vitest component tests for preview form validation and result presentation helpers.

## 📈 Observability & DX Enhancements
- Preview responses include aggregated metrics (`totalDurationMs`, `tokensUsed`) to inform future analytics.
- Frontend stores last-used payload locally so builders can iterate quickly during a session.
- GitHub Actions executes preview suites as part of `npm run test:e2e`, ensuring regression coverage before merge.

## 🔭 Follow-ups Tracked
- Persist preview runs for comparison and team sharing.
- Expose aggregated preview metrics alongside execution history in the UI.
- Expand Cypress coverage to include failure-state visual regressions and trigger-to-preview hand-offs.
- Integrate preview orchestration with upcoming trigger execution pipeline once scheduler wiring lands.

## 📎 References
- Atlassian Agile Coach — [Agile epics: definition, examples, and templates](https://www.atlassian.com/agile/project-management/epics)
- Atlassian Agile Coach — [User stories with examples and a template](https://www.atlassian.com/agile/project-management/user-stories)

*Last updated: September 29, 2025*