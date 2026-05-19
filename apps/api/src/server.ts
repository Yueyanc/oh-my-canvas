import { createApiApp } from "./app";
import { createDb } from "@template/db";
import { createChildLogger } from "@template/logger";

const db = createDb();
const log = createChildLogger("api");
const port = Number(process.env.PORT ?? 8787);

log.info("api server configured", { port });

export default {
  port,
  fetch: createApiApp(db).fetch
};
