# EPIC 8 – Story 3: Execution Visualization in Linear Builder V2

## Goal
Enable authors to run workflows directly from Builder V2 and see a live, inline execution timeline: per-step status, outputs, warnings, and run-to-here/re-run controls without leaving the editor.

## Acceptance Criteria

Behavior
- Run button enabled after first save (workflow ID present) and valid form state.
- Executions initiated from Builder V2 update an inline timeline pane in real time.
- Each step shows: order, name, started/finished badges, duration, warnings, and primary output preview (text or document link when offloaded).
- “Run to here” and “Re-run step” controls mirror Preview behavior but execute real runs, not simulation.
- If a step fails, the timeline shows FAILED state with surfaced error message; downstream steps don’t execute.
- Variable tokens (including step.<id>.output.text) resolve during real execution (matches Preview semantics).

Persistence / Reload
- The latest execution summary is visible in the workflow’s Execution Reports list and is linkable from the timeline.
- Reloading the editor keeps the timeline collapsed by default and shows a link to the most recent execution.

Validation / Errors
- “Run” disabled if the workflow has forward-reference warnings or invalid variable types.
- If provider credentials are missing/revoked, surface a clear inline message and link to Integration Keys.

Access & Flags
- Feature piggybacks on `builder.v2.linear`; run visualization gated behind `workflow.run.inline` flag for controlled rollout.

## UX Notes
- Timeline uses the same visual language as Preview for consistency.
- Show a compact “Live Run” card above execution history, with expand/collapse.

## Testing (Testing Trophy)
- Unit: ensure adapter translates execution updates into timeline items; guard token resolution path.
- Component: Builder V2 shows run button state; timeline renders step items; error/warning paths.
- E2E: end-to-end run from the editor, asserting step transitions and final status; simulate missing credentials path.

## Implementation Outline
1) Backend
   - Ensure actual runs expose step.<id>.output.text in the execution context (added in Story 2 follow-up).
   - Extend executeWorkflow to stream progress (SSE/WebSocket) or poll for updates.
2) Frontend
   - Add “Run” controls in Builder V2 (already present) to start execution and show Live Run timeline inline.
   - Reuse Preview components for rendering with a “Live” badge; wire polling/SSE to update statuses.
3) Docs & Flags
   - Document behavior and add `workflow.run.inline` flag entry.

## Risks & Mitigations
- Long-running runs: use background polling and allow collapsing timeline.
- Provider quota/latency: show inline warnings and keep UI responsive.

## Rollback Plan
Disable the `workflow.run.inline` feature flag; the “Run” button falls back to existing behavior without live visualization.
