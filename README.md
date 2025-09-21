# 🚀 PromptPilot Pro

PromptPilot Pro is a modular AI workflow platform for professionals.  
This repo contains the full-stack application built with:

- **Frontend**: React + Tailwind  
- **Backend**: Node.js + TypeScript + Express  
- **Database**: PostgreSQL  
- **Model Integration**: OpenAI (GPT-4), Claude, Gemini

---

## 🛠️ Local Development

### Prerequisites
- Node.js v18+
- PostgreSQL 14+
- Docker (optional for containerized setup)

### Setup
```bash
git clone https://github.com/tailSpike/promptpilot-pro.git
cd promptpilot-pro
npm install

### Run Backend
npm run dev


### Run Frontend
cd client
npm install
npm run dev


### Run with Docker
docker-compose up



### 🧪 Testing
npm run test         # unit tests
npm run lint         # code linting
npm run format       # prettier formatting



### 🐞 Debugging
- Use VS Code launch.json for backend debugging
- React DevTools for frontend inspection
- Logs are stored in /logs and viewable via console

### 🚀 Deployment
- Staging: Railway / Vercel / Render
- Production: Docker + VPS or Kubernetes (TBD)

### 📚 Docs
- System Design
- Epics
- API
- Data Models
- Dev Guide
