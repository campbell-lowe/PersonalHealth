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
    </div>
  );
}

export default CycleStatistics;
