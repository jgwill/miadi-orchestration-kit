#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { createMiadiNetworkHub } from "./src/hub.ts";
import { DEFAULT_PORT } from "./src/protocol.ts";

const token = process.env.MIADI_PI_NETWORK_TOKEN;
if (!token) {
  console.error("MIADI_PI_NETWORK_TOKEN is required. Generate one with: openssl rand -hex 32");
  process.exit(1);
}

const hostname = process.env.MIADI_PI_NETWORK_HOST ?? "127.0.0.1";
const rawPort = Number(process.env.MIADI_PI_NETWORK_PORT ?? DEFAULT_PORT);
if (!Number.isInteger(rawPort) || rawPort < 0 || rawPort > 65_535) {
  console.error("MIADI_PI_NETWORK_PORT must be an integer from 0 to 65535");
  process.exit(1);
}

const configuredStore = process.env.MIADI_PI_NETWORK_STORE;
const storePath = configuredStore === ":memory:"
  ? null
  : configuredStore ?? join(homedir(), ".miadi", "pi-network", "hub-state.json");

const hub = await createMiadiNetworkHub({
  hostname,
  port: rawPort,
  token,
  storePath,
});

let stopping = false;
async function stop(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`Stopping Miadi Pi network hub (${signal})`);
  await hub.stop();
  process.exit(0);
}

process.on("SIGINT", () => void stop("SIGINT"));
process.on("SIGTERM", () => void stop("SIGTERM"));
