import { createApiApp } from "./app";
import { createDb } from "@information/db";
import { createChildLogger } from "@information/logger";
import { getSchedulerState, startAutoCollector } from "./scheduler";

const db = createDb();
const log = createChildLogger("api");
const port = Number(process.env.PORT ?? 3000);

startAutoCollector(db);
log.info("api server configured", { port, scheduler: getSchedulerState() });

export default {
  port,
  fetch: createApiApp(db).fetch
};
