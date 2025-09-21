
---

## 📄 `/docs/DEV_GUIDE.md`

```markdown
# 🧑‍💻 Developer Guide — PromptPilot Pro

This guide outlines best practices for contributing to PromptPilot Pro.

---

## 🧱 Tech Stack

- **Frontend**: React + Tailwind + Vite  
- **Backend**: Node.js + TypeScript + Express  
- **Database**: PostgreSQL + Prisma ORM  
- **Infra**: Docker + Railway/Vercel  
- **AI Models**: OpenAI, Claude, Gemini (via API)

---

## 📁 Folder Structure
/client         # React frontend 
/server         # Express backend 
/prisma         # DB schema and migrations 
/docs           # Architecture and planning 
/tests          # Unit and integration tests

---

## 🧼 Code Hygiene

- Use Prettier for formatting (`npm run format`)
- Use ESLint for linting (`npm run lint`)
- Write meaningful commit messages (`feat:`, `fix:`, `chore:`)
- Prefer functional components and hooks in React
- Use async/await and typed interfaces in backend

---

## 🧪 Testing Strategy

- Unit tests with Jest  
- Integration tests for workflows  
- Mock model responses for deterministic testing  
- CI runs lint + tests on every PR

---

## 🔐 Secrets & Environment

- Use `.env.local` for local development  
- Never commit `.env` files  
- Use Railway/Vercel secrets for staging/prod

---

## 🧠 Development Principles

- Build in vertical slices (prompt → workflow → execution)  
- Keep logic modular and testable  
- Document edge cases and assumptions  
- Prioritize clarity over cleverness

---

## 🧭 Onboarding Checklist

- Clone repo and run locally  
- Read SYSTEM_DESIGN.md and EPICS.md  
- Join Slack/Discord for team updates  
- Ask questions early—collaboration is key