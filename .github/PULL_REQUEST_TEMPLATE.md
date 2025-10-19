## Summary

Describe the change, link to the user story/epic, and call out notable design decisions.

---

## Acceptance Criteria Coverage

- [ ] AC 1: … (link to Cypress spec/assertions)
- [ ] AC 2: …
- [ ] AC 3: …

Specs:
- `frontend/cypress/e2e/builder-canvas-v2.cy.ts` (or other relevant specs)

---

## How to run locally

Windows PowerShell:
```powershell
# From repo root
npm run setup
npm run dev
```

Optional (targeted E2E):
```powershell
node scripts/run-e2e.js --spec cypress/e2e/builder-canvas-v2.cy.ts --headed
```

---

## Manual verification steps

Follow the steps in `docs/testing/manual/canvas-builder-v2.md`.

---

## Documentation updates

- [ ] README updated if applicable
- [ ] Developer or feature docs updated (list files)

---

## Checklist

- [ ] Unit tests pass locally
- [ ] E2E tests pass locally or are addressed
- [ ] Lint/type-check pass
- [ ] CI green or issues explained## Summary

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
