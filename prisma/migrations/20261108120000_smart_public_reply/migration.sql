-- Smart public reply: pick the comment reply by the DM's real outcome.
-- Additive only; existing campaigns keep smartPublicReply = false and behave
-- exactly as before.
ALTER TABLE "Automation" ADD COLUMN "smartPublicReply" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Automation" ADD COLUMN "publicReplyRequestMessages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Automation" ADD COLUMN "publicReplyFailedMessages" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Automation" ADD COLUMN "replyCtaKeyword" TEXT;
ALTER TABLE "Automation" ADD COLUMN "oneReplyPerThread" BOOLEAN NOT NULL DEFAULT true;

-- One automatic answer per comment thread: remember which top-level comment a
-- reply belongs to. Null for top-level comments and for all older rows.
ALTER TABLE "DmLog" ADD COLUMN "parentCommentId" TEXT;
CREATE INDEX "DmLog_parentCommentId_idx" ON "DmLog"("parentCommentId");
