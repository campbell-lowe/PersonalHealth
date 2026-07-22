import express from "express";
import db from "../database.js";

const router = express.Router();

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
      cycleNumber: row.cycle_number,
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

router.post("/", (req, res) => {
  const {
    date,
    cycleNumber,
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
    cycle_number,
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
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

ON CONFLICT(date) DO UPDATE SET
    cycle_number = excluded.cycle_number,
    cycle_day = excluded.cycle_day,
    wrist_temp = excluded.wrist_temp,
    thermometer_temp = excluded.thermometer_temp,
    lh_morning = excluded.lh_morning,
    lh_night = excluded.lh_night,
    cm_amount = excluded.cm_amount,
    cm_type = excluded.cm_type,
    bleeding = excluded.bleeding,
    intercourse = excluded.intercourse,
    pregnancy_test = excluded.pregnancy_test,
    symptoms = excluded.symptoms,
    medications = excluded.medications,
    weight = excluded.weight,
    sleep_hours = excluded.sleep_hours,
    notes = excluded.notes;
`;
  db.run(
    sql,
    [
      date,
      cycleNumber,
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