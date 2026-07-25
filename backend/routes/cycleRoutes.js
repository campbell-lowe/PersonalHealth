import express from "express";
import db from "../database.js";

const router = express.Router();

function parseMultiSelectField(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (typeof parsed === "string" && parsed) {
        return [parsed];
      }
    } catch {
      return [value];
    }
  }

  return [];
}

function toLhNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getEntryLhPeak(entry) {
  const morning = toLhNumber(entry.lhMorning);
  const afternoon = toLhNumber(entry.lhAfternoon);
  const night = toLhNumber(entry.lhNight);

  if (morning === null && afternoon === null && night === null) {
    return null;
  }

  return Math.max(morning ?? -Infinity, afternoon ?? -Infinity, night ?? -Infinity);
}

function deriveOvulationTest(entry) {
  const lhPeak = getEntryLhPeak(entry);
  if (lhPeak === null) {
    return "none";
  }

  if (lhPeak >= 1) {
    return "positive";
  }

  if (lhPeak >= 0.6) {
    return "negative-high";
  }

  return "negative-low";
}

function isCycleStart(entry) {
  // Treat day 1 as a cycle boundary even if period flag was missed.
  return Number(entry.cycleDay) === 1;
}

function mapRowToEntry(row) {
  return {
    id: row.id,
    username: row.username,
    date: row.date,
    cycleDay: row.cycle_day,
    sick: row.sick === null ? false : Boolean(row.sick),
    wristTemp: row.wrist_temp,
    thermometerTemp: row.thermometer_temp,
    lhMorning: row.lh_morning,
    lhAfternoon: row.lh_afternoon,
    lhNight: row.lh_night,
    ovulationConfirmed:
      row.ovulation_confirmed === null ? null : Boolean(row.ovulation_confirmed),
    cmAmount: row.cm_amount,
    cmType: row.cm_type,
    period: row.period === null ? null : Boolean(row.period),
    bleeding: row.bleeding || "none",
    sexDrive: row.sex_drive,
    skinStatus: row.skin_status,
    painSymptoms: parseMultiSelectField(row.pain_symptoms),
    moodEmotions: parseMultiSelectField(row.mood_emotions),
    intercourse: row.intercourse === null ? null : Boolean(row.intercourse),
    usedProtection:
      row.used_protection === null ? null : Boolean(row.used_protection),
    protectionType: row.protection_type,
    pregnancyTest: row.pregnancy_test || "not_taken",
    symptoms: JSON.parse(row.symptoms || "[]"),
    medications: JSON.parse(row.medications || "[]"),
    weight: row.weight,
    sleepHours: row.sleep_hours,
    notes: row.notes,
  };
}

function applyDerivedOvulationFields(entries) {
  const groupedByUsername = new Map();

  entries.forEach((entry) => {
    const key = entry.username || "";
    if (!groupedByUsername.has(key)) {
      groupedByUsername.set(key, []);
    }
    groupedByUsername.get(key).push(entry);
  });

  const derivedById = new Map();

  groupedByUsername.forEach((group) => {
    const sorted = [...group].sort((a, b) => (a.date > b.date ? 1 : -1));

    let cycle = [];
    const flushCycle = () => {
      if (cycle.length === 0) {
        return;
      }

      const lhPeaks = cycle
        .map((entry) => getEntryLhPeak(entry))
        .filter((value) => value !== null);
      const cyclePeak = lhPeaks.length > 0 ? Math.max(...lhPeaks) : null;

      cycle.forEach((entry) => {
        const entryPeak = getEntryLhPeak(entry);
        const derived = {
          ...entry,
          ovulationTest: deriveOvulationTest(entry),
          peak:
            entryPeak !== null && cyclePeak !== null
              ? entryPeak === cyclePeak
              : false,
        };

        derivedById.set(entry.id, derived);
      });

      cycle = [];
    };

    sorted.forEach((entry) => {
      if (cycle.length > 0 && isCycleStart(entry)) {
        flushCycle();
      }

      cycle.push(entry);
    });

    flushCycle();
  });

  return entries.map((entry) => {
    const derived = derivedById.get(entry.id);
    if (derived) {
      return derived;
    }

    return {
      ...entry,
      ovulationTest: deriveOvulationTest(entry),
      peak: false,
    };
  });
}

function sendSavedEntryResponse(res, username, date, saveMeta = {}) {
  db.all(
    "SELECT * FROM cycle_entries WHERE username = ? ORDER BY date",
    [username],
    (lookupError, rows) => {
      if (lookupError) {
        console.error(lookupError);
        return res.json({
          success: true,
          ...saveMeta,
        });
      }

      const entries = applyDerivedOvulationFields(rows.map(mapRowToEntry));
      const savedEntry = entries.find((item) => item.date === date) || null;

      res.json({
        success: true,
        ...saveMeta,
        entry: savedEntry,
      });
    }
  );
}

function toPreviousDate(dateString) {
  const current = new Date(`${dateString}T00:00:00`);
  current.setDate(current.getDate() - 1);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isTrueLike(value) {
  return value === true || value === 1 || value === "1" || value === "true" || value === "yes";
}

function normalizeCycleDayValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const day = Math.floor(numeric);
  return day >= 1 ? day : null;
}

function resolveCycleDayForSave(db, username, date, period, requestedCycleDay, callback) {
  const normalizedRequestedCycleDay = normalizeCycleDayValue(requestedCycleDay);

  // Respect explicit user input and do not auto-rewrite it.
  if (normalizedRequestedCycleDay !== null) {
    callback(normalizedRequestedCycleDay);
    return;
  }

  if (!isTrueLike(period)) {
    callback(null);
    return;
  }

  const previousDate = toPreviousDate(date);

  db.get(
    "SELECT period FROM cycle_entries WHERE username = ? AND date = ?",
    [username, previousDate],
    (err, previousEntry) => {
      if (err) {
        console.error(err);
        callback(null);
        return;
      }

      const previousWasPeriod = previousEntry ? isTrueLike(previousEntry.period) : false;

      callback(previousWasPeriod ? null : 1);
    }
  );
}

//
// GET ALL ENTRIES
//
router.get("/", (req, res) => {
  const username = req.query.username;
  const sql = username
    ? `
        SELECT *
        FROM cycle_entries
        WHERE username = ?
        ORDER BY date;
      `
    : `
        SELECT *
        FROM cycle_entries
        ORDER BY date;
      `;
  const params = username ? [username] : [];

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);

      return res.status(500).json({
        error: err.message,
      });
    }

    const entries = applyDerivedOvulationFields(rows.map(mapRowToEntry));

    res.json(entries);
  });
});

//
// GET ONE ENTRY BY DATE
//
router.get("/:date", (req, res) => {
  const username = req.query.username || "campbell.lowe";

  db.all(
    "SELECT * FROM cycle_entries WHERE username = ? ORDER BY date",
    [username],
    (err, rows) => {
      if (err) {
        console.error(err);

        return res.status(500).json({
          error: err.message,
        });
      }

      const entries = applyDerivedOvulationFields(rows.map(mapRowToEntry));
      const entry = entries.find((item) => item.date === req.params.date);

      if (!entry) {
        return res.status(404).json({
          message: "No entry found.",
        });
      }

      res.json(entry);
    }
  );
});

//
// CREATE OR UPDATE ENTRY
//
router.post("/", (req, res) => {
  const {
    username,
    date,
    cycleDay,
    sick,
    wristTemp,
    thermometerTemp,
    lhMorning,
    lhAfternoon,
    lhNight,
    ovulationConfirmed,
    cmAmount,
    cmType,
    period,
    bleeding,
    sexDrive,
    skinStatus,
    painSymptoms,
    moodEmotions,
    intercourse,
    usedProtection,
    protectionType,
    pregnancyTest,
    symptoms,
    medications,
    weight,
    sleepHours,
    notes,
  } = req.body;

  const updateSql = `
    UPDATE cycle_entries
    SET
      cycle_day = COALESCE(?, cycle_day),
      sick = COALESCE(?, sick),
      wrist_temp = COALESCE(?, wrist_temp),
      thermometer_temp = COALESCE(?, thermometer_temp),
      lh_morning = COALESCE(?, lh_morning),
      lh_afternoon = COALESCE(?, lh_afternoon),
      lh_night = COALESCE(?, lh_night),
      ovulation_confirmed = COALESCE(?, ovulation_confirmed),
      cm_amount = COALESCE(?, cm_amount),
      cm_type = COALESCE(?, cm_type),
      period = COALESCE(?, period),
      bleeding = COALESCE(?, bleeding),
      sex_drive = COALESCE(?, sex_drive),
      skin_status = COALESCE(?, skin_status),
      pain_symptoms = COALESCE(?, pain_symptoms),
      mood_emotions = COALESCE(?, mood_emotions),
      intercourse = COALESCE(?, intercourse),
      used_protection = COALESCE(?, used_protection),
      protection_type = COALESCE(?, protection_type),
      pregnancy_test = COALESCE(?, pregnancy_test),
      symptoms = COALESCE(?, symptoms),
      medications = COALESCE(?, medications),
      weight = COALESCE(?, weight),
      sleep_hours = COALESCE(?, sleep_hours),
      notes = COALESCE(?, notes)
    WHERE username = ? AND date = ?;
  `;

  const normalizedPainSymptoms = JSON.stringify(parseMultiSelectField(painSymptoms));
  const normalizedMoodEmotions = JSON.stringify(parseMultiSelectField(moodEmotions));
  const normalizedSymptoms = JSON.stringify(symptoms || []);
  const normalizedMedications = JSON.stringify(medications || []);

  const insertSql = `
      INSERT INTO cycle_entries (
        username,
        date,
        cycle_day,
        sick,
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

  resolveCycleDayForSave(db, username, date, period, cycleDay, (finalCycleDay) => {
    const updateParams = [
      finalCycleDay,
      sick,
      wristTemp,
      thermometerTemp,
      lhMorning,
      lhAfternoon,
      lhNight,
      ovulationConfirmed,
      cmAmount,
      cmType,
      period,
      bleeding,
      sexDrive,
      skinStatus,
      normalizedPainSymptoms,
      normalizedMoodEmotions,
      intercourse,
      usedProtection,
      protectionType,
      pregnancyTest,
      normalizedSymptoms,
      normalizedMedications,
      weight,
      sleepHours,
      notes,
      username,
      date,
    ];

    db.run(updateSql, updateParams, function (updateError) {
      if (updateError) {
        console.error(updateError);

        return res.status(500).json({
          error: updateError.message,
        });
      }

      if (this.changes > 0) {
        return sendSavedEntryResponse(res, username, date, {
          updated: true,
        });
      }

      db.run(
        insertSql,
        [
          username,
          date,
          finalCycleDay,
          sick,
          wristTemp,
          thermometerTemp,
          lhMorning,
          lhAfternoon,
          lhNight,
          ovulationConfirmed,
          cmAmount,
          cmType,
          period,
          bleeding,
          sexDrive,
          skinStatus,
          normalizedPainSymptoms,
          normalizedMoodEmotions,
          intercourse,
          usedProtection,
          protectionType,
          pregnancyTest,
          normalizedSymptoms,
          normalizedMedications,
          weight,
          sleepHours,
          notes,
        ],
        function (insertError) {
          if (insertError) {
            console.error(insertError);

            return res.status(500).json({
              error: insertError.message,
            });
          }

          sendSavedEntryResponse(res, username, date, {
            inserted: true,
            id: this.lastID,
          });
        }
      );
    });
  });
});

export default router;