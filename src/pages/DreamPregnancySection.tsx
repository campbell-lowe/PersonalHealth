import { useEffect, useMemo, useState } from "react";
import "./WellnessPages.css";

const DREAM_VIBES = ["Cozy winter baby", "Sunny summer baby", "Fresh start spring baby", "Golden autumn baby"];

const DREAM_MILESTONES = [
  "Start with the season or month that feels like your family.",
  "Sketch backward to the likely conception window.",
  "Leave yourself a gentle prep runway before that window.",
  "Use your notes like a journal: money, work, travel, support, and timing.",
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

function addMonths(monthString, delta) {
  return shiftMonth(monthString, delta);
}

function addDaysToIsoDate(dateString, daysToAdd) {
  if (!dateString) return null;
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + daysToAdd);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthFromIsoDate(dateString) {
  if (!dateString) return "";
  const [year, month] = String(dateString).split("-");
  if (!year || !month) return "";
  return `${year}-${month}`;
}

function formatMonthLabel(monthString) {
  if (!monthString) return "-";
  const [year, month] = monthString.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  if (Number.isNaN(date.getTime())) return monthString;
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function monthDistance(startMonth, endMonth) {
  if (!startMonth || !endMonth) return null;
  const [startYear, startNumber] = startMonth.split("-").map(Number);
  const [endYear, endNumber] = endMonth.split("-").map(Number);
  if (!startYear || !startNumber || !endYear || !endNumber) return null;
  return (endYear - startYear) * 12 + (endNumber - startNumber);
}

function weeksFromMonths(monthCount) {
  return Math.round(monthCount * 4.345);
}

function formatOrdinal(value) {
  const modTen = value % 10;
  const modHundred = value % 100;

  if (modTen === 1 && modHundred !== 11) return `${value}st`;
  if (modTen === 2 && modHundred !== 12) return `${value}nd`;
  if (modTen === 3 && modHundred !== 13) return `${value}rd`;
  return `${value}th`;
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

function DreamPregnancySection({ username }) {
  const plannerStorageKey = `personalhealth.pregnancyPlanner.${username}`;
  const [planningMode, setPlanningMode] = useState("not-yet");
  const [desiredArrivalMonth, setDesiredArrivalMonth] = useState(() => toMonthInputValue());
  const [preferredCycleLength, setPreferredCycleLength] = useState(28);
  const [planningNotes, setPlanningNotes] = useState("");
  const [dreamVibe, setDreamVibe] = useState(DREAM_VIBES[0]);
  const [nameIdeas, setNameIdeas] = useState("");
  const [visionNotes, setVisionNotes] = useState("");
  const [desiredKidCount, setDesiredKidCount] = useState(2);
  const [ageGapMonths, setAgeGapMonths] = useState(14);
  const [latestFinalBabyMonth, setLatestFinalBabyMonth] = useState("2028-12");
  const [futurePlanName, setFuturePlanName] = useState("Cruise");
  const [futurePlanMonth, setFuturePlanMonth] = useState(shiftMonth(toMonthInputValue(), 12));
  const [minimumBabyAgeMonths, setMinimumBabyAgeMonths] = useState(6);
  const [maximumPregnancyWeeks, setMaximumPregnancyWeeks] = useState(24);
  const [cycleEntries, setCycleEntries] = useState([]);
  const [cycleLoadMessage, setCycleLoadMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(plannerStorageKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (saved?.planningMode === "ttc" || saved?.planningMode === "not-yet") {
        setPlanningMode(saved.planningMode);
      }
      if (typeof saved?.desiredArrivalMonth === "string" && saved.desiredArrivalMonth) {
        setDesiredArrivalMonth(saved.desiredArrivalMonth);
      } else if (typeof saved?.targetMonth === "string" && saved.targetMonth) {
        setDesiredArrivalMonth(saved.targetMonth);
      }
      if (Number.isFinite(Number(saved?.preferredCycleLength))) {
        setPreferredCycleLength(Math.max(21, Math.min(40, Number(saved.preferredCycleLength))));
      }
      if (typeof saved?.planningNotes === "string") {
        setPlanningNotes(saved.planningNotes);
      }
      if (typeof saved?.dreamVibe === "string" && saved.dreamVibe) {
        setDreamVibe(saved.dreamVibe);
      }
      if (typeof saved?.nameIdeas === "string") {
        setNameIdeas(saved.nameIdeas);
      }
      if (typeof saved?.visionNotes === "string") {
        setVisionNotes(saved.visionNotes);
      }
      if (Number.isFinite(Number(saved?.desiredKidCount))) {
        setDesiredKidCount(Math.max(1, Math.min(6, Number(saved.desiredKidCount))));
      }
      if (Number.isFinite(Number(saved?.ageGapMonths))) {
        setAgeGapMonths(Math.max(9, Math.min(60, Number(saved.ageGapMonths))));
      }
      if (typeof saved?.latestFinalBabyMonth === "string" && saved.latestFinalBabyMonth) {
        setLatestFinalBabyMonth(saved.latestFinalBabyMonth);
      } else if (typeof saved?.latestSecondBabyMonth === "string" && saved.latestSecondBabyMonth) {
        setLatestFinalBabyMonth(saved.latestSecondBabyMonth);
      }
      if (typeof saved?.futurePlanName === "string" && saved.futurePlanName) {
        setFuturePlanName(saved.futurePlanName);
      }
      if (typeof saved?.futurePlanMonth === "string" && saved.futurePlanMonth) {
        setFuturePlanMonth(saved.futurePlanMonth);
      }
      if (Number.isFinite(Number(saved?.minimumBabyAgeMonths))) {
        setMinimumBabyAgeMonths(Math.max(0, Math.min(36, Number(saved.minimumBabyAgeMonths))));
      }
      if (Number.isFinite(Number(saved?.maximumPregnancyWeeks))) {
        setMaximumPregnancyWeeks(Math.max(0, Math.min(40, Number(saved.maximumPregnancyWeeks))));
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
          desiredArrivalMonth,
          planningMode,
          preferredCycleLength,
          planningNotes,
          dreamVibe,
          nameIdeas,
          visionNotes,
          desiredKidCount,
          ageGapMonths,
          latestFinalBabyMonth,
          futurePlanName,
          futurePlanMonth,
          minimumBabyAgeMonths,
          maximumPregnancyWeeks,
        })
      );
    } catch {
      // Ignore storage write errors.
    }
  }, [
    plannerStorageKey,
    desiredArrivalMonth,
    planningMode,
    preferredCycleLength,
    planningNotes,
    dreamVibe,
    nameIdeas,
    visionNotes,
    desiredKidCount,
    ageGapMonths,
    latestFinalBabyMonth,
    futurePlanName,
    futurePlanMonth,
    minimumBabyAgeMonths,
    maximumPregnancyWeeks,
  ]);

  useEffect(() => {
    async function loadCycleEntries() {
      try {
        setCycleLoadMessage("");

        const response = await fetch(
          `http://localhost:3000/api/cycle?username=${encodeURIComponent(username)}`
        );

        if (!response.ok) {
          throw new Error(`Could not load cycle data (${response.status}).`);
        }

        const data = await response.json();
        const sortedEntries = Array.isArray(data)
          ? [...data].sort((left, right) => (left.date > right.date ? 1 : -1))
          : [];

        setCycleEntries(sortedEntries);
      } catch (error) {
        console.error(error);
        setCycleEntries([]);
        setCycleLoadMessage(error.message || "Could not load current cycle data.");
      }
    }

    loadCycleEntries();
  }, [username]);

  const estimatedConceptionMonth = shiftMonth(desiredArrivalMonth, -9);
  const currentCycleProjection = useMemo(() => {
    if (!Array.isArray(cycleEntries) || cycleEntries.length === 0) {
      return {
        currentCycleDay: null,
        conceptionDate: null,
        conceptionMonth: toMonthInputValue(),
        sourceLabel: "No cycle entries yet, so this falls back to the current month.",
      };
    }

    const latestEntry = cycleEntries[cycleEntries.length - 1] || null;
    const latestCycleDay = Number(latestEntry?.cycleDay);
    const normalizedCycleDay = Number.isFinite(latestCycleDay) && latestCycleDay > 0 ? latestCycleDay : null;
    const ovulationDay = Math.max(10, preferredCycleLength - 14);

    if (!latestEntry?.date || normalizedCycleDay === null) {
      return {
        currentCycleDay: null,
        conceptionDate: null,
        conceptionMonth: toMonthInputValue(),
        sourceLabel: "Current cycle day is missing, so this falls back to the current month.",
      };
    }

    const daysUntilEstimatedOvulation = ovulationDay - normalizedCycleDay;
    const conceptionDate = addDaysToIsoDate(latestEntry.date, daysUntilEstimatedOvulation);

    return {
      currentCycleDay: normalizedCycleDay,
      conceptionDate,
      conceptionMonth: toMonthFromIsoDate(conceptionDate) || toMonthInputValue(),
      sourceLabel:
        daysUntilEstimatedOvulation >= 0
          ? `Current cycle day is CD ${normalizedCycleDay}, so TTC mode estimates conception around CD ${ovulationDay}.`
          : `Current cycle day is CD ${normalizedCycleDay}, which is past the estimated ovulation point, so TTC mode uses that cycle's likely conception month.`,
    };
  }, [cycleEntries, preferredCycleLength]);
  const firstBabyConceptionMonth = planningMode === "ttc" ? currentCycleProjection.conceptionMonth : estimatedConceptionMonth;
  const currentCycleArrivalMonth = addMonths(firstBabyConceptionMonth, 9);
  const suggestedPrepStartMonth = shiftMonth(estimatedConceptionMonth, -3);
  const suggestedFocusedTrackingMonth = shiftMonth(estimatedConceptionMonth, -1);
  const suggestedOvulationDay = Math.max(10, preferredCycleLength - 14);
  const familyTimeline = useMemo(
    () =>
      Array.from({ length: desiredKidCount }, (_, index) => {
        const childNumber = index + 1;
        const arrivalMonth = addMonths(currentCycleArrivalMonth, index * ageGapMonths);
        const conceptionMonth = addMonths(arrivalMonth, -9);

        return {
          childNumber,
          arrivalMonth,
          conceptionMonth,
        };
      }),
    [currentCycleArrivalMonth, desiredKidCount, ageGapMonths]
  );
  const finalPlannedBaby = familyTimeline[familyTimeline.length - 1] || null;
  const deadlineCushionMonths = finalPlannedBaby
    ? monthDistance(finalPlannedBaby.arrivalMonth, latestFinalBabyMonth)
    : null;
  const latestFinalBabyConceptionMonth = addMonths(latestFinalBabyMonth, -9);
  const futurePlanChecks = useMemo(
    () =>
      familyTimeline.map((child) => {
        const monthsAfterArrival = monthDistance(child.arrivalMonth, futurePlanMonth);
        const monthsAfterConception = monthDistance(child.conceptionMonth, futurePlanMonth);
        const isDuringPregnancy =
          monthsAfterConception != null && monthsAfterConception >= 0 && monthsAfterArrival != null && monthsAfterArrival <= 0;
        const pregnancyWeeksAtPlan = isDuringPregnancy ? weeksFromMonths(monthsAfterConception) : null;
        const worksWithBabyAge = monthsAfterArrival != null && monthsAfterArrival >= minimumBabyAgeMonths;
        const worksWithPregnancy =
          pregnancyWeeksAtPlan != null && pregnancyWeeksAtPlan >= 0 && pregnancyWeeksAtPlan <= maximumPregnancyWeeks;

        let summary = "This timing misses both of those guideposts.";
        if (worksWithBabyAge && worksWithPregnancy) {
          summary = "This timing works whether you imagine going with a baby or while pregnant.";
        } else if (worksWithBabyAge) {
          summary = `This works if you want baby #${child.childNumber} to be at least ${minimumBabyAgeMonths} months old.`;
        } else if (worksWithPregnancy) {
          summary = `This works if you would rather still be pregnant and stay within about ${maximumPregnancyWeeks} weeks.`;
        }

        return {
          ...child,
          monthsAfterArrival,
          pregnancyWeeksAtPlan,
          worksWithBabyAge,
          worksWithPregnancy,
          summary,
        };
      }),
    [familyTimeline, futurePlanMonth, minimumBabyAgeMonths, maximumPregnancyWeeks]
  );
  const futurePlanMatches = futurePlanChecks.filter((item) => item.worksWithBabyAge || item.worksWithPregnancy);
  const arrivalDateLabel = useMemo(() => {
    if (!desiredArrivalMonth) return "your dream timing";
    return formatMonthLabel(desiredArrivalMonth);
  }, [desiredArrivalMonth]);
  const overviewBoardItems = [
    {
      label: "Dream arrival",
      value: arrivalDateLabel,
      detail: "The chapter you are sketching toward right now.",
    },
    {
      label: "Conception window",
      value: formatMonthLabel(firstBabyConceptionMonth),
      detail:
        planningMode === "ttc"
          ? "Pulled from your current cycle sketch in TTC mode."
          : "A rough month that supports that arrival timing.",
    },
    {
      label: "Gentle prep start",
      value: formatMonthLabel(suggestedPrepStartMonth),
      detail: "A soft runway before trying.",
    },
    {
      label: "Future plan",
      value: `${futurePlanName || "Future plan"} in ${formatMonthLabel(futurePlanMonth)}`,
      detail: "Checked against baby age and pregnancy timing below.",
    },
  ];

  return (
    <div className="wellness-page-shell dream-page-shell">
      <section className="wellness-hero-card dream-hero-card">
        <p className="wellness-kicker">Family Planning Section</p>
        <h1>Dream Pregnancy</h1>
        <p>
          Treat this like a life sketchbook. Pick the timing that feels right, play with the shape of your
          future family, and keep the practical details beside the dreamy ones.
        </p>

        <div className="dream-vibe-row" role="group" aria-label="Dream vibe choices">
          {DREAM_VIBES.map((option) => (
            <button
              key={option}
              type="button"
              className={`dream-vibe-chip ${dreamVibe === option ? "is-active" : ""}`}
              onClick={() => setDreamVibe(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="dream-board-grid">
        <article className="wellness-card dream-spotlight-card dream-picture-board">
          <p className="dream-mini-label">Today&apos;s picture</p>
          <h2>{dreamVibe}</h2>
          <p className="wellness-muted">
            Right now, {arrivalDateLabel} is the chapter you are sketching toward.
          </p>
        </article>

        <article className="wellness-card dream-overview-board">
          <div className="dream-board-header">
            <p className="dream-mini-label">Overview</p>
            <h2>At A Glance</h2>
          </div>

          <div className="dream-overview-grid">
            {overviewBoardItems.map((item) => (
              <div className="dream-overview-item" key={item.label}>
                <p className="dream-mini-label">{item.label}</p>
                <h3>{item.value}</h3>
                <p className="wellness-muted">{item.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dream-board-grid dream-board-grid-planning">
        <article className="wellness-card planner-card dream-board-panel">
          <div className="dream-board-header">
            <p className="dream-mini-label">Board One</p>
            <h2>Dream Timing</h2>
          </div>

          <div className="dream-mode-row" role="group" aria-label="Planning mode">
            <button
              type="button"
              className={`dream-vibe-chip ${planningMode === "ttc" ? "is-active" : ""}`}
              onClick={() => setPlanningMode("ttc")}
            >
              TTC
            </button>
            <button
              type="button"
              className={`dream-vibe-chip ${planningMode === "not-yet" ? "is-active" : ""}`}
              onClick={() => setPlanningMode("not-yet")}
            >
              Not Yet
            </button>
          </div>

          <div className="planner-grid">
            <label>
              If everything lined up, when would baby feel perfect?
              <input
                type="month"
                value={desiredArrivalMonth}
                onChange={(event) => setDesiredArrivalMonth(event.target.value)}
              />
            </label>

            <label>
              What does your cycle usually look like?
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
              What is the vibe of this season?
              <input type="text" value={dreamVibe} onChange={(event) => setDreamVibe(event.target.value)} />
            </label>
          </div>

          <div className="planner-note-box dream-timing-box">
            <p>
              Mode: <strong>{planningMode === "ttc" ? "TTC" : "Not Yet"}</strong>
            </p>
            {planningMode === "ttc" ? (
              <p>
                {currentCycleProjection.sourceLabel}
              </p>
            ) : null}
            {planningMode === "ttc" && currentCycleProjection.conceptionDate ? (
              <p>
                TTC mode assumes pregnancy from the current cycle, around <strong>{currentCycleProjection.conceptionDate}</strong>.
              </p>
            ) : null}
            {planningMode === "ttc" && cycleLoadMessage ? (
              <p>{cycleLoadMessage}</p>
            ) : null}
            <p>
              {planningMode === "ttc" ? (
                <>
                  TTC mode uses <strong>{firstBabyConceptionMonth || "-"}</strong> as the starting conception month.
                </>
              ) : (
                <>
                  If you&apos;re aiming for that season, conception likely circles around <strong>{estimatedConceptionMonth || "-"}</strong>.
                </>
              )}
            </p>
            <p>
              A calm prep runway could start around <strong>{suggestedPrepStartMonth || "-"}</strong>.
            </p>
            <p>
              You may want more focused tracking around <strong>{suggestedFocusedTrackingMonth || "-"}</strong>.
            </p>
            <p>
              Your cycle math points to ovulation around <strong>CD {suggestedOvulationDay}</strong> (approx).
            </p>
          </div>
        </article>

        <article className="wellness-card planner-card dream-board-panel">
          <div className="dream-board-header">
            <p className="dream-mini-label">Board Two</p>
            <h2>Family Shape</h2>
          </div>

          <div className="planner-grid">
            <label>
              How many kids do you picture?
              <input
                type="number"
                min="1"
                max="6"
                value={desiredKidCount}
                onChange={(event) =>
                  setDesiredKidCount(Math.max(1, Math.min(6, Number(event.target.value) || 1)))
                }
              />
            </label>

            <label>
              What age gap feels right?
              <input
                type="number"
                min="9"
                max="60"
                value={ageGapMonths}
                onChange={(event) =>
                  setAgeGapMonths(Math.max(9, Math.min(60, Number(event.target.value) || 12)))
                }
              />
            </label>

            <label>
              By when would you want your final baby here?
              <input
                type="month"
                value={latestFinalBabyMonth}
                onChange={(event) => setLatestFinalBabyMonth(event.target.value)}
              />
            </label>
          </div>

          <div className="planner-note-box dream-timing-box">
            <p>
              This sketch currently starts with baby #1 in <strong>{formatMonthLabel(currentCycleArrivalMonth)}</strong>.
            </p>
            {finalPlannedBaby ? (
              <p>
                With a {ageGapMonths}-month gap, baby #{finalPlannedBaby.childNumber} would likely arrive around <strong>{formatMonthLabel(finalPlannedBaby.arrivalMonth)}</strong>.
              </p>
            ) : null}
            {finalPlannedBaby ? (
              <p>
                To welcome baby #{finalPlannedBaby.childNumber} by <strong>{formatMonthLabel(latestFinalBabyMonth)}</strong>, conception likely needs to happen by <strong>{formatMonthLabel(latestFinalBabyConceptionMonth)}</strong>.
              </p>
            ) : null}
          </div>
        </article>

        <article className="wellness-card planner-card dream-board-panel">
          <div className="dream-board-header">
            <p className="dream-mini-label">Board Three</p>
            <h2>Future Plans</h2>
          </div>

          <div className="planner-grid">
            <label>
              What future plan matters here?
              <input type="text" value={futurePlanName} onChange={(event) => setFuturePlanName(event.target.value)} />
            </label>

            <label>
              When is that plan?
              <input
                type="month"
                value={futurePlanMonth}
                onChange={(event) => setFuturePlanMonth(event.target.value)}
              />
            </label>

            <label>
              Baby should be at least this many months old
              <input
                type="number"
                min="0"
                max="36"
                value={minimumBabyAgeMonths}
                onChange={(event) =>
                  setMinimumBabyAgeMonths(Math.max(0, Math.min(36, Number(event.target.value) || 0)))
                }
              />
            </label>

            <label>
              Or no more than this many weeks pregnant
              <input
                type="number"
                min="0"
                max="40"
                value={maximumPregnancyWeeks}
                onChange={(event) =>
                  setMaximumPregnancyWeeks(Math.max(0, Math.min(40, Number(event.target.value) || 0)))
                }
              />
            </label>
          </div>

          <div className="planner-note-box dream-timing-box">
            <p>
              For {futurePlanName || "that plan"} in <strong>{formatMonthLabel(futurePlanMonth)}</strong>, compare baby age and pregnancy timing against the family sketch below.
            </p>
            {futurePlanMatches.length > 0 ? (
              <p>
                Right now, it fits best around <strong>baby #{futurePlanMatches[0].childNumber}</strong>.
              </p>
            ) : (
              <p>
                Right now, this plan does not fit neatly. Try moving the plan, the gap, or the family size.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="wellness-card dream-scenario-card">
        <h2>If This Cycle Became Your Story</h2>
        <p className="wellness-muted">
          {planningMode === "ttc"
            ? `If this current cycle became a pregnancy, this is how the story could stretch across ${desiredKidCount} kid${desiredKidCount === 1 ? "" : "s"}.`
            : `If you started from this sketch later, this is how the story could stretch across ${desiredKidCount} kid${desiredKidCount === 1 ? "" : "s"}.`}
        </p>

        <div className="dream-scenario-grid">
          {familyTimeline.map((child) => (
            <article className="dream-scenario-pill" key={child.childNumber}>
              <p className="dream-mini-label">{formatOrdinal(child.childNumber)} little chapter</p>
              <h3>{formatMonthLabel(child.arrivalMonth)}</h3>
              <p>
                Baby #{child.childNumber} would likely need conception around {formatMonthLabel(child.conceptionMonth)} for an arrival around {formatMonthLabel(child.arrivalMonth)}.
              </p>
            </article>
          ))}

          <article className="dream-scenario-pill">
            <p className="dream-mini-label">Your outer boundary</p>
            <h3>{formatMonthLabel(latestFinalBabyMonth)}</h3>
            <p>
              {deadlineCushionMonths == null
                ? "Set a deadline to compare your final-baby timing."
                : deadlineCushionMonths >= 0
                  ? `That sketch lands ${deadlineCushionMonths} month${deadlineCushionMonths === 1 ? "" : "s"} before your deadline.`
                  : `That sketch lands ${Math.abs(deadlineCushionMonths)} month${Math.abs(deadlineCushionMonths) === 1 ? "" : "s"} after your deadline.`}
            </p>
          </article>
        </div>

        <div className="planner-note-box dream-timing-box">
          <p>
            For {desiredKidCount} kid{desiredKidCount === 1 ? "" : "s"}, this version of the story starts with baby #1 in <strong>{formatMonthLabel(currentCycleArrivalMonth)}</strong>.
          </p>
          {finalPlannedBaby ? (
            <p>
              With a {ageGapMonths}-month gap, baby #{finalPlannedBaby.childNumber} would likely need conception around <strong>{formatMonthLabel(finalPlannedBaby.conceptionMonth)}</strong>, with arrival around <strong>{formatMonthLabel(finalPlannedBaby.arrivalMonth)}</strong>.
            </p>
          ) : null}
          {finalPlannedBaby ? (
            <p>
              To welcome baby #{finalPlannedBaby.childNumber} by <strong>{formatMonthLabel(latestFinalBabyMonth)}</strong>, conception would likely need to happen by <strong>{formatMonthLabel(latestFinalBabyConceptionMonth)}</strong>.
            </p>
          ) : null}
        </div>
      </section>

      <section className="wellness-card dream-plan-card">
        <h2>Future Plans That Shape The Timing</h2>
        <p className="wellness-muted">
          A plan like {futurePlanName || "a trip"} can absolutely change the shape of this. This view checks whether {formatMonthLabel(futurePlanMonth)} works better with a baby who is at least {minimumBabyAgeMonths} months old, or while you are no more than about {maximumPregnancyWeeks} weeks pregnant.
        </p>

        <div className="dream-scenario-grid">
          {futurePlanChecks.map((check) => (
            <article className={`dream-scenario-pill ${check.worksWithBabyAge || check.worksWithPregnancy ? "is-match" : "is-tight"}`} key={`future-plan-${check.childNumber}`}>
              <p className="dream-mini-label">{futurePlanName || "Future plan"} around baby #{check.childNumber}</p>
              <h3>{formatMonthLabel(futurePlanMonth)}</h3>
              <p>{check.summary}</p>
              <p>
                Baby age then: <strong>{check.monthsAfterArrival == null ? "-" : check.monthsAfterArrival < 0 ? "not born yet" : `${check.monthsAfterArrival} month${check.monthsAfterArrival === 1 ? "" : "s"}`}</strong>
              </p>
              <p>
                Pregnancy timing then: <strong>{check.pregnancyWeeksAtPlan == null ? check.monthsAfterArrival != null && check.monthsAfterArrival > 0 ? "baby is already here" : "not pregnant yet" : `about ${check.pregnancyWeeksAtPlan} weeks`}</strong>
              </p>
            </article>
          ))}
        </div>

        <div className="planner-note-box dream-timing-box">
          {futurePlanMatches.length > 0 ? (
            <p>
              {futurePlanName || "This plan"} fits most naturally around baby #{futurePlanMatches[0].childNumber} in this version of the timeline.
            </p>
          ) : (
            <p>
              Right now, {futurePlanName || "this plan"} does not fit the sketch cleanly. Try shifting the family size, age gap, or target timing.
            </p>
          )}
        </div>
      </section>

      <section className="wellness-grid-2">
        <article className="wellness-card dream-milestone-card">
          <h2>Little Prompts To Play With</h2>
          <ul>
            {DREAM_MILESTONES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="wellness-card dream-vision-card">
          <h2>Mini Vision Board</h2>
          <label>
            Names, themes, or tiny details you keep picturing
            <textarea
              value={nameIdeas}
              onChange={(event) => setNameIdeas(event.target.value)}
              placeholder="Names, nursery colors, favorite month, family traditions, little moments you imagine"
            />
          </label>

          <label>
            Why does this timing feel right in your life?
            <textarea
              value={visionNotes}
              onChange={(event) => setVisionNotes(event.target.value)}
              placeholder="Career timing, holidays, support system, finances, energy, home life, gut feeling"
            />
          </label>
        </article>
      </section>

      <section className="wellness-grid-2">
        <article className="wellness-card">
          <h2>Life Notes</h2>
          <textarea
            className="dream-textarea"
            value={planningNotes}
            onChange={(event) => setPlanningNotes(event.target.value)}
            placeholder="Provider questions, savings thoughts, leave ideas, travel plans, childcare, anything you want to remember"
          />
        </article>

        <article className="wellness-card">
          <h2>Open Notes</h2>
          <textarea
            className="dream-textarea"
            value={visionNotes}
            onChange={(event) => setVisionNotes(event.target.value)}
            placeholder="Anything else you want to capture about timing, feelings, plans, or possibilities"
          />
        </article>
      </section>
    </div>
  );
}

export default DreamPregnancySection;