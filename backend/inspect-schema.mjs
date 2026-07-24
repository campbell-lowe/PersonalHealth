import sqlite3 from "sqlite3";

const db = new sqlite3.Database("cycleTracker.db");

db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='cycle_entries'", (err, row) => {
  if (err) {
    console.error(err);
    db.close();
    return;
  }

  console.log("TABLE_SQL", row?.sql);

  db.all("PRAGMA index_list(cycle_entries)", (indexErr, indexes) => {
    if (indexErr) {
      console.error(indexErr);
      db.close();
      return;
    }

    console.log("INDEX_LIST", indexes);

    if (!indexes || indexes.length === 0) {
      db.close();
      return;
    }

    let pending = indexes.length;

    indexes.forEach((indexRow) => {
      db.all(`PRAGMA index_info(${indexRow.name})`, (infoErr, columns) => {
        if (infoErr) {
          console.error(infoErr);
        } else {
          console.log("INDEX_INFO", indexRow.name, columns);
        }

        pending -= 1;
        if (pending === 0) {
          db.close();
        }
      });
    });
  });
});
