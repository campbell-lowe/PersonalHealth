import WellnessGoalsWorkspace from "../components/WellnessGoalsWorkspace";
import { useEffect, useMemo, useState } from "react";

const LIFESTYLE_TEMPLATES = [
  "30 minutes movement",
  "No caffeine after 2 PM",
  "7+ hours sleep",
  "Bedtime wind-down routine",
  "8+ cups water",
  "10 minutes stretch",
  "Whole-food lunch",
  "20 minutes outside",
  "5 minutes breathing practice",
];

function toSleepNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function Lifestyle({ username }) {
  const [sleepEntries, setSleepEntries] = useState([]);
  const [sleepStatus, setSleepStatus] = useState("");

  useEffect(() => {
    async function loadSleepFromCycleTracker() {
      try {
        setSleepStatus("");

        const response = await fetch(
          `http://localhost:3000/api/cycle?username=${encodeURIComponent(username)}`
        );

        if (!response.ok) {
          throw new Error(`Could not load cycle entries (${response.status}).`);
        }

        const entries = await response.json();
        const normalized = Array.isArray(entries)
          ? entries
              .map((entry) => ({
                date: entry.date,
                sleepHours: toSleepNumber(entry.sleepHours),
              }))
              .filter((entry) => entry.date && entry.sleepHours !== null)
              .sort((a, b) => (a.date < b.date ? 1 : -1))
          : [];

        setSleepEntries(normalized);
      } catch (error) {
        console.error(error);
        setSleepStatus(error.message || "Could not load sleep data from cycle tracker.");
      }
    }

    loadSleepFromCycleTracker();
  }, [username]);

  const sleepSummary = useMemo(() => {
    const recent = sleepEntries.slice(0, 14);
    if (recent.length === 0) {
      return {
        recent,
        average: null,
        nightsAtOrAboveSeven: 0,
        lastLogged: null,
      };
    }

    const total = recent.reduce((sum, item) => sum + item.sleepHours, 0);
    return {
      recent,
      average: total / recent.length,
      nightsAtOrAboveSeven: recent.filter((item) => item.sleepHours >= 7).length,
      lastLogged: recent[0],
    };
  }, [sleepEntries]);

  const sleepPanel = useMemo(
    () => (
      <section className="wellness-card sleep-pull-card">
        <h2>Sleep Pulled From Cycle Tracker</h2>
        <p className="wellness-muted">
          This section reads your logged sleep hours from cycle entries so you do not have to track
          sleep twice.
        </p>

        {sleepStatus ? <p className="wellness-muted">{sleepStatus}</p> : null}

        <div className="planner-note-box">
          <p>
            Last logged sleep: <strong>{sleepSummary.lastLogged ? `${sleepSummary.lastLogged.sleepHours} h on ${sleepSummary.lastLogged.date}` : "No sleep logged yet"}</strong>
          </p>
          <p>
            Recent average (up to 14 logs): <strong>{sleepSummary.average === null ? "-" : `${sleepSummary.average.toFixed(1)} h`}</strong>
          </p>
          <p>
            Nights at 7+ hours: <strong>{sleepSummary.nightsAtOrAboveSeven}</strong>
          </p>
        </div>

        {sleepSummary.recent.length > 0 ? (
          <ul className="sleep-pull-list">
            {sleepSummary.recent.slice(0, 7).map((item) => (
              <li key={item.date}>
                <span>{item.date}</span>
                <strong>{item.sleepHours} h</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    ),
    [sleepStatus, sleepSummary]
  );

  return (
    <WellnessGoalsWorkspace
      username={username}
      category="lifestyle"
      kicker="Support Section"
      title="Lifestyle"
      description="Strengthen the habits that support hormones, recovery, mood, and cycle stability over time."
      infoCards={[
        {
          title: "Sleep",
          description: "Consistent sleep and wake times improve resilience and energy.",
        },
        {
          title: "Movement",
          description: "Mix lighter days with strength and moderate cardio for balance.",
        },
        {
          title: "Nourishment",
          description: "Prioritize protein, fiber, hydration, and blood-sugar stability.",
        },
      ]}
      templates={LIFESTYLE_TEMPLATES}
      inputPlaceholder="Enter a lifestyle goal..."
      trackerHeading="Lifestyle Goal Trackers"
      emptyText="No lifestyle goals yet. Add one above or choose from the quick templates."
      topPanel={sleepPanel}
    />
  );
}

export default Lifestyle;
