-- CreateTable
CREATE TABLE "prompt_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "prompt_comments_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompt_comments_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "folders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompt_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "prompt_comments_promptId_createdAt_idx" ON "prompt_comments" ("promptId", "createdAt");

-- CreateIndex
CREATE INDEX "prompt_comments_libraryId_idx" ON "prompt_comments" ("libraryId");

-- CreateIndex
CREATE INDEX "prompt_comments_authorId_idx" ON "prompt_comments" ("authorId");