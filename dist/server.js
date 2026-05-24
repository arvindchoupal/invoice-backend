"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const server = app_1.app.listen(env_1.env.port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${env_1.env.port}`);
});
async function shutdown(signal) {
    console.log(`${signal}: closing HTTP server and MySQL pool…`);
    server.close(async () => {
        try {
            await db_1.pool.end();
        }
        finally {
            process.exit(0);
        }
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
