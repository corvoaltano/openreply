-- Let one comment campaign trigger on several posts/reels. Additive only:
-- postId is kept as the primary post, so code that reads only postId keeps
-- working while this rolls out.
ALTER TABLE "Automation" ADD COLUMN "postIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Existing specific-post campaigns carry their single post in the new list.
UPDATE "Automation" SET "postIds" = ARRAY["postId"] WHERE "postId" IS NOT NULL;

-- The DM worker matches incoming comments with postIds @> ARRAY[mediaId].
CREATE INDEX "Automation_postIds_idx" ON "Automation" USING GIN ("postIds");
