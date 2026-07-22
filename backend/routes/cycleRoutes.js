import express from "express";
import db from "../database.js";

const router = express.Router();

//
// GET ALL ENTRIES
//
router.get("/", (req, res) => {
  const sql = `
    SELECT *
    FROM cycle_entries
    ORDER BY date;
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error(err);

      return res.status(500).json({
        error: err.message,
      });
    }

    const entries = rows.map((row) => ({
      id: row.id,
      date: row.date,
      cycleDay: row.cycle_day,
      wristTemp: row.wrist_temp,
      thermometerTemp: row.thermometer_temp,
      lhMorning: row.lh_morning,
      lhNight: row.lh_night,
      cmAmount: row.cm_amount,
      cmType: row.cm_type,
      bleeding: row.bleeding,
      intercourse: Boolean(row.intercourse),
      pregnancyTest: row.pregnancy_test,
      symptoms: JSON.parse(row.symptoms || "[]"),
      medications: JSON.parse(row.medications || "[]"),
      weight: row.weight,
      sleepHours: row.sleep_hours,
      notes: row.notes,
    }));

    res.json(entries);
  });
});

//
// GET ONE ENTRY BY DATE
//
router.get("/:date", (req, res) => {
  db.get(
    "SELECT * FROM cycle_entries WHERE date = ?",
    [req.params.date],
    (err, row) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          error: err.message,
        });
      }

      if (!row) {
        return res.status(404).json({
          message: "No entry found.",
        });
      }

      res.json({
        id: row.id,
        date: row.date,
        cycleDay: row.cycle_day,
        wristTemp: row.wrist_temp,
        thermometerTemp: row.thermometer_temp,
        lhMorning: row.lh_morning,
        lhNight: row.lh_night,
        cmAmount: row.cm_amount,
        cmType: row.cm_type,
        bleeding: row.bleeding,
        intercourse: Boolean(row.intercourse),
        pregnancyTest: row.pregnancy_test,
        symptoms: JSON.parse(row.symptoms || "[]"),
        medications: JSON.parse(row.medications || "[]"),
        weight: row.weight,
        sleepHours: row.sleep_hours,
        notes: row.notes,
      });
    }
  );
});

//
// CREATE OR UPDATE ENTRY
//
router.post("/", (req, res) => {
  const {
    date,
    cycleDay,
    wristTemp,
    thermometerTemp,
    lhMorning,
    lhNight,
    cmAmount,
    cmType,
    bleeding,
    intercourse,
    pregnancyTest,
    symptoms,
    medications,
    weight,
    sleepHours,
    notes,
  } = req.body;

  const sql = `
    INSERT INTO cycle_entries (
      date,
      cycle_day,
      wrist_temp,
      thermometer_temp,
      lh_morning,
      lh_night,
      cm_amount,
      cm_type,
      bleeding,
      intercourse,
      pregnancy_test,
      symptoms,
      medications,
      weight,
      sleep_hours,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

    ON CONFLICT(date) DO UPDATE SET
      cycle_day         = COALESCE(excluded.cycle_day, cycle_day),
      wrist_temp        = COALESCE(excluded.wrist_temp, wrist_temp),
      thermometer_temp  = COALESCE(excluded.thermometer_temp, thermometer_temp),
      lh_morning        = COALESCE(excluded.lh_morning, lh_morning),
      lh_night          = COALESCE(excluded.lh_night, lh_night),
      cm_amount         = COALESCE(excluded.cm_amount, cm_amount),
      cm_type           = COALESCE(excluded.cm_type, cm_type),
      bleeding          = COALESCE(excluded.bleeding, bleeding),
      intercourse       = COALESCE(excluded.intercourse, intercourse),
      pregnancy_test    = COALESCE(excluded.pregnancy_test, pregnancy_test),
      symptoms          = COALESCE(excluded.symptoms, symptoms),
      medications       = COALESCE(excluded.medications, medications),
      weight            = COALESCE(excluded.weight, weight),
      sleep_hours       = COALESCE(excluded.sleep_hours, sleep_hours),
      notes             = COALESCE(excluded.notes, notes);
  `;

  db.run(
    sql,
    [
      date,
      cycleDay,
      wristTemp,
      thermometerTemp,
      lhMorning,
      lhNight,
      cmAmount,
      cmType,
      bleeding,
      intercourse,
      pregnancyTest,
      JSON.stringify(symptoms),
      JSON.stringify(medications),
      weight,
      sleepHours,
      notes,
    ],
    function (err) {
      if (err) {
        console.error(err);

        return res.status(500).json({
          error: err.message,
        });
      }

      res.json({
        success: true,
        id: this.lastID,
      });
    }
  );
});

export default router;