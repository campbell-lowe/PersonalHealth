import sqlite3 from "sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "cycleTracker.db");

const db = new sqlite3.Database(dbPath);

const sql = `
INSERT INTO cycle_entries (
  username, date, cycle_day, ovulation_confirmed
)
VALUES (?, ?, ?, ?)
ON CONFLICT(username, date) DO UPDATE SET
  cycle_day = COALESCE(excluded.cycle_day, cycle_day),
  ovulation_confirmed = COALESCE(excluded.ovulation_confirmed, ovulation_confirmed);
`;

db.run(sql, ["campbell.lowe", "2026-07-23", 13, 0], function (err) {
  if (err) {
    console.error("DB_TEST_ERROR", err.message);
  } else {
    console.log("DB_TEST_OK", this.lastID);
  }

  db.close();
});
