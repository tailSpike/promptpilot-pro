# PromptPilot Pro — Architecture Overview

This repo powers PromptPilot Pro, a modular AI workflow platform for professionals.  
It enables structured prompt creation, multi-model orchestration, and team collaboration.

## Key Docs
- [System Design](./SYSTEM_DESIGN.md)
- [Epics & User Stories](./EPICS.md)
- [API Contracts](./API.md)
- [Data Models](./DATA_MODELS.md)
- [Workflow Engine](./WORKFLOW_ENGINE.md)
- [Testing Strategy](../TESTING.md)
- [MVP Scope](./MVP_SCOPE.md)

## Tech Stack
- Node.js + Express + TypeScript services (Prisma ORM)
- React + Vite + Tailwind frontend SPA
- SQLite for local development/testing; PostgreSQL ready for production
- Cypress, Vitest, and Jest for automated coverage