import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

const preferredApiPort = Number(process.env.PORT ?? 8787);
const apiPort = await findAvailablePort(preferredApiPort);

if (apiPort !== preferredApiPort) {
  console.log(`[api] port ${preferredApiPort} is in use, trying ${apiPort}...`);
}

const commands = [
  {
    name: "api",
    command: "bun run dev:api",
    env: { ...process.env, PORT: String(apiPort) }
  },
  {
    name: "web",
    command: "bun run dev:web",
    env: {
      ...process.env,
      VITE_API_PROXY_TARGET: `http://localhost:${apiPort}`
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

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 100; port += 1) {
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
    server.listen(port);
  });
}
