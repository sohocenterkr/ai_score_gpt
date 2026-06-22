#!/usr/bin/env node
/* Site AI Score - one-time PostgreSQL/Replit DB to Supabase migration helper.
 *
 * Required migration environment:
 *   SOURCE_DATABASE_URL = current Replit PostgreSQL connection string
 *   TARGET_DATABASE_URL = new external Supabase PostgreSQL connection string
 *
 * Fallback:
 *   SOURCE_DATABASE_URL falls back to DATABASE_URL so the current app DB can be the source.
 *
 * This script never prints connection strings.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "../..");
const workDir = path.join(rootDir, ".siteaiscore-db-migration");
const dumpPath = path.join(workDir, "siteaiscore-data.dump");
const countsPath = path.join(workDir, "table-counts.json");

function loadDotenvFile(fileName) {
  const fullPath = path.join(rootDir, fileName);
  if (!fs.existsSync(fullPath)) {
    return;
  }

  try {
    require("dotenv").config({ path: fullPath, override: false });
  } catch (error) {
    throw new Error(`${fileName} 파일을 읽을 수 없습니다: ${error.message}`);
  }
}

loadDotenvFile(".env");
loadDotenvFile(".env.local");
loadDotenvFile(".env.migration");

function mask(value) {
  if (!value) return "not set";
  return "set";
}

function requireUrl(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`${name} 환경변수가 필요합니다. 실제 값은 출력하지 않습니다.`);
  }
  return String(value).trim();
}

function getSourceUrl() {
  return requireUrl(
    "SOURCE_DATABASE_URL 또는 DATABASE_URL",
    process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL,
  );
}

function getTargetUrl() {
  return requireUrl(
    "TARGET_DATABASE_URL 또는 SUPABASE_DATABASE_URL",
    process.env.TARGET_DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_DIRECT_URL,
  );
}

function ensureDifferentDatabases(sourceUrl, targetUrl) {
  if (sourceUrl === targetUrl) {
    throw new Error("SOURCE_DATABASE_URL과 TARGET_DATABASE_URL이 같습니다. 이전 작업을 중단합니다.");
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...(options.env || {}) },
    stdio: options.stdio || "inherit",
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} 명령이 실패했습니다. exit=${result.status}`);
  }

  return result;
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...(options.env || {}) },
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = sanitize(result.stderr || result.stdout || "");
    throw new Error(`${command} 명령이 실패했습니다. exit=${result.status}\n${stderr}`);
  }

  return result.stdout || "";
}

function sanitize(text) {
  const source = process.env.SOURCE_DATABASE_URL || "";
  const target =
    process.env.TARGET_DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_DIRECT_URL ||
    "";
  let output = String(text);
  for (const secret of [source, target, process.env.DATABASE_URL || ""]) {
    if (secret) output = output.split(secret).join("[REDACTED_DB_URL]");
  }
  output = output.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, "[REDACTED_DB_URL]");
  return output;
}

function ensureTools() {
  for (const command of ["pg_dump", "psql", "pg_restore"]) {
    const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
      cwd: rootDir,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`${command} 명령을 찾을 수 없습니다.`);
    }
  }
}

function psql(url, sql) {
  return runCapture(
    "psql",
    ["--dbname", url, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", sql],
  ).trim();
}

function testConnection(label, url) {
  const output = psql(url, "select current_database();");
  if (!output) {
    throw new Error(`${label} DB 연결 확인 결과가 비어 있습니다.`);
  }
  console.log(`${label} DB 연결: OK`);
}

function listPublicTables(url) {
  const output = psql(
    url,
    `
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name;
    `,
  );

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function tableCounts(url, options = {}) {
  const exclude = new Set(options.exclude || []);
  const tables = listPublicTables(url).filter((table) => !exclude.has(table));
  const counts = {};

  for (const table of tables) {
    const count = psql(url, `select count(*)::bigint from public.${quoteIdent(table)};`);
    counts[table] = Number(count);
  }

  return counts;
}

function totalRows(counts) {
  return Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0);
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`- ${table}: ${count}`);
  }
}

function preflight() {
  const sourceUrl = getSourceUrl();
  const targetUrl = getTargetUrl();
  ensureDifferentDatabases(sourceUrl, targetUrl);
  ensureTools();

  console.log("환경변수 상태:");
  console.log(`- SOURCE_DATABASE_URL: ${mask(process.env.SOURCE_DATABASE_URL)}`);
  console.log(`- DATABASE_URL source fallback: ${process.env.SOURCE_DATABASE_URL ? "not used" : mask(process.env.DATABASE_URL)}`);
  console.log(`- TARGET_DATABASE_URL: ${mask(process.env.TARGET_DATABASE_URL)}`);
  console.log(`- SUPABASE_DATABASE_URL fallback: ${process.env.TARGET_DATABASE_URL ? "not used" : mask(process.env.SUPABASE_DATABASE_URL)}`);
  console.log(`- SUPABASE_DIRECT_URL fallback: ${process.env.TARGET_DATABASE_URL || process.env.SUPABASE_DATABASE_URL ? "not used" : mask(process.env.SUPABASE_DIRECT_URL)}`);

  testConnection("source", sourceUrl);
  testConnection("target", targetUrl);

  console.log("\nPrisma schema 검증:");
  run("npm", ["run", "db:validate"]);

  console.log("\npreflight 완료");
}

function applySchema() {
  const sourceUrl = getSourceUrl();
  const targetUrl = getTargetUrl();
  ensureDifferentDatabases(sourceUrl, targetUrl);

  console.log("Supabase target DB에 Prisma migration을 적용합니다.");
  run("npx", ["prisma", "migrate", "deploy"], {
    env: {
      DATABASE_URL: targetUrl,
    },
  });
  console.log("schema 적용 완료");
}

function dumpData() {
  const sourceUrl = getSourceUrl();
  const targetUrl = getTargetUrl();
  ensureDifferentDatabases(sourceUrl, targetUrl);
  ensureTools();
  fs.mkdirSync(workDir, { recursive: true });

  const sourceCounts = tableCounts(sourceUrl, { exclude: ["_prisma_migrations"] });
  printCounts("source row counts before dump", sourceCounts);

  fs.writeFileSync(
    countsPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), sourceCounts }, null, 2),
  );

  console.log(`\n데이터 dump 생성: ${path.relative(rootDir, dumpPath)}`);
  run("pg_dump", [
    "--dbname",
    sourceUrl,
    "--format=custom",
    "--data-only",
    "--no-owner",
    "--no-privileges",
    "--schema=public",
    "--exclude-table=public._prisma_migrations",
    "--file",
    dumpPath,
  ]);

  const stat = fs.statSync(dumpPath);
  if (!stat.size) {
    throw new Error("dump 파일 크기가 0입니다.");
  }
  console.log(`dump 완료: ${stat.size} bytes`);
}

function assertTargetDataTablesEmpty(targetUrl) {
  const targetCounts = tableCounts(targetUrl, { exclude: ["_prisma_migrations"] });
  const rows = totalRows(targetCounts);
  printCounts("target row counts before restore", targetCounts);

  if (rows > 0 && process.env.ALLOW_NON_EMPTY_TARGET !== "true") {
    throw new Error(
      "target DB에 이미 데이터가 있습니다. 안전을 위해 restore를 중단합니다. " +
        "정말 덮어쓸 상황이면 별도로 검토한 뒤 ALLOW_NON_EMPTY_TARGET=true를 사용하세요.",
    );
  }
}

function restoreData() {
  const sourceUrl = getSourceUrl();
  const targetUrl = getTargetUrl();
  ensureDifferentDatabases(sourceUrl, targetUrl);
  ensureTools();

  if (!fs.existsSync(dumpPath)) {
    throw new Error(`dump 파일이 없습니다: ${path.relative(rootDir, dumpPath)}. 먼저 npm run db:supabase:dump를 실행하세요.`);
  }

  assertTargetDataTablesEmpty(targetUrl);

  console.log("\nSupabase target DB에 데이터를 복원합니다.");
  run("pg_restore", [
    "--data-only",
    "--no-owner",
    "--no-privileges",
    "--single-transaction",
    "--exit-on-error",
    "--dbname",
    targetUrl,
    dumpPath,
  ]);

  console.log("restore 완료");
}

function verify() {
  const sourceUrl = getSourceUrl();
  const targetUrl = getTargetUrl();
  ensureDifferentDatabases(sourceUrl, targetUrl);

  const sourceCounts = tableCounts(sourceUrl, { exclude: ["_prisma_migrations"] });
  const targetCounts = tableCounts(targetUrl, { exclude: ["_prisma_migrations"] });

  printCounts("source row counts", sourceCounts);
  printCounts("target row counts", targetCounts);

  const allTables = Array.from(
    new Set([...Object.keys(sourceCounts), ...Object.keys(targetCounts)]),
  ).sort();

  const mismatches = allTables.filter(
    (table) => Number(sourceCounts[table] || 0) !== Number(targetCounts[table] || 0),
  );

  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(
    countsPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCounts,
        targetCounts,
        mismatches,
      },
      null,
      2,
    ),
  );

  if (mismatches.length > 0) {
    console.error("\nrow count 불일치:");
    for (const table of mismatches) {
      console.error(`- ${table}: source=${sourceCounts[table] || 0}, target=${targetCounts[table] || 0}`);
    }
    throw new Error("DB 이전 검증 실패");
  }

  console.log("\nDB 이전 검증 통과: source와 target의 public table row count가 일치합니다.");
}

function usage() {
  console.log(`
사용법:
  npm run db:supabase:preflight
  npm run db:supabase:apply-schema
  npm run db:supabase:dump
  npm run db:supabase:restore
  npm run db:supabase:verify
  npm run db:supabase:all

필요 환경변수:
  SOURCE_DATABASE_URL  현재 Replit DB URL. 없으면 DATABASE_URL을 source로 사용합니다.
  TARGET_DATABASE_URL  새 Supabase DB URL.

주의:
  - 실제 DB URL은 출력하지 않습니다.
  - target DB에 앱 데이터가 이미 있으면 restore를 중단합니다.
  - Cloudinary 파일/이미지 코드는 변경하지 않습니다.
`);
}

function main() {
  const command = process.argv[2] || "help";

  try {
    if (command === "preflight") return preflight();
    if (command === "apply-schema") return applySchema();
    if (command === "dump") return dumpData();
    if (command === "restore") return restoreData();
    if (command === "verify") return verify();
    if (command === "all") {
      preflight();
      applySchema();
      dumpData();
      restoreData();
      verify();
      return;
    }

    usage();
  } catch (error) {
    console.error(`\n실패: ${sanitize(error && error.message ? error.message : error)}`);
    process.exit(1);
  }
}

main();
