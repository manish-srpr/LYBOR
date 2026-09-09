-- CreateTable
CREATE TABLE "SkillAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerProfileId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "bankVersion" INTEGER NOT NULL DEFAULT 1,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SkillAssessment_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillAssessment_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SkillAssessment_skillId_idx" ON "SkillAssessment"("skillId");

-- CreateIndex
CREATE INDEX "SkillAssessment_passed_idx" ON "SkillAssessment"("passed");

-- CreateIndex
CREATE UNIQUE INDEX "SkillAssessment_workerProfileId_skillId_key" ON "SkillAssessment"("workerProfileId", "skillId");
