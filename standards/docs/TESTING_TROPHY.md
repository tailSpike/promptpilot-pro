# Testing Trophy

Emphasize:
- Unit tests: largest layer for logic, branching, validation
- Component/Integration: UI behavior and service edges
- E2E: minimal, one per AC, contract/persistence checks

Per AC:
- Unit: core logic + edge case
- Component/Integration: render + interactions or service routes
- E2E: single scenario validates end-to-end and Save→reload
