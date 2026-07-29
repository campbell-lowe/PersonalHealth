CREATE TABLE IF NOT EXISTS cycle_entries (
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

CREATE TABLE IF NOT EXISTS wellness_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    category TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    name TEXT NOT NULL,
    completed_dates TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(username, category, goal_id)
);