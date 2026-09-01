import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "link_study_session";

function configuredToken() {
  return process.env.LINK_STUDY_ADMIN_TOKEN || "";
}

function digest(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function uiAuthConfigured() {
  return Boolean(configuredToken());
}

export async function uiAuthorized() {
  if (process.env.NODE_ENV !== "production" && !uiAuthConfigured()) return true;
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return Boolean(value && value === digest(configuredToken()));
}

export function requestAuthorized(request: NextRequest) {
  if (process.env.NODE_ENV !== "production" && !uiAuthConfigured()) return true;
  const value = request.cookies.get(COOKIE_NAME)?.value;
  return Boolean(value && value === digest(configuredToken()));
}

export function validateAdminToken(candidate: string) {
  const expected = configuredToken();
  if (!expected || !candidate) return false;
  const a = Buffer.from(digest(expected));
  const b = Buffer.from(digest(candidate));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function sessionCookieValue() {
  return digest(configuredToken());
}

export const sessionCookieName = COOKIE_NAME;
