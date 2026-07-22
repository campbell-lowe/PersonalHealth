import { useState } from "react";
import AddCycleEntry from "./AddCycleEntry";

function CycleTracking() {
  const [page, setPage] = useState("home");

  if (page === "add") {
    return (
      <div>
        <button onClick={() => setPage("home")}>
          ← Back
        </button>

        <AddCycleEntry />
      </div>
    );
  }

  if (page === "dashboard") {
    return (
      <div>
        <button onClick={() => setPage("home")}>
          ← Back
        </button>

        <h1>Cycle Dashboard</h1>
        <p>Coming soon!</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Cycle Tracking</h1>

      <button onClick={() => setPage("add")}>
        ➕ Add Cycle Entry
      </button>

      <button onClick={() => setPage("dashboard")}>
        📊 View Dashboard
      </button>
    </div>
  );
}

export default CycleTracking;