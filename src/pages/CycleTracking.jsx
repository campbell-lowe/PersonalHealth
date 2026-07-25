import { useState } from "react";
import AddCycleEntry from "./AddCycleEntry";
import CycleDashboard from "./CycleDashboard";
import CycleStatistics from "./CycleStatistics";

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

        <CycleDashboard />
      </div>
    );
  }

  if (page === "statistics") {
    return (
      <div>
        <button onClick={() => setPage("home")}>
          ← Back
        </button>

        <CycleStatistics />
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

      <button onClick={() => setPage("statistics")}>
        📈 View Statistics
      </button>
    </div>
  );
}

export default CycleTracking;