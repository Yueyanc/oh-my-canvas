import { collectRadar, loadRadarConfig } from "@information/core";
import { createDb } from "@information/db";
import { createChildLogger, errorMeta } from "@information/logger";

const db = createDb();
const log = createChildLogger("collect-cli");

try {
  log.info("manual collection command started");
  const config = await loadRadarConfig();
  const result = await collectRadar(db, config);
  log.info("manual collection command finished", result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  log.error("manual collection command failed", errorMeta(error));
  throw error;
}
