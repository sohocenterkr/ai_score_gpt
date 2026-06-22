#!/usr/bin/env node

const { spawn } = require("node:child_process");

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/runtime/use-target-database-url.cjs <command> [...args]");
  process.exit(1);
}

const env = { ...process.env };

if (env.TARGET_DATABASE_URL) {
  env.DATABASE_URL = env.TARGET_DATABASE_URL;
  try {
    const url = new URL(env.TARGET_DATABASE_URL);
    const hostKind = url.hostname.includes("pooler.supabase.com")
      ? "supabase pooler"
      : url.hostname.endsWith(".supabase.co")
        ? "supabase direct"
        : "custom target";
    console.log(`[db] TARGET_DATABASE_URL을 DATABASE_URL로 사용합니다. (${hostKind})`);
  } catch {
    console.log("[db] TARGET_DATABASE_URL을 DATABASE_URL로 사용합니다.");
  }
} else {
  console.log("[db] TARGET_DATABASE_URL이 없어 기존 DATABASE_URL을 사용합니다.");
}

const child = spawn(command, args, {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
