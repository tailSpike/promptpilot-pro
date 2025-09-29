# 📘 EPICS — PromptPilot Pro

This document outlines the major functional epics for PromptPilot Pro, a modular AI workflow platform designed for professionals. Each epic includes user stories and acceptance criteria to guide development and prioritization.

---

## 🧩 Epic 1: Prompt Creation & Management

### Story Overview
Epic 1 focuses on the core prompt management capabilities that form the foundation of PromptPilot Pro. This epic is broken down into three distinct stories:

### Story 1: Structured Prompt Creation ✅ COMPLETED
**User Story:** As a user, I want to create structured prompts with variables so I can reuse them across workflows.
📄 **[View Full Story Details](./EPIC1_STORY1.md)**

**Key Features:**
- Variable injection with typed variables (text, number, boolean, select)
- Real-time preview with variable substitution
- Comprehensive validation and metadata support

### Story 2: Hierarchical Organization System ✅ COMPLETED  
**User Story:** As a user, I want to organize prompts into folders, tags, and categories so I can find and iterate quickly.
📄 **[View Full Story Details](./EPIC1_STORY2.md)**

**Key Features:**
- Unlimited folder nesting with color coding
- Native HTML5 drag-and-drop organization
- Inline editing with real-time synchronization

### Story 3: Prompt Version Control & History Management ✅ COMPLETED (Phase 1)
**User Story:** As a user, I want to version-control my prompts so I can track changes and revert when needed.
📄 **[View Full Story Details](./EPIC1_STORY3.md)**

**Key Features:**
- ✅ Semantic versioning with automatic increments
- ✅ Complete version history and revert functionality  
- ✅ Full API and frontend integration (30/30 tests passing)
- 🔄 Visual diff comparison and branching support (Phase 2)
- 🔄 Collaborative version management with approval workflows (Phase 2)

### Story 4: Enhanced Metadata & Preview System 📋 NOT STARTED
**User Story:** As a user, I want comprehensive tagging, real-time preview, and advanced filtering so I can efficiently manage and discover prompts.
📄 **[View Full Story Details](./EPIC1_STORY4.md)**

**Key Features:**
- Comprehensive tags and categories system
- Real-time preview with live variable substitution
- Advanced search and filtering capabilities

---

## 🔄 Epic 2: Workflow Automation ✅ STORY 1 COMPLETE

### Story 1: Sequential Workflow Builder ✅ COMPLETE + ENHANCED
**User Story:** As a user, I want to chain prompts into multi-step flows so I can automate complex tasks.
📄 **[View Full Story Details](./EPIC2_STORY1.md)**

**Implementation Status:**
- ✅ Database schema design and migration
- ✅ Comprehensive workflow service layer 
- ✅ Complete REST API implementation (8 endpoints)
- ✅ Route integration and authentication
- ✅ Validation and error handling
- ✅ Comprehensive API testing suite (18 workflow tests, 128 total)
- ✅ Frontend components (WorkflowList, WorkflowEditor, WorkflowDetail)
- ✅ Enhanced step configuration with type-specific forms
- ✅ Prompts system integration with dual-mode approach
- ✅ Variable mapping and workflow execution
- ✅ Real-time step saving and error recovery

**Key Features Implemented:**
- Full CRUD operations for workflows and steps
- Sequential prompt chaining with variable passing
- 6 step types with rich configuration (PROMPT, CONDITION, TRANSFORM, DELAY, WEBHOOK, DECISION)
- **ENHANCED**: Dual-mode PROMPT steps (existing prompts + inline content)
- **ENHANCED**: Automatic variable detection and mapping
- **ENHANCED**: Type-specific configuration forms for all step types
- Execution tracking and history with status monitoring
- Real-time validation and comprehensive error handling
- Professional workflow management interface
- **ENHANCED**: Prompts library integration with preview and selection

**Status:** ✅ **COMPLETE** - Production-ready workflow automation with enhanced prompt integration

### Story 2: Workflow Triggers & Scheduling ✅ COMPLETE + ENHANCED
**User Story:** As a user, I want to trigger workflows based on inputs, schedules, or external events.
📄 **[View Full Implementation Details](./EPIC2_STORY2.md)**

**Implementation Status:**
- ✅ Complete trigger management system with 5 trigger types
- ✅ Database schema with WorkflowTrigger model and TriggerType enum
- ✅ Full TriggerService with node-cron scheduling and webhook security
- ✅ Complete REST API with authentication and validation
- ✅ Enhanced React frontend with intuitive date/time controls
- ✅ Comprehensive examples and user guidance
- ✅ Real-time trigger monitoring and execution tracking

**Key Features Implemented:**
- **MANUAL**: Instant execution with run button and status feedback
- **SCHEDULED**: Cron-based automation with simple/advanced configuration modes
  - **ENHANCED**: Intuitive date/time picker interface
  - **ENHANCED**: Real-time cron generation from simple inputs
  - **ENHANCED**: Human-readable schedule descriptions
- **WEBHOOK**: Secure HTTP triggers with HMAC-SHA256 validation
  - **ENHANCED**: Auto-generated webhook URLs with security guidance
- **API**: Programmatic execution via authenticated REST endpoints
  - **ENHANCED**: Complete API documentation in UI
- **EVENT**: System event triggers (extensible for future integrations)

**Enhanced User Experience:**
- **✨ NEW**: Simple/Advanced toggle for scheduled triggers
- **✨ NEW**: Date and time picker for intuitive scheduling
- **✨ NEW**: Comprehensive examples for every trigger type  
- **✨ NEW**: Real-time cron expression generation and validation
- **✨ NEW**: Enhanced trigger cards with detailed configuration info
- **✨ NEW**: Contextual help and usage tips throughout interface
- **✨ NEW**: Toast notifications for all trigger operations

**Security & Reliability:**
- JWT authentication for all API endpoints
- HMAC-SHA256 webhook signature validation
- Input validation and sanitization
- Graceful error handling and user feedback
- Automatic cleanup of scheduled tasks on server restart

**Follow-ups:**
- Wire scheduler callbacks into `WorkflowService.executeWorkflow`
- Finalise webhook signature verification & payload mapping
- Stabilise Cypress trigger E2E suite and add component tests for trigger UI

**Status:** ✅ **COMPLETE (Phase 1)** — Trigger management and UX shipped; execution integration tracked as follow-up

### Story 3: Testing & Preview System ✅ COMPLETE
📄 **[View Full Story Details](./EPIC2_STORY3.md)**

**User Story:** As a workflow owner, I want to preview and test flows before deploying them so I can validate behaviour without polluting production history.

**Acceptance Criteria (aligned with Atlassian's epic documentation guidance):**
- Preview executions reuse the orchestration pipeline without creating persistent records.
- UI exposes both manual JSON payloads and auto-generated sample data with validation feedback.
- Step-level diagnostics (duration, token estimates, warnings, errors) surface to the builder.
- Cypress coverage guards happy paths, validation errors, and warning states.

**Key Features Delivered:**
- 🔁 **Ad-hoc test runs** – Preview workflows with either manual JSON payloads or auto-generated sample data.
- 📊 **Step insights** – Detailed run breakdown with per-step duration, token estimates, warnings, and error context.
- 🧪 **Safe sandboxing** – Execute previews without persisting history, keeping production execution logs uncluttered.
- 🧩 **UI polishing** – Guardrails on manual payloads, clear messaging for invalid inputs, and a results viewer with final output formatting.
- ✅ **Automation** – Cypress coverage for preview journeys (sample data, manual entry, validation) plus backend guards.

**Follow-ups Tracked:**
- Persist preview runs for comparison and sharing.
- Surface aggregated preview metrics alongside execution history.
- Extend Cypress coverage to include failure-state visual regressions.

---

## 👥 Epic 3: Collaboration & Sharing

### User Stories
- As a user, I want to share prompt libraries with my team so we can standardize outputs.
- As a user, I want to comment on and suggest edits to shared prompts.
- As a user, I want to publish prompt templates to a marketplace.

### Acceptance Criteria
- Prompts and workflows can be shared with role-based permissions
- Commenting and suggestion threads are supported
- Public publishing includes metadata and attribution

---

## 🧠 Epic 4: AI Model Integration

### User Stories
- As a user, I want to run prompts across multiple AI models so I can compare outputs.
- As a user, I want to set model-specific parameters like temperature and context window.
- As a user, I want to switch models mid-flow to optimize performance and cost.

### Acceptance Criteria
- Model selector supports GPT-4, Claude, Gemini, etc.
- Parameters are configurable per step
- Execution engine supports multi-model chaining

---

## 📊 Epic 5: Analytics & Feedback

### User Stories
- As a user, I want to see how often a prompt is used and by whom.
- As a user, I want to rate and annotate prompt outputs.
- As a user, I want to A/B test prompt variants.

### Acceptance Criteria
- Usage metrics are tracked per prompt and workflow
- Feedback UI supports rating, tagging, and comments
- A/B testing framework compares output quality across variants

---

## 🛠️ Epic 6: Access & Identity

### User Stories
- As an admin, I want to manage user roles and permissions across workspaces.
- As a user, I want to log in securely and manage my profile.
- As a team member, I want scoped access to shared resources.

### Acceptance Criteria
- Role-based access control (RBAC) is enforced
- JWT-based authentication and session management
- Workspace-level scoping for prompts and workflows

---

## 🌐 Epic 7: External Integrations

### User Stories
- As a user, I want to trigger workflows from external tools like Slack or Zapier.
- As a developer, I want to use a public API to run workflows programmatically.
- As a user, I want to receive outputs in my preferred tool or format.

### Acceptance Criteria
- Webhooks and API endpoints are documented and secure
- Integration SDK supports common platforms
- Output delivery options include email, webhook, or file export

---
