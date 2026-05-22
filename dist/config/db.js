"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.pingDatabase = pingDatabase;
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("./env");
console.log({
    ...env_1.env.db,
});
exports.pool = promise_1.default.createPool({
    ...env_1.env.db,
    waitForConnections: true,
    connectionLimit: 10,
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
