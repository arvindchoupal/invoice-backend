"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.pingDatabase = pingDatabase;
exports.withTransaction = withTransaction;
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("./env");
exports.pool = promise_1.default.createPool({
    host: env_1.env.db.host,
    port: env_1.env.db.port,
    user: env_1.env.db.user,
    password: env_1.env.db.password,
    database: env_1.env.db.database,
    waitForConnections: true,
    connectionLimit: env_1.env.db.connectionLimit,
    queueLimit: env_1.env.db.queueLimit,
    maxIdle: env_1.env.db.connectionLimit,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    namedPlaceholders: true,
    decimalNumbers: true,
});
async function pingDatabase() {
    const connection = await exports.pool.getConnection();
    try {
        await connection.ping();
    }
    finally {
        connection.release();
    }
}
async function withTransaction(fn) {
    const connection = await exports.pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await fn(connection);
        await connection.commit();
        return result;
    }
    catch (error) {
        try {
            await connection.rollback();
        }
        catch {
            // No active transaction (e.g. validation failed before beginTransaction in caller).
        }
        throw error;
    }
    finally {
        connection.release();
    }
}
