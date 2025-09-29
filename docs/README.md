# PromptPilot Pro — Architecture Overview

This repo powers PromptPilot Pro, a modular AI workflow platform for professionals.  
It enables structured prompt creation, multi-model orchestration, and team collaboration.

## Key Docs
- [System Design](./SYSTEM_DESIGN.md)
- [Epics & User Stories](./EPICS.md)
- [Epic 2 Story 3 Deep Dive](./EPIC2_STORY3.md)
- [API Contracts](./API.md)
- [Data Models](./DATA_MODELS.md)
- [Workflow Engine](./WORKFLOW_ENGINE.md)
- [Testing Strategy](../TESTING.md)
- [Epic 3 Story 1: Team Collaboration Foundations](./EPIC3_STORY1.md)

## Tech Stack
- Node.js + Express + TypeScript services (Prisma ORM)
- React + Vite + Tailwind frontend SPA
- SQLite for local development/testing; PostgreSQL ready for production
- Cypress, Vitest, and Jest for automated coverage