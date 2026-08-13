import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const preferredApiPort = Number(process.env.PORT ?? 8787);
const apiPort = await findAvailablePort(preferredApiPort);
const preferredWebPort = Number(process.env.VITE_PORT ?? 3000);
const webPort = await findAvailablePort(preferredWebPort, new Set([apiPort]));

if (apiPort !== preferredApiPort) {
  console.log(`[api] port ${preferredApiPort} is in use, trying ${apiPort}...`);
}
if (webPort !== preferredWebPort) {
  console.log(`[web] port ${preferredWebPort} is in use, trying ${webPort}...`);
}

const commands = [
  {
    name: "web",
    command: "bun run dev:web",
    env: {
      ...process.env,
      VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
      VITE_PORT: String(webPort)
    }
  },
  {
    name: "electron",
    command: "bun run dev:electron",
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: `http://127.0.0.1:${webPort}`,
      ELECTRON_API_PORT: String(apiPort)
    }
  }
];

let shuttingDown = false;

const processes = commands.map(({ name, command, env }) => {
  const child = spawn(command, {
    cwd: process.cwd(),
    env,
    shell: true,
    stdio: ["inherit", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => writeLines(name, chunk));
  child.stderr.on("data", (chunk) => writeLines(name, chunk));
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.log(`[${name}] exited ${signal ?? code ?? 0}`);
    shutdown(code ?? 1);
  });

  return child;
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function writeLines(name, chunk) {
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line.trim()) console.log(`[${name}] ${line}`);
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) {
    if (child.killed) continue;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill();
    }
  }
  setTimeout(() => process.exit(code), 250);
}

async function findAvailablePort(startPort, excludedPorts = new Set()) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (excludedPorts.has(port)) continue;
    if (await canListen(port)) return port;
  }

  throw new Error(`No available API port found from ${startPort} to ${startPort + 99}`);
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}
