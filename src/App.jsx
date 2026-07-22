

import { useState } from "react";
import PregnancyPrep from "./pages/PregnancyPrep";
import CycleTracking from "./pages/CycleTracking";
import AddCycleEntry from "./pages/AddCycleEntry";
import Lifestyle from "./pages/Lifestyle";
function App() {
  const [page, setPage] = useState("pregnancy");

  return (
    <div>
      <nav>
        <button onClick={() => setPage("pregnancy")}>
          Pregnancy Prep
        </button>

        <button onClick={() => setPage("cycle")}>
          Cycle Tracking
        </button>

        <button onClick={() => setPage("lifestyle")}>
          Lifestyle
        </button>
      </nav>

      {page === "pregnancy" && <PregnancyPrep />}
      {page === "cycle" && (
        <CycleTracking setPage={setPage} />
      )}
      {page === "addEntry" && <AddCycleEntry />}
      {page === "lifestyle" && <Lifestyle />}
    </div>
  );
}

export default App;