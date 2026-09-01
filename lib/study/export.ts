import crypto from "node:crypto";

const SECRET_KEY = /(api[_-]?key|secret|token|password|credential|authorization|cookie|service[_-]?role|private[_-]?key|client[_-]?secret)/i;
const PII_KEY = /(^|_|-)(email|e-mail|phone|telefono|teléfono|mobile|rut|dni|passport|address|direccion|dirección|birthday|birth_date)(_|-|$)/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_VALUE = /(?<!\d)(?:\+?56\s*)?(?:9\s*)?\d{4}[\s-]?\d{4}(?!\d)/g;
const RUT_VALUE = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;

export const EXPORT_REDACTION_VERSION = "link-study-export-v1";

function cleanString(value: string, allowPii: boolean) {
  if (allowPii) return value;
  return value
    .replace(EMAIL_VALUE, "[REDACTED_EMAIL]")
    .replace(PHONE_VALUE, "[REDACTED_PHONE]")
    .replace(RUT_VALUE, "[REDACTED_ID]");
}

function sanitize(value: unknown, allowPii: boolean): unknown {
  if (value == null) return value;
  if (typeof value === "string") return cleanString(value, allowPii);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, allowPii));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) {
        output[key] = "[REDACTED_SECRET]";
        continue;
      }
      if (!allowPii && PII_KEY.test(key)) {
        output[key] = "[REDACTED_PII]";
        continue;
      }
      output[key] = sanitize(item, allowPii);
    }
    return output;
  }
  return value;
}

export function prepareExternalStudyContext(context: unknown) {
  const allowPii = process.env.LINK_STUDY_ALLOW_PII_EXPORT === "true";
  const sanitized = sanitize(context, allowPii);
  const serialized = JSON.stringify(sanitized, null, 2);
  return {
    context: sanitized,
    serialized,
    allowPii,
    redactionVersion: EXPORT_REDACTION_VERSION,
    exportDigest: crypto.createHash("sha256").update(serialized).digest("hex"),
  };
}
