import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/client";

const SHA256_HEX = /^[a-f0-9]{64}$/i;

/**
 * Personal API token for scripted access (e.g. a local MCP server driving the
 * API on the owner's behalf). Only the token's SHA-256 lives on the server, in
 * MCP_API_TOKEN_SHA256; MCP_API_USER_EMAIL names the user it acts as. Leave
 * either unset and bearer tokens are refused.
 *
 * Returns undefined when the request carries no bearer token (fall back to the
 * session), null when it carries one that does not check out, else the user id.
 */
export async function getApiTokenUserId(): Promise<string | null | undefined> {
  let authorization: string | null;
  try {
    authorization = (await headers()).get("authorization");
  } catch {
    // Outside a request (scripts, tests): there is no token to read.
    return undefined;
  }
  if (!authorization?.startsWith("Bearer ")) return undefined;

  const token = authorization.slice("Bearer ".length).trim();
  const expected = process.env.MCP_API_TOKEN_SHA256?.trim() ?? "";
  const email = process.env.MCP_API_USER_EMAIL?.trim().toLowerCase();
  if (!token || !SHA256_HEX.test(expected) || !email) return null;

  const got = createHash("sha256").update(token).digest();
  if (!timingSafeEqual(got, Buffer.from(expected, "hex"))) return null;

  // Auth.js stores sign-in emails lowercased.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? null;
}
