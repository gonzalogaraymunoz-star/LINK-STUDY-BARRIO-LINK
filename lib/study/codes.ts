export function makeStudyCode(shortCode?: string | null) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const scope = (shortCode || "LINK").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8) || "LINK";
  return `LST-${scope}-${date}-${time}-${suffix}`;
}
