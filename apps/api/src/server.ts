import { createApiApp } from "./app";
import { createDb } from "@oh-my-canvas/db";
import { createChildLogger } from "@oh-my-canvas/logger";

const db = createDb();
const log = createChildLogger("api");
const port = Number(process.env.PORT ?? 8787);

log.info("api server configured", { port });

export default {
  port,
  fetch: createApiApp(db).fetch
};
