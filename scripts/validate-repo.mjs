import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  ".env.example",
  "app/page.tsx",
  "app/api/bootstrap/route.ts",
  "app/api/studies/route.ts",
  "app/mcp/route.ts",
  "lib/supabase/server.ts",
  "lib/study/context.ts",
  "lib/study/repository.ts",
  "lib/mirofish/client.ts",
  "supabase/migrations/20260901_add_link_study_lab.sql",
  "docs/NO_FAKE_CONTRACT.md",
];

const failures = [];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`missing:${relative}`);
}

const sourceRoots = ["app", "components", "lib"];
const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) sourceFiles.push(full);
  }
}
for (const relative of sourceRoots) walk(path.join(root, relative));

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(root, file);
  if (/\blocalStorage\b/.test(text)) failures.push(`no_fake:localStorage:${rel}`);
  if (/\balert\s*\(/.test(text)) failures.push(`no_fake:alert:${rel}`);
  if (/NEXT_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET|TOKEN|KEY)/.test(text) && !/NEXT_PUBLIC_SUPABASE_URL/.test(text)) {
    failures.push(`secret_public_prefix:${rel}`);
  }
  if (/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/.test(text)) failures.push(`hardcoded_service_role:${rel}`);
}

const miro = fs.readFileSync(path.join(root, "components/StudyView.tsx"), "utf8");
if (!miro.includes("miro?.reachable")) failures.push("no_fake:mirofish_ui_not_health_gated");

const context = fs.readFileSync(path.join(root, "lib/study/context.ts"), "utf8");
for (const marker of ["source_digest", "truth_class", "scope", "study_evidence"]) {
  if (!context.includes(marker)) failures.push(`context_contract_missing:${marker}`);
}

if (failures.length) {
  console.error("LINK STUDY repository validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`LINK STUDY repository validation passed (${sourceFiles.length} source files checked).`);
