import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CycleEntryForm from "../components/CycleEntryForm";
import "./AddCycleEntry.css";
import { getActiveUsername } from "../utils/activeUsername";

const FLOW_VALUES = new Set(["light", "medium", "heavy"]);

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayInputDate() {
  return formatDateForInput(new Date());
}

function toDisplayDateLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function toMonthLabel(date) {
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function toCalendarDateString(year, monthIndex, day) {
  return formatDateForInput(new Date(year, monthIndex, day));
}

function toCycleDayLabel(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? `CD ${numeric}` : "CD -";
}

function toCycleDayValueText(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : "-";
}

function isoDateToDayNumber(dateString) {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24);
}

function dayNumberToIsoDate(dayNumber) {
  const date = new Date(dayNumber * 1000 * 60 * 60 * 24);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEstimatedCycleLength(knownCycleDayByDate) {
  const cycleStartDays = Object.entries(knownCycleDayByDate)
    .filter(([, cycleDay]) => Number(cycleDay) === 1)
    .map(([date]) => isoDateToDayNumber(date))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  if (cycleStartDays.length < 2) {
    return 28;
  }

  const differences = [];
  for (let index = 1; index < cycleStartDays.length; index += 1) {
    const diff = cycleStartDays[index] - cycleStartDays[index - 1];
    if (diff >= 20 && diff <= 40) {
      differences.push(diff);
    }
  }

  if (differences.length === 0) {
    return 28;
  }

  const average = differences.reduce((sum, value) => sum + value, 0) / differences.length;
  return Math.max(21, Math.min(40, Math.round(average)));
}

function getFertileWindowForCycleLength(cycleLength) {
  const ovulationDay = Math.max(10, Math.min(cycleLength - 12, cycleLength - 14));
  return {
    ovulationDay,
    fertileStartDay: Math.max(1, ovulationDay - 5),
    fertileEndDay: Math.min(cycleLength, ovulationDay + 1),
  };
}

function isDateInFuture(dateString) {
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target > today;
}

function buildProjectedCycleDayMap(knownCycleDayByDate, knownEntryDateSet, projectionDays = 180) {
  const knownDates = Object.keys(knownCycleDayByDate)
    .filter((date) => Number.isFinite(Number(knownCycleDayByDate[date])) && Number(knownCycleDayByDate[date]) > 0)
    .sort((a, b) => (a > b ? 1 : -1));

  if (knownDates.length === 0) {
    return {
      cycleLength: 28,
      projectedCycleDayByDate: {},
      firstProjectedCycleStartDate: null,
    };
  }

  const cycleLength = getEstimatedCycleLength(knownCycleDayByDate);
  const lastKnownDate = knownDates[knownDates.length - 1];
  const lastKnownCycleDay = Number(knownCycleDayByDate[lastKnownDate]);
  const lastKnownDayNumber = isoDateToDayNumber(lastKnownDate);

  if (!Number.isFinite(lastKnownCycleDay) || !Number.isFinite(lastKnownDayNumber)) {
    return {
      cycleLength,
      projectedCycleDayByDate: {},
      firstProjectedCycleStartDate: null,
    };
  }

  const projectedCycleDayByDate = {};
  let runningCycleDay = lastKnownCycleDay;
  let firstProjectedCycleStartDate = null;

  for (let offset = 1; offset <= projectionDays; offset += 1) {
    const nextDayNumber = lastKnownDayNumber + offset;
    const nextDate = dayNumberToIsoDate(nextDayNumber);

    runningCycleDay += 1;
    if (runningCycleDay > cycleLength) {
      runningCycleDay = 1;
    }

    if (!knownEntryDateSet.has(nextDate)) {
      projectedCycleDayByDate[nextDate] = runningCycleDay;

      if (runningCycleDay === 1 && !firstProjectedCycleStartDate) {
        firstProjectedCycleStartDate = nextDate;
      }
    }
  }

  return {
    cycleLength,
    projectedCycleDayByDate,
    firstProjectedCycleStartDate,
  };
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
  const currentUsername = getActiveUsername();

  try {
    const response = await fetch(
      `http://localhost:3000/api/cycle?username=${encodeURIComponent(currentUsername)}`
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
  const [knownEntryDateSet, setKnownEntryDateSet] = useState(new Set());
  const [knownCycleDayByDate, setKnownCycleDayByDate] = useState({});
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const formRef = useRef(null);

  const calendarCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const monthIndex = visibleMonth.getMonth();
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push({ type: "empty", key: `empty-${index}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateString = toCalendarDateString(year, monthIndex, day);
      cells.push({
        type: "day",
        key: dateString,
        day,
        date: dateString,
        hasEntry: knownEntryDateSet.has(dateString),
        cycleDay: knownCycleDayByDate[dateString] ?? null,
      });
    }

    return cells;
  }, [knownCycleDayByDate, knownEntryDateSet, visibleMonth]);

  const monthLabel = useMemo(() => toMonthLabel(visibleMonth), [visibleMonth]);

  const projection = useMemo(
    () => buildProjectedCycleDayMap(knownCycleDayByDate, knownEntryDateSet),
    [knownCycleDayByDate, knownEntryDateSet]
  );

  const fertileWindow = useMemo(
    () => getFertileWindowForCycleLength(projection.cycleLength),
    [projection.cycleLength]
  );

  useEffect(() => {
    async function loadKnownEntryDates() {
      const currentUsername = getActiveUsername();

      try {
        const response = await fetch(
          `http://localhost:3000/api/cycle?username=${encodeURIComponent(currentUsername)}`
        );

        if (!response.ok) {
          return;
        }

        const entries = await response.json();
        const cycleDayMap = {};

        if (Array.isArray(entries)) {
          entries.forEach((item) => {
            if (item?.date) {
              cycleDayMap[item.date] = item.cycleDay ?? null;
            }
          });
        }

        const knownDates = new Set(
          Array.isArray(entries)
            ? entries.map((item) => item?.date).filter(Boolean)
            : []
        );

        setKnownEntryDateSet(knownDates);
        setKnownCycleDayByDate(cycleDayMap);
      } catch {
        // Keep navigation usable even if date preloading fails.
      }
    }

    loadKnownEntryDates();
  }, []);

  const saveCurrentEntryBeforeNavigation = useCallback(async () => {
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
  }, [entry]);

  const loadEntry = useCallback(async (targetDate) => {
    const currentUsername = getActiveUsername();

    if (!targetDate) {
      setStatusMessage("Pick a date first, then click Load Entry.");
      return;
    }

    try {
      setStatusMessage("Loading entry...");
      setSelectedDate(targetDate);

      const response = await fetch(
        `http://localhost:3000/api/cycle/${targetDate}?username=${encodeURIComponent(currentUsername)}`
      );

      if (response.ok) {
        const data = await response.json();
        setEntry(data);
        setKnownEntryDateSet((previousSet) => {
          const nextSet = new Set(previousSet);
          nextSet.add(targetDate);
          return nextSet;
        });
        setKnownCycleDayByDate((previousMap) => ({
          ...previousMap,
          [targetDate]: data?.cycleDay ?? previousMap[targetDate] ?? null,
        }));
        setStatusMessage(`Loaded existing entry for ${targetDate}.`);
      } else if (response.status === 404) {
        const suggestedCycleDay = await getSuggestedCycleDay(targetDate);

        setEntry({
          username: currentUsername,
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
  }, []);

  const openEditorForDate = useCallback(async (targetDate) => {
    await loadEntry(targetDate);
    setIsEditorOpen(true);
  }, [loadEntry]);

  const goToNextDay = useCallback(async () => {
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
  }, [loadEntry, saveCurrentEntryBeforeNavigation, selectedDate]);

  const goToPreviousDay = useCallback(async () => {
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
  }, [loadEntry, saveCurrentEntryBeforeNavigation, selectedDate]);

  useEffect(() => {
    function onKeyDown(event) {
      const targetTagName = event.target?.tagName;
      if (targetTagName === "INPUT" || targetTagName === "TEXTAREA" || targetTagName === "SELECT") {
        return;
      }

      if (!event.altKey) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (isEditorOpen) {
          goToPreviousDay();
        }
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (isEditorOpen) {
          goToNextDay();
        }
      }

      if (event.key.toLowerCase() === "t") {
        event.preventDefault();
        loadEntry(getTodayInputDate());
        setIsEditorOpen(true);
      }

      if (event.key === "Escape" && isEditorOpen) {
        event.preventDefault();
        setIsEditorOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isEditorOpen, goToNextDay, goToPreviousDay, loadEntry]);

  function shiftVisibleMonth(monthDelta) {
    setVisibleMonth((previousMonth) => {
      const nextMonth = new Date(previousMonth);
      nextMonth.setMonth(previousMonth.getMonth() + monthDelta);
      return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
    });
  }

  return (
    <div className="add-cycle-entry-page">
      <h1>Add / Update Cycle Entry</h1>
      <p className="entry-intro">
        Click a day in the calendar to open a popup editor and log that day.
      </p>

      <p className="entry-hotkeys-note">
        Shortcuts: Alt + T (today), Alt + Left/Right (previous/next day while editor is open), Esc (close popup)
      </p>

      <div className="entry-calendar-card">
        <div className="entry-calendar-head">
          <button type="button" className="calendar-month-btn" onClick={() => shiftVisibleMonth(-1)}>
            Previous Month
          </button>
          <h2>{monthLabel}</h2>
          <button type="button" className="calendar-month-btn" onClick={() => shiftVisibleMonth(1)}>
            Next Month
          </button>
        </div>

        <div className="entry-calendar-weekdays" aria-hidden="true">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        <div className="entry-calendar-grid" role="grid" aria-label="Cycle entry days by month">
          {calendarCells.map((cell) => {
            if (cell.type === "empty") {
              return <div key={cell.key} className="calendar-empty-cell" aria-hidden="true" />;
            }

            const isToday = cell.date === getTodayInputDate();
            const isSelected = cell.date === selectedDate;
            const projectedCycleDay = projection.projectedCycleDayByDate[cell.date] ?? null;
            const displayedCycleDay = cell.cycleDay ?? projectedCycleDay;
            const isProjected = cell.cycleDay == null && projectedCycleDay != null;
            const isFertileEstimate =
              Number(displayedCycleDay) >= fertileWindow.fertileStartDay &&
              Number(displayedCycleDay) <= fertileWindow.fertileEndDay;
            const isEstimatedOvulationDay = Number(displayedCycleDay) === fertileWindow.ovulationDay;
            const isProjectedCycleStart =
              isProjected && cell.date === projection.firstProjectedCycleStartDate;

            return (
              <button
                key={cell.key}
                type="button"
                role="gridcell"
                className={`entry-calendar-day ${cell.hasEntry ? "has-entry" : "is-new"} ${isProjected ? "is-projected" : ""} ${isFertileEstimate ? "is-fertile-window" : ""} ${isEstimatedOvulationDay ? "is-ovulation-guess" : ""} ${isProjectedCycleStart ? "is-projected-cycle-start" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                onClick={() => openEditorForDate(cell.date)}
              >
                <strong>{cell.day}</strong>
                <span className="entry-calendar-day-cycle">
                  {isProjected ? `~${toCycleDayLabel(displayedCycleDay)}` : toCycleDayLabel(displayedCycleDay)}
                </span>
                <small>
                  {isProjectedCycleStart
                    ? "Next CD1"
                    : cell.hasEntry
                      ? "Saved"
                      : isDateInFuture(cell.date)
                        ? "Forecast"
                        : "New"}
                </small>
              </button>
            );
          })}
        </div>

        <div className="entry-calendar-legend" aria-label="Calendar meaning">
          <span className="legend-item"><i className="legend-swatch legend-saved" />Saved day</span>
          <span className="legend-item"><i className="legend-swatch legend-forecast" />Forecast day</span>
          <span className="legend-item"><i className="legend-swatch legend-fertile" />Fertile window estimate</span>
          <span className="legend-item"><i className="legend-swatch legend-ovulation" />Estimated ovulation day</span>
          <span className="legend-item"><i className="legend-swatch legend-cycle-start" />Next estimated CD1</span>
        </div>

        {statusMessage && <p className="entry-status-message">{statusMessage}</p>}
      </div>

      {isEditorOpen && (
        <div className="entry-editor-modal" role="dialog" aria-modal="true" aria-label="Cycle entry editor">
          <div className="entry-editor-panel">
            <div className="entry-editor-head">
              <div>
                <h2>{selectedDate ? toDisplayDateLabel(selectedDate) : "Day Editor"}</h2>
                <p>{selectedDate || "No date selected"}</p>
                <p className="entry-editor-cycle-day">
                  {`Cycle day: ${toCycleDayValueText(entry?.cycleDay)}`}
                </p>
              </div>
              <button type="button" className="entry-editor-close" onClick={() => setIsEditorOpen(false)}>
                Close
              </button>
            </div>

            <div className="entry-loader-actions entry-editor-nav-row">
              <button className="prev-day-btn" onClick={goToPreviousDay} disabled={!selectedDate}>
                Previous Day
              </button>

              <button className="today-btn" onClick={() => openEditorForDate(getTodayInputDate())}>
                Today
              </button>

              <button className="next-day-btn" onClick={goToNextDay} disabled={!selectedDate}>
                Next Day
              </button>
            </div>

            {entry ? (
              <CycleEntryForm
                ref={formRef}
                initialEntry={entry}
                onSaved={(savedEntry) => {
                  if (savedEntry?.date) {
                    setKnownEntryDateSet((previousSet) => {
                      const nextSet = new Set(previousSet);
                      nextSet.add(savedEntry.date);
                      return nextSet;
                    });
                    setKnownCycleDayByDate((previousMap) => ({
                      ...previousMap,
                      [savedEntry.date]: savedEntry.cycleDay ?? previousMap[savedEntry.date] ?? null,
                    }));
                  }
                }}
              />
            ) : (
              <p className="entry-modal-loading">Loading selected day...</p>
            )}
          </div>
        </div>
      )}

      <p className="entry-inline-date" aria-live="polite">
        {selectedDate ? `Selected date: ${selectedDate}` : "Selected date: not set"}
      </p>
    </div>
  );
}

export default AddCycleEntry;