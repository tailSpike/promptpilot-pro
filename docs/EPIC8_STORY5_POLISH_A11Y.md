# Epic 8 — Story 5: Polish & Accessibility Hardening

Status: Proposed → Draft
Feature flag: builder.v2.*
Related: WORKFLOW_BUILDER_V2_DESIGN.md

## User Story
As a broad set of users, I want the builder to be fast, accessible, and intuitive so I can work efficiently without barriers.

## Acceptance Criteria
- Performance: virtualized step list; lazy-load heavy editors; debounce validation
- Accessibility: keyboard nav for all core tasks; ARIA; contrast ≥ 4.5:1; reduced motion option
- Copy & micro-interactions polished (empty states, toasts, helper text)
- Telemetry dashboards for builder usage and validation errors

## Tests
- A11y tooling checks (axe), keyboard nav RTL tests
- Performance smoke (interaction timings)
- Visual snapshots for key surfaces