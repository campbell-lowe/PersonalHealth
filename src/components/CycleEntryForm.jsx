import { useState, useEffect } from "react";
import { emptyCycleEntry } from "../models/cycleEntryModel";

function CycleEntryForm({ initialEntry }) {
  const [entry, setEntry] = useState(emptyCycleEntry);
  const [sleepDuration, setSleepDuration] = useState({
    hours: "",
    minutes: "",
  });

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
    textAlign: "left",
  };

  const labelStyle = {
    minWidth: "220px",
  };

  const inputStyle = {
    flex: 1,
    minWidth: 0,
  };

  useEffect(() => {
    if (initialEntry) {
      setEntry(initialEntry);

      const decimal = Number(initialEntry.sleepHours);
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
  }, [initialEntry]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

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

  async function handleSubmit(event) {
    event.preventDefault();

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

      alert("Entry saved!");

      setEntry(emptyCycleEntry);
      setSleepDuration({ hours: "", minutes: "" });
    } catch (error) {
      console.error(error);
      alert(`Something went wrong while saving: ${error.message}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: "820px",
        margin: "0 auto",
      }}
    >
      <h2>Daily Cycle Entry</h2>

      <label style={rowStyle}>
        <span style={labelStyle}>Date</span>
        <input
          type="date"
          name="date"
          value={entry.date || ""}
          onChange={handleChange}
          style={inputStyle}
        />
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>Cycle Day</span>
        <input
          type="number"
          name="cycleDay"
          value={entry.cycleDay ?? ""}
          onChange={handleChange}
          style={inputStyle}
        />
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>Wrist Temperature</span>
        <input
          type="number"
          step="0.01"
          name="wristTemp"
          value={entry.wristTemp ?? ""}
          onChange={handleChange}
          style={inputStyle}
        />
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>Thermometer Temperature</span>
        <input
          type="number"
          step="0.01"
          name="thermometerTemp"
          value={entry.thermometerTemp ?? ""}
          onChange={handleChange}
          style={inputStyle}
        />
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>LH Morning</span>
        <input
          type="number"
          step="0.01"
          name="lhMorning"
          value={entry.lhMorning ?? ""}
          onChange={handleChange}
          style={inputStyle}
        />
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>LH Night</span>
        <input
          type="number"
          step="0.01"
          name="lhNight"
          value={entry.lhNight ?? ""}
          onChange={handleChange}
          style={inputStyle}
        />
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>CM Amount</span>
        <select
          name="cmAmount"
          value={entry.cmAmount || ""}
          onChange={handleChange}
          style={inputStyle}
        >
          <option value="">Select amount</option>
          <option value="none">None</option>
          <option value="light">Light</option>
          <option value="moderate">Moderate</option>
          <option value="heavy">Heavy</option>
        </select>
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>CM Type</span>
        <select
          name="cmType"
          value={entry.cmType || ""}
          onChange={handleChange}
          style={inputStyle}
        >
          <option value="">Select type</option>
          <option value="dry">Dry</option>
          <option value="sticky">Sticky</option>
          <option value="creamy">Creamy</option>
          <option value="watery">Watery</option>
          <option value="eggwhite">Egg White</option>
        </select>
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>Bleeding / Spotting</span>
        <select
          name="bleeding"
          value={entry.bleeding || ""}
          onChange={handleChange}
          style={inputStyle}
        >
          <option value="">Select flow</option>
          <option value="none">None</option>
          <option value="spotting">Spotting</option>
          <option value="light">Light</option>
          <option value="medium">Medium</option>
          <option value="heavy">Heavy</option>
        </select>
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>Pregnancy Test</span>
        <select
          name="pregnancyTest"
          value={entry.pregnancyTest || ""}
          onChange={handleChange}
          style={inputStyle}
        >
          <option value="">Select result</option>
          <option value="not_taken">Not Taken</option>
          <option value="negative">Negative</option>
          <option value="faint_positive">Faint Positive</option>
          <option value="positive">Positive</option>
          <option value="invalid">Invalid</option>
        </select>
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>Weight</span>
        <input
          type="number"
          step="0.1"
          name="weight"
          value={entry.weight ?? ""}
          onChange={handleChange}
          style={inputStyle}
        />
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>Sleep Hours (Hours/Minutes)</span>
        <div style={{ ...inputStyle, display: "flex", gap: "8px" }}>
          <input
            type="number"
            min="0"
            name="hours"
            value={sleepDuration.hours}
            onChange={handleSleepChange}
            placeholder="Hours"
            style={{ flex: 1, minWidth: 0 }}
          />
          <input
            type="number"
            min="0"
            max="59"
            name="minutes"
            value={sleepDuration.minutes}
            onChange={handleSleepChange}
            placeholder="Minutes"
            style={{ flex: 1, minWidth: 0 }}
          />
        </div>
      </label>

      <label style={rowStyle}>
        <span style={labelStyle}>Notes</span>
        <textarea
          name="notes"
          value={entry.notes || ""}
          onChange={handleChange}
          style={inputStyle}
        />
      </label>

      <button type="submit">
        Save Entry
      </button>
    </form>
  );
}

export default CycleEntryForm;