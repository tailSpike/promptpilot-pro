-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "lastTriggeredAt" DATETIME,
    "nextRunAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workflowId" TEXT NOT NULL,
    CONSTRAINT "workflow_triggers_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "triggerId" TEXT,
    CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "workflow_executions_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "workflow_triggers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_workflow_executions" ("completedAt", "error", "id", "input", "metadata", "output", "startedAt", "status", "triggerType", "workflowId") SELECT "completedAt", "error", "id", "input", "metadata", "output", "startedAt", "status", "triggerType", "workflowId" FROM "workflow_executions";
DROP TABLE "workflow_executions";
ALTER TABLE "new_workflow_executions" RENAME TO "workflow_executions";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
