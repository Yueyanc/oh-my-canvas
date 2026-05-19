import { createApiApp } from "./app";
import { createDb } from "@information/db";
import { createChildLogger } from "@information/logger";

const db = createDb();
const log = createChildLogger("api");
const port = Number(process.env.PORT ?? 8787);

log.info("api server configured", { port });

export default {
  port,
  fetch: createApiApp(db).fetch
};
