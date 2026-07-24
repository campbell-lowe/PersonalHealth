import { useEffect, useMemo, useState } from "react";

const DASHBOARD_USERNAMES = ["campbell.lowe"];
const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "30", label: "Last 30 Days" },
  { value: "60", label: "Last 60 Days" },
  { value: "90", label: "Last 90 Days" },
  { value: "custom", label: "Custom Range" },
];

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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function LineChart({ title, color, data }) {
  if (data.length === 0) {
    return (
      <div style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px" }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ marginBottom: 0, color: "#6b7280" }}>Not enough data yet.</p>
      </div>
    );
  }

  const width = 720;
  const height = 230;

  const yValues = data.map((point) => point.y);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const pathData = buildLinePath(data, width, height, minY, maxY);

  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "220px" }} role="img" aria-label={title}>
        <line x1="40" y1="20" x2="40" y2="200" stroke="#d1d5db" />
        <line x1="40" y1="200" x2="680" y2="200" stroke="#d1d5db" />

        <path d={pathData} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((point, index) => {
          const x = 40 + (640 * index) / Math.max(data.length - 1, 1);
          const yRange = maxY - minY || 1;
          const y = 20 + 180 - ((point.y - minY) / yRange) * 180;

          return (
            <g key={`${point.label}-${index}`}>
              <circle cx={x} cy={y} r="3.5" fill={color} />
              {index === 0 || index === data.length - 1 ? (
                <text x={x} y="218" fontSize="11" textAnchor="middle" fill="#4b5563">
                  {point.label}
                </text>
              ) : null}
            </g>
          );
        })}

        <text x="4" y="26" fontSize="11" fill="#4b5563">
          {maxY.toFixed(2)}
        </text>
        <text x="4" y="200" fontSize="11" fill="#4b5563">
          {minY.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}

function HorizontalBarChart({ title, counts }) {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (entries.length === 0) {
    return (
      <div style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px" }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ marginBottom: 0, color: "#6b7280" }}>No selections logged yet.</p>
      </div>
    );
  }

  const maxValue = Math.max(...entries.map(([, value]) => value));

  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px" }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ display: "grid", gap: "10px" }}>
        {entries.map(([label, value]) => {
          const widthPercent = (value / maxValue) * 100;

          return (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "4px" }}>
                <span>{label.replaceAll("_", " ")}</span>
                <span>{value}</span>
              </div>
              <div style={{ background: "#e5e7eb", height: "9px", borderRadius: "999px" }}>
                <div style={{ width: `${widthPercent}%`, height: "9px", background: "#2563eb", borderRadius: "999px" }} />
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
      <div style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px" }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ marginBottom: 0, color: "#6b7280" }}>Not enough cycle-day temperature data yet.</p>
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

  return (
    <div style={{ border: "1px solid #d1d5db", borderRadius: "10px", padding: "14px" }}>
      <h3 style={{ marginTop: 0, marginBottom: "8px" }}>{title}</h3>
      <p style={{ marginTop: 0, marginBottom: "12px", color: "#6b7280", fontSize: "0.9rem" }}>
        Long view by cycle day. Green ring markers show days where ovulation was marked true.
      </p>

      <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: "260px" }} role="img" aria-label={title}>
          <line x1={left} y1={top} x2={left} y2={height - bottom} stroke="#d1d5db" />
          <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} stroke="#d1d5db" />

          {dayTicks.map((day) => {
            const x = xForDay(day);
            return (
              <g key={`tick-${day}`}>
                <line x1={x} y1={top} x2={x} y2={height - bottom} stroke="#f3f4f6" />
                <text x={x} y={height - 8} fontSize="10" textAnchor="middle" fill="#4b5563">
                  {day}
                </text>
              </g>
            );
          })}

          <path d={pathData} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {sorted.map((point, index) => {
            const x = xForDay(point.cycleDay);
            const y = yForTemp(point.temp);

            return (
              <g key={`${point.date}-${point.cycleDay}-${index}`}>
                <circle cx={x} cy={y} r="3.5" fill="#ef4444" />
                {point.ovulationConfirmed ? <circle cx={x} cy={y} r="6.5" fill="none" stroke="#059669" strokeWidth="2" /> : null}
              </g>
            );
          })}

          <text x="8" y={top + 4} fontSize="11" fill="#4b5563">
            {yMax.toFixed(2)}
          </text>
          <text x="8" y={height - bottom} fontSize="11" fill="#4b5563">
            {yMin.toFixed(2)}
          </text>
        </svg>
      </div>
    </div>
  );
}

function CycleDashboard() {
  const [username, setUsername] = useState(DASHBOARD_USERNAMES[0]);
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("Loading dashboard data...");
  const [rangePreset, setRangePreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const dashboardData = useMemo(() => {
    const sorted = [...entries].sort((a, b) => (a.date > b.date ? 1 : -1));
    const filtered = sorted.filter((entry) =>
      isInDateRange(entry.date, rangePreset, startDate, endDate)
    );

    const temperaturePoints = filtered
      .map((entry) => {
        const preferredTemp = toNumber(entry.thermometerTemp) ?? toNumber(entry.wristTemp);
        if (preferredTemp === null) return null;

        return {
          label: entry.date,
          y: preferredTemp,
        };
      })
      .filter(Boolean);

    const lhPoints = filtered
      .map((entry) => {
        const morning = toNumber(entry.lhMorning);
        const night = toNumber(entry.lhNight);
        const value = morning !== null || night !== null ? Math.max(morning ?? -Infinity, night ?? -Infinity) : null;

        if (value === null || value === -Infinity) return null;

        return {
          label: entry.date,
          y: value,
        };
      })
      .filter(Boolean);

    const cycleDayPoints = filtered
      .map((entry) => {
        const cycleDayValue = toNumber(entry.cycleDay);
        if (cycleDayValue === null) return null;

        return {
          label: entry.date,
          y: cycleDayValue,
        };
      })
      .filter(Boolean);

    const cycleDayTemperaturePoints = filtered
      .map((entry) => {
        const cycleDayValue = toNumber(entry.cycleDay);
        const preferredTemp = toNumber(entry.thermometerTemp) ?? toNumber(entry.wristTemp);

        if (cycleDayValue === null || preferredTemp === null) return null;

        return {
          date: entry.date,
          cycleDay: cycleDayValue,
          temp: preferredTemp,
          ovulationConfirmed: entry.ovulationConfirmed === true,
        };
      })
      .filter(Boolean);

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

    const cycleDayAverage =
      cycleDayPoints.length > 0
        ? cycleDayPoints.reduce((sum, point) => sum + point.y, 0) / cycleDayPoints.length
        : null;

    const rangeStart = filtered.length > 0 ? filtered[0].date : null;
    const lastInRange = filtered.at(-1);
    const rangeEnd = lastInRange ? lastInRange.date : null;

    return {
      totalEntries: filtered.length,
      totalEntriesAllTime: sorted.length,
      temperaturePoints,
      lhPoints,
      cycleDayPoints,
      cycleDayTemperaturePoints,
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
        <LineChart title="Temperature Trend" color="#ef4444" data={dashboardData.temperaturePoints} />
        <LineChart title="LH Trend (Daily Peak)" color="#7c3aed" data={dashboardData.lhPoints} />
        <LineChart title="Cycle Day Trend" color="#059669" data={dashboardData.cycleDayPoints} />
      </div>

      <LongCycleDayChart
        title="Temperature by Cycle Day (Long Graph)"
        data={dashboardData.cycleDayTemperaturePoints}
      />

      <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <HorizontalBarChart title="Most Frequent Pain/Symptoms" counts={dashboardData.symptomCounts} />
        <HorizontalBarChart title="Most Frequent Mood/Emotions" counts={dashboardData.moodCounts} />
      </div>
    </div>
  );
}

export default CycleDashboard;
