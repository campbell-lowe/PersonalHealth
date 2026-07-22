CREATE TABLE IF NOT EXISTS cycle_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    date TEXT UNIQUE NOT NULL,

    cycle_number INTEGER,
    cycle_day INTEGER,

    wrist_temp REAL,
    thermometer_temp REAL,

    lh_morning REAL,
    lh_night REAL,

    cm_amount TEXT,
    cm_type TEXT,

    bleeding TEXT,

    intercourse BOOLEAN,

    pregnancy_test TEXT,

    symptoms TEXT,
    medications TEXT,

    weight REAL,
    sleep_hours REAL,

    notes TEXT
);