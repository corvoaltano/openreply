/**
 * Multi-post campaigns — API contract.
 *
 * One comment campaign can target several posts/reels. postId stays the
 * primary post (always postIds[0]) so code that only reads postId keeps
 * working, and clients that only send postId still behave as before.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    workspace: { findUnique: vi.fn() },
    automation: {
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    instagramAccount: { findFirst: vi.fn() },
    trackedLink: { create: vi.fn() },
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentWorkspaceId: async () => "w1" }));
vi.mock("@/lib/workspace-access", () => ({
  getCurrentWorkspaceContext: async () => ({
    workspaceId: "w1",
    role: "OWNER",
  }),
  canManageWorkspace: () => true,
}));

describe("multi-post campaigns — API contract", () => {
  let POST: typeof import("@/app/api/automations/route").POST;
  let PATCH: typeof import("@/app/api/automations/route").PATCH;

  beforeAll(async () => {
    ({ POST, PATCH } = await import("@/app/api/automations/route"));
  });

  function req(body: unknown, id?: string) {
    return new NextRequest(
      `http://localhost/api/automations${id ? `?id=${id}` : ""}`,
      {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  const base = {
    name: "Lead magnet",
    instagramAccountId: "ig1",
    keywords: ["GUIDE"],
    dmMessage: "Here you go",
  };

  beforeEach(() => {
    mockPrisma.automation.create.mockReset();
    mockPrisma.automation.create.mockImplementation(({ data }) => data);
    mockPrisma.automation.update.mockReset();
    mockPrisma.automation.update.mockResolvedValue({});
    mockPrisma.automation.findFirst.mockReset();
    mockPrisma.automation.findFirst.mockResolvedValue({
      id: "a1",
      campaignType: "COMMENT",
    });
    mockPrisma.instagramAccount.findFirst.mockResolvedValue({ id: "ig1" });
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: "w1" });
  });

  it("stores every selected post and makes the first one primary", async () => {
    const res = await POST(
      req({ ...base, postIds: ["reel_a", "reel_b", "reel_a", "reel_c"] }),
    );

    expect(res.status).toBe(201);
    const data = mockPrisma.automation.create.mock.calls[0][0].data;
    expect(data.postIds).toEqual(["reel_a", "reel_b", "reel_c"]);
    expect(data.postId).toBe("reel_a");
  });

  it("still accepts a single postId from older clients", async () => {
    await POST(req({ ...base, postId: "reel_a" }));

    const data = mockPrisma.automation.create.mock.calls[0][0].data;
    expect(data.postId).toBe("reel_a");
    expect(data.postIds).toEqual(["reel_a"]);
  });

  it("rejects more than 20 posts", async () => {
    const postIds = Array.from({ length: 21 }, (_, i) => `reel_${i}`);
    const res = await POST(req({ ...base, postIds }));

    expect(res.status).toBe(400);
    expect(mockPrisma.automation.create).not.toHaveBeenCalled();
  });

  it("stores no posts for an any-post campaign", async () => {
    await POST(req({ ...base, matchAnyPost: true, postIds: ["reel_a"] }));

    const data = mockPrisma.automation.create.mock.calls[0][0].data;
    expect(data.postId).toBeNull();
    expect(data.postIds).toEqual([]);
  });

  it("keeps postId in sync when the post list is edited", async () => {
    await PATCH(req({ postIds: ["reel_b", "reel_c"] }, "a1"));

    const data = mockPrisma.automation.update.mock.calls[0][0].data;
    expect(data.postIds).toEqual(["reel_b", "reel_c"]);
    expect(data.postId).toBe("reel_b");
  });

  it("leaves the posts alone on an edit that does not touch them", async () => {
    await PATCH(req({ isActive: false }, "a1"));

    const data = mockPrisma.automation.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("postIds");
    expect(data).not.toHaveProperty("postId");
  });

  it("clears the post list when switching to any post", async () => {
    await PATCH(req({ matchAnyPost: true }, "a1"));

    const data = mockPrisma.automation.update.mock.calls[0][0].data;
    expect(data.postId).toBeNull();
    expect(data.postIds).toEqual([]);
  });
});
