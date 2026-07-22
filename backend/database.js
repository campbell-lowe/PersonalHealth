import sqlite3 from "sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "cycleTracker.db");
const schemaPath = path.join(__dirname, "schema.sql");

const db = new sqlite3.Database(dbPath);

const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema, (error) => {
    if (error) {
        console.error("Database setup failed:", error);
    } else {
        console.log("Database ready!");
    }
});

export default db;