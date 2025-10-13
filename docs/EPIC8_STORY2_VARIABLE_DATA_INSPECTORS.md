# Epic 8 — Story 2: Variable & Data Inspectors

Status: Proposed → Draft
Feature flag: builder.v2.linear (shared), future: builder.v2.canvas
Related: WORKFLOW_BUILDER_V2_DESIGN.md

## User Story
As a builder, I want variable and data inspectors that always show available inputs/outputs and sample values so I can confidently map and debug flows.

## Acceptance Criteria
- Variable Inspector lists workflow inputs, step outputs, constants, and secrets
- Searchable with type tags; compatibility hints on selection
- Data Inspector displays live sample data at step boundaries (from preview)
- Copy/export actions; schema view toggle
- Secret values masked by default with reveal-once pattern

## Non-Goals
- Canvas node/edge mapping UI

## Tests
- Unit: filter/search behavior, type hints
- RTL: keyboard navigation, copy actions
- E2E: preview → inspect data → re-map and re-run