import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockHeaders } = vi.hoisted(() => ({
  mockPrisma: { user: { findUnique: vi.fn() } },
  mockHeaders: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("next/headers", () => ({ headers: mockHeaders }));

import { getApiTokenUserId } from "../lib/api-token";

const TOKEN = "test-token-value";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function request(authorization?: string) {
  mockHeaders.mockResolvedValue(
    new Headers(authorization ? { authorization } : {}),
  );
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.stubEnv("MCP_API_TOKEN_SHA256", sha(TOKEN));
  vi.stubEnv("MCP_API_USER_EMAIL", "Owner@Example.com");
  mockPrisma.user.findUnique.mockResolvedValue({ id: "u1" });
});

describe("API token auth", () => {
  it("leaves requests without a bearer token to the session", async () => {
    request();
    expect(await getApiTokenUserId()).toBeUndefined();
    request("Basic abc");
    expect(await getApiTokenUserId()).toBeUndefined();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("treats a request outside a request scope as tokenless", async () => {
    mockHeaders.mockRejectedValue(new Error("outside a request scope"));
    expect(await getApiTokenUserId()).toBeUndefined();
  });

  it("resolves the configured user for the right token", async () => {
    request(`Bearer ${TOKEN}`);
    expect(await getApiTokenUserId()).toBe("u1");
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "owner@example.com" },
      select: { id: true },
    });
  });

  it("refuses a wrong token without touching the database", async () => {
    request("Bearer not-the-token");
    expect(await getApiTokenUserId()).toBeNull();
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses every token when the feature is not configured", async () => {
    request(`Bearer ${TOKEN}`);
    vi.stubEnv("MCP_API_TOKEN_SHA256", "");
    expect(await getApiTokenUserId()).toBeNull();
    vi.stubEnv("MCP_API_TOKEN_SHA256", sha(TOKEN));
    vi.stubEnv("MCP_API_USER_EMAIL", "");
    expect(await getApiTokenUserId()).toBeNull();
  });

  it("refuses the token when the user does not exist", async () => {
    request(`Bearer ${TOKEN}`);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await getApiTokenUserId()).toBeNull();
  });
});
