CREATE TABLE IF NOT EXISTS cycle_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    username TEXT NOT NULL DEFAULT 'campbell.lowe',

    date TEXT NOT NULL,

    cycle_day INTEGER,

    wrist_temp REAL,
    thermometer_temp REAL,

    lh_morning REAL,
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