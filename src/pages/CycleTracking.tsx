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
      <section className="cycle-home">
        <div className="cycle-home-hero">
          <h1>Cycle Tracking</h1>
          <p>Pick what you want to do next. Your entries, dashboard, and charts are all in one place.</p>
        </div>

        <div className="cycle-home-actions">
          <button type="button" className="feature-card" onClick={() => setPage("add")}>
            <h2>Add or Edit Daily Entry</h2>
            <p>Log today, update past days, and move quickly across dates.</p>
          </button>

          <button type="button" className="feature-card" onClick={() => setPage("dashboard")}>
            <h2>Open Cycle Dashboard</h2>
            <p>See fertile window timing, ovulation clues, and key cycle events.</p>
          </button>

          <button type="button" className="feature-card" onClick={() => setPage("statistics")}>
            <h2>Review Statistics</h2>
            <p>Check trends for temperature, mucus, symptoms, and longer-term patterns.</p>
          </button>
        </div>
      </section>
    );
  }

  return (
    <div>
      <div className="top-nav cycle-top-nav">
        <button className="top-nav-btn" onClick={() => setAppPage?.("home")}>App Home</button>
        <button className={`top-nav-btn ${page === "home" ? "is-active" : ""}`} onClick={() => setPage("home")}>Cycle Home</button>
        <button className={`top-nav-btn ${page === "add" ? "is-active" : ""}`} onClick={() => setPage("add")}>Daily Entry</button>
        <button className={`top-nav-btn ${page === "dashboard" ? "is-active" : ""}`} onClick={() => setPage("dashboard")}>Dashboard</button>
        <button className={`top-nav-btn ${page === "statistics" ? "is-active" : ""}`} onClick={() => setPage("statistics")}>Statistics</button>
        <button className={`top-nav-btn ${page === "allCycles" ? "is-active" : ""}`} onClick={() => setPage("allCycles")}>All Cycles</button>
      </div>

      {content}
    </div>
  );
}

export default CycleTracking;