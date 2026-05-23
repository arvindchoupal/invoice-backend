"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
// async function start() {
//   // await pingDatabase();
//   app.listen(env.port, "0.0.0.0", () => {
//     console.log(`Server running on http://localhost:${env.port}`);
//   });
// }
// start().catch((error) => {
//   logger.error("Failed to start server", { error });
//   process.exit(1);
// });
app_1.app.listen(env_1.env.port, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${env_1.env.port}`);
});
