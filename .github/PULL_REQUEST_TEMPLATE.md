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

Follow the steps in `docs/testing/manual/canvas-builder-v2.md` (or link to the relevant manual guide).

---

## Documentation updates

- [ ] README updated if applicable
- [ ] Developer or feature docs updated (list files)

---

## Checklist

- [ ] Acceptance Criteria documented in the linked issue/story
- [ ] Unit tests pass locally
- [ ] Component/Integration tests where applicable
- [ ] Cypress E2E covers each AC and key persistence/hydration flows
- [ ] Feature flag gates (if applicable) verified
- [ ] Lint/type-check/build pass locally
- [ ] CI green or issues explained
- [ ] Docs updated (README/DEV_GUIDE/etc.) if behavior or flows changed
- [ ] Follows Standard Workflow: see [docs/STANDARD_WORKFLOW.md](../docs/STANDARD_WORKFLOW.md)

---

## Testing Notes

How to run tests locally and any relevant data/setup.

---

## Screenshots/Recordings (optional)

---

## Risk/Impact

Areas to watch and rollback plan if needed.
