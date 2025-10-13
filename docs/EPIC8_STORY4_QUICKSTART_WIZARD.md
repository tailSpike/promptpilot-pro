# Epic 8 — Story 4: Quickstart Wizard & Templates

Status: Proposed → Draft
Feature flag: builder.v2.wizard
Related: WORKFLOW_BUILDER_V2_DESIGN.md

## User Story
As a new user, I want a quickstart wizard with ready-made templates so I can get a runnable workflow with minimal setup.

## Acceptance Criteria
- Template gallery with ~4 starter flows (summarize docs, extract entities + email, classify + route, webhook-triggered responder)
- Wizard collects minimal inputs; generates a runnable flow in Linear Builder
- Inline hints in generated steps with links to docs
- Telemetry: wizard completion rate

## Non-Goals
- Marketplace publishing (Epic 3)

## Tests
- E2E: complete wizard → run workflow; template smoke validations