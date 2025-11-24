# Canvas Builder V2 — Manual Test Plan

This plan mirrors the acceptance criteria for Epic 8 — Story 3 and complements the Cypress spec at `frontend/cypress/e2e/builder-canvas-v2.cy.ts`.

## Prerequisites
- Backend and frontend running locally
- Feature flags: `builder.v2.linear=true`, `builder.v2.canvas=true`

## Steps
1. Register or log in. Create a workflow (or open an existing one).
  - In Builder V2 (Linear or Canvas), first enter a value in the "Workflow Name" field under Basic Information, then click the "Create Workflow" button.
2. Visit `/workflows/:id/edit?v2=1&canvas=1`.
3. Confirm the canvas is visible (`[data-testid="builder-v2-canvas"]`).
4. Open Step Library. Quick-add `PROMPT` then `TRANSFORM`.
5. Verify at least two nodes (`[data-testid^="canvas-node-"]`).
6. Connect nodes: click purple `handle-output` on the first, then blue `handle-input` on the second. Popover should appear.
7. In popover: set Path to `output.text`, click Apply.
8. Zoom in twice, zoom out once; confirm minimap is visible.
9. Click Save (either main Save or Canvas Save). If this is a brand new workflow without an ID yet, the Canvas Save button is disabled; first use the main Create/Save control to create the workflow. After the workflow has an ID, Canvas Save persists to `localStorage`.
10. Reload; verify nodes and one edge rehydrate.

## Notes
- LocalStorage keys:
  - `ppp-builder-v2-mode`: last builder mode
  - `ppp-canvas-last-saved:<workflowId>`: canvas nodes/edges/zoom; namespaced per workflow ID

## Known limitations (current slice)
- Server-side canvas persistence is not part of this slice.
- Edge routing is simple bezier; no obstacle avoidance yet.

## Troubleshooting
- Clicking "Create Workflow" does nothing: ensure the "Workflow Name" is filled. If there are validation issues (e.g., a PROMPT step without inline content or a selected prompt), a red error banner appears above the form with details.