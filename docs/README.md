# PromptPilot Pro — Architecture Overview

This repo powers PromptPilot Pro, a modular AI workflow platform for professionals.  
It enables structured prompt creation, multi-model orchestration, and team collaboration.

## Key Docs
- Architecture: [/docs/architecture](./architecture/README.md)
- Epics index: [/docs/epics](./epics/README.md)
- Testing index: [/docs/testing](./testing/README.md)
- API Contracts: [API.md](./API.md)
- System Design: [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md)
- Data Models: [DATA_MODELS.md](./DATA_MODELS.md)
- Workflow Engine: [WORKFLOW_ENGINE.md](./WORKFLOW_ENGINE.md)
- Testing Strategy (root): [TESTING.md](../TESTING.md)

## Tech Stack
- Node.js + Express + TypeScript services (Prisma ORM)
- React + Vite + Tailwind frontend SPA
- SQLite for local development/testing; PostgreSQL ready for production
- Cypress, Vitest, and Jest for automated coverage