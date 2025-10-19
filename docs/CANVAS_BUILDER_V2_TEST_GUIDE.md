# Canvas Builder V2 — Manual Verification Guide

Note: This guide has a normalized twin in `docs/testing/manual/canvas-builder-v2.md` and a story-named copy `docs/EPIC8_STORY3_CANVAS_BUILDER_TEST_GUIDE.md`. Please prefer the normalized path for new references. This copy remains for backward compatibility with existing links.

This guide mirrors the Cypress acceptance test for EPIC 8 — Story 3 (Canvas Builder). Follow these steps to verify functionality manually.

## Prerequisites
- Backend and frontend running locally
- Feature flags return builder.v2.linear=true and builder.v2.canvas=true for your session/user

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
1. Register/login, create a workflow (or use an existing one).
2. Visit /workflows/:id/edit?v2=1&canvas=1
3. Confirm Canvas is visible ([data-testid="builder-v2-canvas"]).
  - See DEV Guide section “3.4 Builder V2 – Canvas Mode” for flags, query params, and test IDs.
4. Click the step library button; add PROMPT then TRANSFORM via quick-add buttons.
5. Verify at least two nodes are present ([data-testid^="canvas-node-"]).
6. Connect nodes: click the purple `handle-output` on the first node, then click the blue `handle-input` on the second. An edge popover should appear.
7. In the edge popover, type `output.text` into the Path field and click the Apply button.
8. Zoom in twice (canvas-zoom-in) and zoom out once (canvas-zoom-out); confirm canvas-minimap is visible.
9. Click Save: either the main editor Save button, or the Canvas header Save ([data-testid="canvas-save-button"]). If this is a brand new workflow without an ID yet, the Canvas Save button is disabled; first use the main Create/Save control to create the workflow. After the workflow has an ID, Canvas Save persists state to localStorage.
10. Reload the same URL; verify at least two nodes and one edge rehydrate.

## Notes
- LocalStorage keys used:
  - ppp-builder-v2-mode: last builder mode
  - ppp-canvas-last-saved:<workflowId>: canvas nodes/edges/zoom; namespaced per workflow ID
- This story does not implement server-side canvas persistence or drag-to-move; those are follow-ups.