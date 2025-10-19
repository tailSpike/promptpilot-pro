# Epic 8 — Story 3: Canvas Builder — Manual Test Guide

This manual guide mirrors the Cypress acceptance spec for Epic 8 — Story 3 and is named to match the story for easier grouping with related docs.

For the normalized path version, see: `docs/testing/manual/canvas-builder-v2.md`.

## Prerequisites
- Backend and frontend running locally
- Feature flags return `builder.v2.linear=true` and `builder.v2.canvas=true` for your session/user

## Start the app (Windows PowerShell)
Option A: Dev servers (frontend on 5173, backend on 3001)

```powershell
# From repo root
npm run dev
```

Option B: Preview + E2E orchestrator (builds, resets test DB, starts servers, and runs the Canvas spec)

```powershell
# From repo root
node scripts/run-e2e.js --spec cypress/e2e/builder-canvas-v2.cy.ts --headed
```

## Steps
1. Register/login, create a workflow (or use an existing one). In Builder V2 (Linear or Canvas), enter a Workflow Name under Basic Information and click Create Workflow.
2. Visit `/workflows/:id/edit?v2=1&canvas=1`.
3. Confirm Canvas is visible (`[data-testid="builder-v2-canvas"]`).
   - See DEV Guide section “Builder V2 – Canvas Mode” for flags, query params, and test IDs.
4. Open the step library; quick-add `PROMPT` then `TRANSFORM`.
5. Verify at least two nodes are present (`[data-testid^="canvas-node-"]`).
6. Connect nodes: click the purple `handle-output` on the first node, then click the blue `handle-input` on the second. An edge popover should appear.
7. In the edge popover, type `output.text` into the Path field and click the Apply button.
8. Zoom in twice (`canvas-zoom-in`) and zoom out once (`canvas-zoom-out`); confirm `canvas-minimap` is visible.
9. Click Save: either the main editor Save button, or the Canvas header Save (`[data-testid="canvas-save-button"]`). If this is a brand new workflow without an ID yet, the Canvas Save button is disabled; first use the main Create/Save control to create the workflow. After the workflow has an ID, Canvas Save persists state to localStorage.
10. Reload the same URL; verify at least two nodes and one edge rehydrate.

## Notes
- LocalStorage keys used:
  - `ppp-builder-v2-mode`: last builder mode
  - `ppp-canvas-last-saved:<workflowId>`: canvas nodes/edges/zoom; namespaced per workflow ID
- This story does not implement server-side canvas persistence or drag-to-move; those are follow-ups.

## References
- Manual (normalized): `docs/testing/manual/canvas-builder-v2.md`
- Epic: `docs/EPIC8_STORY3_CANVAS_BUILDER.md`
- Cypress spec: `frontend/cypress/e2e/builder-canvas-v2.cy.ts`