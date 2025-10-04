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

## manual tests

manual test scenarios for E3S2 feedback threads
(Use two personas: Owner with library ownership, Viewer with share access; ensure collaboration.sharing flag already on.)

1. Feature flag gating
FF-01 Enablement:
Pre: collaboration.comments = ON. Viewer opens shared prompt.
Steps: Refresh prompt detail.
Expected: Feedback tab visible with form, “No feedback yet” placeholder.
FF-02 Disabled behavior:
Pre: Turn flag OFF while story1 flag stays ON.
Steps: Hard refresh prompt detail and comments API call.
Expected: Feedback tab hidden; API returns 404/feature-disabled error.
2. Permissions & access
PERM-01 Authorized commenter:
Pre: Viewer has viewer role.
Steps: Submit valid 100-char comment.
Expected: Comment appears instantly; persisted after reload.
PERM-02 Unauthorized user blocked:
Pre: User without library share attempts POST via UI/API.
Steps: Submit comment.
Expected: UI shows “insufficient permissions”; API returns 403; no audit event.
PERM-03 Owner access:
Pre: Owner logged in.
Steps: Comment submission.
Expected: Same success path as viewer.
PERM-04 Non-authenticated guard:
Steps: Use incognito (no session) to submit.
Expected: Redirect to auth / 401 error; no UI update.
3. Comment creation validation
CREATE-01 Empty body rejection:
Steps: Submit blank or whitespace-only.
Expected: Inline validation, no API call.
CREATE-02 Max length acceptance:
Pre: Prepare 2,000 character string.
Steps: Submit.
Expected: Accepted, stored full text.
CREATE-03 Length overflow:
Steps: Submit 2,001 characters.
Expected: UI error, API 400 with message.
CREATE-04 Sanitization check:
Steps: Submit <script>alert(1)</script>.
Expected: Rendered as literal text; no script execution.
CREATE-05 Rate limiting:
Pre: Use script or manual bursts.
Steps: Send 31 comments inside an hour.
Expected: First 30 pass, 31st blocked with rate-limit message; analytics only for accepted ones.
CREATE-06 Optimistic rollback on failure:
Pre: Simulate network failure (toggle offline after submit).
Steps: Submit comment.
Expected: Temporary optimistic entry disappears on error; toast/banner surfaces failure.
4. Thread display
DISPLAY-01 Ordering:
Pre: Create three comments at known timestamps.
Steps: Refresh panel.
Expected: Newest at top, each showing avatar, display name, and relative time (e.g., “just now”).
DISPLAY-02 Loading state:
Steps: Hard refresh while throttling network.
Expected: Loading indicator replaced by list once data arrives.
DISPLAY-03 Empty state:
Pre: Delete all comments (soft).
Steps: Reload.
Expected: “No feedback yet” message plus form.
DISPLAY-04 Cross-session visibility:
Pre: Viewer adds comment.
Steps: Owner refreshes different browser session.
Expected: Comment visible immediately (confirm via hard reload).
DISPLAY-05 Long text wrapping:
Steps: Submit 1,000-character paragraph.
Expected: Text wraps within panel, no overflow.
5. Notifications & toasts
NOTIF-01 Owner toast:
Pre: Owner logged in elsewhere, toast service enabled.
Steps: Viewer posts comment.
Expected: Owner sees toast “New feedback on ‹library/prompt›” once within reasonable latency.
NOTIF-02 No duplicate toasts:
Steps: Post two comments quickly; dismiss first toast.
Expected: One toast per create; no repeated notifications for same comment.
NOTIF-03 Toast suppressed for commenter:
Steps: Owner posts comment.
Expected: Owner does not see self-notification.
6. Deletion workflows
DELETE-01 Author soft delete:
Steps: Comment author clicks delete; confirm dialog.
Expected: Comment disappears from list; API marks deletedAt; audit+analytics entries recorded.
DELETE-02 Owner delete of viewer comment:
Steps: Owner deletes someone else’s comment.
Expected: Same soft-delete behavior; viewer sees removal on refresh.
DELETE-03 Unauthorized delete blocked:
Steps: Different viewer attempts delete on another user’s comment.
Expected: Button hidden or action returns 403; audit intact.
DELETE-04 Deleted comment hidden after refresh:
Steps: Hard reload UI and call list endpoint.
Expected: Deleted comment omitted; count decreased.
DELETE-05 Audit integrity:
Steps: Inspect audit log backend (DB or admin UI).
Expected: collaboration.comment.created and collaboration.comment.deleted entries with {workspaceId, actorId, promptId}.
7. Telemetry & analytics
TELEM-01 Create event payload:
Steps: Use network inspector during comment create.
Expected: Analytics call with collaboration.comment.created, includes workspace/actor/prompt IDs.
TELEM-02 Delete event payload:
Steps: On delete, capture analytics request.
Expected: collaboration.comment.deleted with same identifiers plus comment ID if specified.
TELEM-03 Missing event failure:
Steps: Disable analytics service (mock).
Expected: UI still succeeds; log warning captured for telemetry failure.
8. API behavior
API-01 GET ordering & metadata:
Steps: Call /api/prompts/:id/comments via REST client.
Expected: 200 with array sorted descending by createdAt; includes author info; no deleted entries.
API-02 POST with feature flag off:
Pre: collaboration.comments OFF.
Steps: POST new comment.
Expected: 403/feature disabled error.
API-03 DELETE response:
Steps: DELETE as authorized actor.
Expected: 200/204; subsequent GET excludes comment.
API-04 Rate limit headers:
Steps: Repeated POST until limit.
Expected: Response includes rate-limit headers or specific error payload.
9. Performance & resilience
RESIL-01 Concurrent creation ordering:
Pre: Owner and viewer ready.
Steps: Submit simultaneously.
Expected: Both appear, order matches timestamps; no duplication.
RESIL-02 Offline reader fallback:
Steps: Disconnect network, open prompt.
Expected: Feedback tab indicates offline/unavailable state.
RESIL-03 Large thread scroll:
Pre: Seed 50+ comments.
Steps: Scroll panel.
Expected: Smooth scrolling (no virtualization yet but list manageable), no layout shift.
10. Security & compliance
SEC-01 HTML escape verification:
Steps: Submit <b>bold</b> and <img src=x onerror=alert(1)>.
Expected: Rendered as literal text; no styles/images loaded.
SEC-02 XSS via markdown attempt:
Steps: Submit [link](javascript:alert(1)).
Expected: Rendered plain text; no link.
SEC-03 Audit immutability:
Steps: Attempt to edit comment via API (unsupported).
Expected: 405/404; audit unaffected.
SEC-04 Rate limit bypass attempt:
Steps: Rotate tokens/IP incognito.
Expected: Rate limit keyed per actor; bypass fails.
11. Integration with prior sharing skeleton
INT-01 Share role reuse:
Pre: Invite new viewer via story1 flow.
Steps: Accept invite; check comments panel.
Expected: Immediately allowed to read/post; no extra permission config.
INT-02 Revoked access:
Steps: Remove viewer role; attempt to load comments.
Expected: Panel shows permission error; API 403.
12. Regression guardrails
REG-01 Existing share functionality unaffected:
Steps: Verify original prompt details panel still loads when feature flag off.
Expected: No console errors.
REG-02 Toast system existing triggers unaffected:
Steps: Trigger known toast (story1) plus comment creation.
Expected: Both toasts queue correctly without collision.
execution notes
Use separate browsers (or profiles) to emulate owner/viewer simultaneously.
For telemetry/audit checks, coordinate with backend logging or inspect DB tables as described in docs (audit service).
Capture evidence (screenshots/logs) for each pass to support compliance verification.
Rate-limit and optimistic rollback tests are slower—schedule them toward the end to avoid hitting limits mid-run.
requirements coverage
E3S2 comment creation, display, permissions, notifications, telemetry, audit, soft delete, optimistic updates, rate-limits, sanitization, feature flag layering, and reuse of sharing roles are all addressed via the scenarios above.