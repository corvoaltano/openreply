-- Add CampaignType so a campaign can be driven by an inbound DM keyword
-- instead of a comment on a post. Existing rows are comment campaigns.
CREATE TYPE "CampaignType" AS ENUM ('COMMENT', 'DM');

ALTER TABLE "Automation" ADD COLUMN     "campaignType" "CampaignType" NOT NULL DEFAULT 'COMMENT';

-- The DM worker looks campaigns up by type + account on every inbound message.
CREATE INDEX "Automation_campaignType_instagramAccountId_idx" ON "Automation"("campaignType", "instagramAccountId");
