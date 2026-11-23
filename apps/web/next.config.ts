import fs from "fs";
import path from "path";
import type { NextConfig } from "next";

function loadRootPublicEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), "../../.env");
  const result: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return result;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eqIdx = line.indexOf("=");
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key.startsWith("NEXT_PUBLIC_") && !process.env[key]) {
      result[key] = val;
    }
  }
  return result;
}

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  env: loadRootPublicEnv(),
};

export default nextConfig;
