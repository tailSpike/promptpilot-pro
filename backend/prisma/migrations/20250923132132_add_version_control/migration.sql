-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionNumber" TEXT NOT NULL,
    "majorVersion" INTEGER NOT NULL DEFAULT 1,
    "minorVersion" INTEGER NOT NULL DEFAULT 0,
    "patchVersion" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "metadata" JSONB,
    "commitMessage" TEXT,
    "changeType" TEXT NOT NULL DEFAULT 'PATCH',
    "changesSummary" JSONB,
    "tags" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "parentVersionId" TEXT,
    CONSTRAINT "prompt_versions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompt_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "prompt_versions_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "prompt_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prompt_branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "promptId" TEXT NOT NULL,
    "baseVersionId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdBy" TEXT NOT NULL,
    CONSTRAINT "prompt_branches_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompt_branches_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "prompt_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "prompt_branches_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "prompt_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "prompt_branches_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_prompt_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "input" JSONB NOT NULL,
    "output" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promptId" TEXT NOT NULL,
    "versionId" TEXT,
    CONSTRAINT "prompt_executions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompt_executions_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "prompt_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_prompt_executions" ("createdAt", "id", "input", "metadata", "model", "output", "promptId") SELECT "createdAt", "id", "input", "metadata", "model", "output", "promptId" FROM "prompt_executions";
DROP TABLE "prompt_executions";
ALTER TABLE "new_prompt_executions" RENAME TO "prompt_executions";
CREATE TABLE "new_prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "metadata" JSONB,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "folderId" TEXT,
    "currentVersionId" TEXT,
    CONSTRAINT "prompts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompts_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "prompts_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "prompt_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_prompts" ("content", "createdAt", "description", "folderId", "id", "isPublic", "metadata", "name", "updatedAt", "userId", "variables", "version") SELECT "content", "createdAt", "description", "folderId", "id", "isPublic", "metadata", "name", "updatedAt", "userId", "variables", "version" FROM "prompts";
DROP TABLE "prompts";
ALTER TABLE "new_prompts" RENAME TO "prompts";
CREATE UNIQUE INDEX "prompts_currentVersionId_key" ON "prompts"("currentVersionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "prompt_versions_promptId_createdAt_idx" ON "prompt_versions"("promptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_promptId_versionNumber_key" ON "prompt_versions"("promptId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_branches_promptId_name_key" ON "prompt_branches"("promptId", "name");
