# Epic 3 Story 3: Marketplace Publishing Skeleton 🚧 DISCOVERY

## 📋 User Story
**As a prompt program lead, I want to publish a vetted prompt library to our marketplace so other workspaces can discover and import it.**

This slice closes the loop by letting owners push a shared library through a lightweight approval workflow and exposing a basic public listing.

## 🎯 Walking Skeleton Goals
- Enable owners to submit an existing prompt library for publication with minimal metadata.
- Provide a reviewer queue where compliance can approve or reject submissions.
- Expose approved libraries on a simple marketplace listing page with import/download.
- Track state transitions for auditing.

### Explicit Non-Goals
- Monetisation, ratings, or analytics dashboards.
- Version history comparisons or diff visualisation.
- External webhooks or email campaigns.

## 👤 Personas & Pain Points
| Persona | Needs | Pain Today |
| --- | --- | --- |
| Prompt Program Lead | Distribute vetted prompts broadly | Must export manually and share via docs |
| Compliance Reviewer | Ensure only compliant prompts are public | Lacks queue, relies on ad-hoc reviews |
| Marketplace Consumer | Find approved templates quickly | No central catalogue |

## ✅ Success Signals
- A submission moves from Draft → Approved and appears in marketplace listing.
- Rejected submission records reason and returns to Draft state.
- Import button clones library into consumer workspace in staging test.

## 📦 Scope & Acceptance Criteria
1. **Submission Form**
   - Owners choose library → fill minimal metadata (title, summary ≤280 chars, primary tag).
   - Submitting creates `marketplaceSubmission` record in `DRAFT` then `IN_REVIEW` state.
   - Form validates required fields and blocks duplicate active submissions per library.

2. **Reviewer Queue**
   - Compliance role sees `/marketplace/review` list with submissions, metadata, and quick preview of prompts.
   - Reviewer can approve (state → `APPROVED`) or reject (→ `REJECTED` with reason text).
   - Decisions append to audit log with actor, state change, reason.

3. **Marketplace Listing**
   - Public `/marketplace` page lists approved libraries (title, summary, owner, updatedAt).
   - “Import” button calls `POST /api/marketplace/import/:submissionId` to clone library into requester workspace (requires auth).
   - Approved listings cached for 10 minutes to reduce load.

### Definition of Done
- Submission → approval → marketplace listing works end-to-end in staging.
- Import endpoint clones prompts and associates them with requesting workspace.
- Cypress flow covers submit, approve, and import happy path.
- Feature flag `collaboration.marketplace` layered on prior flags.

## 🧭 Experience Outline
1. Owner opens library → selects “Publish to Marketplace”.
2. Fills title/summary/tag → submits → sees confirmation banner.
3. Reviewer visits queue → opens submission → approves.
4. Library appears on marketplace listing → consumer clicks Import → library arrives in their workspace with “Imported from Marketplace” badge.

## 🧱 Technical Notes
### Data Model (Prisma-ish pseudocode)
```ts
model MarketplaceSubmission {
  id            String   @id @default(cuid())
  libraryId     String
  workspaceId   String   // owner workspace
  status        SubmissionStatus @default(DRAFT)
  metadata      Json
  submittedById String
  reviewerId    String?
  reviewedAt    DateTime?
  rejectionReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum SubmissionStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  REJECTED
}
```

- Approved submissions materialised into `MarketplaceListing` view for faster reads.

### API Surface
| Endpoint | Purpose |
| --- | --- |
| `POST /api/marketplace/submissions` | Create + auto mark `IN_REVIEW`. |
| `PATCH /api/marketplace/submissions/:id` | Approve/reject (reviewer only). |
| `GET /api/marketplace/listings` | List approved entries (public). |
| `POST /api/marketplace/import/:id` | Clone library into requester workspace. |

### UI Hooks
- Library toolbar button → modal for metadata.
- Reviewer dashboard (table with approve/reject actions).
- Marketplace public page (cards with title/summary/import).

## 🔐 Security & Compliance
- Reviewers limited to compliance group defined via existing RBAC service.
- Import endpoint checks marketplace flag and ensures consumer workspace ≠ producer.
- Audit log records submission, approval, rejection, and import events.

## 🧪 Testing Strategy
- **Unit:** Submission service prevents duplicates, enforces transitions.
- **Integration:** Submit → approve → verify listing → import clones prompts.
- **E2E:** Cypress spec for owner submit + reviewer approve + consumer import.

## 🚀 Rollout Checklist
1. Launch internally with curated set of libraries.
2. Ensure moderation queue handles load (target <200 ms response for list).
3. Open to select beta customers; monitor import success rate and rejection reasons.

## ⚠️ Risks & Mitigations
- **Low quality listings:** Add basic checklist copy in form, require summary.
- **Reviewer bottleneck:** Provide Slack alert webhook for pending submissions (future enhancement).

## 📚 References
- [Wikipedia — Collaboration](https://en.wikipedia.org/wiki/Collaboration)
- [Atlassian Work Management — Project Collaboration Tips](https://www.atlassian.com/work-management/project-collaboration)
