import json
import os
import re
import sqlite3
from datetime import date, datetime, timedelta
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "cycleTracker.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"
ALLOWED_CATEGORIES = {"pregnancy", "lifestyle"}
DEFAULT_USERNAME = "campbell.lowe"
ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

goals_save_lock = Lock()

app = Flask(__name__)
CORS(app)


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


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


def ensure_column(connection, table_name, column_name, column_definition):
    rows = connection.execute(f"PRAGMA table_info({table_name});").fetchall()
    has_column = any(row["name"] == column_name for row in rows)

    if has_column:
        return

    connection.execute(
        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition};"
    )


def ensure_username_date_unique_constraint(connection):
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


def init_db():
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

        connection.commit()
        return send_saved_entry_response(
            username,
            entry_date,
            {"inserted": True, "id": cursor.lastrowid},
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
                connection.execute("BEGIN IMMEDIATE TRANSACTION")

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
