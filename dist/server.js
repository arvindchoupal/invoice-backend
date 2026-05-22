"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const logger_1 = require("./utils/logger");
async function start() {
    await (0, db_1.pingDatabase)();
    app_1.app.listen(env_1.env.port, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${env_1.env.port}`);
    });
}
start().catch((error) => {
    logger_1.logger.error("Failed to start server", { error });
    process.exit(1);
});
