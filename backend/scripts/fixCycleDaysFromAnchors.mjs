import sqlite3 from "sqlite3";
import path from "node:path";
import fs from "node:fs";

const dbPath = path.join(process.cwd(), "backend", "cycleTracker.db");
const backupPath = path.join(process.cwd(), "backend", "cycleTracker.before-cycleday-fix.db");

const anchors = ["2026-04-28", "2026-06-25", "2026-07-24"];
const username = "campbell.lowe";
const firstAnchor = anchors[0];

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(dbPath, backupPath);
}

const db = new sqlite3.Database(dbPath);

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00`).getTime();
}

function computeCycleDay(dateString) {
  if (!dateString) return null;

  const targetTime = parseDate(dateString);
  let activeAnchor = null;

  for (const anchor of anchors) {
    if (parseDate(anchor) <= targetTime) {
      activeAnchor = anchor;
    }
  }

  if (!activeAnchor) {
    return null;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((targetTime - parseDate(activeAnchor)) / dayMs) + 1;
}

async function main() {
  try {
    const rows = await all(
      "SELECT id, date, cycle_day FROM cycle_entries WHERE username = ? ORDER BY date",
      [username]
    );

    await run("BEGIN TRANSACTION");

    let updated = 0;
    for (const row of rows) {
      const nextCycleDay = computeCycleDay(row.date);

      if (nextCycleDay !== null && row.cycle_day !== nextCycleDay) {
        await run("UPDATE cycle_entries SET cycle_day = ? WHERE id = ?", [
          nextCycleDay,
          row.id,
        ]);
        updated += 1;
      }
    }

    // Clear any pre-anchor cycle-day values so only anchor-driven cycles are used.
    await run(
      "UPDATE cycle_entries SET cycle_day = NULL WHERE username = ? AND date < ?",
      [username, firstAnchor]
    );

    await run("COMMIT");

    const around0428 = await all(
      "SELECT date, cycle_day FROM cycle_entries WHERE username = ? AND date BETWEEN '2026-04-26' AND '2026-04-30' ORDER BY date",
      [username]
    );

    const cycleDayOnes = await all(
      "SELECT date, cycle_day FROM cycle_entries WHERE username = ? AND cycle_day = 1 ORDER BY date",
      [username]
    );

    const around0625 = await all(
      "SELECT date, cycle_day FROM cycle_entries WHERE username = ? AND date BETWEEN '2026-06-24' AND '2026-06-27' ORDER BY date",
      [username]
    );

    const around0724 = await all(
      "SELECT date, cycle_day FROM cycle_entries WHERE username = ? AND date BETWEEN '2026-07-23' AND '2026-07-25' ORDER BY date",
      [username]
    );

    console.log(
      JSON.stringify(
        {
          updated,
          anchors,
          around0428,
          around0625,
          around0724,
          cycleDayOnes,
        },
        null,
        2
      )
    );
  } catch (error) {
    try {
      await run("ROLLBACK");
    } catch {
      // Ignore rollback errors after failed transaction setup.
    }

    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
