import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(projectRoot, "apps/electron/dist");

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const sharedOptions = {
  bundle: true,
  external: ["better-sqlite3", "electron"],
  logLevel: "info",
  platform: "node",
  sourcemap: true,
  target: "node22",
  tsconfig: resolve(projectRoot, "tsconfig.json")
};

await Promise.all([
  build({
    ...sharedOptions,
    entryPoints: [resolve(projectRoot, "apps/electron/src/main.ts")],
    format: "cjs",
    outfile: resolve(outputDirectory, "main.cjs")
  }),
  build({
    ...sharedOptions,
    entryPoints: [resolve(projectRoot, "apps/electron/src/preload.ts")],
    format: "cjs",
    outfile: resolve(outputDirectory, "preload.cjs")
  })
]);
