import { describe, it, expect } from "vitest";
import {
  buildDuplicatePayload,
  type DuplicableCampaign,
} from "@/lib/campaign-duplicate";

const base: DuplicableCampaign = {
  name: "Rehber",
  campaignType: "COMMENT",
  instagramAccountId: "ig1",
  postId: "p1",
  postIds: ["p1"],
  postUrl: "https://instagram.com/reel/x",
  pendingNextReel: false,
  matchAnyPost: false,
  keywords: ["REHBER"],
  matchAnyWord: false,
  dmMessage: "link",
  openingDmEnabled: false,
  openingDmMessage: null,
  openingDmButtonLabel: null,
  publicReplyEnabled: true,
  publicReplyMessages: ["a", "b"],
  smartPublicReply: true,
  publicReplyRequestMessages: ["req"],
  publicReplyFailedMessages: ["fail"],
  replyCtaKeyword: "LINK",
  oneReplyPerThread: false,
  requireFollow: false,
  followPromptMessage: null,
  followPromptButtonLabel: null,
  wholeWordMatch: true,
  trackedLinks: [{ destinationUrl: "https://a.test", label: null }],
};

describe("buildDuplicatePayload", () => {
  it("carries the smart public reply fields", () => {
    const p = buildDuplicatePayload(base);
    expect(p.publicReplyEnabled).toBe(true);
    expect(p.publicReplyMessages).toEqual(["a", "b"]);
    expect(p.smartPublicReply).toBe(true);
    expect(p.publicReplyRequestMessages).toEqual(["req"]);
    expect(p.publicReplyFailedMessages).toEqual(["fail"]);
    expect(p.replyCtaKeyword).toBe("LINK");
    expect(p.oneReplyPerThread).toBe(false);
  });

  it("keeps oneReplyPerThread true and falls back for old rows", () => {
    const p = buildDuplicatePayload({
      ...base,
      smartPublicReply: undefined,
      publicReplyRequestMessages: undefined,
      publicReplyFailedMessages: undefined,
      replyCtaKeyword: undefined,
      oneReplyPerThread: undefined,
      publicReplyMessages: [],
      publicReplyMessage: "legacy",
    });
    expect(p.oneReplyPerThread).toBe(true);
    expect(p.smartPublicReply).toBe(false);
    expect(p.publicReplyMessages).toEqual(["legacy"]);
    expect(p.replyCtaKeyword).toBeNull();
  });

  it("creates the copy paused and renamed", () => {
    const p = buildDuplicatePayload(base);
    expect(p.isActive).toBe(false);
    expect(p.name).toBe("Rehber copy");
    expect(p.trackedDestinationUrl).toBe("https://a.test");
  });
});
