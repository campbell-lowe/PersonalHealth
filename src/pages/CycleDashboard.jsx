import { useEffect, useMemo, useState } from "react";

const DASHBOARD_USERNAMES = ["campbell.lowe"];
const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "30", label: "Last 30 Days" },
  { value: "60", label: "Last 60 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "custom", label: "Custom Range" },
];

const chartCardStyle = {
  border: "1px solid #d7e0ea",
  borderRadius: "16px",
  padding: "16px",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
};

const emptyChartTextStyle = {
  marginBottom: 0,
  color: "#6b7280",
};

const chartMetaTextStyle = {
  marginTop: 0,
  marginBottom: "12px",
  color: "#64748b",
  fontSize: "0.9rem",
};

const statRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "8px",
  marginBottom: "12px",
};

const statCardStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "10px 12px",
  background: "#ffffff",
};

function parseEntryDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function isInDateRange(dateString, rangePreset, startDate, endDate) {
  const entryDate = parseEntryDate(dateString);

  if (rangePreset === "custom") {
    if (startDate) {
      const start = parseEntryDate(startDate);
      if (entryDate < start) return false;
    }

    if (endDate) {
      const end = parseEntryDate(endDate);
      if (entryDate > end) return false;
    }

    return true;
  }

  if (rangePreset === "all") {
    return true;
  }

  const days = Number(rangePreset);
  if (!Number.isFinite(days) || days <= 0) {
    return true;
  }

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return entryDate >= cutoff;
}

function toStartOfDay(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function getDaysSince(dateString) {
  if (!dateString) return null;

  const today = toStartOfDay(new Date());
  const target = toStartOfDay(parseEntryDate(dateString));
  const diffMs = today - target;

  if (diffMs < 0) return 0;

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatShortDate(dateString) {
  const date = parseEntryDate(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatChartLabel(label) {
  return label.includes("-") ? formatShortDate(label) : label;
}

function humanizeOptionLabel(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function createValueTicks(minValue, maxValue, tickCount = 4) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return [];
  }

  if (minValue === maxValue) {
    return [minValue];
  }

  const ticks = [];
  const step = (maxValue - minValue) / tickCount;

  for (let index = 0; index <= tickCount; index += 1) {
    ticks.push(minValue + step * index);
  }

  return ticks;
}

function formatTickValue(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getSeriesSummary(data) {
  if (data.length === 0) {
    return null;
  }

  const latest = data.at(-1);
  const values = data.map((point) => point.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const previous = data.length > 1 ? data.at(-2) : null;
  const change = previous ? latest.y - previous.y : null;

  return {
    latest,
    min,
    max,
    change,
  };
}

function summarizeLoggedCycles(entries) {
  const cycles = [];
  let currentCycle = null;

  entries.forEach((entry) => {
    const cycleDay = toNumber(entry.cycleDay);
    if (cycleDay === null) {
      return;
    }

    const startsNewCycle = currentCycle === null || cycleDay === 1;

    if (startsNewCycle) {
      if (currentCycle) {
        cycles.push(currentCycle);
      }

      currentCycle = {
        startDate: entry.date,
        endDate: entry.date,
        loggedDays: 1,
        maxCycleDay: cycleDay,
      };

      return;
    }

    currentCycle.endDate = entry.date;
    currentCycle.loggedDays += 1;
    currentCycle.maxCycleDay = Math.max(currentCycle.maxCycleDay, cycleDay);
  });

  if (currentCycle) {
    cycles.push(currentCycle);
  }

  return cycles.reverse();
}

function buildCycleWindows(entries) {
  const sorted = [...entries].sort((a, b) => (a.date > b.date ? 1 : -1));
  const starts = sorted.filter((entry) => toNumber(entry.cycleDay) === 1);

  if (starts.length === 0) {
    return [];
  }

  return starts.map((startEntry, index) => {
    const nextStart = starts[index + 1];
    const endDateExclusive = nextStart?.date || null;

    const windowEntries = sorted.filter((entry) => {
      if (entry.date < startEntry.date) {
        return false;
      }

      if (!endDateExclusive) {
        return true;
      }

      return entry.date < endDateExclusive;
    });

    return {
      startDate: startEntry.date,
      endDateExclusive,
      entries: windowEntries,
    };
  });
}

function StatCard({ label, value }) {
  return (
    <div style={statCardStyle}>
      <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

function RecentValuesTable({ data, valueFormatter }) {
  const recentItems = [...data].slice(-5).reverse();

  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
        Most Recent Values
      </div>
      <div style={{ display: "grid", gap: "6px" }}>
        {recentItems.map((point) => (
          <div
            key={`${point.label}-${point.y}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              fontSize: "0.88rem",
              padding: "7px 10px",
              borderRadius: "10px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <span style={{ color: "#475569" }}>{formatChartLabel(point.label)}</span>
            <strong style={{ color: "#0f172a" }}>{valueFormatter(point.y)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildAreaPath(points, width, height, minY, maxY) {
  if (points.length === 0) return "";

  const innerWidth = width - 60;
  const innerHeight = height - 50;
  const xStart = 40;
  const yStart = 20;
  const baseline = yStart + innerHeight;
  const yRange = maxY - minY || 1;

  const lineSegments = points.map((point, index) => {
    const x = xStart + (innerWidth * index) / Math.max(points.length - 1, 1);
    const normalizedY = (point.y - minY) / yRange;
    const y = yStart + innerHeight - normalizedY * innerHeight;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  const lastX = xStart + (innerWidth * (points.length - 1)) / Math.max(points.length - 1, 1);

  return `${lineSegments.join(" ")} L${lastX.toFixed(2)} ${baseline.toFixed(2)} L${xStart.toFixed(2)} ${baseline.toFixed(2)} Z`;
}

function normalizeMultiValueField(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string") return [parsed];
    } catch {
      return [value];
    }
  }

  return [];
}

function buildLinePath(points, width, height, minY, maxY) {
  if (points.length === 0) return "";

  const innerWidth = width - 60;
  const innerHeight = height - 50;
  const xStart = 40;
  const yStart = 20;

  const yRange = maxY - minY || 1;

  return points
    .map((point, index) => {
      const x = xStart + (innerWidth * index) / Math.max(points.length - 1, 1);
      const normalizedY = (point.y - minY) / yRange;
      const y = yStart + innerHeight - normalizedY * innerHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function LineChart({ title, color, data, description, valueFormatter = formatTickValue }) {
  if (data.length === 0) {
    return (
      <div style={chartCardStyle}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={emptyChartTextStyle}>Not enough data yet.</p>
      </div>
    );
  }

  const width = 720;
  const height = 230;

  const yValues = data.map((point) => point.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const pathData = buildLinePath(data, width, height, minY, maxY);
  const areaPathData = buildAreaPath(data, width, height, minY, maxY);
  const yTicks = createValueTicks(minY, maxY, 4);
  const summary = getSeriesSummary(data);
  const xTickIndexes = data.length <= 6
    ? data.map((_, index) => index)
    : Array.from(new Set([0, Math.floor((data.length - 1) * 0.25), Math.floor((data.length - 1) * 0.5), Math.floor((data.length - 1) * 0.75), data.length - 1]));

  return (
    <div style={chartCardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={chartMetaTextStyle}>
        {description || `Rightmost point is the newest day. ${data.length} point${data.length === 1 ? "" : "s"} shown.`}
      </p>
      {summary ? (
        <div style={statRowStyle}>
          <StatCard label="Latest" value={`${valueFormatter(summary.latest.y)} on ${formatChartLabel(summary.latest.label)}`} />
          <StatCard label="Lowest" value={valueFormatter(summary.min)} />
          <StatCard label="Highest" value={valueFormatter(summary.max)} />
          <StatCard
            label="Change From Previous"
            value={summary.change === null ? "n/a" : `${summary.change > 0 ? "+" : ""}${valueFormatter(summary.change)}`}
          />
        </div>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "220px" }} role="img" aria-label={title}>
        <defs>
          <linearGradient id={`area-${title.replaceAll(" ", "-")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const yRange = maxY - minY || 1;
          const y = 20 + 180 - ((tick - minY) / yRange) * 180;

          return (
            <g key={`y-${tick}`}>
              <line x1="40" y1={y} x2="680" y2={y} stroke="#e7edf4" strokeDasharray="4 6" />
              <text x="34" y={y + 4} fontSize="11" textAnchor="end" fill="#64748b">
                {formatTickValue(tick)}
              </text>
            </g>
          );
        })}

        <line x1="40" y1="20" x2="40" y2="200" stroke="#cbd5e1" />
        <line x1="40" y1="200" x2="680" y2="200" stroke="#cbd5e1" />

        <path d={areaPathData} fill={`url(#area-${title.replaceAll(" ", "-")})`} />

        <path d={pathData} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((point, index) => {
          const x = 40 + (640 * index) / Math.max(data.length - 1, 1);
          const yRange = maxY - minY || 1;
          const y = 20 + 180 - ((point.y - minY) / yRange) * 180;
          const isLatest = index === data.length - 1;

          return (
            <g key={`${point.label}-${index}`}>
              <circle cx={x} cy={y} r="4" fill={color} stroke="#ffffff" strokeWidth="2" />
              {isLatest ? (
                <text x={x - 8} y={Math.max(16, y - 10)} fontSize="11" textAnchor="end" fill="#0f172a">
                  {valueFormatter(point.y)}
                </text>
              ) : null}
              {xTickIndexes.includes(index) ? (
                <text x={x} y="218" fontSize="11" textAnchor="middle" fill="#64748b">
                  {formatChartLabel(point.label)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <RecentValuesTable data={data} valueFormatter={valueFormatter} />
    </div>
  );
}

function HorizontalBarChart({ title, counts }) {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (entries.length === 0) {
    return (
      <div style={chartCardStyle}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={emptyChartTextStyle}>No selections logged yet.</p>
      </div>
    );
  }

  const maxValue = Math.max(...entries.map(([, value]) => value));

  return (
    <div style={chartCardStyle}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={chartMetaTextStyle}>Top {entries.length} logged selections in the active date range.</p>
      <div style={{ display: "grid", gap: "10px" }}>
        {entries.map(([label, value]) => {
          const widthPercent = (value / maxValue) * 100;

          return (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "4px" }}>
                <span>{humanizeOptionLabel(label)}</span>
                <span>{value}</span>
              </div>
              <div style={{ background: "#e5e7eb", height: "10px", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ width: `${widthPercent}%`, height: "10px", background: "linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)", borderRadius: "999px" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LongCycleDayChart({ title, data }) {
  if (data.length === 0) {
    return (
      <div style={chartCardStyle}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={emptyChartTextStyle}>Not enough cycle-day temperature data yet.</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => {
    if (a.cycleDay !== b.cycleDay) {
      return a.cycleDay - b.cycleDay;
    }

    return a.date > b.date ? 1 : -1;
  });

  const minDay = Math.min(...sorted.map((point) => point.cycleDay));
  const maxDay = Math.max(...sorted.map((point) => point.cycleDay));
  const minTemp = Math.min(...sorted.map((point) => point.temp));
  const maxTemp = Math.max(...sorted.map((point) => point.temp));

  const width = Math.max(980, (maxDay + 1) * 42);
  const height = 280;
  const left = 56;
  const right = 20;
  const top = 20;
  const bottom = 46;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const dayRange = maxDay - minDay || 1;
  const yMin = minTemp - 0.05;
  const yMax = maxTemp + 0.05;
  const yRange = yMax - yMin || 1;

  const xForDay = (day) => left + ((day - minDay) / dayRange) * innerWidth;
  const yForTemp = (temp) => top + innerHeight - ((temp - yMin) / yRange) * innerHeight;

  const pathData = sorted
    .map((point, index) => `${index === 0 ? "M" : "L"}${xForDay(point.cycleDay).toFixed(2)} ${yForTemp(point.temp).toFixed(2)}`)
    .join(" ");

  let tickStep = 1;
  if (dayRange > 24) {
    tickStep = 3;
  } else if (dayRange > 12) {
    tickStep = 2;
  }
  const dayTicks = [];
  for (let day = minDay; day <= maxDay; day += tickStep) {
    dayTicks.push(day);
  }
  if (dayTicks.at(-1) !== maxDay) {
    dayTicks.push(maxDay);
  }

  const yTicks = createValueTicks(yMin, yMax, 4);
  const latestPoint = sorted.at(-1);

  return (
    <div style={chartCardStyle}>
      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>{title}</h3>
      <p style={chartMetaTextStyle}>
        Long view by cycle day. Green ring markers show days where ovulation was marked true.
      </p>
      <div style={statRowStyle}>
        <StatCard label="Latest Day Shown" value={`Day ${latestPoint.cycleDay}`} />
        <StatCard label="Latest Temperature" value={formatTickValue(latestPoint.temp)} />
        <StatCard label="Lowest Temperature" value={formatTickValue(minTemp)} />
        <StatCard label="Highest Temperature" value={formatTickValue(maxTemp)} />
      </div>

      <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: "260px" }} role="img" aria-label={title}>
          {yTicks.map((tick) => {
            const y = yForTemp(tick);

            return (
              <g key={`temp-${tick}`}>
                <line x1={left} y1={y} x2={width - right} y2={y} stroke="#e7edf4" strokeDasharray="4 6" />
                <text x={left - 8} y={y + 4} fontSize="11" textAnchor="end" fill="#64748b">
                  {formatTickValue(tick)}
                </text>
              </g>
            );
          })}

          <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="#cbd5e1" />
          <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="#cbd5e1" />

          {dayTicks.map((day) => {
            const x = xForDay(day);
            return (
              <g key={`tick-${day}`}>
                <line x1={x} y1={top} x2={x} y2={height - bottom} stroke="#eef2f7" />
                <text x={x} y={height - 8} fontSize="10" textAnchor="middle" fill="#64748b">
                  {day}
                </text>
              </g>
            );
          })}

          <path d={pathData} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {sorted.map((point, index) => {
            const x = xForDay(point.cycleDay);
            const y = yForTemp(point.temp);
            const isLatest = index === sorted.length - 1;

            return (
              <g key={`${point.date}-${point.cycleDay}-${index}`}>
                <circle cx={x} cy={y} r="4" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                {point.ovulationConfirmed ? <circle cx={x} cy={y} r="6.5" fill="none" stroke="#059669" strokeWidth="2" /> : null}
                {isLatest ? (
                  <text x={x - 8} y={Math.max(16, y - 10)} fontSize="11" textAnchor="end" fill="#0f172a">
                    {formatTickValue(point.temp)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <RecentValuesTable
        data={sorted.map((point) => ({ label: `${point.date} (Day ${point.cycleDay})`, y: point.temp }))}
        valueFormatter={formatTickValue}
      />
    </div>
  );
}

function CycleSummaryCards({ cycles }) {
  if (cycles.length === 0) {
    return (
      <div style={chartCardStyle}>
        <h3 style={{ marginTop: 0 }}>Logged Cycles</h3>
        <p style={emptyChartTextStyle}>Not enough cycle-day data yet.</p>
      </div>
    );
  }

  return (
    <div style={chartCardStyle}>
      <h3 style={{ marginTop: 0 }}>Logged Cycles</h3>
      <p style={chartMetaTextStyle}>
        Each box shows the date range covered by a logged cycle and how many entries are in it.
      </p>
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {cycles.map((cycle, index) => (
          <div
            key={`${cycle.startDate}-${cycle.endDate}-${index}`}
            style={{
              border: "1px solid #d7e0ea",
              borderRadius: "14px",
              padding: "14px",
              background: "#ffffff",
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "4px" }}>
              Cycle {cycles.length - index}
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#0f172a", marginBottom: "8px" }}>
              {formatChartLabel(cycle.startDate)} to {formatChartLabel(cycle.endDate)}
            </div>
            <div style={{ display: "grid", gap: "6px", color: "#475569", fontSize: "0.9rem" }}>
              <span>Logged Days: {cycle.loggedDays}</span>
              <span>Highest Cycle Day: {cycle.maxCycleDay}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildCycleDayTemperaturePoints(entries, temperatureField) {
  return entries
    .map((entry) => {
      const cycleDayValue = toNumber(entry.cycleDay);
      const temperatureValue = toNumber(entry[temperatureField]);

      if (cycleDayValue === null || temperatureValue === null) return null;

      return {
        date: entry.date,
        cycleDay: cycleDayValue,
        temp: temperatureValue,
        ovulationConfirmed: entry.ovulationConfirmed === true,
      };
    })
    .filter(Boolean);
}

function CycleDashboard() {
  const [username, setUsername] = useState(DASHBOARD_USERNAMES[0]);
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("Loading dashboard data...");
  const [rangePreset, setRangePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedCycleStartDate, setSelectedCycleStartDate] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadEntries() {
      try {
        setStatus("Loading dashboard data...");

        const response = await fetch(`http://localhost:3000/api/cycle?username=${encodeURIComponent(username)}`);

        if (!response.ok) {
          throw new Error("Could not load cycle entries.");
        }

        const data = await response.json();

        if (cancelled) return;

        setEntries(data);
        setStatus(data.length === 0 ? "No entries yet for this user." : "");
      } catch (error) {
        if (cancelled) return;

        console.error(error);
        setStatus("Could not load dashboard. Make sure backend is running on port 3000.");
      }
    }

    loadEntries();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const cycleWindows = useMemo(() => buildCycleWindows(entries), [entries]);

  useEffect(() => {
    if (cycleWindows.length === 0) {
      if (selectedCycleStartDate !== "") {
        setSelectedCycleStartDate("");
      }
      return;
    }

    const hasSelection = cycleWindows.some(
      (cycleWindow) => cycleWindow.startDate === selectedCycleStartDate
    );

    if (!hasSelection) {
      setSelectedCycleStartDate(cycleWindows.at(-1).startDate);
    }
  }, [cycleWindows, selectedCycleStartDate]);

  const selectedCycleWindow = useMemo(() => {
    if (!selectedCycleStartDate) {
      return null;
    }

    return (
      cycleWindows.find(
        (cycleWindow) => cycleWindow.startDate === selectedCycleStartDate
      ) || null
    );
  }, [cycleWindows, selectedCycleStartDate]);

  const dashboardData = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date > b.date ? 1 : -1));
    const filtered = sorted.filter((entry) =>
      isInDateRange(entry.date, rangePreset, startDate, endDate)
    );

    const thermometerPoints = filtered
      .map((entry) => {
        const thermometerTemp = toNumber(entry.thermometerTemp);
        if (thermometerTemp === null) return null;

        return {
          label: entry.date,
          y: thermometerTemp,
        };
      })
      .filter(Boolean);

    const wristTemperaturePoints = filtered
      .map((entry) => {
        const wristTemp = toNumber(entry.wristTemp);
        if (wristTemp === null) return null;

        return {
          label: entry.date,
          y: wristTemp,
        };
      })
      .filter(Boolean);

    const lhPoints = filtered
      .map((entry) => {
        const morning = toNumber(entry.lhMorning);
        const afternoon = toNumber(entry.lhAfternoon);
        const night = toNumber(entry.lhNight);
        const value =
          morning !== null || afternoon !== null || night !== null
            ? Math.max(morning ?? -Infinity, afternoon ?? -Infinity, night ?? -Infinity)
            : null;

        if (value === null || value === -Infinity) return null;

        return {
          label: entry.date,
          y: value,
        };
      })
      .filter(Boolean);

    const cycleSummaries = summarizeLoggedCycles(filtered);

    const thermometerCycleDayPoints = buildCycleDayTemperaturePoints(filtered, "thermometerTemp");
    const wristCycleDayPoints = buildCycleDayTemperaturePoints(filtered, "wristTemp");

    const symptomCounts = {};
    const moodCounts = {};

    filtered.forEach((entry) => {
      normalizeMultiValueField(entry.painSymptoms).forEach((item) => {
        symptomCounts[item] = (symptomCounts[item] || 0) + 1;
      });

      normalizeMultiValueField(entry.moodEmotions).forEach((item) => {
        moodCounts[item] = (moodCounts[item] || 0) + 1;
      });
    });

    const ovulationConfirmedDays = filtered.filter((entry) => entry.ovulationConfirmed === true).length;

    const unprotectedEntries = sorted.filter((entry) => {
      if (entry.intercourse !== true) return false;

      const noProtection = entry.usedProtection === false;
      const pullOut = entry.protectionType === "pull_out";

      return noProtection || pullOut;
    });

    const lastUnprotectedEntryDate = unprotectedEntries.length > 0 ? unprotectedEntries.at(-1).date : null;
    const daysSinceNoProtectionSex = getDaysSince(lastUnprotectedEntryDate);

    const cycleDayValues = filtered
      .map((entry) => toNumber(entry.cycleDay))
      .filter((value) => value !== null);

    const cycleDayAverage =
      cycleDayValues.length > 0
        ? cycleDayValues.reduce((sum, value) => sum + value, 0) / cycleDayValues.length
        : null;

    const rangeStart = filtered.length > 0 ? filtered[0].date : null;
    const lastInRange = filtered.at(-1);
    const rangeEnd = lastInRange ? lastInRange.date : null;

    return {
      totalEntries: filtered.length,
      totalEntriesAllTime: sorted.length,
      thermometerPoints,
      wristTemperaturePoints,
      lhPoints,
      cycleSummaries,
      thermometerCycleDayPoints,
      wristCycleDayPoints,
      symptomCounts,
      moodCounts,
      ovulationConfirmedDays,
      daysSinceNoProtectionSex,
      lastUnprotectedEntryDate,
      cycleDayAverage,
      rangeStart,
      rangeEnd,
    };
  }, [entries, rangePreset, startDate, endDate]);

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <h1 style={{ marginBottom: 0 }}>Cycle Dashboard</h1>

      <div style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "12px", display: "grid", gap: "10px" }}>
        <label style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ minWidth: "84px" }}>Username</span>
          <select value={username} onChange={(event) => setUsername(event.target.value)}>
            {DASHBOARD_USERNAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ minWidth: "84px" }}>Date Range</span>
          <select value={rangePreset} onChange={(event) => setRangePreset(event.target.value)}>
            {DATE_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {rangePreset === "custom" ? (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                aria-label="Start date"
              />
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                aria-label="End date"
              />
            </>
          ) : null}
        </label>

        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", color: "#374151" }}>
          <span>Entries in Range: {dashboardData.totalEntries}</span>
          <span>Entries All Time: {dashboardData.totalEntriesAllTime}</span>
          <span>
            Range: {dashboardData.rangeStart && dashboardData.rangeEnd ? `${dashboardData.rangeStart} to ${dashboardData.rangeEnd}` : "No entries in selected range"}
          </span>
          <span>Ovulation Confirmed Days: {dashboardData.ovulationConfirmedDays}</span>
          <span>
            Days Since No-Protection Sex: {dashboardData.daysSinceNoProtectionSex ?? "n/a"}
          </span>
          <span>
            Last No-Protection Date: {dashboardData.lastUnprotectedEntryDate || "n/a"}
          </span>
          <span>
            Avg Cycle Day: {dashboardData.cycleDayAverage !== null ? dashboardData.cycleDayAverage.toFixed(1) : "n/a"}
          </span>
        </div>
      </div>

      {status ? <p>{status}</p> : null}

      <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <LineChart
          title="Thermometer Temperature Trend"
          color="#dc2626"
          data={dashboardData.thermometerPoints}
          description="Tracks thermometer temperatures only."
        />
        <LineChart
          title="Wrist Temperature Trend"
          color="#2563eb"
          data={dashboardData.wristTemperaturePoints}
          description="Tracks wrist temperatures only."
        />
        <LineChart
          title="LH Trend (Daily Peak)"
          color="#7c3aed"
          data={dashboardData.lhPoints}
          description="Shows the highest LH reading logged for each day."
        />
        <CycleSummaryCards cycles={dashboardData.cycleSummaries} />
      </div>

      <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <LongCycleDayChart
          title="Thermometer Temperature by Cycle Day"
          data={dashboardData.thermometerCycleDayPoints}
        />
        <LongCycleDayChart
          title="Wrist Temperature by Cycle Day"
          data={dashboardData.wristCycleDayPoints}
        />
      </div>

      <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <HorizontalBarChart title="Most Frequent Pain/Symptoms" counts={dashboardData.symptomCounts} />
        <HorizontalBarChart title="Most Frequent Mood/Emotions" counts={dashboardData.moodCounts} />
      </div>

      <div style={chartCardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "8px" }}>Cycle Day 1 Filter</h3>
        <p style={chartMetaTextStyle}>
          Click a Cycle Day 1 date to view all entries from that date until the next Cycle Day 1.
        </p>

        {cycleWindows.length === 0 ? (
          <p style={emptyChartTextStyle}>No Cycle Day 1 entries found yet.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "14px" }}>
              {cycleWindows.map((cycleWindow) => {
                const isSelected = cycleWindow.startDate === selectedCycleStartDate;

                return (
                  <button
                    key={cycleWindow.startDate}
                    type="button"
                    onClick={() => setSelectedCycleStartDate(cycleWindow.startDate)}
                    style={{
                      border: isSelected ? "1px solid #0ea5e9" : "1px solid #d1d5db",
                      background: isSelected ? "#e0f2fe" : "#ffffff",
                      color: "#0f172a",
                      borderRadius: "999px",
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  >
                    {cycleWindow.startDate}
                  </button>
                );
              })}
            </div>

            {selectedCycleWindow ? (
              <>
                <div style={{ marginBottom: "10px", color: "#334155" }}>
                  <strong>Selected window:</strong> {selectedCycleWindow.startDate} to {selectedCycleWindow.endDateExclusive || "latest entry"}
                  {" "}
                  ({selectedCycleWindow.entries.length} entries)
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  {selectedCycleWindow.entries.map((entry) => (
                    <details key={`${entry.date}-${entry.id}`} style={{ border: "1px solid #dbe5ef", borderRadius: "10px", padding: "8px 10px", background: "#ffffff" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 600, color: "#0f172a" }}>
                        {entry.date} | CD {entry.cycleDay ?? "n/a"}
                      </summary>
                      <pre
                        style={{
                          margin: "8px 0 0",
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "10px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          fontSize: "0.82rem",
                        }}
                      >
                        {JSON.stringify(entry, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default CycleDashboard;
