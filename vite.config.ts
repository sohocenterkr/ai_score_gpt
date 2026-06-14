import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function normalizeHostname(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );

    return url.hostname;
  } catch {
    return undefined;
  }
}

const replitAllowedHosts = [
  normalizeHostname(process.env.REPLIT_DEV_DOMAIN),
  ...(process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((value) => normalizeHostname(value)),
].filter((value): value is string => Boolean(value));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/public",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: [...new Set(replitAllowedHosts)],
  },
});
