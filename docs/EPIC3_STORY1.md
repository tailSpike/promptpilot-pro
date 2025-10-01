# Epic 3 Story 1: Library Sharing Skeleton 🚧 DISCOVERY

## 📋 User Story
**As a prompt program lead, I want to invite teammates to view a prompt library so they can reuse approved prompts without needing the original author.**

This first slice delivers a thin end-to-end sharing flow (invite → accept → view) so we can validate the collaboration foundation before layering richer capabilities.

## 🎯 Walking Skeleton Goals
- Allow an owner to grant read-only access to a prompt library for another workspace member.
- Enforce permissions server-side so only invited members can fetch the shared library.
- Surface the shared library in the recipient’s UI with a clear “Shared with me” affordance.
- Capture an audit log entry for each share action to exercise compliance plumbing.

### Explicit Non-Goals
- Editing, commenting, or suggestion workflows (future stories).
- External email invites or role customization beyond Viewer.
- Admin consoles or notification batching (we’ll add once the skeleton proves out).

## 👤 Personas & Pain Points
| Persona | Needs | Pain Today |
| --- | --- | --- |
| Prompt Program Lead | Share vetted libraries without copying/exporting | Manual exports via docs/slack create drift |
| Prompt Consumer | Discover shared prompts quickly | No shared view → relies on ad-hoc links |

## ✅ Success Signals
- ≥1 prompt library successfully shared internally during beta (dogfooding).
- Permission checks block unauthorised access in Cypress smoke test.
- Audit log captures who shared which library and when.

## 📦 Scope & Acceptance Criteria
1. **Share Invitation**
   - Owners can open a “Share” modal from a prompt library and search for a workspace member.
   - Only the Viewer role is available; invitations persist in `promptLibraryShares` table.
   - Invitee receives an email (simple template) and in-app toast when the share is created.

2. **Shared Library Access**
   - Invitees see a “Shared with me” tab showing the library name, owner, and last updated timestamp.
   - GET endpoints enforce that only owners or share recipients with `Viewer` role can read the library and its prompts.
   - Access revocation removes the library from the shared tab immediately.
   - First time a new library appears in a recipient’s list, the UI surfaces a toast announcing who shared it; the acknowledgement is cached locally to avoid duplicate alerts.

3. **Audit & Telemetry**
   - Each create/delete share action appends an immutable audit record with actor, target, and timestamp.
   - Analytics event `collaboration.library.shared` fires with `{workspaceId, actorId, libraryId}` payload. (A default single-workspace identifier is emitted until multi-workspace support ships.)

### Definition of Done
- UI, API, and persistence are wired through and demoable end-to-end.
- Feature flag `collaboration.sharing` guards production rollout.
- Happy-path Cypress test covers invite → view → revoke.

## 🧭 Experience Outline
1. Owner clicks “Share” in library header.
2. Modal displays email/member search → owner selects teammate → confirms invite.
3. Teammate sees toast + email and finds library under “Shared with me”.
4. Owner removes share; teammate loses access instantly.

## 🧱 Technical Notes
### Data Model (Prisma-ish pseudocode)
```ts
model PromptLibraryShare {
  id          String   @id @default(cuid())
  workspaceId String
  libraryId   String
  library     PromptLibrary @relation(fields: [libraryId], references: [id])
  invitedUserId String
  role        CollaborationRole @default(VIEWER)
  invitedById String
  createdAt   DateTime @default(now())
  deletedAt   DateTime?
}

enum CollaborationRole {
  OWNER
  VIEWER
}
```

### API Surface
| Endpoint | Purpose |
| --- | --- |
| `POST /api/libraries/:id/shares` | Create viewer invite (owner only). |
| `DELETE /api/libraries/:id/shares/:shareId` | Revoke invite. |
| `GET /api/libraries/shared-with-me` | List libraries current user can view. |

Middleware checks `workspaceId`, ownership, and share membership before returning library content.

### UI Hooks
- Library header button → new `ShareLibraryModal` component.
- `SharedLibrariesPanel` in sidebar lists libraries returned from API.
- Simple toast + minimal email template triggered via existing notification service.

## 🔐 Security & Compliance
- Permission guard uses single SQL query with composite index `(libraryId, invitedUserId)`.
- Owners cannot self-downgrade (role remains implicit OWNER).
- Audit log stored via existing `AuditTrailService.record(action, actorId, subjectId)`.

## 🧪 Testing Strategy
- **Unit:** share service validates ownership, prevents duplicate invites, respects soft deletes.
- **Integration:** create share → fetch library as invitee → revoke → ensure 403 afterward.
- **E2E:** Cypress spec runs through invite from UI, confirms shared tab presence, then revoke.

## 🚀 Rollout Checklist
1. Implement behind feature flag; run dogfood with internal workspace.
2. Capture feedback, ensure audit trail populates.
3. Enable for limited beta cohort; monitor permission-denied logs.

## ⚠️ Risks & Mitigations
- **Invite spam:** Enforce rate limit of 20 invites per user per hour.
- **Stale cache:** Clear `sharedLibraries` cache on create/delete share events.

## 📚 References
- [Wikipedia — Collaboration](https://en.wikipedia.org/wiki/Collaboration)
- [Atlassian Work Management — Project Collaboration Tips](https://www.atlassian.com/work-management/project-collaboration)
- [Atlassian Work Management — Building a Collaborative Culture](https://www.atlassian.com/work-management/project-collaboration/collaborative-culture)
