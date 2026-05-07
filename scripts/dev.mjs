import { spawn, spawnSync } from "node:child_process";

const commands = [
  ["api", "bun run dev:api"],
  ["web", "bun run dev:web"]
];

let shuttingDown = false;

const processes = commands.map(([name, command]) => {
  const child = spawn(command, {
    cwd: process.cwd(),
    env: process.env,
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
