## Summary

- What does this PR change and why?

## Checklist

- [ ] Acceptance Criteria documented in the linked issue/story
- [ ] Unit tests cover core logic (happy path + at least 1 edge case) – Testing Trophy
- [ ] Component/Integration tests exercise UI/service interactions (where applicable)
- [ ] Cypress E2E covers:
  - [ ] One E2E per AC (keep lean per Testing Trophy)
  - [ ] Persistence and hydration after Save (reload/redirect assertions)
  - [ ] Network contract (intercepts for critical endpoints if applicable)
  - [ ] Idempotent Save (no duplicates after second Save)
  - [ ] Delete flows persist and hydrate correctly (where applicable)
- [ ] Feature flag gates (if applicable) verified
- [ ] Lint/build/test pass locally
- [ ] Docs updated (README/DEV_GUIDE) if behavior or flows changed
- [ ] Follows Standard Workflow: see [docs/STANDARD_WORKFLOW.md](../docs/STANDARD_WORKFLOW.md)

## Testing Notes

- How to run the tests locally and any relevant data/setup.

## Screenshots/Recordings (optional)

## Risk/Impact

- Areas to watch and rollback plan if needed.
