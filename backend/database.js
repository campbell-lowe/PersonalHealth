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

function ensureColumn(tableName, columnName, columnDefinition) {
    db.all(`PRAGMA table_info(${tableName});`, (pragmaError, rows) => {
        if (pragmaError) {
            console.error(`Could not inspect ${tableName}:`, pragmaError);
            return;
        }

        const hasColumn = rows.some((row) => row.name === columnName);
        if (hasColumn) {
            return;
        }

        db.run(
            `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`,
            (alterError) => {
                if (alterError) {
                    console.error(`Could not add ${columnName}:`, alterError);
                } else {
                    console.log(`Added missing column ${columnName} to ${tableName}.`);
                }
            }
        );
    });
}

function ensureUsernameDateUniqueConstraint() {
    db.get(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cycle_entries';",
        (tableError, tableDefinition) => {
            if (tableError) {
                console.error("Could not inspect cycle_entries table definition:", tableError);
                return;
            }

            const createSql = tableDefinition?.sql || "";
            if (createSql.includes("UNIQUE(username, date)")) {
                return;
            }

            db.exec(
                `
                BEGIN TRANSACTION;

                ALTER TABLE cycle_entries RENAME TO cycle_entries_old;

                CREATE TABLE cycle_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL DEFAULT 'campbell.lowe',
                    date TEXT NOT NULL,
                    cycle_day INTEGER,
                    sick BOOLEAN DEFAULT 0,
                    wrist_temp REAL,
                    thermometer_temp REAL,
                    lh_morning REAL,
                    lh_afternoon REAL,
                    lh_night REAL,
                    ovulation_confirmed BOOLEAN,
                    cm_amount TEXT,
                    cm_type TEXT,
                    period BOOLEAN,
                    bleeding TEXT,
                    sex_drive TEXT,
                    skin_status TEXT,
                    pain_symptoms TEXT,
                    mood_emotions TEXT,
                    intercourse BOOLEAN,
                    used_protection BOOLEAN,
                    protection_type TEXT,
                    pregnancy_test TEXT,
                    symptoms TEXT,
                    medications TEXT,
                    weight REAL,
                    sleep_hours REAL,
                    notes TEXT,
                    UNIQUE(username, date)
                );

                INSERT INTO cycle_entries (
                    id,
                    username,
                    date,
                    cycle_day,
                    wrist_temp,
                    thermometer_temp,
                    lh_morning,
                    lh_afternoon,
                    lh_night,
                    ovulation_confirmed,
                    cm_amount,
                    cm_type,
                    period,
                    bleeding,
                    sex_drive,
                    skin_status,
                    pain_symptoms,
                    mood_emotions,
                    intercourse,
                    used_protection,
                    protection_type,
                    pregnancy_test,
                    symptoms,
                    medications,
                    weight,
                    sleep_hours,
                    notes
                )
                SELECT
                    id,
                    COALESCE(username, 'campbell.lowe') AS username,
                    date,
                    cycle_day,
                    wrist_temp,
                    thermometer_temp,
                    lh_morning,
                    lh_afternoon,
                    lh_night,
                    ovulation_confirmed,
                    cm_amount,
                    cm_type,
                    period,
                    bleeding,
                    sex_drive,
                    skin_status,
                    pain_symptoms,
                    mood_emotions,
                    intercourse,
                    used_protection,
                    protection_type,
                    pregnancy_test,
                    symptoms,
                    medications,
                    weight,
                    sleep_hours,
                    notes
                FROM cycle_entries_old;

                DROP TABLE cycle_entries_old;

                COMMIT;
                `,
                (migrationError) => {
                    if (migrationError) {
                        console.error("Could not migrate cycle_entries uniqueness to username+date:", migrationError);
                    } else {
                        console.log("Updated cycle_entries uniqueness to username + date.");
                    }
                }
            );
        }
    );
}

db.exec(schema, (error) => {
    if (error) {
        console.error("Database setup failed:", error);
    } else {
        console.log("Database ready!");

        ensureColumn("cycle_entries", "sex_drive", "TEXT");
        ensureColumn("cycle_entries", "username", "TEXT NOT NULL DEFAULT 'campbell.lowe'");
        ensureColumn("cycle_entries", "skin_status", "TEXT");
        ensureColumn("cycle_entries", "pain_symptoms", "TEXT");
        ensureColumn("cycle_entries", "mood_emotions", "TEXT");
        ensureColumn("cycle_entries", "lh_afternoon", "REAL");
        ensureColumn("cycle_entries", "sick", "BOOLEAN DEFAULT 0");
        ensureColumn("cycle_entries", "ovulation_confirmed", "BOOLEAN");
        ensureColumn("cycle_entries", "period", "BOOLEAN");
        ensureColumn("cycle_entries", "used_protection", "BOOLEAN");
        ensureColumn("cycle_entries", "protection_type", "TEXT");
        ensureUsernameDateUniqueConstraint();
    }
});

export default db;