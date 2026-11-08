/**
 * Builds the POST /api/automations body used by the dashboard's "Duplicate"
 * action. Kept as a pure function so every copied field is covered by a test:
 * a field missing here silently disappears from the copy.
 */

export interface DuplicableCampaign {
  name: string;
  campaignType?: "COMMENT" | "DM";
  instagramAccountId: string;
  postId: string | null;
  postIds?: string[];
  postUrl: string | null;
  pendingNextReel: boolean;
  matchAnyPost: boolean;
  keywords: string[];
  matchAnyWord: boolean;
  dmMessage: string;
  openingDmEnabled: boolean;
  openingDmMessage: string | null;
  openingDmButtonLabel: string | null;
  publicReplyEnabled: boolean;
  publicReplyMessage?: string | null;
  publicReplyMessages: string[];
  smartPublicReply?: boolean;
  publicReplyRequestMessages?: string[];
  publicReplyFailedMessages?: string[];
  replyCtaKeyword?: string | null;
  oneReplyPerThread?: boolean;
  requireFollow: boolean;
  followPromptMessage: string | null;
  followPromptButtonLabel: string | null;
  wholeWordMatch: boolean;
  trackedLinks: Array<{ destinationUrl: string; label: string | null }>;
}

export function buildDuplicatePayload(auto: DuplicableCampaign) {
  const isDm = auto.campaignType === "DM";
  const specific = !isDm && !auto.matchAnyPost && !auto.pendingNextReel;
  return {
    name: `${auto.name} copy`,
    campaignType: auto.campaignType,
    instagramAccountId: auto.instagramAccountId,
    postId: specific ? auto.postId : null,
    postIds: specific ? (auto.postIds ?? []) : [],
    postUrl: specific ? auto.postUrl : null,
    matchAnyPost: auto.matchAnyPost,
    pendingNextReel: auto.pendingNextReel,
    matchAnyWord: auto.matchAnyWord,
    keywords: auto.keywords,
    dmTriggerEnabled: isDm ? true : undefined,
    dmMessage: auto.dmMessage,
    openingDmEnabled: isDm ? false : auto.openingDmEnabled,
    openingDmMessage: auto.openingDmMessage,
    openingDmButtonLabel: auto.openingDmButtonLabel,
    publicReplyEnabled: auto.publicReplyEnabled,
    // Older rows may only have the legacy single message.
    publicReplyMessages:
      auto.publicReplyMessages?.length > 0
        ? auto.publicReplyMessages
        : auto.publicReplyMessage
          ? [auto.publicReplyMessage]
          : [],
    smartPublicReply: auto.smartPublicReply ?? false,
    publicReplyRequestMessages: auto.publicReplyRequestMessages ?? [],
    publicReplyFailedMessages: auto.publicReplyFailedMessages ?? [],
    replyCtaKeyword: auto.replyCtaKeyword ?? null,
    oneReplyPerThread: auto.oneReplyPerThread ?? true,
    trackedDestinationUrl: auto.trackedLinks[0]?.destinationUrl ?? "",
    secondaryDestinationUrl: auto.trackedLinks[1]?.destinationUrl ?? "",
    secondaryButtonLabel: auto.trackedLinks[1]?.label ?? "Open link",
    requireFollow: auto.requireFollow,
    followPromptMessage: auto.followPromptMessage,
    followPromptButtonLabel: auto.followPromptButtonLabel,
    wholeWordMatch: auto.wholeWordMatch,
    isActive: false,
  };
}
