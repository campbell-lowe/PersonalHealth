import sqlite3 from "sqlite3";
import fs from "fs";

const db = new sqlite3.Database("./cycleTracker.db");

const schema = fs.readFileSync("./schema.sql", "utf8");

db.exec(schema, (error) => {
    if (error) {
        console.error("Database setup failed:", error);
    } else {
        console.log("Database ready!");
    }
});

export default db;