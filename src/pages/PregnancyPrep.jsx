import WellnessGoalsWorkspace from "../components/WellnessGoalsWorkspace";
import { useEffect, useMemo, useState } from "react";

const PREGNANCY_PREP_TEMPLATES = [
  "Prenatal vitamin daily",
  "Hydration goal (8+ cups)",
  "Protein-forward breakfast",
  "No alcohol",
  "20-minute walk",
  "Sleep by 10:30 PM",
  "Schedule preconception appointment",
  "Track ovulation signs daily",
];

function toMonthInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function shiftMonth(monthString, delta) {
  if (!monthString) return "";
  const [year, month] = monthString.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1 + delta, 1);
  const shiftedYear = date.getFullYear();
  const shiftedMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}`;
}

function daysSinceDate(dateString) {
  if (!dateString) return null;
  const parsed = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.floor((now - parsed) / msPerDay);
  return diff >= 0 ? diff : null;
}

function PregnancyPrep({ username }) {
  const plannerStorageKey = `personalhealth.pregnancyPlanner.${username}`;
  const [targetMonth, setTargetMonth] = useState(() => toMonthInputValue());
  const [preferredCycleLength, setPreferredCycleLength] = useState(28);
  const [birthControlStopDate, setBirthControlStopDate] = useState("");
  const [birthControlTransitionNotes, setBirthControlTransitionNotes] = useState("");
  const [planningNotes, setPlanningNotes] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(plannerStorageKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (typeof saved?.targetMonth === "string" && saved.targetMonth) {
        setTargetMonth(saved.targetMonth);
      }
      if (Number.isFinite(Number(saved?.preferredCycleLength))) {
        setPreferredCycleLength(Math.max(21, Math.min(40, Number(saved.preferredCycleLength))));
      }
      if (typeof saved?.birthControlStopDate === "string") {
        setBirthControlStopDate(saved.birthControlStopDate);
      }
      if (typeof saved?.birthControlTransitionNotes === "string") {
        setBirthControlTransitionNotes(saved.birthControlTransitionNotes);
      }
      if (typeof saved?.planningNotes === "string") {
        setPlanningNotes(saved.planningNotes);
      }
    } catch {
      // Ignore invalid saved planner data.
    }
  }, [plannerStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        plannerStorageKey,
        JSON.stringify({
          targetMonth,
          preferredCycleLength,
          birthControlStopDate,
          birthControlTransitionNotes,
          planningNotes,
        })
      );
    } catch {
      // Ignore storage write errors.
    }
  }, [
    plannerStorageKey,
    targetMonth,
    preferredCycleLength,
    birthControlStopDate,
    birthControlTransitionNotes,
    planningNotes,
  ]);

  const suggestedOvulationDay = Math.max(10, preferredCycleLength - 14);
  const daysOffBirthControl = daysSinceDate(birthControlStopDate);

  const planningPanel = useMemo(
    () => (
      <section className="wellness-card planner-card">
        <h2>Conception Timing Planner</h2>

        <div className="planner-grid">
          <label>
            Target month to start trying
            <input
              type="month"
              value={targetMonth}
              onChange={(event) => setTargetMonth(event.target.value)}
            />
          </label>

          <label>
            Typical cycle length (days)
            <input
              type="number"
              min="21"
              max="40"
              value={preferredCycleLength}
              onChange={(event) =>
                setPreferredCycleLength(
                  Math.max(21, Math.min(40, Number(event.target.value) || 28))
                )
              }
            />
          </label>

          <label>
            Date stopped birth control
            <input
              type="date"
              value={birthControlStopDate}
              onChange={(event) => setBirthControlStopDate(event.target.value)}
            />
          </label>
        </div>

        <div className="planner-note-box">
          <p>
            Suggested prep start: <strong>{shiftMonth(targetMonth, -3) || "-"}</strong>
          </p>
          <p>
            Suggested focused tracking start: <strong>{shiftMonth(targetMonth, -1) || "-"}</strong>
          </p>
          <p>
            Estimated ovulation day each cycle: <strong>CD {suggestedOvulationDay}</strong> (approx)
          </p>
          <p>
            Off birth control for:{" "}
            <strong>{daysOffBirthControl == null ? "Not set yet" : `${daysOffBirthControl} days`}</strong>
          </p>
        </div>

        <label>
          Birth control transition notes
          <textarea
            value={birthControlTransitionNotes}
            onChange={(event) => setBirthControlTransitionNotes(event.target.value)}
            placeholder="Example: method used, stop date details, side effects, first cycle changes"
          />
        </label>

        <label>
          Planning notes
          <textarea
            value={planningNotes}
            onChange={(event) => setPlanningNotes(event.target.value)}
            placeholder="Example: appointment dates, supplements, timing plan, questions for OB/GYN"
          />
        </label>
      </section>
    ),
    [
      targetMonth,
      preferredCycleLength,
      suggestedOvulationDay,
      birthControlStopDate,
      birthControlTransitionNotes,
      daysOffBirthControl,
      planningNotes,
    ]
  );

  return (
    <WellnessGoalsWorkspace
      username={username}
      category="pregnancy"
      kicker="Planning Section"
      title="Pregnancy Prep"
      description="Build steady preconception habits, keep your foundation strong, and track consistency month to month."
      infoCards={[
        {
          title: "Daily Foundations",
          items: [
            "Prenatal and supplement consistency",
            "Sleep quality and stress balance",
            "Hydration and nutrition targets",
            "Cycle and ovulation signal tracking",
          ],
        },
        {
          title: "Appointments & Planning",
          items: [
            "Preconception provider visit",
            "Medication safety review",
            "Vaccination and lab updates",
            "Partner health and timing plan",
          ],
        },
      ]}
      templates={PREGNANCY_PREP_TEMPLATES}
      inputPlaceholder="Enter a prep goal..."
      trackerHeading="Prep Checklists"
      emptyText="No prep goals yet. Add one above or choose from the quick templates."
      showStreak={false}
      trackerMode="checklist"
      topPanel={planningPanel}
    />
  );
}

export default PregnancyPrep;