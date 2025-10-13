# 🧭 Epic 8: Workflow Builder V2 (UX Redesign)

Status: Proposed → Draft → Planned
Owner: Platform UX/Workflow Team
Related: WORKFLOW_BUILDER_V2_DESIGN.md

---

## Summary
We will redesign the Workflow Builder to be simpler and more discoverable, reducing friction when authoring flows, mapping data between steps, and validating execution. The redesign adds a Linear Builder (default), an optional Canvas mode for advanced users, a Quickstart Wizard, unified Variable/Data Inspectors, and an Execution Timeline.

Refer to the full design doc for detailed rationale and architecture: WORKFLOW_BUILDER_V2_DESIGN.md.

## Goals
- Faster time-to-first-successful-run for new users
- Clear, physical data flow and mapping
- Confident execution with preview-first controls and diagnostics
- Progressive complexity with strong accessibility

## Out of Scope
- Replacing the workflow engine, persistence, or RBAC models
- Real-time multi-user collaboration (covered in Epic 3)

## Stories
- 📄 Story 1: Linear Builder V2 (authoring, mapping, preview)
  - File: EPIC8_STORY1_LINEAR_BUILDER_V2.md
- 📄 Story 2: Variable & Data Inspectors
  - File: EPIC8_STORY2_VARIABLE_DATA_INSPECTORS.md
- 📄 Story 3: Canvas Builder (advanced)
  - File: EPIC8_STORY3_CANVAS_BUILDER.md
- 📄 Story 4: Quickstart Wizard & Templates
  - File: EPIC8_STORY4_QUICKSTART_WIZARD.md
- 📄 Story 5: Polish & Accessibility Hardening
  - File: EPIC8_STORY5_POLISH_A11Y.md

## Acceptance Criteria (Epic)
- Linear Builder delivers a complete authoring path with validations and preview
- Variable/Data Inspectors usable across Linear and Canvas
- Canvas mode available behind feature flag and stable for mid-sized flows
- Templates reduce required configuration to achieve first run
- A11y and performance targets met (WCAG 2.1 AA, virtualized lists)

## Rollout & Flags
- Feature flags: `builder.v2.linear`, `builder.v2.canvas`, `builder.v2.wizard`
- Opt-in per workspace; phased rollout with hallway tests

---

## Metrics
- 30% faster time-to-first-successful-run (usability tests)
- 40% reduction in mapping validation errors/session
- ≥70% of new flows initiated via wizard/templates
- SUS ≥ 80
