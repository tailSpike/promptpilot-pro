# Epic 3 Story 2: Feedback Threads Skeleton 🚧 DISCOVERY

## 📋 User Story
**As a prompt author, I want to leave feedback on a teammate’s shared prompt so we can collaborate without drifting versions.**

This slice builds on the sharing skeleton by adding a lightweight comment stream bound to shared libraries, enabling asynchronous review with minimal surface area.

## 🎯 Walking Skeleton Goals
- Allow viewers of a shared prompt library to post text-only comments on individual prompts.
- Display comment threads chronologically within a new “Feedback” panel.
- Notify the prompt owner via in-app toast so they can respond quickly.
- Persist comments and ensure permission checks reuse sharing roles.

### Explicit Non-Goals
- Suggestion diffs or inline edits (future story).
- @mentions, reactions, or email digests.
- Commenting on workflow steps (library prompts only for now).

## 👤 Personas & Pain Points
| Persona | Needs | Pain Today |
| --- | --- | --- |
| Prompt Author | Collect feedback without duplicating prompts | Feedback currently arrives via DM and gets lost |
| Prompt Reviewer | Capture questions in context | Must screenshot or copy/paste prompt content elsewhere |

## ✅ Success Signals
- Comment posted in staging appears instantly for both author and reviewer.
- Permission guard blocks users without viewer access from posting or reading comments.
- Audit event `collaboration.comment.created` recorded for compliance.

## 📦 Scope & Acceptance Criteria
1. **Comment Creation**
   - Viewers and owners can submit plain-text comments (max 2,000 chars) on a prompt detail sidebar.
   - Comments persist with author, timestamp, and prompt ID.
   - Empty-body submissions are rejected; basic markdown not yet supported.

2. **Thread Display**
   - Feedback panel shows comments newest-first with author avatar, timestamp (relative time), and body.
   - Loading state + “No feedback yet” empty message provided.
   - Deleting comments limited to comment author or library owner; deletion is soft (marked removed, hidden in UI).

3. **Notifications & Telemetry**
   - Prompt owner receives in-app toast “New feedback on ‹library/prompt›”.
   - Analytics event for create/delete with `{workspaceId, actorId, promptId}` payload.
   - Audit entry stored for create/delete operations.

### Definition of Done
- Comment panel working in UI with real API, including optimistic update rollback on failure.
- Cypress E2E covers add + delete comment path.
- Feature flag `collaboration.comments` layered on top of story 1 flag.

## 🧭 Experience Outline
1. Reviewer opens shared library → selects a prompt → Feedback tab reveals comment form.
2. Reviewer types feedback → submits → comment appears at top with timestamp.
3. Owner sees toast → opens same prompt → comment visible.
4. Owner deletes comment (if resolved) → panel collapses to empty state.

## 🧱 Technical Notes
### Data Model (Prisma-ish pseudocode)
```ts
model PromptComment {
  id            String   @id @default(cuid())
  workspaceId   String
  promptId      String
  libraryId     String
  authorId      String
  body          String
  createdAt     DateTime @default(now())
  deletedAt     DateTime?
}
```

- Foreign-key `libraryId` enables quick permission check against shares.
- Soft delete retains history for compliance.

### API Surface
| Endpoint | Purpose |
| --- | --- |
| `POST /api/prompts/:id/comments` | Create comment (viewer/owner only). |
| `GET /api/prompts/:id/comments` | List comments ordered by `createdAt DESC`. |
| `DELETE /api/comments/:id` | Soft delete (author/owner only). |

Middleware verifies caller has viewer access through Story 1 share table.

### UI Hooks
- `FeedbackPanel` toggled via tab next to “Details”.
- Comment form with submit + inline validation error messages.
- Comments list uses virtualised scroll (future optimisation) but simple list suffices.

## 🔐 Security & Compliance
- Rate limit comment creation (30 per user per hour) to avoid spam.
- Body sanitized for HTML escapement before render.
- Audit trail leverages existing service with action keys `COMMENT_CREATED` / `COMMENT_DELETED`.

## 🧪 Testing Strategy
- **Unit:** Comment service validates permissions, sanitises body, handles soft delete.
- **Integration:** Share invite → comment creation → ensure list API returns comment → delete → ensure hidden.
- **E2E:** Cypress spec covering comment create/delete with optimistic UI.

## 🚀 Rollout Checklist
1. Ship behind `collaboration.comments` flag, enable internally.
2. Collect usability notes from prompt authors, tweak empty state copy if needed.
3. Gradually roll out to beta cohort alongside sharing skeleton once stable.

## ⚠️ Risks & Mitigations
- **Feedback loops stuck:** Add inline nudge encouraging owners to respond (copy only).
- **Notification fatigue:** Start with in-app toast only, add preferences before enabling email.

## 📚 References
- [Wikipedia — Collaboration](https://en.wikipedia.org/wiki/Collaboration)
- [Atlassian Work Management — Project Collaboration Tips](https://www.atlassian.com/work-management/project-collaboration)
