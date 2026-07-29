import { useState } from "react";
import AddCycleEntry from "./AddCycleEntry";
import CycleDashboard, { AllCyclesChartsPage } from "./CycleDashboard";
import CycleStatistics from "./CycleStatistics";
import CycleDueDateEstimate from "./CycleDueDateEstimate";
import CyclePhaseGuide from "./CyclePhaseGuide";

function CycleTracking({ setPage: setAppPage }) {
  const [page, setPage] = useState("home");
  const [dueDateCycleSummary, setDueDateCycleSummary] = useState(null);
  const [phaseGuideCycleSummary, setPhaseGuideCycleSummary] = useState(null);

  let content = null;

  if (page === "add") {
    content = <AddCycleEntry />;
  }

  if (page === "dashboard") {
    content = (
      <CycleDashboard
        onOpenDueDateEstimator={(cycleSummary) => {
          setDueDateCycleSummary(cycleSummary || null);
          setPage("dueDate");
        }}
        onOpenPhaseGuide={(cycleSummary) => {
          setPhaseGuideCycleSummary(cycleSummary || null);
          setPage("phaseGuide");
        }}
      />
    );
  }

  if (page === "statistics") {
    content = <CycleStatistics />;
  }

  if (page === "dueDate") {
    content = <CycleDueDateEstimate cycleSummary={dueDateCycleSummary} />;
  }

  if (page === "phaseGuide") {
    content = <CyclePhaseGuide cycleSummary={phaseGuideCycleSummary} />;
  }

  if (page === "allCycles") {
    content = <AllCyclesChartsPage />;
  }

  if (page === "home") {
    content = (
      <div>
        <h1>Cycle Tracking</h1>
        <p>Use the top navigation buttons to move between cycle tools.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="top-nav cycle-top-nav">
        <button className="top-nav-btn" onClick={() => setAppPage?.("pregnancy")}>App Home</button>
        <button className={`top-nav-btn ${page === "home" ? "is-active" : ""}`} onClick={() => setPage("home")}>Cycle Home</button>
        <button className={`top-nav-btn ${page === "add" ? "is-active" : ""}`} onClick={() => setPage("add")}>Add Cycle Entry</button>
        <button className={`top-nav-btn ${page === "dashboard" ? "is-active" : ""}`} onClick={() => setPage("dashboard")}>View Dashboard</button>
        <button className={`top-nav-btn ${page === "statistics" ? "is-active" : ""}`} onClick={() => setPage("statistics")}>View Statistics</button>
        <button className={`top-nav-btn ${page === "allCycles" ? "is-active" : ""}`} onClick={() => setPage("allCycles")}>All Cycles Chart</button>
      </div>

      {content}
    </div>
  );
}

export default CycleTracking;