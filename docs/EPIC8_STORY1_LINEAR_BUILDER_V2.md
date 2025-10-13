# Epic 8 — Story 1: Linear Builder V2 (Authoring, Mapping, Preview)

Status: Proposed → Draft
Feature flag: builder.v2.linear
Related: WORKFLOW_BUILDER_V2_DESIGN.md

## User Story
As a builder, I want a simple linear workflow editor with clear data mapping and preview controls so I can create and test flows quickly.

## Acceptance Criteria
- New Linear Builder route behind feature flag
- Step cards with compact headers and collapsible detail
- Variable Inspector visible; click-to-bind or drag-to-map compatible variables
- Inline validation for required fields and schema mismatches
- Preview run with Execution Timeline; support "Run to here" and "Re-run step"
- Data Inspector shows step-by-step sample inputs/outputs
- A11y: Keyboard navigation for adding steps, selecting fields, binding variables

## Non-Goals
- Canvas builder
- Templates/wizard

## UI/Dev Notes
- Components: StepCard, VariableInspector, DataInspector, TimelineBar
- Validation: zod schema-driven forms; show inline issues; disable primary CTA until valid
- Preview API: extend existing preview endpoint to return per-step outputs and diagnostics

## Tests
- Unit: mapping validation, form rules
- RTL: keyboard navigation and binding
- E2E: create flow → map → preview → run-to-here → re-run

## Definition of Done
- Feature-flagged UI merged
- Docs: DEV_GUIDE updated, screenshots added
- Cypress coverage in CI green