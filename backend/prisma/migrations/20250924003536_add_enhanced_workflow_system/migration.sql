/*
  Warnings:

  - You are about to drop the column `createdAt` on the `workflow_executions` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `workflow_executions` table. All the data in the column will be lost.
  - Added the required column `name` to the `workflow_steps` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "workflow_variables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "description" TEXT,
    "defaultValue" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "validation" JSONB,
    "workflowId" TEXT NOT NULL,
    CONSTRAINT "workflow_variables_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "difficulty" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sourceWorkflowId" TEXT NOT NULL,
    CONSTRAINT "workflow_templates_sourceWorkflowId_fkey" FOREIGN KEY ("sourceWorkflowId") REFERENCES "workflows" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflow_step_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stepOrder" INTEGER NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "duration" INTEGER,
    "error" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    CONSTRAINT "workflow_step_executions_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "workflow_executions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_step_executions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "workflow_steps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_workflow_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "error" JSONB,
    "metadata" JSONB,
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "workflowId" TEXT NOT NULL,
    CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_workflow_executions" ("id", "input", "metadata", "output", "status", "workflowId") SELECT "id", "input", "metadata", "output", "status", "workflowId" FROM "workflow_executions";
DROP TABLE "workflow_executions";
ALTER TABLE "new_workflow_executions" RENAME TO "workflow_executions";
CREATE TABLE "new_workflow_steps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PROMPT',
    "order" INTEGER NOT NULL,
    "position" JSONB,
    "config" JSONB NOT NULL,
    "inputs" JSONB,
    "outputs" JSONB,
    "conditions" JSONB,
    "retryConfig" JSONB,
    "workflowId" TEXT NOT NULL,
    "promptId" TEXT,
    CONSTRAINT "workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_steps_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_workflow_steps" ("config", "id", "order", "promptId", "workflowId") SELECT "config", "id", "order", "promptId", "workflowId" FROM "workflow_steps";
DROP TABLE "workflow_steps";
ALTER TABLE "new_workflow_steps" RENAME TO "workflow_steps";
CREATE UNIQUE INDEX "workflow_steps_workflowId_order_key" ON "workflow_steps"("workflowId", "order");
CREATE TABLE "new_workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "templateId" TEXT,
    CONSTRAINT "workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflows_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "workflows_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "workflow_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_workflows" ("createdAt", "description", "id", "isActive", "name", "updatedAt", "userId") SELECT "createdAt", "description", "id", "isActive", "name", "updatedAt", "userId" FROM "workflows";
DROP TABLE "workflows";
ALTER TABLE "new_workflows" RENAME TO "workflows";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "workflow_variables_workflowId_name_key" ON "workflow_variables"("workflowId", "name");
