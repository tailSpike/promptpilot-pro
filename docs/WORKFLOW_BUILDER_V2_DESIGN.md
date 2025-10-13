# Workflow Builder V2 — UX Redesign Design Doc

Last updated: 2025-10-13

Owner: Platform UX/Workflow Team

Status: Draft for review

---

## 1) Overview

We will redesign the PromptPilot Pro workflow builder UI to be significantly easier to understand, author, and debug. The current experience is powerful but can be confusing when chaining steps, passing data between prompts, and verifying execution order/timing. The new design prioritizes learnability, clear data flow, and confident execution.

This document proposes a dual-mode builder (Linear + Canvas) with a Quickstart Wizard, unified variable mapping, a live Data Inspector, a predictable Execution Timeline, and simplified Triggers. The goal is to make creating and maintaining flows intuitive without sacrificing advanced power.

## 2) Goals and Non-Goals

Goals
- Short “time-to-first-successful-run” for new users (< 5 minutes with a template or wizard)
- Make data flow obvious: what each step needs, what it produces, and how it maps forward
- Reduce configuration friction: fewer clicks, inline editing, keyboard-first where possible
- Confident execution: clear run order, dry-run/preview, step-level diagnostics, and replay
- Progressive complexity: start simple, unlock advanced only when needed
- Strong accessibility (WCAG 2.1 AA) and responsive layouts

Non-Goals
- Replace backend workflow engine semantics or persistence model (beyond small metadata additions)
- Introduce vendor-specific visual languages; remain provider-agnostic
- Build full collaborative real-time editing (tracked separately under Epic 3)

## 3) Users and Jobs-To-Be-Done

Personas
- Prompt Engineer: prototypes flows, iterates quickly, compares models
- Operations Lead: wants reliability, guardrails, time/cost predictability
- Developer Integrator: integrates with external systems, automates triggers, needs predictable contracts

Primary JTBD
- Create a new flow; connect prompts/steps; pass outputs to inputs; preview and iterate safely; schedule or expose triggers; monitor results

## 4) Pain Points (current)
- Hard to visualize how data moves from one step to the next
- Unclear validation feedback; late discovery of shape mismatches
- Scheduling feels separate from execution; timing is opaque
- Editing requires too many context switches between panels
- Difficult to re-run a specific step with the same inputs to isolate issues

## 5) Design Principles
- Start Simple, Scale Up: Linear builder first; Canvas for advanced users
- Show, Don’t Tell: Always show input/output “contracts” and sample data
- Make Mapping Physical: Drag-and-drop or one-click bindings with in-place validation
- Predictable Execution: Timeline you can scrub; “Run to here” and “Re-run step”
- Explain Decisions: Why was a model selected; why did a step skip; surface rationale inline
- Trust by Default: Safe previews that don’t pollute history, clear gating for live runs

## 6) High-Level Proposal

Dual-Mode Builder
- Linear Builder (default): A vertical list of steps (PROMPT, CONDITION, TRANSFORM, DELAY, WEBHOOK, DECISION). Each step has a compact header and a collapsible details panel. Variables map via a right-side “Variable Inspector.”
- Canvas Builder (advanced): A simple DAG (directed acyclic graph) canvas with nodes and edges. Edges represent data flow. Optional “swimlane” for triggers, core steps, webhooks.

Quickstart Wizard
- On first use or when creating a new workflow, present templates (e.g., “Summarize documents,” “Extract entities + email”), with pre-wired steps and placeholders. Wizard collects minimal info and lands the user in Linear Builder with everything runnable.

Key Shared Foundations
- Variable Inspector: Always-visible panel listing available variables (workflow inputs, step outputs, constants, secrets). Users can drag variables onto step inputs or click-to-bind. Shows type/shape and last-sample value.
- Data Inspector: Bottom drawer that shows “live sample data” at each step boundary (from preview runs). Supports expand/collapse, JSON format, copy/export, and schema view.
- Execution Timeline: A horizontal bar across the top of the builder during previews/runs. Shows ordering, status (queued/running/success/skip/fail), duration, and warnings. Supports “Run to here,” “Re-run step,” and “Resume from here.”
- Triggers Panel: Humanized schedule description, with “Simple” (date/time/interval) and “Advanced” (cron) tabs. Webhook/API/event triggers summarized with copyable endpoints and sample payloads.
- Inline Validation: Red/amber annotations next to fields with hover details; primary CTA is disabled with precise reason until required fields are completed.

## 7) Information Architecture

Primary Navigation
- Workflows, Prompts, Integrations, Runs, Triggers, Settings (unchanged)

Workflow Detail (Builder) Layout
- Top Bar: Name, Save status, Validate, Preview, Run, Undo/Redo, Diff vs Last Saved, Help
- Main Area: Toggle between Linear / Canvas
- Right Panel: Properties for selected step; tabs: [Config | Guardrails | Mapping | Docs]
- Left Drawer (optional): Library of steps/snippets/templates (collapsible)
- Bottom Drawer: Data Inspector + Console (warnings/errors/logs)

## 8) Interaction Model

Add a Step
- In Linear mode: “+ Add Step” between steps; choose type; inline forms appear with sensible defaults
- In Canvas mode: Drag from step library; connect edges by dragging output ports to input ports

Variable Mapping
- Linear: Select a step input; the Variable Inspector highlights compatible variables; click-to-bind or drag. Display the resulting JSONPath or binding expression. Inline validation shows shape mismatches.
- Canvas: Draw connection from an output port to an input port; optionally refine mapping with a small popover editor (path selectors, transforms)

Data Contracts
- Each step declares Inputs (schema) and Outputs (schema). Show both in the UI. On preview, render sample output values per step.

Execution Controls
- Validate: Static checks (required fields, unmapped inputs, cycles)
- Preview: Non-persistent run; shows timeline, logs, and sample outputs; supports “Run to here” and “Re-run step”
- Live Run: Persistent execution with triggers; confirm dialog if previews have not run recently

Error Surfacing
- Inline on fields; in Data Inspector (stack traces, warnings); on Timeline (badges)
- Provide “Fix-it” quick actions (e.g., auto-map similarly named fields, create transform step for type mismatch)

Scheduling & Triggers
- Natural language helpers (“every weekday at 9am”, “on the 1st of the month”), plus advanced cron editor with immediate human-readable preview
- Copy/paste-ready Webhook/API curl examples with validation tips and expected payload schema

Keyboard-First Enhancements
- Universal command palette (Ctrl/Cmd + K) to add steps, jump to steps, toggle panels
- Per-step shortcuts (collapse/expand, re-run)

Accessibility
- Full keyboard navigability, visible focus states, reduced motion option; screen-reader-friendly structure and labels

## 9) Visual Structure (Wireframe Notes)

- Linear Mode:
  - Step Header: [Icon] [Step Name] [Status Dot] [Duration] [Chevrons]
  - Step Body: [Config Form] [Mapping Tab] [Guardrails Tab] [Docs Tab]
  - Variable Inspector: Right side with searchable variables, types, sample values

- Canvas Mode:
  - Nodes: Minimal footprint with name, type, status; expandable for quick-edit
  - Edges: Show mapping count (e.g., 3 mappings); hover to view details

## 10) Data Model Impacts (Minimal)

- WorkflowStep metadata additions:
  - ui: { view: 'linear' | 'canvas', x?: number, y?: number }
  - inputsSchema?: JsonSchema
  - outputsSchema?: JsonSchema
  - mappings?: Array<{ to: string; from: string; transform?: string }>
  - samples?: { input?: unknown; output?: unknown }

- Execution records (preview only do not persist full history):
  - stepDiagnostics?: { durationMs: number; warnings?: string[]; errors?: string[] }

Note: schemas leverage existing Zod/TS types where possible; stored as JSON for portability.

## 11) API and Backend Impacts

- New/extended endpoints (backward-compatible):
  - POST /api/workflows/:id/validate — static validation report (unmapped inputs, schema mismatches)
  - POST /api/workflows/:id/preview?toStep=<stepId> — run to selected step; returns step-by-step outputs + diagnostics
  - POST /api/workflows/:id/preview/step/:stepId/rerun — re-run a single step with preserved inputs
  - GET  /api/workflows/:id/contracts — inputs/outputs schemas for steps and available variables
  - POST /api/schedule/parse — optional helper to humanize cron (server-side parity with UI)

## 12) Telemetry & Analytics

- Builder metrics: time-to-first-run, mapping errors per session, validation error frequency, most-added step types
- Execution preview metrics: preview success rate, common failure steps, average re-runs per step
- UI diagnostics: panel toggles, wizard completion rate, command palette usage

## 13) Performance Considerations

- Virtualize long step lists; lazy-load heavy editors
- Debounced validation; opportunistic background schema inference
- Canvas mode uses simplified DOM; only render visible nodes and edge labels

## 14) Security & Privacy

- Mask secrets in Variable Inspector; explicit reveal-once flow
- Previews avoid writing to execution history; clear callouts when switching to live runs
- Respect RBAC for editing vs viewing; audit sensitive changes (triggers, credentials)

## 15) Accessibility & Internationalization

- Keyboard navigation for all core tasks; ARIA roles/labels; color contrast > 4.5:1
- Localize labels, help text, and schedule descriptions; support 12/24h time formatting

## 16) Rollout Plan (Phased)

- Phase 0 — Prototype (2 weeks)
  - Spike Linear Builder V2 in a feature-flagged route; stub Variable/Data Inspector

- Phase 1 — Linear Builder V2 (3–4 weeks)
  - New step cards; Variable Inspector; inline validation; Data Inspector (read-only)
  - Preview “run to here” and re-run; timeline bar; basic keyboard shortcuts

- Phase 2 — Canvas Builder (3–5 weeks)
  - Basic node/edge editor; mapping edges; quick-edit popovers; zoom/pan; mini-map

- Phase 3 — Quickstart Wizard & Templates (2 weeks)
  - Template gallery; minimal input collection; land in Linear Builder ready-to-run

- Phase 4 — Polish & A11y Hardening (2 weeks)
  - Performance tuning, accessibility fixes, copywriting polish, telemetry dashboards

All phases behind feature flags with opt-in per workspace. Beta cohort gathers feedback before GA.

## 17) Risks & Mitigations

- Scope creep in Canvas mode → Keep MVP minimal; limit node types and edge features initially
- Confusion from dual modes → Clear toggle, remember last used; onboarding suggests Linear first
- Performance in large flows → Virtualization, lazy-loading, on-demand validation
- Data model drift → Store only minimal UI metadata; keep engine contracts stable

## 18) Open Questions

- How much auto-mapping should we attempt (name similarity, type compatibility)?
- Should we allow “breakpoints” that pause a live run and wait for user resume in dev?
- Do we expose per-step “docs” from a marketplace/templates?

## 19) Success Metrics

- 30% faster time-to-first-successful-run in usability tests
- 40% reduction in mapping validation errors per session
- >70% of new flows created via wizard/templates within 2 months of launch
- SUS (System Usability Scale) improves from baseline to ≥80

## 20) Implementation Notes (Frontend)

- Linear mode
  - New components: StepCard, VariableInspector, DataInspector, TimelineBar
  - Patterns: schema-driven forms, zod validation, react-query for previews, keyboard shortcuts with Cmd-K palette

- Canvas mode
  - Use a lightweight graph renderer (or custom minimal SVG) with virtualized labels
  - Fast edge creation and popover mapping editor; focus on clarity and selection states

## 21) Implementation Notes (Backend)

- Extend preview endpoints to support step-bounded execution and return per-step outputs + diagnostics
- Validation service to preflight unmapped inputs and schema mismatches
- Optional cron humanizer endpoint to keep logic in sync with frontend

## 22) QA & Testing Strategy

- Unit: mapping validation, data contract inference, timeline state transitions
- Integration: preview → run parity, re-run stability, trigger scheduling UI ↔ server
- E2E: wizard → first run; canvas mapping and run; a11y checks; keyboard nav
- Visual: snapshot guard for step cards, timeline, inspectors

## 23) Next Steps

- Review this design
- If approved, create Story “Workflow Builder UX Redesign (V2)” with Phase 1 scope and feature flag
- Stand up basic scaffolding behind feature flag and run a hallway usability test with 3–5 users

---

Appendix: Inspiration (non-goal to copy)
- ETL/dataflow tools (node/edge clarity)
- Low-code builders (inline validation and wizards)
- AI flow tools (simple mapping and preview-first)
