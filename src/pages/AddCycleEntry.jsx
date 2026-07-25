import { useRef, useState } from "react";
import CycleEntryForm from "../components/CycleEntryForm";
import "./AddCycleEntry.css";

const CURRENT_USERNAME = "campbell.lowe";
const FLOW_VALUES = new Set(["light", "medium", "heavy"]);

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toStartOfDay(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dayDiff(fromDateString, toDateString) {
  const from = toStartOfDay(fromDateString);
  const to = toStartOfDay(toDateString);
  const diffMs = to - from;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function getSuggestedCycleDay(targetDate) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/cycle?username=${encodeURIComponent(CURRENT_USERNAME)}`
    );

    if (!response.ok) {
      return 1;
    }

    const allEntries = await response.json();
    const previousEntries = allEntries
      .filter((item) => item.date && item.date < targetDate)
      .sort((a, b) => (a.date > b.date ? 1 : -1));

    if (previousEntries.length === 0) {
      return 1;
    }

    const flowStartEntry = [...previousEntries]
      .reverse()
      .find(
        (item) =>
          Number(item.cycleDay) === 1 &&
          (item.period === true || FLOW_VALUES.has(item.bleeding))
      );

    if (flowStartEntry) {
      const diff = dayDiff(flowStartEntry.date, targetDate);
      return Math.max(1, diff + 1);
    }

    const lastEntry = previousEntries.at(-1);
    const lastCycleDay = Number(lastEntry.cycleDay);
    if (Number.isFinite(lastCycleDay) && lastCycleDay > 0) {
      const diff = dayDiff(lastEntry.date, targetDate);
      return Math.max(1, lastCycleDay + Math.max(0, diff));
    }

    return 1;
  } catch {
    return 1;
  }
}

function AddCycleEntry() {
  const [selectedDate, setSelectedDate] = useState("");
  const [entry, setEntry] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const formRef = useRef(null);

  async function saveCurrentEntryBeforeNavigation() {
    if (!entry || !formRef.current?.saveEntry) {
      return true;
    }

    setStatusMessage("Saving current entry before changing day...");
    const saveResult = await formRef.current.saveEntry();

    if (!saveResult?.ok) {
      setStatusMessage(
        saveResult?.message
          ? `Could not save current entry: ${saveResult.message}`
          : "Could not save current entry."
      );
      return false;
    }

    return true;
  }

  async function loadEntry(targetDate = selectedDate) {
    if (!targetDate) {
      setStatusMessage("Pick a date first, then click Load Entry.");
      return;
    }

    try {
      setStatusMessage("Loading entry...");
      setSelectedDate(targetDate);

      const response = await fetch(
        `http://localhost:3000/api/cycle/${targetDate}?username=${encodeURIComponent(CURRENT_USERNAME)}`
      );

      if (response.ok) {
        const data = await response.json();
        setEntry(data);
        setStatusMessage(`Loaded existing entry for ${targetDate}.`);
      } else if (response.status === 404) {
        const suggestedCycleDay = await getSuggestedCycleDay(targetDate);

        setEntry({
          username: CURRENT_USERNAME,
          date: targetDate,
          cycleDay: suggestedCycleDay,
          sick: false,
          pregnancyTest: "not_taken",
          bleeding: "none",
          ovulationConfirmed: false,
          period: false,
          intercourse: false,
        });
        setStatusMessage(
          `No entry found for ${targetDate}. Starting a new one at cycle day ${suggestedCycleDay}.`
        );
      } else {
        let message = `Load failed (${response.status}).`;

        try {
          const errorData = await response.json();
          message = errorData.error || errorData.message || message;
        } catch {
          // Keep fallback message when response is not JSON.
        }

        throw new Error(message);
      }
    } catch (error) {
      console.error(error);
      setStatusMessage(`Could not load entry: ${error.message}`);
    }
  }

  async function goToNextDay() {
    if (!selectedDate) {
      setStatusMessage("Load a date first, then use Next Day.");
      return;
    }

    const saved = await saveCurrentEntryBeforeNavigation();
    if (!saved) {
      return;
    }

    const currentDate = new Date(`${selectedDate}T00:00:00`);
    currentDate.setDate(currentDate.getDate() + 1);
    const nextDate = formatDateForInput(currentDate);

    await loadEntry(nextDate);
  }

  async function goToPreviousDay() {
    if (!selectedDate) {
      setStatusMessage("Load a date first, then use Previous Day.");
      return;
    }

    const saved = await saveCurrentEntryBeforeNavigation();
    if (!saved) {
      return;
    }

    const currentDate = new Date(`${selectedDate}T00:00:00`);
    currentDate.setDate(currentDate.getDate() - 1);
    const previousDate = formatDateForInput(currentDate);

    await loadEntry(previousDate);
  }

  return (
    <div className="add-cycle-entry-page">
      <h1>Add / Update Cycle Entry</h1>
      <p className="entry-intro">
        Choose a date, load it, and then complete the survey below.
      </p>

      <div className="entry-loader-card">
        <label className="entry-loader-label">
          <span>Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={selectedDate ? "date-filled" : "date-empty"}
          />
        </label>

        <div className="entry-loader-actions">
          <button className="prev-day-btn" onClick={goToPreviousDay}>
            Previous Day
          </button>

          <button className="load-btn" onClick={() => loadEntry()}>
            Load Entry
          </button>

          <button className="next-day-btn" onClick={goToNextDay}>
            Next Day
          </button>
        </div>

        {statusMessage && <p className="entry-status-message">{statusMessage}</p>}
      </div>

      {entry && (
        <CycleEntryForm
          ref={formRef}
          initialEntry={entry}
        />
      )}

      <div className="entry-bottom-actions">
        <button className="prev-day-btn" onClick={goToPreviousDay}>
          Previous Day
        </button>

        <button className="load-btn" onClick={() => loadEntry()}>
          Load Entry
        </button>

        <button className="next-day-btn" onClick={goToNextDay}>
          Next Day
        </button>
      </div>

      <div className="entry-corner-date" aria-live="polite">
        {selectedDate ? `Date: ${selectedDate}` : "Date: not selected"}
      </div>
    </div>
  );
}

export default AddCycleEntry;