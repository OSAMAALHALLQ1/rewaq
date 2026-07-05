import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const canonicalDir = join(root, "supabase", "migrations");
const legacyDir = join(root, "db", "migrations");

const allowedCanonicalDuplicates = new Map([
  [
    "006",
    [
      "006_add_departments_and_api_keys.sql",
      "006_email_approval_and_team_invites.sql",
    ],
  ],
]);

const requiredLegacyPorts = new Map([
  [
    "008_department_access_and_messaging.sql",
    {
      canonicalFile: "022_forward_fix_department_api_keys.sql",
      checks: [
        "department_api_keys",
        "key_hash",
        "organization_id",
        "branch_id",
        "allowed_modules",
        "internal_messages",
      ],
    },
  ],
  [
    "009_fix_rls_infinite_recursion.sql",
    {
      canonicalFile: "022_forward_fix_department_api_keys.sql",
      checks: [
        "language plpgsql",
        "security definer",
        "create or replace function public.is_super_admin",
        "create or replace function public.is_org_member",
        "create or replace function public.can_access_branch",
      ],
    },
  ],
  [
    "010_fix_department_api_keys.sql",
    {
      canonicalFile: "022_forward_fix_department_api_keys.sql",
      checks: [
        "department_api_keys",
        "key_hash",
        "internal_messages",
        "drop policy if exists \"Owners manage keys\"",
        "drop policy if exists \"Org members read keys\"",
      ],
      forbidden: [
        "drop table if exists public.department_api_keys",
        "drop table if exists public.department_members",
        "drop table if exists public.departments",
      ],
    },
  ],
]);

function migrationFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function versionOf(name) {
  return name.split("_", 1)[0];
}

function duplicates(files) {
  const byVersion = new Map();
  for (const file of files) {
    const version = versionOf(file);
    byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
  }

  return [...byVersion.entries()].filter(([, names]) => names.length > 1);
}

function readMigration(dir, file) {
  return readFileSync(join(dir, file), "utf8");
}

function hash(content) {
  return createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex");
}

function sameMembers(actual, expected) {
  return actual.length === expected.length && actual.every((name) => expected.includes(name));
}

const canonical = migrationFiles(canonicalDir);
const legacy = migrationFiles(legacyDir);
const canonicalSet = new Set(canonical);
const legacySet = new Set(legacy);

const onlyCanonical = canonical.filter((file) => !legacySet.has(file));
const onlyLegacy = legacy.filter((file) => !canonicalSet.has(file));
const duplicateCanonical = duplicates(canonical);
const duplicateLegacy = duplicates(legacy);
const common = canonical.filter((file) => legacySet.has(file));

let failed = false;

if (onlyCanonical.length > 0) {
  console.warn("Canonical-only migrations in supabase/migrations:");
  for (const file of onlyCanonical) console.error(`  - ${file}`);
}

for (const file of common) {
  const canonicalHash = hash(readMigration(canonicalDir, file));
  const legacyHash = hash(readMigration(legacyDir, file));
  if (canonicalHash !== legacyHash) {
    failed = true;
    console.error(`Migration content differs between canonical and legacy directories: ${file}`);
  }
}

for (const file of onlyLegacy) {
  const port = requiredLegacyPorts.get(file);
  if (!port) {
    failed = true;
    console.error(`Legacy-only migration has no canonical forward port: ${file}`);
    continue;
  }

  if (!canonicalSet.has(port.canonicalFile)) {
    failed = true;
    console.error(`Legacy-only migration ${file} is missing canonical port ${port.canonicalFile}`);
    continue;
  }

  const canonicalSql = readMigration(canonicalDir, port.canonicalFile).toLowerCase();
  const missingChecks = port.checks.filter((check) => !canonicalSql.includes(check.toLowerCase()));
  const forbiddenMatches = (port.forbidden ?? []).filter((check) => canonicalSql.includes(check.toLowerCase()));

  if (missingChecks.length > 0) {
    failed = true;
    console.error(`Canonical port ${port.canonicalFile} does not cover ${file}:`);
    for (const check of missingChecks) console.error(`  - missing ${check}`);
  }

  if (forbiddenMatches.length > 0) {
    failed = true;
    console.error(`Canonical port ${port.canonicalFile} contains destructive legacy repair from ${file}:`);
    for (const check of forbiddenMatches) console.error(`  - forbidden ${check}`);
  }
}

if (duplicateCanonical.length > 0) {
  for (const [version, names] of duplicateCanonical) {
    const allowed = allowedCanonicalDuplicates.get(version);
    if (allowed && sameMembers(names, allowed)) {
      console.warn(
        `Known canonical duplicate migration version ${version}: ${names.join(", ")}. ` +
          "Do not run db push until the migration-history repair path is chosen.",
      );
      continue;
    }

    failed = true;
    console.error(`Duplicate migration version in supabase/migrations: ${version}: ${names.join(", ")}`);
  }
}

if (duplicateLegacy.length > 0) {
  failed = true;
  console.error("Duplicate migration versions in db/migrations:");
  for (const [version, names] of duplicateLegacy) {
    console.error(`  - ${version}: ${names.join(", ")}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("Canonical migration chain has the required forward ports.");
