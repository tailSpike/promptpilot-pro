-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "prompts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "workflowId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    CONSTRAINT "workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_steps_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prompt_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "input" JSONB NOT NULL,
    "output" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promptId" TEXT NOT NULL,
    CONSTRAINT "prompt_executions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workflowId" TEXT NOT NULL,
    CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
