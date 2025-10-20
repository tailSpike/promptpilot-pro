# Epic 8 — Story 3: Canvas Builder (Advanced) — PR Draft

Implements the Canvas Builder for Workflow Builder V2 behind a feature flag. Users can add nodes, connect edges with a mapping popover, zoom, and persist layout locally per workflow. Includes a deterministic test path and a manual verification guide.

---

## Story / Links

- Epic: 8 — Story 3: Canvas Builder (Advanced)
- Feature flags: `builder.v2.linear`, `builder.v2.canvas`
- Deterministic entry: `/workflows/:id/edit?v2=1&canvas=1`

---

## Acceptance Criteria Coverage

- [x] Canvas mode with nodes (steps) and edges (mappings)
- [x] Quick-add from step library; connect outputs to inputs
- [x] Edge popover for mapping refinement (path selection, simple transforms)
- [x] Zoom/pan, mini-map; performant on mid-sized graphs (smoke exercised via zoom/minimap)
- [x] Persist minimal UI layout (x,y) per step

Spec(s):
- `frontend/cypress/e2e/builder-canvas-v2.cy.ts`

---

## Implementation summary

- Canvas: `frontend/src/components/CanvasBuilderV2.tsx`
  - Nodes/edges with DOM-accurate handle centers; cubic curves; non-scaling stroke, rounded caps/joins
  - Edge popover (`edge-popover`, `edge-mapping-path`, `edge-mapping-apply`)
  - Zoom controls and minimap placeholder (`canvas-zoom-in`, `canvas-zoom-out`, `canvas-minimap`)
  - Client-side persistence on Save to `localStorage` key `ppp-canvas-last-saved:<workflowId>`
  - Canvas Save disabled until workflowId exists (tooltip + note)
- V2 integration: `frontend/src/components/WorkflowEditor.tsx`
  - V2 form includes “Basic Information” (Name + Description) and error banner for validation feedback
  - Shared submit handler creates/updates workflow; saves steps for new workflows
- Documentation updates
  - `docs/EPIC8_STORY3_CANVAS_BUILDER.md`
  - `docs/testing/manual/canvas-builder-v2.md`
  - `docs/DEV_GUIDE.md`
  - `docs/CANVAS_BUILDER_V2_TEST_GUIDE.md` (legacy)
  - `README.md` (how to use Canvas V2; namespaced key)
- PR template: `.github/PULL_REQUEST_TEMPLATE.md`

---

## How to run locally

Windows PowerShell:
```powershell
# From repo root
npm run setup
npm run dev
```

Optional: targeted E2E
```powershell
node scripts/run-e2e.js --spec cypress/e2e/builder-canvas-v2.cy.ts --headed
```

---

## Manual verification

Follow `docs/testing/manual/canvas-builder-v2.md`.

Notes:
- In V2 (Linear or Canvas), enter a Workflow Name and click “Create Workflow.” Canvas Save is disabled until a workflow ID exists.
- Persistence is namespaced per workflow: `ppp-canvas-last-saved:<workflowId>`.

---

## Quality gates (local)

- [x] Lint/type-check: PASS
- [x] Frontend unit tests: PASS
- [x] Frontend build: PASS
- [x] E2E (Canvas spec): PASS

---

## Follow-ups

- Server-side persistence for canvas layout
- Drag-to-reposition nodes and improved edge routing visuals
- Deeper unit tests around edge mapping and node lifecycle events
