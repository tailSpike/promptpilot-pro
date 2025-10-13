# Epic 8 — Story 3: Canvas Builder (Advanced)

Status: Proposed → Draft
Feature flag: builder.v2.canvas
Related: WORKFLOW_BUILDER_V2_DESIGN.md

## User Story
As an advanced user, I want a visual canvas to arrange steps and draw dataflow so I can reason about complex workflows at a glance.

## Acceptance Criteria
- Canvas mode with nodes (steps) and edges (mappings)
- Quick-add from step library; connect outputs to inputs
- Edge popover for mapping refinement (path selection, simple transforms)
- Zoom/pan, mini-map; performant on mid-sized graphs
- Persist minimal UI layout (x,y) per step

## Non-Goals
- Complex ETL-like transforms (keep MVP simple)

## Tests
- Unit: edge creation/removal, popover mapping
- E2E: add nodes, connect, preview, validate; a11y checks