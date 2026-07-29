import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { emptyCycleEntry } from "../models/cycleEntryModel";
import "./CycleEntryForm.css";

const painSymptomOptions = [
  ["none", "None"],
  ["cramps", "Cramps"],
  ["headache", "Headache"],
  ["back_pain", "Back Pain"],
  ["breast_tenderness", "Breast Tenderness"],
  ["bloating", "Bloating"],
  ["fatigue", "Fatigue"],
  ["nausea", "Nausea"],
  ["other", "Other"],
];

const moodEmotionOptions = [
  ["calm", "Calm"],
  ["happy", "Happy"],
  ["irritable", "Irritable"],
  ["anxious", "Anxious"],
  ["sad", "Sad"],
  ["mood_swings", "Mood Swings"],
  ["emotional", "Emotional"],
  ["other", "Other"],
];

function booleanToSelectValue(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "";
}

function selectToBoolean(value) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Value is not JSON, so treat it as a scalar option.
    }
  }

  return [value];
}

function hasValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  return true;
}

function getInputStateClass(value) {
  return hasValue(value) ? "is-filled" : "is-empty";
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function normalizeLhInputValue(rawValue) {
  if (rawValue === "") {
    return "";
  }

  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return rawValue;
  }

  return numeric < 0 ? "0" : rawValue;
}

function isLhField(name) {
  return name === "lhMorning" || name === "lhAfternoon" || name === "lhNight";
}

function CycleEntryForm({ initialEntry }, ref) {
  const [entry, setEntry] = useState(emptyCycleEntry);
  const [saveState, setSaveState] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [sleepDuration, setSleepDuration] = useState({
    hours: "",
    minutes: "",
  });

  function toggleMultiValue(fieldName, optionValue, isChecked) {
    setEntry((previousEntry) => {
      const existingValues = toArray(previousEntry[fieldName]);
      const nextValues = isChecked
        ? Array.from(new Set([...existingValues, optionValue]))
        : existingValues.filter((value) => value !== optionValue);

      return {
        ...previousEntry,
        [fieldName]: nextValues,
      };
    });
  }

  useEffect(() => {
    if (initialEntry) {
      const hydratedEntry = {
        ...emptyCycleEntry,
        ...initialEntry,
        ovulationConfirmed:
          initialEntry.ovulationConfirmed ?? emptyCycleEntry.ovulationConfirmed,
        painSymptoms: toArray(initialEntry.painSymptoms),
        moodEmotions: toArray(initialEntry.moodEmotions),
        symptoms: toArray(initialEntry.symptoms),
        medications: toArray(initialEntry.medications),
      };

      setEntry(hydratedEntry);

      const decimal = Number(hydratedEntry.sleepHours);
      if (Number.isFinite(decimal) && decimal >= 0) {
        const totalMinutes = Math.round(decimal * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        setSleepDuration({
          hours: String(hours),
          minutes: String(minutes),
        });
      } else {
        setSleepDuration({ hours: "", minutes: "" });
      }
    } else {
      setEntry(emptyCycleEntry);
      setSleepDuration({ hours: "", minutes: "" });
    }

    setSaveState("idle");
    setSaveMessage("");
  }, [initialEntry]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    if (name === "cycleDay") {
      const digitsOnlyValue = value.replace(/\D/g, "");
      setEntry((previousEntry) => ({
        ...previousEntry,
        cycleDay: digitsOnlyValue,
      }));
      return;
    }

    if (isLhField(name)) {
      setEntry((previousEntry) => ({
        ...previousEntry,
        [name]: normalizeLhInputValue(value),
      }));
      return;
    }

    if (name === "intercourse") {
      const intercourseValue = selectToBoolean(value);

      setEntry((previousEntry) => ({
        ...previousEntry,
        intercourse: intercourseValue,
        usedProtection:
          intercourseValue === true ? previousEntry.usedProtection : null,
        protectionType: intercourseValue === true ? previousEntry.protectionType : "",
      }));
      return;
    }

    if (name === "usedProtection") {
      const usedProtectionValue = selectToBoolean(value);

      setEntry((previousEntry) => ({
        ...previousEntry,
        usedProtection: usedProtectionValue,
        protectionType:
          usedProtectionValue === true ? previousEntry.protectionType : "",
      }));
      return;
    }

    if (name === "ovulationConfirmed") {
      setEntry((previousEntry) => ({
        ...previousEntry,
        ovulationConfirmed: selectToBoolean(value),
      }));
      return;
    }

    if (name === "period") {
      setEntry((previousEntry) => ({
        ...previousEntry,
        period: selectToBoolean(value),
      }));
      return;
    }

    if (name === "sick") {
      setEntry((previousEntry) => ({
        ...previousEntry,
        sick: selectToBoolean(value) ?? false,
      }));
      return;
    }

    if (name === "painSymptoms" || name === "moodEmotions") {
      toggleMultiValue(name, value, checked);
      return;
    }

    setEntry((previousEntry) => ({
      ...previousEntry,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleSleepChange(event) {
    const { name, value } = event.target;

    if (value === "") {
      setSleepDuration((previousDuration) => ({
        ...previousDuration,
        [name]: "",
      }));
      return;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;

    if (name === "hours") {
      setSleepDuration((previousDuration) => ({
        ...previousDuration,
        hours: String(Math.max(0, Math.floor(numericValue))),
      }));
      return;
    }

    const clampedMinutes = Math.max(0, Math.min(59, Math.floor(numericValue)));
    setSleepDuration((previousDuration) => ({
      ...previousDuration,
      minutes: String(clampedMinutes),
    }));
  }

  async function saveEntry() {
    setSaveState("saving");
    setSaveMessage("Saving entry...");

    const hasHours = sleepDuration.hours !== "";
    const hasMinutes = sleepDuration.minutes !== "";

    const sleepHoursDecimal =
      hasHours || hasMinutes
        ? (Number(sleepDuration.hours || 0) * 60 +
            Number(sleepDuration.minutes || 0)) /
          60
        : null;

    const payload = {
      ...entry,
      wristTemp: normalizeOptionalNumber(entry.wristTemp),
      thermometerTemp: normalizeOptionalNumber(entry.thermometerTemp),
      lhMorning: normalizeOptionalNumber(entry.lhMorning),
      lhAfternoon: normalizeOptionalNumber(entry.lhAfternoon),
      lhNight: normalizeOptionalNumber(entry.lhNight),
      sleepHours: sleepHoursDecimal,
    };

    try {
      const response = await fetch("http://localhost:3000/api/cycle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let backendMessage = "Failed to save entry.";

        try {
          const errorData = await response.json();
          backendMessage = errorData.error || errorData.message || backendMessage;
        } catch {
          // Keep fallback message when response is not JSON.
        }

        throw new Error(backendMessage);
      }

      const responseData = await response.json();

      if (responseData?.entry) {
        const hydratedEntry = {
          ...emptyCycleEntry,
          ...responseData.entry,
          ovulationConfirmed:
            responseData.entry.ovulationConfirmed ?? emptyCycleEntry.ovulationConfirmed,
          period: responseData.entry.period ?? emptyCycleEntry.period,
          peak: responseData.entry.peak ?? emptyCycleEntry.peak,
          painSymptoms: toArray(responseData.entry.painSymptoms),
          moodEmotions: toArray(responseData.entry.moodEmotions),
          symptoms: toArray(responseData.entry.symptoms),
          medications: toArray(responseData.entry.medications),
        };

        setEntry(hydratedEntry);

        const decimal = Number(hydratedEntry.sleepHours);
        if (Number.isFinite(decimal) && decimal >= 0) {
          const totalMinutes = Math.round(decimal * 60);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          setSleepDuration({
            hours: String(hours),
            minutes: String(minutes),
          });
        } else {
          setSleepDuration({ hours: "", minutes: "" });
        }
      } else {
        setEntry((previousEntry) => ({
          ...previousEntry,
          sleepHours: sleepHoursDecimal,
        }));
      }

      setSaveState("saved");
      setSaveMessage("Saved. Derived values are refreshed.");
      return { ok: true };
    } catch (error) {
      console.error(error);
      setSaveState("error");
      setSaveMessage(`Could not save entry: ${error.message}`);
      return { ok: false, message: error.message };
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await saveEntry();
  }

  function handleFormKeyDown(event) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    const targetTag = event.target.tagName;
    if (targetTag === "TEXTAREA" || targetTag === "SELECT") {
      return;
    }

    event.preventDefault();

    if (saveState !== "saving") {
      event.currentTarget.requestSubmit();
    }
  }

  function handleLhKeyDown(event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
    }
  }

  function handleFormWheelCapture(event) {
    if (event.target instanceof HTMLInputElement && event.target.type === "number") {
      event.target.blur();
      event.preventDefault();
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      saveEntry,
    })
  );

  let saveStateClass = "survey-status";
  if (saveState === "saved") {
    saveStateClass = "survey-status survey-status-success";
  } else if (saveState === "error") {
    saveStateClass = "survey-status survey-status-error";
  } else if (saveState === "saving") {
    saveStateClass = "survey-status survey-status-saving";
  }

  const sleepFieldState = getInputStateClass(
    (sleepDuration.hours || "") + (sleepDuration.minutes || "")
  );

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleFormKeyDown}
      onWheelCapture={handleFormWheelCapture}
      className="cycle-entry-form"
      noValidate
    >
      <div className="survey-header">
        <h2>Daily Cycle Entry</h2>
        <p>Quickly log today and save. Automatic fields update right after save.</p>
      </div>

      {saveMessage && <p className={saveStateClass}>{saveMessage}</p>}

      <section className="survey-section">
        <h3>Basics</h3>

        <label className="survey-row">
          <span className="survey-label">Username</span>
          <input
            type="text"
            name="username"
            value={entry.username || ""}
            readOnly
            className={`survey-input survey-input-readonly ${getInputStateClass(entry.username)}`}
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">Date</span>
          <input
            type="date"
            name="date"
            value={entry.date || ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.date)}`}
            required
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">Cycle Day</span>
          <input
            type="text"
            inputMode="numeric"
            name="cycleDay"
            value={entry.cycleDay ?? ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.cycleDay)}`}
            placeholder="Auto unless typed"
          />
        </label>
      </section>

      <section className="survey-section">
        <h3>Fertility Markers</h3>

        <label className="survey-row">
          <span className="survey-label">Sick?</span>
          <select
            name="sick"
            value={booleanToSelectValue(entry.sick)}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.sick)}`}
          >
            <option value="yes">True</option>
            <option value="no">False</option>
          </select>
        </label>

        <label className="survey-row">
          <span className="survey-label">Wrist Temperature</span>
          <input
            type="number"
            step="0.01"
            name="wristTemp"
            value={entry.wristTemp ?? ""}
            onChange={handleChange}
            onKeyDown={handleLhKeyDown}
            className={`survey-input ${getInputStateClass(entry.wristTemp)}`}
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">Thermometer Temperature</span>
          <input
            type="number"
            step="0.01"
            name="thermometerTemp"
            value={entry.thermometerTemp ?? ""}
            onChange={handleChange}
            onKeyDown={handleLhKeyDown}
            className={`survey-input ${getInputStateClass(entry.thermometerTemp)}`}
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">LH Morning</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="lhMorning"
            value={entry.lhMorning ?? ""}
            onChange={handleChange}
            onKeyDown={handleLhKeyDown}
            className={`survey-input ${getInputStateClass(entry.lhMorning)}`}
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">LH Afternoon</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="lhAfternoon"
            value={entry.lhAfternoon ?? ""}
            onChange={handleChange}
            onKeyDown={handleLhKeyDown}
            className={`survey-input ${getInputStateClass(entry.lhAfternoon)}`}
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">LH Night</span>
          <input
            type="number"
            step="0.01"
            min="0"
            name="lhNight"
            value={entry.lhNight ?? ""}
            onChange={handleChange}
            onKeyDown={handleLhKeyDown}
            className={`survey-input ${getInputStateClass(entry.lhNight)}`}
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">Ovulation Test</span>
          <input
            type="text"
            value={entry.ovulationTest || "none"}
            readOnly
            className={`survey-input survey-input-readonly ${getInputStateClass(entry.ovulationTest || "none")}`}
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">Peak (T/F)</span>
          <input
            type="text"
            value={entry.peak ? "True" : "False"}
            readOnly
            className={`survey-input survey-input-readonly ${getInputStateClass(entry.peak)}`}
          />
        </label>

        <label className="survey-row">
          <span className="survey-label">Ovulation Confirmed (T/F)</span>
          <select
            name="ovulationConfirmed"
            value={booleanToSelectValue(entry.ovulationConfirmed)}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.ovulationConfirmed)}`}
          >
            <option value="">Select value</option>
            <option value="yes">True</option>
            <option value="no">False</option>
          </select>
        </label>

        <label className="survey-row">
          <span className="survey-label">CM Amount</span>
          <select
            name="cmAmount"
            value={entry.cmAmount || ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.cmAmount)}`}
          >
            <option value="">Select amount</option>
            <option value="none">None</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="heavy">Heavy</option>
          </select>
        </label>

        <label className="survey-row">
          <span className="survey-label">CM Type</span>
          <select
            name="cmType"
            value={entry.cmType || ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.cmType)}`}
          >
            <option value="">Select type</option>
            <option value="dry">Dry</option>
            <option value="sticky">Sticky</option>
            <option value="creamy">Creamy</option>
            <option value="watery">Watery</option>
            <option value="eggwhite">Egg White</option>
          </select>
        </label>
      </section>

      <section className="survey-section">
        <h3>Flow, Body, and Mood</h3>

        <label className="survey-row">
          <span className="survey-label">Period (T/F)</span>
          <select
            name="period"
            value={booleanToSelectValue(entry.period)}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.period)}`}
          >
            <option value="yes">True</option>
            <option value="no">False</option>
          </select>
        </label>

        <label className="survey-row">
          <span className="survey-label">Bleeding / Spotting</span>
          <select
            name="bleeding"
            value={entry.bleeding || ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.bleeding)}`}
          >
            <option value="">Select flow</option>
            <option value="none">None</option>
            <option value="spotting">Spotting</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
          </select>
        </label>

        <label className="survey-row">
          <span className="survey-label">Sex Drive</span>
          <select
            name="sexDrive"
            value={entry.sexDrive || ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.sexDrive)}`}
          >
            <option value="">Select level</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="survey-row">
          <span className="survey-label">Skin</span>
          <select
            name="skinStatus"
            value={entry.skinStatus || ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.skinStatus)}`}
          >
            <option value="">Select skin symptom</option>
            <option value="none">None</option>
            <option value="oily">Oily</option>
            <option value="acne">Acne/Breakouts</option>
            <option value="dry">Dry Skin</option>
            <option value="sensitive">Sensitive Skin</option>
            <option value="other">Other</option>
          </select>
        </label>

        <div className="survey-row survey-row-top">
          <span className="survey-label">Pain and Symptoms</span>
          <div className={`survey-input multi-select-card ${getInputStateClass(toArray(entry.painSymptoms))}`}>
            <strong>Select all that apply</strong>
            <div className="checkbox-grid">
              {painSymptomOptions.map(([value, label]) => (
                <label key={value} className="checkbox-option">
                  <input
                    type="checkbox"
                    name="painSymptoms"
                    value={value}
                    checked={toArray(entry.painSymptoms).includes(value)}
                    onChange={handleChange}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="survey-row survey-row-top">
          <span className="survey-label">Mood and Emotions</span>
          <div className={`survey-input multi-select-card ${getInputStateClass(toArray(entry.moodEmotions))}`}>
            <strong>Select all that apply</strong>
            <div className="checkbox-grid">
              {moodEmotionOptions.map(([value, label]) => (
                <label key={value} className="checkbox-option">
                  <input
                    type="checkbox"
                    name="moodEmotions"
                    value={value}
                    checked={toArray(entry.moodEmotions).includes(value)}
                    onChange={handleChange}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="survey-section">
        <h3>Intercourse and Protection</h3>

        <label className="survey-row">
          <span className="survey-label">Had Sex</span>
          <select
            name="intercourse"
            value={booleanToSelectValue(entry.intercourse)}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.intercourse)}`}
          >
            <option value="">Select answer</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        {entry.intercourse === true && (
          <>
            <label className="survey-row">
              <span className="survey-label">If yes, Used Protection?</span>
              <select
                name="usedProtection"
                value={booleanToSelectValue(entry.usedProtection)}
                onChange={handleChange}
                className={`survey-input ${getInputStateClass(entry.usedProtection)}`}
              >
                <option value="">Select answer</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            {entry.usedProtection === true && (
              <label className="survey-row">
                <span className="survey-label">Protection Type</span>
                <select
                  name="protectionType"
                  value={entry.protectionType || ""}
                  onChange={handleChange}
                  className={`survey-input ${getInputStateClass(entry.protectionType)}`}
                >
                  <option value="">Select type</option>
                  <option value="condom">Condom</option>
                  <option value="pill">Birth Control Pill</option>
                  <option value="iud">IUD</option>
                  <option value="implant">Implant</option>
                  <option value="patch">Patch</option>
                  <option value="ring">Vaginal Ring</option>
                  <option value="shot">Birth Control Shot</option>
                  <option value="diaphragm">Diaphragm</option>
                  <option value="spermicide">Spermicide</option>
                  <option value="not_vaginal_sex">Not Vaginal Sex</option>
                  <option value="emergency_contraception">Emergency Contraception</option>
                  <option value="vasectomy">Partner Vasectomy</option>
                  <option value="tubal_ligation">Tubal Ligation</option>
                  <option value="pull_out">Pull-Out / No Ejaculation</option>
                  <option value="other">Other</option>
                </select>
              </label>
            )}
          </>
        )}
      </section>

      <section className="survey-section">
        <h3>Wellness</h3>

        <label className="survey-row">
          <span className="survey-label">Pregnancy Test</span>
          <select
            name="pregnancyTest"
            value={entry.pregnancyTest || ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.pregnancyTest)}`}
          >
            <option value="">Select result</option>
            <option value="not_taken">Not Taken</option>
            <option value="negative">Negative</option>
            <option value="faint_positive">Faint Positive</option>
            <option value="positive">Positive</option>
            <option value="invalid">Invalid</option>
          </select>
        </label>

        <label className="survey-row">
          <span className="survey-label">Weight</span>
          <input
            type="number"
            step="0.1"
            name="weight"
            value={entry.weight ?? ""}
            onChange={handleChange}
            className={`survey-input ${getInputStateClass(entry.weight)}`}
          />
        </label>

        <label className="survey-row survey-row-top">
          <span className="survey-label">Sleep Hours</span>
          <div className={`survey-input sleep-grid ${sleepFieldState}`}>
            <input
              type="number"
              min="0"
              name="hours"
              value={sleepDuration.hours}
              onChange={handleSleepChange}
              placeholder="Hours"
            />
            <input
              type="number"
              min="0"
              max="59"
              name="minutes"
              value={sleepDuration.minutes}
              onChange={handleSleepChange}
              placeholder="Minutes"
            />
          </div>
        </label>
      </section>

      <section className="survey-section">
        <h3>Notes</h3>

        <label className="survey-row survey-row-top">
          <span className="survey-label">Daily Notes</span>
          <textarea
            name="notes"
            value={entry.notes || ""}
            onChange={handleChange}
            className={`survey-input survey-notes ${getInputStateClass(entry.notes)}`}
            placeholder="Anything important for today?"
          />
        </label>
      </section>

      <div className="survey-actions">
        <button type="submit" disabled={saveState === "saving"}>
          {saveState === "saving" ? "Saving..." : "Save Entry"}
        </button>
      </div>
    </form>
  );
}

const ForwardedCycleEntryForm = forwardRef(CycleEntryForm);
ForwardedCycleEntryForm.displayName = "CycleEntryForm";

export default ForwardedCycleEntryForm;