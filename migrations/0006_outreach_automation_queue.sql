-- Multi-mailbox outreach automation foundation.

DROP INDEX IF EXISTS "GmailConnection_userId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "GmailConnection_userId_gmailAddress_key" ON "GmailConnection"("userId", "gmailAddress");

CREATE TABLE "OutreachAutomationSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "globalPaused" BOOLEAN NOT NULL DEFAULT false,
    "sendWindowStartHour" INTEGER NOT NULL DEFAULT 9,
    "sendWindowStartMinute" INTEGER NOT NULL DEFAULT 0,
    "sendWindowEndHour" INTEGER NOT NULL DEFAULT 16,
    "sendWindowEndMinute" INTEGER NOT NULL DEFAULT 30,
    "weekdaysOnly" BOOLEAN NOT NULL DEFAULT true,
    "initialDelayMinMinutes" INTEGER NOT NULL DEFAULT 10,
    "initialDelayMaxMinutes" INTEGER NOT NULL DEFAULT 45,
    "followUp1BusinessDays" INTEGER NOT NULL DEFAULT 2,
    "followUp2BusinessDays" INTEGER NOT NULL DEFAULT 4,
    "schedulerClaimBatch" INTEGER NOT NULL DEFAULT 4,
    "replySyncStaleMinutes" INTEGER NOT NULL DEFAULT 5,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT OR IGNORE INTO "OutreachAutomationSetting" (
    "id",
    "enabled",
    "globalPaused",
    "sendWindowStartHour",
    "sendWindowStartMinute",
    "sendWindowEndHour",
    "sendWindowEndMinute",
    "weekdaysOnly",
    "initialDelayMinMinutes",
    "initialDelayMaxMinutes",
    "followUp1BusinessDays",
    "followUp2BusinessDays",
    "schedulerClaimBatch",
    "replySyncStaleMinutes",
    "updatedAt"
) VALUES (
    'global',
    1,
    0,
    9,
    0,
    16,
    30,
    1,
    10,
    45,
    2,
    4,
    4,
    5,
    CURRENT_TIMESTAMP
);

CREATE TABLE "OutreachMailbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gmailConnectionId" TEXT,
    "gmailAddress" TEXT NOT NULL,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WARMING',
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "dailyLimit" INTEGER NOT NULL DEFAULT 20,
    "hourlyLimit" INTEGER NOT NULL DEFAULT 5,
    "minDelaySeconds" INTEGER NOT NULL DEFAULT 600,
    "maxDelaySeconds" INTEGER NOT NULL DEFAULT 1800,
    "warmupLevel" INTEGER NOT NULL DEFAULT 1,
    "lastSentAt" DATETIME,
    "lastReplyCheckAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutreachMailbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutreachMailbox_gmailConnectionId_fkey" FOREIGN KEY ("gmailConnectionId") REFERENCES "GmailConnection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OutreachMailbox_gmailAddress_key" ON "OutreachMailbox"("gmailAddress");
CREATE INDEX "OutreachMailbox_status_idx" ON "OutreachMailbox"("status");
CREATE INDEX "OutreachMailbox_userId_status_idx" ON "OutreachMailbox"("userId", "status");

CREATE TABLE "OutreachSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" INTEGER NOT NULL,
    "queuedByUserId" TEXT NOT NULL,
    "assignedMailboxId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "currentStep" TEXT NOT NULL DEFAULT 'INITIAL',
    "nextScheduledAt" DATETIME,
    "lastSentAt" DATETIME,
    "replyDetectedAt" DATETIME,
    "stopReason" TEXT,
    "sequenceConfigSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutreachSequence_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutreachSequence_queuedByUserId_fkey" FOREIGN KEY ("queuedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutreachSequence_assignedMailboxId_fkey" FOREIGN KEY ("assignedMailboxId") REFERENCES "OutreachMailbox" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OutreachSequence_leadId_status_idx" ON "OutreachSequence"("leadId", "status");
CREATE INDEX "OutreachSequence_status_nextScheduledAt_idx" ON "OutreachSequence"("status", "nextScheduledAt");
CREATE INDEX "OutreachSequence_assignedMailboxId_status_idx" ON "OutreachSequence"("assignedMailboxId", "status");

CREATE TABLE "OutreachSequenceStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequenceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "stepType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" DATETIME NOT NULL,
    "claimedAt" DATETIME,
    "claimedByRunId" TEXT,
    "sentAt" DATETIME,
    "gmailMessageId" TEXT,
    "gmailThreadId" TEXT,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "bodyPlain" TEXT,
    "generationModel" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OutreachSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OutreachSequenceStep_sequenceId_stepNumber_key" ON "OutreachSequenceStep"("sequenceId", "stepNumber");
CREATE INDEX "OutreachSequenceStep_status_scheduledFor_idx" ON "OutreachSequenceStep"("status", "scheduledFor");
CREATE INDEX "OutreachSequenceStep_claimedByRunId_idx" ON "OutreachSequenceStep"("claimedByRunId");

CREATE TABLE "OutreachSuppression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "domain" TEXT,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "leadId" INTEGER,
    "sequenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "OutreachSuppression_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OutreachSuppression_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "OutreachSequence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "OutreachSuppression_email_idx" ON "OutreachSuppression"("email");
CREATE INDEX "OutreachSuppression_domain_idx" ON "OutreachSuppression"("domain");
CREATE INDEX "OutreachSuppression_expiresAt_idx" ON "OutreachSuppression"("expiresAt");

CREATE TABLE "OutreachRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "claimedCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT
);

CREATE INDEX "OutreachRun_startedAt_idx" ON "OutreachRun"("startedAt");
CREATE INDEX "OutreachRun_status_startedAt_idx" ON "OutreachRun"("status", "startedAt");

ALTER TABLE "OutreachEmail" ADD COLUMN "mailboxId" TEXT;
ALTER TABLE "OutreachEmail" ADD COLUMN "sequenceId" TEXT;
ALTER TABLE "OutreachEmail" ADD COLUMN "sequenceStepId" TEXT;

CREATE INDEX "OutreachEmail_mailboxId_sentAt_idx" ON "OutreachEmail"("mailboxId", "sentAt");
CREATE INDEX "OutreachEmail_sequenceId_idx" ON "OutreachEmail"("sequenceId");
