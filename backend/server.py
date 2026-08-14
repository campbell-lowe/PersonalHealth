import json
import os
import re
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - optional until DATABASE_URL is configured
    psycopg = None
    dict_row = None

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "cycleTracker.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"
DATABASE_URL = str(os.getenv("DATABASE_URL", "")).strip()
DB_ENGINE = "postgres" if DATABASE_URL.startswith(("postgres://", "postgresql://")) else "sqlite"
ALLOWED_CATEGORIES = {"pregnancy", "lifestyle"}
DEFAULT_USERNAME = "campbell.lowe"
DEFAULT_DEMO_USERNAME = "demo"
DEFAULT_DEMO_PASSWORD = "demo12345"
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

goals_save_lock = Lock()


def get_allowed_origins():
    raw_value = str(os.getenv("APP_ALLOWED_ORIGINS", "")).strip()
    if raw_value == "":
        return "*"

    origins = [origin.strip() for origin in raw_value.split(",") if origin.strip()]
    return origins or "*"

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": get_allowed_origins()}})


class PgCursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        return None

    def fetchone(self):
        row = self._cursor.fetchone()
        return dict(row) if row else None

    def fetchall(self):
        return [dict(row) for row in self._cursor.fetchall()]


class PgConnectionWrapper:
    def __init__(self, connection):
        self._connection = connection

    def execute(self, query, params=()):
        cursor = self._connection.cursor()
        cursor.execute(query.replace("?", "%s"), params or ())
        return PgCursorWrapper(cursor)

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()


def get_connection():
    if DB_ENGINE == "postgres":
        if psycopg is None:
            raise RuntimeError(
                "DATABASE_URL is set but psycopg is not installed. Add psycopg[binary] to requirements."
            )

        connection = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        return PgConnectionWrapper(connection)

    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def begin_write_transaction(connection):
    if DB_ENGINE == "postgres":
        connection.execute("BEGIN")
        return

    connection.execute("BEGIN IMMEDIATE TRANSACTION")


def parse_json_array(value):
    if isinstance(value, list):
        return value

    if not isinstance(value, str) or value.strip() == "":
        return []

    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return []


def parse_multi_select_field(value):
    if value is None or value == "":
        return []

    if isinstance(value, list):
        return value

    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
            if isinstance(parsed, str) and parsed:
                return [parsed]
        except json.JSONDecodeError:
            return [value]

    return []


def to_lh_number(value):
    if value is None:
        return None

    if isinstance(value, str) and value.strip() == "":
        return None

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    return numeric


def get_entry_lh_peak(entry):
    morning = to_lh_number(entry.get("lhMorning"))
    afternoon = to_lh_number(entry.get("lhAfternoon"))
    night = to_lh_number(entry.get("lhNight"))

    if morning is None and afternoon is None and night is None:
        return None

    values = [value for value in [morning, afternoon, night] if value is not None]
    return max(values) if values else None


def derive_ovulation_test(entry):
    lh_peak = get_entry_lh_peak(entry)
    if lh_peak is None:
        return "none"

    if lh_peak >= 1:
        return "positive"

    if lh_peak >= 0.6:
        return "negative-high"

    return "negative-low"


def is_cycle_start(entry):
    try:
        return int(entry.get("cycleDay")) == 1
    except (TypeError, ValueError):
        return False


def map_row_to_entry(row):
    return {
        "id": row["id"],
        "username": row["username"],
        "date": row["date"],
        "cycleDay": row["cycle_day"],
        "sick": False if row["sick"] is None else bool(row["sick"]),
        "wristTemp": row["wrist_temp"],
        "thermometerTemp": row["thermometer_temp"],
        "lhMorning": row["lh_morning"],
        "lhAfternoon": row["lh_afternoon"],
        "lhNight": row["lh_night"],
        "ovulationConfirmed": None if row["ovulation_confirmed"] is None else bool(row["ovulation_confirmed"]),
        "cmAmount": row["cm_amount"],
        "cmType": row["cm_type"],
        "period": None if row["period"] is None else bool(row["period"]),
        "bleeding": row["bleeding"] or "none",
        "sexDrive": row["sex_drive"],
        "skinStatus": row["skin_status"],
        "painSymptoms": parse_multi_select_field(row["pain_symptoms"]),
        "moodEmotions": parse_multi_select_field(row["mood_emotions"]),
        "intercourse": None if row["intercourse"] is None else bool(row["intercourse"]),
        "usedProtection": None if row["used_protection"] is None else bool(row["used_protection"]),
        "protectionType": row["protection_type"],
        "pregnancyTest": row["pregnancy_test"] or "not_taken",
        "symptoms": parse_json_array(row["symptoms"]),
        "medications": parse_json_array(row["medications"]),
        "weight": row["weight"],
        "sleepHours": row["sleep_hours"],
        "notes": row["notes"],
    }


def apply_derived_ovulation_fields(entries):
    grouped_by_username = {}
    for entry in entries:
        key = entry.get("username") or ""
        grouped_by_username.setdefault(key, []).append(entry)

    derived_by_id = {}

    for group in grouped_by_username.values():
        sorted_entries = sorted(group, key=lambda item: item.get("date", ""))
        cycle = []

        def flush_cycle():
            nonlocal cycle
            if not cycle:
                return

            lh_peaks = [get_entry_lh_peak(entry) for entry in cycle]
            numeric_peaks = [value for value in lh_peaks if value is not None]
            cycle_peak = max(numeric_peaks) if numeric_peaks else None

            for entry in cycle:
                entry_peak = get_entry_lh_peak(entry)
                derived = {
                    **entry,
                    "ovulationTest": derive_ovulation_test(entry),
                    "peak": bool(entry_peak is not None and cycle_peak is not None and entry_peak == cycle_peak),
                }
                derived_by_id[entry["id"]] = derived

            cycle = []

        for entry in sorted_entries:
            if cycle and is_cycle_start(entry):
                flush_cycle()
            cycle.append(entry)

        flush_cycle()

    output = []
    for entry in entries:
        derived = derived_by_id.get(entry["id"])
        if derived:
            output.append(derived)
            continue

        output.append({**entry, "ovulationTest": derive_ovulation_test(entry), "peak": False})

    return output


def to_previous_date(date_string):
    current = datetime.strptime(date_string, "%Y-%m-%d").date()
    return (current - timedelta(days=1)).isoformat()


def is_true_like(value):
    return value in (True, 1, "1", "true", "yes")


def normalize_cycle_day_value(value):
    if value is None:
        return None

    if isinstance(value, str) and value.strip() == "":
        return None

    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    day = int(numeric)
    return day if day >= 1 else None


def is_future_iso_date(date_string):
    if not isinstance(date_string, str) or not ISO_DATE_RE.match(date_string):
        return False

    try:
        entry_date = datetime.strptime(date_string, "%Y-%m-%d").date()
    except ValueError:
        return False

    return entry_date > date.today()


def resolve_cycle_day_for_save(connection, username, entry_date, period, requested_cycle_day):
    normalized_requested = normalize_cycle_day_value(requested_cycle_day)
    if normalized_requested is not None:
        return normalized_requested

    if not is_true_like(period):
        return None

    previous_date = to_previous_date(entry_date)
    row = connection.execute(
        "SELECT period FROM cycle_entries WHERE username = ? AND date = ?",
        (username, previous_date),
    ).fetchone()

    previous_was_period = is_true_like(row["period"]) if row else False
    return None if previous_was_period else 1


def normalize_username(value):
    trimmed = str(value or "").strip()
    return trimmed or DEFAULT_USERNAME


def normalize_category(value):
    return str(value or "").strip().lower()


def normalize_auth_username(value):
    return str(value or "").strip()


def is_valid_password(password):
    return isinstance(password, str) and len(password) >= 8


def bootstrap_default_user(connection):
    # Optional bootstrap for hosted deployments.
    env_username = str(os.getenv("APP_DEFAULT_USERNAME", "")).strip()
    env_password = str(os.getenv("APP_DEFAULT_PASSWORD", "")).strip()

    if not env_username or not env_password:
        return

    username = normalize_username(env_username)

    existing = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()

    if existing:
        return

    connection.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (username, generate_password_hash(env_password, method="pbkdf2:sha256")),
    )


def bootstrap_demo_account(connection):
    demo_username = str(os.getenv("APP_DEMO_USERNAME", DEFAULT_DEMO_USERNAME)).strip() or DEFAULT_DEMO_USERNAME
    demo_password = str(os.getenv("APP_DEMO_PASSWORD", DEFAULT_DEMO_PASSWORD)).strip() or DEFAULT_DEMO_PASSWORD

    connection.execute(
        """
        INSERT INTO users (username, password_hash)
        VALUES (?, ?)
        ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash
        """,
        (demo_username, generate_password_hash(demo_password, method="pbkdf2:sha256")),
    )

    has_cycle_data = connection.execute(
        "SELECT 1 FROM cycle_entries WHERE username = ? LIMIT 1",
        (demo_username,),
    ).fetchone()

    if not has_cycle_data:
        sample_cycle_entries = [
            {
                "date": "2026-05-01",
                "cycle_day": 1,
                "period": 1,
                "bleeding": "heavy",
                "wrist_temp": 97.3,
                "thermometer_temp": 97.5,
                "sex_drive": "low",
                "skin_status": "clear",
                "sleep_hours": 7.5,
                "notes": "Sample data: period start.",
            },
            {
                "date": "2026-05-02",
                "cycle_day": 2,
                "period": 1,
                "bleeding": "medium",
                "wrist_temp": 97.2,
                "thermometer_temp": 97.4,
                "sex_drive": "low",
                "skin_status": "clear",
                "sleep_hours": 7.0,
                "notes": "Sample data.",
            },
            {
                "date": "2026-05-05",
                "cycle_day": 5,
                "period": 0,
                "bleeding": "none",
                "wrist_temp": 97.4,
                "thermometer_temp": 97.6,
                "lh_morning": 0.21,
                "lh_afternoon": 0.32,
                "lh_night": 0.28,
                "sex_drive": "medium",
                "skin_status": "clear",
                "sleep_hours": 7.8,
                "notes": "Sample data.",
            },
            {
                "date": "2026-05-11",
                "cycle_day": 11,
                "period": 0,
                "bleeding": "none",
                "wrist_temp": 97.5,
                "thermometer_temp": 97.7,
                "lh_morning": 0.55,
                "lh_afternoon": 0.63,
                "lh_night": 0.59,
                "sex_drive": "high",
                "skin_status": "clear",
                "sleep_hours": 8.1,
                "notes": "Sample data: fertile window.",
            },
            {
                "date": "2026-05-13",
                "cycle_day": 13,
                "period": 0,
                "bleeding": "none",
                "wrist_temp": 97.6,
                "thermometer_temp": 97.8,
                "lh_morning": 0.98,
                "lh_afternoon": 1.18,
                "lh_night": 1.05,
                "sex_drive": "high",
                "skin_status": "clear",
                "sleep_hours": 7.9,
                "notes": "Sample data: LH peak day.",
            },
            {
                "date": "2026-05-14",
                "cycle_day": 14,
                "period": 0,
                "bleeding": "none",
                "wrist_temp": 97.9,
                "thermometer_temp": 98.0,
                "lh_morning": 0.72,
                "lh_afternoon": 0.66,
                "lh_night": 0.52,
                "ovulation_confirmed": 1,
                "sex_drive": "high",
                "skin_status": "clear",
                "sleep_hours": 7.4,
                "notes": "Sample data: probable ovulation.",
            },
            {
                "date": "2026-05-20",
                "cycle_day": 20,
                "period": 0,
                "bleeding": "none",
                "wrist_temp": 98.1,
                "thermometer_temp": 98.2,
                "sex_drive": "medium",
                "skin_status": "clear",
                "sleep_hours": 8.0,
                "notes": "Sample data: luteal phase.",
            },
            {
                "date": "2026-05-28",
                "cycle_day": 28,
                "period": 0,
                "bleeding": "spotting",
                "wrist_temp": 97.7,
                "thermometer_temp": 97.8,
                "sex_drive": "low",
                "skin_status": "acne",
                "sleep_hours": 6.9,
                "notes": "Sample data: pre-period spotting.",
            },
        ]

        insert_cycle_sql = """
            INSERT INTO cycle_entries (
                username,
                date,
                cycle_day,
                period,
                bleeding,
                wrist_temp,
                thermometer_temp,
                lh_morning,
                lh_afternoon,
                lh_night,
                ovulation_confirmed,
                sex_drive,
                skin_status,
                symptoms,
                medications,
                sleep_hours,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        for entry in sample_cycle_entries:
            connection.execute(
                insert_cycle_sql,
                (
                    demo_username,
                    entry["date"],
                    entry.get("cycle_day"),
                    entry.get("period"),
                    entry.get("bleeding"),
                    entry.get("wrist_temp"),
                    entry.get("thermometer_temp"),
                    entry.get("lh_morning"),
                    entry.get("lh_afternoon"),
                    entry.get("lh_night"),
                    entry.get("ovulation_confirmed"),
                    entry.get("sex_drive"),
                    entry.get("skin_status"),
                    json.dumps([]),
                    json.dumps([]),
                    entry.get("sleep_hours"),
                    entry.get("notes"),
                ),
            )

    has_goal_data = connection.execute(
        "SELECT 1 FROM wellness_goals WHERE username = ? LIMIT 1",
        (demo_username,),
    ).fetchone()

    if not has_goal_data:
        sample_goals = [
            (demo_username, "pregnancy", "prenatal-vitamin", "Take prenatal vitamin", ["2026-05-03", "2026-05-04"], 0),
            (demo_username, "pregnancy", "hydrate", "Hydrate (8 cups)", ["2026-05-03"], 1),
            (demo_username, "lifestyle", "walk", "30-minute walk", ["2026-05-02", "2026-05-05"], 0),
            (demo_username, "lifestyle", "sleep", "Sleep before 11 PM", ["2026-05-01", "2026-05-02"], 1),
        ]

        for username, category, goal_id, name, completed_dates, position in sample_goals:
            connection.execute(
                """
                INSERT OR IGNORE INTO wellness_goals (
                    username,
                    category,
                    goal_id,
                    name,
                    completed_dates,
                    position
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (username, category, goal_id, name, json.dumps(completed_dates), position),
            )


def ensure_column(connection, table_name, column_name, column_definition):
    if DB_ENGINE != "sqlite":
        return

    rows = connection.execute(f"PRAGMA table_info({table_name});").fetchall()
    has_column = any(row["name"] == column_name for row in rows)

    if has_column:
        return

    connection.execute(
        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition};"
    )


def ensure_username_date_unique_constraint(connection):
    if DB_ENGINE != "sqlite":
        return

    row = connection.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cycle_entries';"
    ).fetchone()

    create_sql = row["sql"] if row and row["sql"] else ""
    if "UNIQUE(username, date)" in create_sql:
        return

    connection.executescript(
        """
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
        SELECT
            id,
            COALESCE(username, 'campbell.lowe') AS username,
            date,
            cycle_day,
            COALESCE(sick, 0) AS sick,
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
        """
    )


def init_db_postgres():
    connection = get_connection()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS cycle_entries (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL DEFAULT 'campbell.lowe',
                date TEXT NOT NULL,
                cycle_day INTEGER,
                sick BOOLEAN DEFAULT FALSE,
                wrist_temp DOUBLE PRECISION,
                thermometer_temp DOUBLE PRECISION,
                lh_morning DOUBLE PRECISION,
                lh_afternoon DOUBLE PRECISION,
                lh_night DOUBLE PRECISION,
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
                weight DOUBLE PRECISION,
                sleep_hours DOUBLE PRECISION,
                notes TEXT,
                UNIQUE(username, date)
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS wellness_goals (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                category TEXT NOT NULL,
                goal_id TEXT NOT NULL,
                name TEXT NOT NULL,
                completed_dates TEXT NOT NULL DEFAULT '[]',
                position INTEGER NOT NULL DEFAULT 0,
                UNIQUE(username, category, goal_id)
            )
            """
        )

        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        bootstrap_default_user(connection)
        bootstrap_demo_account(connection)
        connection.commit()
    finally:
        connection.close()


def init_db():
    if DB_ENGINE == "postgres":
        init_db_postgres()
        return

    schema = SCHEMA_PATH.read_text(encoding="utf-8")

    connection = get_connection()
    try:
        connection.executescript(schema)

        ensure_column(connection, "cycle_entries", "sex_drive", "TEXT")
        ensure_column(connection, "cycle_entries", "username", "TEXT NOT NULL DEFAULT 'campbell.lowe'")
        ensure_column(connection, "cycle_entries", "skin_status", "TEXT")
        ensure_column(connection, "cycle_entries", "pain_symptoms", "TEXT")
        ensure_column(connection, "cycle_entries", "mood_emotions", "TEXT")
        ensure_column(connection, "cycle_entries", "lh_afternoon", "REAL")
        ensure_column(connection, "cycle_entries", "sick", "BOOLEAN DEFAULT 0")
        ensure_column(connection, "cycle_entries", "ovulation_confirmed", "BOOLEAN")
        ensure_column(connection, "cycle_entries", "period", "BOOLEAN")
        ensure_column(connection, "cycle_entries", "used_protection", "BOOLEAN")
        ensure_column(connection, "cycle_entries", "protection_type", "TEXT")
        ensure_username_date_unique_constraint(connection)
        bootstrap_default_user(connection)
        bootstrap_demo_account(connection)

        connection.commit()
    finally:
        connection.close()


def send_saved_entry_response(username, entry_date, save_meta=None):
    save_meta = save_meta or {}

    connection = get_connection()
    try:
        rows = connection.execute(
            "SELECT * FROM cycle_entries WHERE username = ? ORDER BY date",
            (username,),
        ).fetchall()
    finally:
        connection.close()

    entries = apply_derived_ovulation_fields([map_row_to_entry(row) for row in rows])
    saved_entry = next((item for item in entries if item["date"] == entry_date), None)

    payload = {"success": True, **save_meta, "entry": saved_entry}
    return jsonify(payload)


init_db()


@app.get("/")
def health_check():
    return "Backend is running!"


@app.post("/api/auth/register")
def register_user():
    payload = request.get_json(silent=True) or {}

    username = normalize_auth_username(payload.get("username"))
    password = payload.get("password")

    if username == "":
        return jsonify({"error": "Username is required."}), 400

    if not isinstance(password, str) or password.strip() == "":
        return jsonify({"error": "Password is required."}), 400

    if not is_valid_password(password):
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    connection = get_connection()
    try:
        existing = connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (username,),
        ).fetchone()

        if existing:
            return jsonify({"error": "Username already exists."}), 409

        connection.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, generate_password_hash(password, method="pbkdf2:sha256")),
        )
        connection.commit()
    except Exception as error:
        connection.rollback()
        return jsonify({"error": str(error)}), 500
    finally:
        connection.close()

    return jsonify({"success": True, "username": username}), 201


@app.post("/api/auth/login")
def login_user():
    payload = request.get_json(silent=True) or {}

    username = normalize_auth_username(payload.get("username"))
    password = payload.get("password")

    if username == "":
        return jsonify({"error": "Username is required."}), 400

    if not isinstance(password, str) or password == "":
        return jsonify({"error": "Password is required."}), 400

    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        connection.close()

    if not row:
        return jsonify({"error": "Invalid username or password."}), 401

    if not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Invalid username or password."}), 401

    return jsonify({"success": True, "username": username})


@app.get("/api/cycle")
def get_cycle_entries():
    username = request.args.get("username")

    connection = get_connection()
    try:
        if username:
            rows = connection.execute(
                "SELECT * FROM cycle_entries WHERE username = ? ORDER BY date;",
                (username,),
            ).fetchall()
        else:
            rows = connection.execute("SELECT * FROM cycle_entries ORDER BY date;").fetchall()
    except Exception as error:
        connection.close()
        return jsonify({"error": str(error)}), 500
    finally:
        connection.close()

    entries = apply_derived_ovulation_fields([map_row_to_entry(row) for row in rows])
    return jsonify(entries)


@app.get("/api/cycle/<entry_date>")
def get_cycle_entry_by_date(entry_date):
    username = request.args.get("username")

    if not username or not isinstance(username, str):
        return jsonify({"error": "Username is required."}), 400

    connection = get_connection()
    try:
        rows = connection.execute(
            "SELECT * FROM cycle_entries WHERE username = ? ORDER BY date",
            (username,),
        ).fetchall()
    except Exception as error:
        connection.close()
        return jsonify({"error": str(error)}), 500
    finally:
        connection.close()

    entries = apply_derived_ovulation_fields([map_row_to_entry(row) for row in rows])
    entry = next((item for item in entries if item["date"] == entry_date), None)

    if not entry:
        return jsonify({"message": "No entry found."}), 404

    return jsonify(entry)


@app.post("/api/cycle")
def create_or_update_cycle_entry():
    payload = request.get_json(silent=True) or {}

    username = payload.get("username")
    entry_date = payload.get("date")

    if not username or not isinstance(username, str):
        return jsonify({"error": "Username is required."}), 400

    if not entry_date or not isinstance(entry_date, str):
        return jsonify({"error": "Date is required in YYYY-MM-DD format."}), 400

    if is_future_iso_date(entry_date):
        return jsonify({"error": "Future entries are not allowed."}), 400

    cycle_day = payload.get("cycleDay")
    sick = payload.get("sick")
    wrist_temp = payload.get("wristTemp")
    thermometer_temp = payload.get("thermometerTemp")
    lh_morning = payload.get("lhMorning")
    lh_afternoon = payload.get("lhAfternoon")
    lh_night = payload.get("lhNight")
    ovulation_confirmed = payload.get("ovulationConfirmed")
    cm_amount = payload.get("cmAmount")
    cm_type = payload.get("cmType")
    period = payload.get("period")
    bleeding = payload.get("bleeding")
    sex_drive = payload.get("sexDrive")
    skin_status = payload.get("skinStatus")
    pain_symptoms = json.dumps(parse_multi_select_field(payload.get("painSymptoms")))
    mood_emotions = json.dumps(parse_multi_select_field(payload.get("moodEmotions")))
    intercourse = payload.get("intercourse")
    used_protection = payload.get("usedProtection")
    protection_type = payload.get("protectionType")
    pregnancy_test = payload.get("pregnancyTest")
    symptoms = json.dumps(payload.get("symptoms") or [])
    medications = json.dumps(payload.get("medications") or [])
    weight = payload.get("weight")
    sleep_hours = payload.get("sleepHours")
    notes = payload.get("notes")

    update_sql = """
        UPDATE cycle_entries
        SET
          cycle_day = COALESCE(?, cycle_day),
          sick = COALESCE(?, sick),
          wrist_temp = COALESCE(?, wrist_temp),
          thermometer_temp = COALESCE(?, thermometer_temp),
          lh_morning = ?,
          lh_afternoon = ?,
          lh_night = ?,
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
    """

    insert_sql = """
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
    """

    connection = get_connection()
    try:
        final_cycle_day = resolve_cycle_day_for_save(connection, username, entry_date, period, cycle_day)

        cursor = connection.execute(
            update_sql,
            (
                final_cycle_day,
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
                notes,
                username,
                entry_date,
            ),
        )

        if cursor.rowcount and cursor.rowcount > 0:
            connection.commit()
            return send_saved_entry_response(username, entry_date, {"updated": True})

        cursor = connection.execute(
            insert_sql,
            (
                username,
                entry_date,
                final_cycle_day,
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
                notes,
            ),
        )

        inserted_id = cursor.lastrowid
        if inserted_id is None:
            inserted_row = connection.execute(
                "SELECT id FROM cycle_entries WHERE username = ? AND date = ?",
                (username, entry_date),
            ).fetchone()
            inserted_id = inserted_row["id"] if inserted_row else None

        connection.commit()
        return send_saved_entry_response(
            username,
            entry_date,
            {"inserted": True, "id": inserted_id},
        )
    except Exception as error:
        connection.rollback()
        return jsonify({"error": str(error)}), 500
    finally:
        connection.close()


@app.get("/api/goals")
def get_goals():
    username = normalize_username(request.args.get("username"))
    category = normalize_category(request.args.get("category"))

    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": "Invalid category. Use pregnancy or lifestyle."}), 400

    connection = get_connection()
    try:
        rows = connection.execute(
            """
            SELECT goal_id, name, completed_dates, position
            FROM wellness_goals
            WHERE username = ? AND category = ?
            ORDER BY position ASC, id ASC;
            """,
            (username, category),
        ).fetchall()
    except Exception as error:
        connection.close()
        return jsonify({"error": str(error)}), 500
    finally:
        connection.close()

    goals = [
        {
            "id": row["goal_id"],
            "name": row["name"],
            "completedDates": parse_json_array(row["completed_dates"]),
        }
        for row in rows
    ]

    return jsonify({"username": username, "category": category, "goals": goals})


@app.put("/api/goals")
def save_goals():
    payload = request.get_json(silent=True) or {}

    username = normalize_username(payload.get("username"))
    category = normalize_category(payload.get("category"))
    goals = payload.get("goals") if isinstance(payload.get("goals"), list) else []

    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": "Invalid category. Use pregnancy or lifestyle."}), 400

    normalized_goals = []
    for index, goal in enumerate(goals):
        goal_id = str((goal or {}).get("id") or "").strip()
        name = str((goal or {}).get("name") or "").strip()

        completed_dates = []
        incoming_dates = (goal or {}).get("completedDates")
        if isinstance(incoming_dates, list):
            completed_dates = [
                value for value in incoming_dates if isinstance(value, str) and value.strip() != ""
            ]

        if not goal_id or not name:
            continue

        normalized_goals.append(
            {
                "id": goal_id,
                "name": name,
                "completedDates": completed_dates,
                "position": index,
            }
        )

    try:
        with goals_save_lock:
            connection = get_connection()
            try:
                begin_write_transaction(connection)

                connection.execute(
                    "DELETE FROM wellness_goals WHERE username = ? AND category = ?",
                    (username, category),
                )

                insert_sql = """
                    INSERT INTO wellness_goals (
                      username,
                      category,
                      goal_id,
                      name,
                      completed_dates,
                      position
                    ) VALUES (?, ?, ?, ?, ?, ?);
                """

                for goal in normalized_goals:
                    connection.execute(
                        insert_sql,
                        (
                            username,
                            category,
                            goal["id"],
                            goal["name"],
                            json.dumps(goal["completedDates"]),
                            goal["position"],
                        ),
                    )

                connection.commit()
            except Exception:
                connection.rollback()
                raise
            finally:
                connection.close()
    except Exception as error:
        return jsonify({"error": str(error) or "Could not save goals."}), 500

    return jsonify(
        {
            "success": True,
            "username": username,
            "category": category,
            "count": len(normalized_goals),
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3000")))
