import { useState } from "react";
import CycleEntryForm from "../components/CycleEntryForm";

function AddCycleEntry() {
  const [selectedDate, setSelectedDate] = useState("");
  const [entry, setEntry] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");

  async function loadEntry() {
    if (!selectedDate) {
      setStatusMessage("Pick a date first, then click Load Entry.");
      return;
    }

    try {
      setStatusMessage("Loading entry...");

      const response = await fetch(
        `http://localhost:3000/api/cycle/${selectedDate}`
      );

      if (response.ok) {
        const data = await response.json();
        setEntry(data);
        setStatusMessage("Loaded existing entry.");
      } else {
        setEntry({
          date: selectedDate,
          cycleDay: 1,
        });
        setStatusMessage("No entry found for that date. Starting a new one.");
      }
    } catch (error) {
      console.error(error);
      setStatusMessage(
        "Could not reach backend. Start backend on port 3000 and try again."
      );
    }
  }

  return (
    <div>
      <h1>Add / Update Cycle Entry</h1>

      <label>
        Date
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </label>

      <button onClick={loadEntry}>
        Load Entry
      </button>

      {statusMessage && <p>{statusMessage}</p>}

      {entry && (
        <CycleEntryForm
          initialEntry={entry}
        />
      )}
    </div>
  );
}

export default AddCycleEntry;