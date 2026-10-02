/**
 * DM campaign type — API contract.
 *
 * Drives the real route handlers and asserts the invariants that keep the two
 * campaign types from bleeding into each other: a DM campaign needs no post and
 * has its DM path forced on, while a comment campaign keeps the behaviour it
 * had before DM campaigns existed.
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
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    instagramAccount: { findFirst: vi.fn() },
    trackedLink: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    dmLog: { count: vi.fn() },
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

describe("campaignType — API contract", () => {
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

  beforeEach(() => {
    mockPrisma.automation.create.mockReset();
    mockPrisma.automation.update.mockReset();
    mockPrisma.automation.findFirst.mockReset();
    mockPrisma.instagramAccount.findFirst.mockReset();
    mockPrisma.trackedLink.create.mockReset();
    mockPrisma.dmLog.count.mockResolvedValue(0);
    mockPrisma.workspace.findUnique.mockReset();
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: "w1" });
  });

  it("creates a DM campaign without a post and forces the DM path on", async () => {
    mockPrisma.instagramAccount.findFirst.mockResolvedValue({
      id: "ig1",
      workspaceId: "w1",
    });
    mockPrisma.automation.create.mockImplementation(({ data }) => ({
      ...data,
      id: "new_id",
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    mockPrisma.trackedLink.create.mockResolvedValue({});

    const res = await POST(
      req({
        name: "DM only",
        campaignType: "DM",
        instagramAccountId: "ig1",
        keywords: ["FIYAT"],
        dmMessage: "Here you go",
      }),
    );
    const json = await res.json();

    expect(json.success).toBe(true);
    const data = mockPrisma.automation.create.mock.calls[0][0].data;
    expect(data.campaignType).toBe("DM");
    expect(data.postId).toBeNull();
    expect(data.postUrl).toBeNull();
    expect(data.matchAnyPost).toBe(false);
    expect(data.pendingNextReel).toBe(false);
    // The keyword is the trigger, so the DM path is on without the toggle.
    expect(data.dmTriggerEnabled).toBe(true);
    // No post exists to reply under.
    expect(data.publicReplyEnabled).toBe(false);
  });

  it("still rejects a COMMENT campaign with no post", async () => {
    mockPrisma.instagramAccount.findFirst.mockResolvedValue({
      id: "ig1",
      workspaceId: "w1",
    });

    const res = await POST(
      req({
        name: "No post",
        campaignType: "COMMENT",
        instagramAccountId: "ig1",
        keywords: ["LINK"],
        dmMessage: "hi",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid input");
    expect(mockPrisma.automation.create).not.toHaveBeenCalled();
  });

  it("does not let a plain edit of a comment campaign clear its DM toggle", async () => {
    mockPrisma.automation.findFirst.mockResolvedValue({
      id: "a_comment",
      campaignType: "COMMENT",
    });
    mockPrisma.automation.update.mockResolvedValue({});

    await PATCH(
      req({ dmMessage: "text", dmTriggerEnabled: true }, "a_comment"),
    );

    const data = mockPrisma.automation.update.mock.calls[0][0].data;
    expect(data.dmTriggerEnabled).toBe(true);
  });

  it("turns the DM path off when a DM campaign is switched back to COMMENT", async () => {
    mockPrisma.automation.findFirst.mockResolvedValue({
      id: "a_dm",
      campaignType: "DM",
    });
    mockPrisma.automation.update.mockResolvedValue({});

    await PATCH(
      req(
        {
          campaignType: "COMMENT",
          dmTriggerEnabled: true,
          postId: "media_101",
        },
        "a_dm",
      ),
    );

    const data = mockPrisma.automation.update.mock.calls[0][0].data;
    expect(data.campaignType).toBe("COMMENT");
    expect(data.dmTriggerEnabled).toBe(false);
    expect(data.postId).toBe("media_101");
  });

  it("clears the post trigger when switching a comment campaign to DM", async () => {
    mockPrisma.automation.findFirst.mockResolvedValue({
      id: "a_comment",
      campaignType: "COMMENT",
      postId: "media_101",
    });
    mockPrisma.automation.update.mockResolvedValue({});

    await PATCH(req({ campaignType: "DM" }, "a_comment"));

    const data = mockPrisma.automation.update.mock.calls[0][0].data;
    expect(data.postId).toBeNull();
    expect(data.postUrl).toBeNull();
    expect(data.matchAnyPost).toBe(false);
    expect(data.pendingNextReel).toBe(false);
    expect(data.dmTriggerEnabled).toBe(true);
    expect(data.publicReplyEnabled).toBe(false);
    expect(data.openingDmEnabled).toBe(false);
  });
});
