import { app } from "./app";
import { pool } from "./config/db";
import { env } from "./config/env";

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${env.port}`);
});

// async function shutdown(signal: string) {
//   console.log(`${signal}: closing HTTP server and MySQL pool…`);
//   server.close(async () => {
//     try {
//       await pool.end();
//     } finally {
//       process.exit(0);
//     }
//   });
//   setTimeout(() => process.exit(1), 10_000).unref();
// }

// process.on("SIGTERM", () => void shutdown("SIGTERM"));
// process.on("SIGINT", () => void shutdown("SIGINT"));
