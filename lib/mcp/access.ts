import crypto from "node:crypto";
import type { NextRequest } from "next/server";

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function authorizeMcp(request: NextRequest) {
  const configured = process.env.LINK_MCP_TOKEN || "";
  if (!configured) return { allowed: false, reason: "mcp_token_not_configured" };
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const header = request.headers.get("x-link-mcp-token") || "";
  const candidate = bearer || header;
  return candidate && safeEqual(candidate, configured)
    ? { allowed: true, reason: "token_ok" }
    : { allowed: false, reason: "invalid_mcp_token" };
}
