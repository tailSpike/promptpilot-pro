# Epic 8 — Story 3: Canvas Builder (Advanced)

Status: Delivered (behind feature flag)
Feature flag: builder.v2.canvas (plus builder.v2.linear)
Related: WORKFLOW_BUILDER_V2_DESIGN.md

## User Story
As an advanced user, I want a visual canvas to arrange steps and draw dataflow so I can reason about complex workflows at a glance.

## Acceptance Criteria
- Canvas mode with nodes (steps) and edges (mappings)
- Quick-add from step library; connect outputs to inputs
- Edge popover for mapping refinement (path selection, simple transforms)
- Zoom/pan, mini-map; performant on mid-sized graphs
- Persist minimal UI layout (x,y) per step

All acceptance criteria are covered by Cypress E2E (see Verification below).

## Implementation Summary
- Minimal DOM-based canvas implemented in `frontend/src/components/CanvasBuilderV2.tsx` with:
	- Nodes and edges with connection handles (`handle-output`, `handle-input`)
	- Edge popover for mapping path (`edge-popover`, `edge-mapping-path`, `edge-mapping-apply`)
	- Zoom controls and minimap placeholder (`canvas-zoom-in`, `canvas-zoom-out`, `canvas-minimap`)
	- Local persistence on surrounding form submit to `localStorage` key `ppp-canvas-last-saved:<workflowId>`
- Integrated into `WorkflowEditor` V2 path. Deterministic Canvas rendering via query params:
	- `?v2=1` enables Builder V2 for the session
	- `?canvas=1` selects Canvas mode when the canvas feature flag is on
- Last selected V2 mode is remembered in `localStorage` under `ppp-builder-v2-mode`.

### How to enable/run (local)
- Ensure feature flags return:
	- `builder.v2.linear = true`
	- `builder.v2.canvas = true`
- Visit: `/workflows/:id/edit?v2=1&canvas=1`
- For test orchestration and preview server, use the helper:
	- `node scripts/run-e2e.js --spec cypress/e2e/builder-canvas-v2.cy.ts --headed`

## Verification
### E2E Coverage
- Spec: `frontend/cypress/e2e/builder-canvas-v2.cy.ts`
	- Enables Canvas mode, adds nodes via quick-add, connects output→input
	- Configures edge mapping via popover
	- Exercises zoom/minimap
	- Saves and verifies persistence on reload (rehydrates nodes and edges)

### Unit/Component Coverage
- `frontend/src/__tests__/CanvasBuilderV2.component.test.tsx` (smoke render)
- Additional unit coverage exists across Builder V2 (linear) for variable and preview flows; Canvas-specific unit tests can be expanded in follow-ups.

### Manual Verification
- Primary guide (story-named): `docs/EPIC8_STORY3_CANVAS_BUILDER_TEST_GUIDE.md`
- Normalized manual: `docs/testing/manual/canvas-builder-v2.md`
- Legacy copy (kept for compatibility): `docs/CANVAS_BUILDER_V2_TEST_GUIDE.md`

## Non-Goals
- Complex ETL-like transforms (keep MVP simple)

## Follow-ups
- Server-side persistence of canvas layout (positions/edges) beyond `localStorage`
- Drag-to-reposition nodes and basic edge routing visuals
- Deeper unit tests around edge mapping and node lifecycle events