import { app } from "./app";
import { env } from "./config/env";
import { pingDatabase } from "./config/db";
import { logger } from "./utils/logger";

async function start() {
  await pingDatabase();
  app.listen(env.port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});
