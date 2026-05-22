const fs = require("fs/promises");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

const config = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "invoice_maker",
  adminUser: process.env.DB_ADMIN_USER || process.env.DB_USER || "root",
  adminPassword: process.env.DB_ADMIN_PASSWORD ?? process.env.DB_PASSWORD ?? "",
};

async function runSqlFile(connection, filePath) {
  const sql = await fs.readFile(filePath, "utf8");
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function main() {
  const shouldSeed = process.argv.includes("--seed");
  const root = path.resolve(__dirname, "..");
  const migrationsDir = path.join(root, "database", "migrations");
  const seedPath = path.join(root, "database", "seeds", "seed.sql");

  const serverConnection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.adminUser,
    password: config.adminPassword,
    multipleStatements: false,
  });

  await serverConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );

  if (config.user !== config.adminUser) {
    const appUser = serverConnection.escape(config.user);
    const appPassword = serverConnection.escape(config.password);
    await serverConnection.query(`CREATE USER IF NOT EXISTS ${appUser}@'%' IDENTIFIED BY ${appPassword}`);
    await serverConnection.query(`CREATE USER IF NOT EXISTS ${appUser}@'localhost' IDENTIFIED BY ${appPassword}`);
    await serverConnection.query(`GRANT ALL PRIVILEGES ON \`${config.database}\`.* TO ${appUser}@'%'`);
    await serverConnection.query(`GRANT ALL PRIVILEGES ON \`${config.database}\`.* TO ${appUser}@'localhost'`);
    await serverConnection.query("FLUSH PRIVILEGES");
  }
  await serverConnection.end();

  const dbConnection = await mysql.createConnection({
    ...config,
    multipleStatements: false,
  });

  const migrationFiles = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    await runSqlFile(dbConnection, path.join(migrationsDir, file));
  }

  if (shouldSeed) {
    await runSqlFile(dbConnection, seedPath);
  }

  await dbConnection.end();

  console.log(`Database "${config.database}" is ready.`);
  console.log(`Applied migrations: ${migrationFiles.join(", ")}.`);
  if (shouldSeed) console.log("Seed data inserted or updated.");
}

main().catch((error) => {
  console.error("Database setup failed:");
  console.error(error.message || error);
  if (error.code) console.error(`Code: ${error.code}`);
  if (error.errno) console.error(`Errno: ${error.errno}`);
  if (error.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("Fix: update invoice-backend/.env with valid DB_ADMIN_USER and DB_ADMIN_PASSWORD. If the app user already exists, DB_USER and DB_PASSWORD are enough.");
  }
  if (error.code === "ECONNREFUSED") {
    console.error("Fix: start MySQL first. With Docker, run: docker compose up -d mysql");
  }
  process.exit(1);
});
