import { useEffect, useMemo, useState } from "react";
import { getActiveUsername } from "../utils/activeUsername";

const TEMPERATURE_SOURCES = [
  { key: "thermometer", label: "Thermometer", dataKey: "thermometerTemp", color: "#ff5d57" },
  { key: "apple-watch", label: "Apple Watch", dataKey: "wristTemp", color: "#2470ff" },
];

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toPlottableNumber(value, options = {}) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }

  if (options.excludeZero && numeric === 0) {
    return null;
  }

  return numeric;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeCmValue(value) {
  return String(value || "").trim();
}

function buildCmLog(entries) {
  return entries
    .map((entry) => {
      const cmType = normalizeCmValue(entry.cmType);
      const cmAmount = normalizeCmValue(entry.cmAmount);

      if (!entry.date || (!cmType && !cmAmount)) {
        return null;
      }

      return {
        date: entry.date,
        cycleDay: Number(entry.cycleDay) || null,
        cmType: cmType || "-",
        cmAmount: cmAmount || "-",
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function buildCmSummary(cmLog) {
  const byType = {};
  const byAmount = {};

  cmLog.forEach((row) => {
    byType[row.cmType] = (byType[row.cmType] || 0) + 1;
    byAmount[row.cmAmount] = (byAmount[row.cmAmount] || 0) + 1;
  });

  return {
    totalLoggedDays: cmLog.length,
    uniqueTypes: Object.keys(byType).length,
    uniqueAmounts: Object.keys(byAmount).length,
    byType: Object.entries(byType).sort((a, b) => b[1] - a[1]),
    byAmount: Object.entries(byAmount).sort((a, b) => b[1] - a[1]),
  };
}

function buildCmCsv(cmLog) {
  const header = "date,cycleDay,cmType,cmAmount";
  const rows = cmLog.map((row) => `${row.date},${row.cycleDay || ""},${row.cmType},${row.cmAmount}`);
  return [header, ...rows].join("\n");
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch {
      return [trimmed];
    }
  }

  return [];
}

function buildSymptomsLog(entries) {
  return entries
    .map((entry) => {
      const painSymptoms = toStringArray(entry.painSymptoms);
      const moodEmotions = toStringArray(entry.moodEmotions);
      const generalSymptoms = toStringArray(entry.symptoms);

      if (!entry.date || (painSymptoms.length === 0 && moodEmotions.length === 0 && generalSymptoms.length === 0)) {
        return null;
      }

      return {
        date: entry.date,
        cycleDay: Number(entry.cycleDay) || null,
        painSymptoms,
        moodEmotions,
        generalSymptoms,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function buildSymptomsSummary(symptomsLog) {
  const painCounts = {};
  const moodCounts = {};
  const generalCounts = {};

  symptomsLog.forEach((row) => {
    row.painSymptoms.forEach((item) => {
      painCounts[item] = (painCounts[item] || 0) + 1;
    });
    row.moodEmotions.forEach((item) => {
      moodCounts[item] = (moodCounts[item] || 0) + 1;
    });
    row.generalSymptoms.forEach((item) => {
      generalCounts[item] = (generalCounts[item] || 0) + 1;
    });
  });

  return {
    totalLoggedDays: symptomsLog.length,
    painCounts: Object.entries(painCounts).sort((a, b) => b[1] - a[1]),
    moodCounts: Object.entries(moodCounts).sort((a, b) => b[1] - a[1]),
    generalCounts: Object.entries(generalCounts).sort((a, b) => b[1] - a[1]),
  };
}

function buildSymptomsCsv(symptomsLog) {
  const header = "date,cycleDay,painSymptoms,moodEmotions,generalSymptoms";
  const rows = symptomsLog.map((row) => {
    const pain = row.painSymptoms.join("; ");
    const mood = row.moodEmotions.join("; ");
    const general = row.generalSymptoms.join("; ");
    return `${row.date},${row.cycleDay || ""},"${pain}","${mood}","${general}"`;
  });

  return [header, ...rows].join("\n");
}

function findSustainedRiseStart(points, startIndex = 6, minDelta = 0.2) {
  const firstIndex = Math.max(6, startIndex);

  for (let index = firstIndex; index <= points.length - 3; index += 1) {
    const previousSixValues = points.slice(index - 6, index).map((point) => point.value);
    const baselineCandidate = average(previousSixValues);
    if (baselineCandidate === null) {
      continue;
    }

    const hasSustainedRise = [0, 1, 2].every(
      (offset) => points[index + offset].value >= baselineCandidate + minDelta
    );

    if (hasSustainedRise) {
      return {
        index,
        baseline: baselineCandidate,
      };
    }
  }

  return null;
}

function computeBaselineForTemperature(points) {
  if (points.length === 0) {
    return { baseline: null, isEstimated: true };
  }

  const ovulationIndex = points.findIndex((point) => point.ovulationConfirmed === true);
  const riseStart = findSustainedRiseStart(points, ovulationIndex >= 0 ? ovulationIndex : 6, 0.2);

  if (riseStart) {
    return {
      baseline: Number(riseStart.baseline.toFixed(2)),
      isEstimated: false,
    };
  }

  const candidatePool =
    ovulationIndex > 0
      ? points.slice(0, ovulationIndex)
      : points.slice(0, Math.max(points.length - 2, 1));

  const lows = candidatePool
    .map((point) => point.value)
    .sort((a, b) => a - b)
    .slice(0, Math.min(6, candidatePool.length));

  const estimatedBaseline = average(lows);

  return {
    baseline: estimatedBaseline === null ? null : Number(estimatedBaseline.toFixed(2)),
    isEstimated: true,
  };
}

function buildCycleWindows(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const ordered = [...entries].sort((a, b) => {
    if (a.date === b.date) {
      return 0;
    }
    return a.date > b.date ? 1 : -1;
  });

  const starts = [];

  ordered.forEach((entry, index) => {
    if (Number(entry.cycleDay) === 1 && entry.date) {
      starts.push(index);
    }
  });

  if (starts.length === 0) {
    starts.push(0);
  } else if (starts[0] !== 0) {
    starts.unshift(0);
  }

  const uniqueStarts = [...new Set(starts)].sort((a, b) => a - b);

  return uniqueStarts.map((startIndex, index) => {
    const endIndexExclusive =
      index + 1 < uniqueStarts.length ? uniqueStarts[index + 1] : ordered.length;

    const cycleEntries = ordered.slice(startIndex, endIndexExclusive);

    return {
      id: `${cycleEntries[0]?.date || "cycle"}-${index}`,
      entries: cycleEntries,
      startDate: cycleEntries[0]?.date || "",
      endDate: cycleEntries[cycleEntries.length - 1]?.date || "",
      length: cycleEntries.length,
    };
  });
}

function summarizeSourceAcrossCycles(cycles, source) {
  const cycleBaselines = cycles
    .map((cycle) => {
      const points = cycle.entries
        .filter((entry) => entry.sick !== true)
        .map((entry, index) => ({
          index,
          ovulationConfirmed: entry.ovulationConfirmed,
          value: toPlottableNumber(entry[source.dataKey], { excludeZero: true }),
        }))
        .filter((point) => point.value !== null);

      if (points.length === 0) {
        return null;
      }

      return computeBaselineForTemperature(points);
    })
    .filter((result) => result && result.baseline !== null);

  const values = cycleBaselines.map((result) => result.baseline);
  const allTimeBaseline = average(values);

  return {
    source,
    allTimeBaseline: allTimeBaseline === null ? null : Number(allTimeBaseline.toFixed(2)),
    cyclesUsed: cycleBaselines.length,
    confirmedCycles: cycleBaselines.filter((result) => !result.isEstimated).length,
    estimatedCycles: cycleBaselines.filter((result) => result.isEstimated).length,
  };
}

function CycleStatistics() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState("all");

  useEffect(() => {
    const currentUsername = getActiveUsername();

    async function loadEntries() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(
          `http://localhost:3000/api/cycle?username=${encodeURIComponent(currentUsername)}`
        );

        if (!response.ok) {
          throw new Error(`Could not load statistics data (${response.status}).`);
        }

        const data = await response.json();
        const sorted = [...data].sort((a, b) => (a.date > b.date ? 1 : -1));

        setEntries(sorted);
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message || "Could not load statistics data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadEntries();
  }, []);

  const cycles = useMemo(() => buildCycleWindows(entries), [entries]);

  const sourceStats = useMemo(
    () => TEMPERATURE_SOURCES.map((source) => summarizeSourceAcrossCycles(cycles, source)),
    [cycles]
  );

  const cycleOptions = useMemo(
    () => [
      { id: "all", label: "All cycles" },
      ...cycles.map((cycle, index) => ({
        id: cycle.id,
        label: `Cycle ${index + 1}: ${cycle.startDate || "-"} to ${cycle.endDate || "-"}`,
      })),
    ],
    [cycles]
  );

  const filteredEntries = useMemo(() => {
    if (selectedCycleId === "all") {
      return entries;
    }

    const selectedCycle = cycles.find((cycle) => cycle.id === selectedCycleId);
    return selectedCycle ? selectedCycle.entries : entries;
  }, [selectedCycleId, cycles, entries]);

  const cmLog = useMemo(() => buildCmLog(filteredEntries), [filteredEntries]);
  const cmSummary = useMemo(() => buildCmSummary(cmLog), [cmLog]);
  const cmCsv = useMemo(() => buildCmCsv(cmLog), [cmLog]);
  const symptomsLog = useMemo(() => buildSymptomsLog(filteredEntries), [filteredEntries]);
  const symptomsSummary = useMemo(() => buildSymptomsSummary(symptomsLog), [symptomsLog]);
  const symptomsCsv = useMemo(() => buildSymptomsCsv(symptomsLog), [symptomsLog]);

  async function copyCmCsv() {
    try {
      await navigator.clipboard.writeText(cmCsv);
      window.alert("CM export copied to clipboard.");
    } catch {
      window.alert("Could not copy CM export. You can still select and copy it below.");
    }
  }

  async function copySymptomsCsv() {
    try {
      await navigator.clipboard.writeText(symptomsCsv);
      window.alert("Symptoms export copied to clipboard.");
    } catch {
      window.alert("Could not copy symptoms export. You can still select and copy it below.");
    }
  }

  if (isLoading) {
    return <p>Loading statistics...</p>;
  }

  if (errorMessage) {
    return <p>Could not load statistics: {errorMessage}</p>;
  }

  if (entries.length === 0) {
    return <p>No cycle entries yet. Add entries first, then come back to statistics.</p>;
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px",
        display: "grid",
        gap: "18px",
      }}
    >
      <h1 style={{ margin: 0 }}>Cycle Statistics</h1>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          display: "grid",
          gap: "8px",
        }}
      >
        <label style={{ display: "grid", gap: "6px", color: "#444", fontWeight: 600 }}>
          Optional cycle filter
          <select
            value={selectedCycleId}
            onChange={(event) => setSelectedCycleId(event.target.value)}
            style={{
              border: "1px solid #d6c4b3",
              borderRadius: "10px",
              padding: "9px 10px",
              font: "inherit",
              maxWidth: "420px",
            }}
          >
            {cycleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
          Applies to CM log/export and Symptoms log/export. Baseline cards above remain all-time.
        </p>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          display: "grid",
          gap: "8px",
        }}
      >
        <p style={{ margin: 0, color: "#444" }}>
          All-time baseline is calculated per device by averaging each cycle baseline for that device.
        </p>
        <p style={{ margin: 0, color: "#444" }}>
          Confirmed cycle = baseline found from a clear thermal shift (3 higher temps in a row after 6 prior temps).
        </p>
        <p style={{ margin: 0, color: "#444" }}>
          Estimated cycle = no clear thermal shift found, so baseline uses a fallback from earlier lower temperatures.
        </p>
        <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
          More confirmed cycles usually means a more reliable all-time baseline.
        </p>
        <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
          Total cycles detected: {cycles.length}
        </p>
      </section>

      {sourceStats.map((stat) => (
        <section
          key={stat.source.key}
          style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "16px",
            display: "grid",
            gap: "10px",
          }}
        >
          <h2 style={{ margin: 0, color: stat.source.color }}>{stat.source.label}</h2>

          {stat.allTimeBaseline !== null ? (
            <>
              <p style={{ margin: 0, fontSize: "1.05rem" }}>
                All-time baseline: <strong>{stat.allTimeBaseline.toFixed(2)}</strong>
              </p>
              <p style={{ margin: 0, color: "#555" }}>
                Based on {stat.cyclesUsed} cycle{stat.cyclesUsed === 1 ? "" : "s"}
                {`: ${stat.confirmedCycles} confirmed, ${stat.estimatedCycles} estimated`}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: "#666" }}>
              Not enough data yet for an all-time baseline.
            </p>
          )}
        </section>
      ))}

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          display: "grid",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>CM Log</h2>
        <p style={{ margin: 0, color: "#555" }}>
          Days where cervical mucus (CM) type and/or amount were logged.
        </p>

        {cmLog.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>No CM data logged yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "540px",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Date</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Cycle Day</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>CM Type</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>CM Amount</th>
                </tr>
              </thead>
              <tbody>
                {cmLog.map((row) => (
                  <tr key={`${row.date}-${row.cycleDay || "na"}-${row.cmType}-${row.cmAmount}`}>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.date}</td>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.cycleDay || "-"}</td>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.cmType}</td>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.cmAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          display: "grid",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>CM Export Numbers</h2>

        <p style={{ margin: 0, color: "#555" }}>
          Total logged days: <strong>{cmSummary.totalLoggedDays}</strong> | Unique CM types: <strong>{cmSummary.uniqueTypes}</strong> | Unique CM amounts: <strong>{cmSummary.uniqueAmounts}</strong>
        </p>

        <div style={{ display: "grid", gap: "4px" }}>
          <p style={{ margin: 0, color: "#555" }}>
            Type counts:{" "}
            {cmSummary.byType.length > 0
              ? cmSummary.byType.map(([label, count]) => `${label}: ${count}`).join(" | ")
              : "-"}
          </p>
          <p style={{ margin: 0, color: "#555" }}>
            Amount counts:{" "}
            {cmSummary.byAmount.length > 0
              ? cmSummary.byAmount.map(([label, count]) => `${label}: ${count}`).join(" | ")
              : "-"}
          </p>
        </div>

        <button
          type="button"
          onClick={copyCmCsv}
          style={{
            justifySelf: "start",
            border: "1px solid #c9a98b",
            borderRadius: "999px",
            padding: "8px 14px",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Copy CSV
        </button>

        <label style={{ display: "grid", gap: "6px", color: "#444" }}>
          Export data
          <textarea
            readOnly
            value={cmCsv}
            rows={Math.min(16, Math.max(6, cmLog.length + 1))}
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "10px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: "0.88rem",
            }}
          />
        </label>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          display: "grid",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>Symptoms Log</h2>
        <p style={{ margin: 0, color: "#555" }}>
          Days where pain symptoms, mood/emotions, or general symptoms were logged.
        </p>

        {symptomsLog.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>No symptoms data logged yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "700px",
              }}
            >
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Date</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Cycle Day</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Pain/Symptoms</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Mood/Emotions</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>General Symptoms</th>
                </tr>
              </thead>
              <tbody>
                {symptomsLog.map((row) => (
                  <tr key={`${row.date}-${row.cycleDay || "na"}`}>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.date}</td>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.cycleDay || "-"}</td>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.painSymptoms.join(", ") || "-"}</td>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.moodEmotions.join(", ") || "-"}</td>
                    <td style={{ borderBottom: "1px solid #efefef", padding: "8px" }}>{row.generalSymptoms.join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          display: "grid",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>Symptoms Export Numbers</h2>

        <p style={{ margin: 0, color: "#555" }}>
          Total logged days: <strong>{symptomsSummary.totalLoggedDays}</strong>
        </p>

        <div style={{ display: "grid", gap: "4px" }}>
          <p style={{ margin: 0, color: "#555" }}>
            Pain/symptom counts:{" "}
            {symptomsSummary.painCounts.length > 0
              ? symptomsSummary.painCounts.map(([label, count]) => `${label}: ${count}`).join(" | ")
              : "-"}
          </p>
          <p style={{ margin: 0, color: "#555" }}>
            Mood/emotion counts:{" "}
            {symptomsSummary.moodCounts.length > 0
              ? symptomsSummary.moodCounts.map(([label, count]) => `${label}: ${count}`).join(" | ")
              : "-"}
          </p>
          <p style={{ margin: 0, color: "#555" }}>
            General symptom counts:{" "}
            {symptomsSummary.generalCounts.length > 0
              ? symptomsSummary.generalCounts.map(([label, count]) => `${label}: ${count}`).join(" | ")
              : "-"}
          </p>
        </div>

        <button
          type="button"
          onClick={copySymptomsCsv}
          style={{
            justifySelf: "start",
            border: "1px solid #c9a98b",
            borderRadius: "999px",
            padding: "8px 14px",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Copy CSV
        </button>

        <label style={{ display: "grid", gap: "6px", color: "#444" }}>
          Export data
          <textarea
            readOnly
            value={symptomsCsv}
            rows={Math.min(16, Math.max(6, symptomsLog.length + 1))}
            style={{
              width: "100%",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "10px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: "0.88rem",
            }}
          />
        </label>
      </section>
    </div>
  );
}

export default CycleStatistics;
