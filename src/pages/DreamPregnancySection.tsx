import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "../utils/api";
import "./WellnessPages.css";

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

function monthAtAge(birthDate, age) {
  if (!birthDate || !Number.isFinite(Number(age))) return "";
  const date = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + Number(age));
  return toMonthFromIsoDate(date.toISOString().slice(0, 10));
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

function formatBabyAge(months) {
  if (months == null) return "-";
  if (months < 0) return "not born yet";

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const yearLabel = `${years} year${years === 1 ? "" : "s"}`;
  const monthLabel = `${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`;
  return `${months} month${months === 1 ? "" : "s"} (${yearLabel}, ${monthLabel})`;
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

function createFuturePlan(id, overrides = {}) {
  return {
    id,
    name: "Cruise",
    month: shiftMonth(toMonthInputValue(), 12),
    minimumBabyAgeMonths: 6,
    maximumPregnancyWeeks: 24,
    ...overrides,
  };
}

function createBoundary(id, overrides = {}) {
  return {
    id,
    name: "Insurance",
    type: "insurance",
    month: "2029-01",
    maximumBabyAgeMonths: 19,
    ...overrides,
  };
}

function DreamPregnancySection({ username }) {
  const plannerStorageKey = `personalhealth.pregnancyPlanner.${username}`;
  const [planningMode, setPlanningMode] = useState("not-yet");
  const [plannedConceptionMonth, setPlannedConceptionMonth] = useState(() => toMonthInputValue());
  const [preferredCycleLength, setPreferredCycleLength] = useState(28);
  const [desiredKidCount, setDesiredKidCount] = useState(2);
  const [ageGapsMonths, setAgeGapsMonths] = useState([14]);
  const [birthDate, setBirthDate] = useState("");
  const [finalBabyAgeLimit, setFinalBabyAgeLimit] = useState(30);
  const [latestFinalBabyMonth, setLatestFinalBabyMonth] = useState("2028-12");
  const [futurePlans, setFuturePlans] = useState(() => [createFuturePlan("plan-1")]);
  const [draggedPlanId, setDraggedPlanId] = useState(null);
  const [boundaries, setBoundaries] = useState(() => [createBoundary("boundary-1")]);
  const [draggedBoundaryId, setDraggedBoundaryId] = useState(null);
  const [cycleEntries, setCycleEntries] = useState([]);
  const [cycleLoadMessage, setCycleLoadMessage] = useState("");
  const [isPlannerHydrated, setIsPlannerHydrated] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(plannerStorageKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (saved?.planningMode === "ttc" || saved?.planningMode === "not-yet") {
        setPlanningMode(saved.planningMode);
      }
      if (typeof saved?.plannedConceptionMonth === "string" && saved.plannedConceptionMonth) {
        setPlannedConceptionMonth(saved.plannedConceptionMonth);
      } else if (typeof saved?.desiredConceptionMonth === "string" && saved.desiredConceptionMonth) {
        setPlannedConceptionMonth(saved.desiredConceptionMonth);
      } else if (typeof saved?.targetMonth === "string" && saved.targetMonth) {
        setPlannedConceptionMonth(shiftMonth(saved.targetMonth, -9));
      } else if (typeof saved?.desiredArrivalMonth === "string" && saved.desiredArrivalMonth) {
        setPlannedConceptionMonth(shiftMonth(saved.desiredArrivalMonth, -9));
      }
      if (Number.isFinite(Number(saved?.preferredCycleLength))) {
        setPreferredCycleLength(Math.max(21, Math.min(40, Number(saved.preferredCycleLength))));
      }
      if (typeof saved?.birthDate === "string") {
        setBirthDate(saved.birthDate);
      }
      if (Number.isFinite(Number(saved?.finalBabyAgeLimit))) {
        setFinalBabyAgeLimit(Math.max(18, Math.min(60, Number(saved.finalBabyAgeLimit))));
      }
      if (Number.isFinite(Number(saved?.desiredKidCount))) {
        setDesiredKidCount(Math.max(1, Math.min(6, Number(saved.desiredKidCount))));
      }
      if (Array.isArray(saved?.ageGapsMonths) && saved.ageGapsMonths.length > 0) {
        setAgeGapsMonths(saved.ageGapsMonths.map((gap) => Math.max(9, Math.min(60, Number(gap) || 14))));
      } else if (Number.isFinite(Number(saved?.ageGapMonths))) {
        setAgeGapsMonths([Math.max(9, Math.min(60, Number(saved.ageGapMonths)))]);
      }
      if (typeof saved?.latestFinalBabyMonth === "string" && saved.latestFinalBabyMonth) {
        setLatestFinalBabyMonth(saved.latestFinalBabyMonth);
      } else if (typeof saved?.latestSecondBabyMonth === "string" && saved.latestSecondBabyMonth) {
        setLatestFinalBabyMonth(saved.latestSecondBabyMonth);
      }
      if (Array.isArray(saved?.futurePlans) && saved.futurePlans.length > 0) {
        setFuturePlans(
          saved.futurePlans.map((plan, index) =>
            createFuturePlan(`plan-${index + 1}`, {
              id: typeof plan?.id === "string" && plan.id ? plan.id : `plan-${index + 1}`,
              name: typeof plan?.name === "string" ? plan.name : "Future plan",
              month: typeof plan?.month === "string" ? plan.month : shiftMonth(toMonthInputValue(), 12),
              minimumBabyAgeMonths: Math.max(0, Math.min(36, Number(plan?.minimumBabyAgeMonths) || 0)),
              maximumPregnancyWeeks: Math.max(0, Math.min(40, Number(plan?.maximumPregnancyWeeks) || 0)),
            })
          )
        );
      } else {
        setFuturePlans([
          createFuturePlan("plan-1", {
            name: typeof saved?.futurePlanName === "string" && saved.futurePlanName ? saved.futurePlanName : "Cruise",
            month: typeof saved?.futurePlanMonth === "string" && saved.futurePlanMonth ? saved.futurePlanMonth : shiftMonth(toMonthInputValue(), 12),
            minimumBabyAgeMonths: Number.isFinite(Number(saved?.minimumBabyAgeMonths)) ? Math.max(0, Math.min(36, Number(saved.minimumBabyAgeMonths))) : 6,
            maximumPregnancyWeeks: Number.isFinite(Number(saved?.maximumPregnancyWeeks)) ? Math.max(0, Math.min(40, Number(saved.maximumPregnancyWeeks))) : 24,
          }),
        ]);
      }
      if (Array.isArray(saved?.boundaries) && saved.boundaries.length > 0) {
        setBoundaries(
          saved.boundaries.map((boundary, index) =>
            createBoundary(`boundary-${index + 1}`, {
              id: typeof boundary?.id === "string" && boundary.id ? boundary.id : `boundary-${index + 1}`,
              name: typeof boundary?.name === "string" ? boundary.name : "Boundary",
              type: ["insurance", "avoid-birth", "outer-deadline"].includes(boundary?.type) ? boundary.type : "insurance",
              month: typeof boundary?.month === "string" ? boundary.month : "2029-01",
              maximumBabyAgeMonths: Math.max(0, Math.min(240, Number(boundary?.maximumBabyAgeMonths) || 0)),
            })
          )
        );
      }
    } catch {
      // Ignore invalid saved planner data.
    } finally {
      setIsPlannerHydrated(true);
    }
  }, [plannerStorageKey]);

  const plannerSnapshot = {
    plannedConceptionMonth,
    planningMode,
    preferredCycleLength,
    birthDate,
    finalBabyAgeLimit,
    desiredKidCount,
    ageGapsMonths,
    latestFinalBabyMonth,
    futurePlans,
    boundaries,
  };

  function savePlanner() {
    try {
      window.localStorage.setItem(plannerStorageKey, JSON.stringify(plannerSnapshot));
      setSaveMessage("Saved");
    } catch {
      setSaveMessage("Could not save");
    }
  }

  useEffect(() => {
    if (!isPlannerHydrated) return;

    try {
      window.localStorage.setItem(plannerStorageKey, JSON.stringify(plannerSnapshot));
    } catch {
      // Ignore storage write errors.
    }
  }, [
    plannerStorageKey,
    plannedConceptionMonth,
    planningMode,
    preferredCycleLength,
    birthDate,
    finalBabyAgeLimit,
    desiredKidCount,
    ageGapsMonths,
    latestFinalBabyMonth,
    futurePlans,
    boundaries,
    isPlannerHydrated,
  ]);

  useEffect(() => {
    async function loadCycleEntries() {
      try {
        setCycleLoadMessage("");

        const response = await fetch(
          apiUrl(`/api/cycle?username=${encodeURIComponent(username)}`)
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

  const estimatedConceptionMonth = plannedConceptionMonth;
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
    () => Array.from({ length: desiredKidCount }, (_, index) => {
        const totalGapMonths = ageGapsMonths.slice(0, index).reduce(
          (total, gap) => total + (gap || ageGapsMonths[0] || 14),
          0
        );
        const arrivalMonth = addMonths(currentCycleArrivalMonth, totalGapMonths);
        const childNumber = index + 1;
        const conceptionMonth = addMonths(arrivalMonth, -9);

        return { childNumber, arrivalMonth, conceptionMonth };
      }),
    [currentCycleArrivalMonth, desiredKidCount, ageGapsMonths]
  );
  const finalPlannedBaby = familyTimeline[familyTimeline.length - 1] || null;
  const familyDeadlineMonth = monthAtAge(birthDate, finalBabyAgeLimit) || latestFinalBabyMonth;
  const deadlineCushionMonths = finalPlannedBaby
    ? monthDistance(finalPlannedBaby.arrivalMonth, familyDeadlineMonth)
    : null;
  const latestFinalBabyConceptionMonth = addMonths(familyDeadlineMonth, -9);
  const futurePlanAnalyses = useMemo(
    () =>
      futurePlans.map((plan) => {
        const checks = familyTimeline.map((child) => {
          const monthsAfterArrival = monthDistance(child.arrivalMonth, plan.month);
          const monthsAfterConception = monthDistance(child.conceptionMonth, plan.month);
          const isDuringPregnancy =
            monthsAfterConception != null && monthsAfterConception >= 0 && monthsAfterArrival != null && monthsAfterArrival <= 0;
          const pregnancyWeeksAtPlan = isDuringPregnancy ? weeksFromMonths(monthsAfterConception) : null;
          const worksWithBabyAge = monthsAfterArrival != null && monthsAfterArrival >= plan.minimumBabyAgeMonths;
          const worksWithPregnancy =
            pregnancyWeeksAtPlan != null && pregnancyWeeksAtPlan >= 0 && pregnancyWeeksAtPlan <= plan.maximumPregnancyWeeks;
          const isBeforeConception = monthsAfterConception != null && monthsAfterConception < 0;

          let summary = "This timing misses both of those guideposts.";
          if (worksWithBabyAge && worksWithPregnancy) {
            summary = "This timing works whether you imagine going with a baby or while pregnant.";
          } else if (worksWithBabyAge) {
            summary = plan.minimumBabyAgeMonths === 0
              ? `This works because baby #${child.childNumber} is already here.`
              : `This works if you want baby #${child.childNumber} to be at least ${plan.minimumBabyAgeMonths} months old.`;
          } else if (worksWithPregnancy) {
            summary = `This works if you would rather still be pregnant and stay within about ${plan.maximumPregnancyWeeks} weeks.`;
          } else if (isBeforeConception) {
            summary = `This plan happens before baby #${child.childNumber} would be conceived, so it does not constrain that timing.`;
          }

          return {
            ...child,
            monthsAfterArrival,
            pregnancyWeeksAtPlan,
            worksWithBabyAge,
            worksWithPregnancy,
            isBeforeConception,
            summary,
          };
        });
        const matches = checks.filter(
          (item) => item.worksWithBabyAge || item.worksWithPregnancy || item.isBeforeConception
        );

        return {
          ...plan,
          checks,
          matches,
          worksForAllBabies: checks.length > 0 && matches.length === checks.length,
        };
      }),
    [familyTimeline, futurePlans]
  );
  const primaryFuturePlan = futurePlanAnalyses[0] || null;
  const futurePlanName = primaryFuturePlan?.name || "Future plan";
  const futurePlanMonth = primaryFuturePlan?.month || "";
  const futurePlanWorksForAllBabies = primaryFuturePlan?.worksForAllBabies || false;
  const updateFuturePlan = (planId, field, value) => {
    setFuturePlans((plans) => plans.map((plan) => (plan.id === planId ? { ...plan, [field]: value } : plan)));
  };
  const addFuturePlan = () => {
    setFuturePlans((plans) => [
      ...plans,
      createFuturePlan(`plan-${Date.now()}`, { name: `Plan ${plans.length + 1}` }),
    ]);
  };
  const removeFuturePlan = (planId) => {
    setFuturePlans((plans) => (plans.length === 1 ? plans : plans.filter((plan) => plan.id !== planId)));
  };
  const moveFuturePlan = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return;
    setFuturePlans((plans) => {
      const sourceIndex = plans.findIndex((plan) => plan.id === sourceId);
      const targetIndex = plans.findIndex((plan) => plan.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return plans;
      const reordered = [...plans];
      const [movedPlan] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, movedPlan);
      return reordered;
    });
  };
  const boundaryAnalyses = useMemo(
    () => boundaries.map((boundary) => {
      const checks = familyTimeline.map((child) => {
        const monthsAtExpiration = monthDistance(child.arrivalMonth, boundary.month);
        const appliesToChild = monthsAtExpiration != null && (boundary.type !== "insurance" || monthsAtExpiration >= 0);
        const isApproved = boundary.type === "avoid-birth"
          ? child.arrivalMonth !== boundary.month
          : boundary.type === "outer-deadline"
            ? monthsAtExpiration != null && monthsAtExpiration >= 0
            : appliesToChild && monthsAtExpiration < boundary.maximumBabyAgeMonths;
        return { ...child, monthsAtExpiration, appliesToChild, isApproved };
      });
      const applicableChecks = checks.filter((check) => check.appliesToChild);
      return {
        ...boundary,
        checks,
        worksForAllBabies: applicableChecks.every((check) => check.isApproved),
      };
    }),
    [boundaries, familyTimeline]
  );
  const updateBoundary = (boundaryId, field, value) => {
    setBoundaries((items) => items.map((boundary) => boundary.id === boundaryId ? { ...boundary, [field]: value } : boundary));
  };
  const addBoundary = () => {
    setBoundaries((items) => [...items, createBoundary(`boundary-${Date.now()}`, { name: `Boundary ${items.length + 1}` })]);
  };
  const removeBoundary = (boundaryId) => {
    setBoundaries((items) => items.length === 1 ? items : items.filter((boundary) => boundary.id !== boundaryId));
  };
  const moveBoundary = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return;
    setBoundaries((items) => {
      const sourceIndex = items.findIndex((boundary) => boundary.id === sourceId);
      const targetIndex = items.findIndex((boundary) => boundary.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return items;
      const reordered = [...items];
      const [movedBoundary] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, movedBoundary);
      return reordered;
    });
  };
  const approvalTimeline = useMemo(
    () => familyTimeline.map((child) => ({
      ...child,
      decisions: [
        ...futurePlanAnalyses.map((plan) => {
          const check = plan.checks.find((item) => item.childNumber === child.childNumber);
          return {
            id: `${plan.id}-${child.childNumber}`,
            label: plan.name || "Future plan",
            month: plan.month,
            approved: Boolean(check && (check.worksWithBabyAge || check.worksWithPregnancy || check.isBeforeConception)),
          };
        }),
        ...boundaryAnalyses.map((boundary) => {
          const check = boundary.checks.find((item) => item.childNumber === child.childNumber);
          return {
            id: `${boundary.id}-${child.childNumber}`,
            label: boundary.name || "Boundary",
            month: boundary.month,
            approved: Boolean(check && (!check.appliesToChild || check.isApproved)),
          };
        }),
      ],
    })),
    [familyTimeline, futurePlanAnalyses, boundaryAnalyses]
  );
  const plannedConceptionLabel = useMemo(() => {
    if (!plannedConceptionMonth) return "your planned conception timing";
    return formatMonthLabel(plannedConceptionMonth);
  }, [plannedConceptionMonth]);
  const overviewBoardItems = [
    {
      label: "Planned conception",
      value: plannedConceptionLabel,
      detail: "The starting point for the family timeline.",
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
        <h1>Family Planning</h1>
        <p>
          Plan the timing and shape of your future family, then test how each child and future plan fit together.
        </p>
        <div className="planner-save-row">
          <button type="button" className="dream-secondary-button" onClick={savePlanner}>
            Save plan
          </button>
          {saveMessage ? <span className="planner-save-message" role="status">{saveMessage}</span> : null}
        </div>
      </section>

      <section className="dream-board-grid">
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
        <article className="wellness-card planner-card dream-board-panel dream-board-panel-wide">
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
              Planned conception month
              <input
                type="month"
                value={plannedConceptionMonth}
                onChange={(event) => setPlannedConceptionMonth(event.target.value)}
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
                  This family timeline starts with conception around <strong>{estimatedConceptionMonth || "-"}</strong>.
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

            {Array.from({ length: Math.max(0, desiredKidCount - 1) }, (_, index) => (
              <label key={`age-gap-${index}`}>
                Gap between baby #{index + 1} and baby #{index + 2}
                <input
                  type="number"
                  min="9"
                  max="60"
                  value={ageGapsMonths[index] || ageGapsMonths[0] || 14}
                  onChange={(event) => {
                    const nextGap = Math.max(9, Math.min(60, Number(event.target.value) || 12));
                    setAgeGapsMonths((gaps) => {
                      const nextGaps = [...gaps];
                      nextGaps[index] = nextGap;
                      return nextGaps;
                    });
                  }}
                />
              </label>
            ))}

            <label>
              Your date of birth
              <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
            </label>

            <label>
              Latest age for your final baby
              <input
                type="number"
                min="18"
                max="60"
                value={finalBabyAgeLimit}
                onChange={(event) => setFinalBabyAgeLimit(Math.max(18, Math.min(60, Number(event.target.value) || 30)))}
              />
            </label>
          </div>

          <div className="planner-note-box dream-timing-box">
            <p>
              This sketch currently starts with baby #1 in <strong>{formatMonthLabel(currentCycleArrivalMonth)}</strong>.
            </p>
            {finalPlannedBaby ? (
              <p>
                With the planned gaps, baby #{finalPlannedBaby.childNumber} would likely arrive around <strong>{formatMonthLabel(finalPlannedBaby.arrivalMonth)}</strong>.
              </p>
            ) : null}
            {finalPlannedBaby ? (
              <p>
                {birthDate
                  ? <>At age {finalBabyAgeLimit}, your final-baby deadline is <strong>{formatMonthLabel(familyDeadlineMonth)}</strong>.</>
                  : <>Set your birth date to calculate your final-baby deadline.</>}
                {birthDate ? <> Conception likely needs to happen by <strong>{formatMonthLabel(latestFinalBabyConceptionMonth)}</strong>.</> : null}
              </p>
            ) : null}
          </div>
        </article>

        <article className="wellness-card planner-card dream-board-panel">
          <div className="dream-board-header">
            <p className="dream-mini-label">Board Three</p>
            <h2>Future Plans</h2>
          </div>

          <div className="future-plan-toolbar">
            <p className="wellness-muted">Add a card for each trip, event, or commitment that should shape the family timeline. Drag cards to reorder them.</p>
            <button type="button" className="dream-secondary-button" onClick={addFuturePlan}>+ Add future plan</button>
          </div>

          <div className="future-plan-list">
            {futurePlans.map((plan) => (
              <article
                className="future-plan-block"
                key={plan.id}
                draggable
                onDragStart={() => setDraggedPlanId(plan.id)}
                onDragEnd={() => setDraggedPlanId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  moveFuturePlan(draggedPlanId, plan.id);
                  setDraggedPlanId(null);
                }}
              >
                <div className="future-plan-block-header">
                  <div>
                    <p className="dream-mini-label">Moveable plan block</p>
                    <h3>{plan.name || "Untitled plan"}</h3>
                  </div>
                  <button
                    type="button"
                    className="dream-icon-button"
                    aria-label={`Remove ${plan.name || "future plan"}`}
                    title="Remove plan"
                    onClick={() => removeFuturePlan(plan.id)}
                  >
                    ×
                  </button>
                </div>

                <div className="planner-grid">
                  <label>
                    Plan name
                    <input
                      type="text"
                      value={plan.name}
                      onChange={(event) => updateFuturePlan(plan.id, "name", event.target.value)}
                    />
                  </label>

                  <label>
                    When is it?
                    <input
                      type="month"
                      value={plan.month}
                      onChange={(event) => updateFuturePlan(plan.id, "month", event.target.value)}
                    />
                  </label>

                  <label>
                    Baby age minimum
                    <input
                      type="number"
                      min="0"
                      max="36"
                      value={plan.minimumBabyAgeMonths}
                      onChange={(event) => updateFuturePlan(plan.id, "minimumBabyAgeMonths", Math.max(0, Math.min(36, Number(event.target.value) || 0)))}
                    />
                  </label>

                  <label>
                    Pregnancy weeks maximum
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={plan.maximumPregnancyWeeks}
                      onChange={(event) => updateFuturePlan(plan.id, "maximumPregnancyWeeks", Math.max(0, Math.min(40, Number(event.target.value) || 0)))}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>

          <div className="planner-note-box dream-timing-box">
            <p>
              For {futurePlanName || "that plan"} in <strong>{formatMonthLabel(futurePlanMonth)}</strong>, compare baby age and pregnancy timing against the family sketch below.
            </p>
            {futurePlanWorksForAllBabies ? (
              <p>
                Right now, this plan works for <strong>every baby in the family sketch</strong>.
              </p>
            ) : (
              <p>
                Right now, this plan does not work for every baby in the family sketch. Try moving the plan, the gap, or the family size.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="wellness-card dream-boundary-card">
        <div className="dream-board-header">
          <p className="dream-mini-label">Board Four</p>
          <h2>Boundaries</h2>
        </div>
        <div className="future-plan-toolbar">
          <p className="wellness-muted">Add limits like insurance expiration dates, travel cutoffs, or age-based coverage rules.</p>
          <button type="button" className="dream-secondary-button" onClick={addBoundary}>+ Add boundary</button>
        </div>

        <div className="future-plan-list">
          {boundaries.map((boundary) => (
            <article
              className="future-plan-block"
              key={boundary.id}
              draggable
              onDragStart={() => setDraggedBoundaryId(boundary.id)}
              onDragEnd={() => setDraggedBoundaryId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                moveBoundary(draggedBoundaryId, boundary.id);
                setDraggedBoundaryId(null);
              }}
            >
              <div className="future-plan-block-header">
                <div>
                  <p className="dream-mini-label">Moveable boundary block</p>
                  <h3>{boundary.name || "Untitled boundary"}</h3>
                </div>
                <button
                  type="button"
                  className="dream-icon-button"
                  aria-label={`Remove ${boundary.name || "boundary"}`}
                  title="Remove boundary"
                  onClick={() => removeBoundary(boundary.id)}
                >
                  ×
                </button>
              </div>
              <div className="planner-grid">
                <label>
                  Boundary name
                  <input type="text" value={boundary.name} onChange={(event) => updateBoundary(boundary.id, "name", event.target.value)} />
                </label>
                <label>
                  Rule type
                  <select value={boundary.type} onChange={(event) => updateBoundary(boundary.id, "type", event.target.value)}>
                    <option value="insurance">Insurance coverage</option>
                    <option value="avoid-birth">Avoid giving birth during</option>
                    <option value="outer-deadline">Outer deadline</option>
                  </select>
                </label>
                <label>
                  {boundary.type === "avoid-birth" ? "Avoid birth during" : boundary.type === "outer-deadline" ? "Deadline month" : "Coverage ends in"}
                  <input type="month" value={boundary.month} onChange={(event) => updateBoundary(boundary.id, "month", event.target.value)} />
                </label>
                {boundary.type === "insurance" ? <label>
                  Covers babies under this many months
                  <input
                    type="number"
                    min="0"
                    max="240"
                    value={boundary.maximumBabyAgeMonths}
                    onChange={(event) => updateBoundary(boundary.id, "maximumBabyAgeMonths", Math.max(0, Math.min(240, Number(event.target.value) || 0)))}
                  />
                </label> : null}
              </div>
            </article>
          ))}
        </div>

        <div className="boundary-analysis-list">
          {boundaryAnalyses.map((boundary) => (
            <article className="planner-note-box boundary-analysis" key={`boundary-analysis-${boundary.id}`}>
              <p><strong>{boundary.name || "This boundary"}</strong>: {boundary.type === "insurance" ? `coverage ends ${formatMonthLabel(boundary.month)} and covers babies under ${boundary.maximumBabyAgeMonths} months` : boundary.type === "avoid-birth" ? `do not give birth during ${formatMonthLabel(boundary.month)}` : `final-baby deadline is ${formatMonthLabel(boundary.month)}`}. </p>
              {boundary.checks.map((check) => (
                <p key={`${boundary.id}-${check.childNumber}`}>
                  Baby #{check.childNumber}: <strong>{!check.appliesToChild ? "APPROVED: not affected at expiration" : check.isApproved ? `APPROVED${boundary.type === "insurance" ? `: covered at ${formatBabyAge(check.monthsAtExpiration)}` : ""}` : `DECLINED${boundary.type === "insurance" ? `: over the age limit at ${formatBabyAge(check.monthsAtExpiration)}` : ""}`}</strong>
                </p>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="wellness-card approval-timeline-card">
        <div className="dream-board-header">
          <p className="dream-mini-label">Decision view</p>
          <h2>Approve / Decline Timeline</h2>
        </div>
        <p className="wellness-muted">Each row shows whether every future plan and boundary is approved for that child&apos;s projected timing.</p>
        <div className="approval-timeline">
          {approvalTimeline.map((child) => (
            <article className="approval-timeline-row" key={`timeline-${child.childNumber}`}>
              <div className="approval-timeline-child">
                <p className="dream-mini-label">Baby #{child.childNumber}</p>
                <h3>{formatMonthLabel(child.arrivalMonth)}</h3>
                <p>Projected arrival month</p>
              </div>
              <div className="approval-timeline-decisions">
                {child.decisions.map((decision) => (
                  <div className={`approval-decision ${decision.approved ? "is-approved" : "is-declined"}`} key={decision.id}>
                    <span>{decision.label}</span>
                    <strong>{decision.approved ? "APPROVED" : "DECLINED"}</strong>
                    <small>{formatMonthLabel(decision.month)}</small>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
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
            <h3>{formatMonthLabel(familyDeadlineMonth)}</h3>
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
              With the planned gaps, baby #{finalPlannedBaby.childNumber} would likely need conception around <strong>{formatMonthLabel(finalPlannedBaby.conceptionMonth)}</strong>, with arrival around <strong>{formatMonthLabel(finalPlannedBaby.arrivalMonth)}</strong>.
            </p>
          ) : null}
          {finalPlannedBaby ? (
            <p>
              {birthDate
                ? <>At age {finalBabyAgeLimit}, your final-baby deadline is <strong>{formatMonthLabel(familyDeadlineMonth)}</strong>, so conception would likely need to happen by <strong>{formatMonthLabel(latestFinalBabyConceptionMonth)}</strong>.</>
                : "Set your birth date to calculate the final-baby deadline."}
            </p>
          ) : null}
        </div>
      </section>

      <section className="wellness-card dream-plan-card">
        <h2>Future Plans That Shape The Timing</h2>
        <p className="wellness-muted">
          Each plan is checked against every planned baby. A plan works for the full timeline only when every baby is compatible.
        </p>

        <div className="future-plan-analysis-list">
          {futurePlanAnalyses.map((plan) => (
            <section className="future-plan-analysis" key={`analysis-${plan.id}`}>
              <div className="future-plan-analysis-header">
                <div>
                  <p className="dream-mini-label">{plan.name || "Future plan"}</p>
                  <h3>{formatMonthLabel(plan.month)}</h3>
                </div>
                <strong className={plan.worksForAllBabies ? "future-plan-status is-yes" : "future-plan-status is-no"}>
                  {plan.worksForAllBabies ? "Yes, works for everyone" : "No, not for everyone"}
                </strong>
              </div>

              <div className="dream-scenario-grid">
                {plan.checks.map((check) => {
                  const worksForChild = check.worksWithBabyAge || check.worksWithPregnancy || check.isBeforeConception;
                  return (
                    <article className={`dream-scenario-pill ${worksForChild ? "is-match" : "is-tight"}`} key={`${plan.id}-${check.childNumber}`}>
                      <p className="dream-mini-label">{plan.name || "Future plan"} around baby #{check.childNumber}</p>
                      <h3>{formatMonthLabel(plan.month)}</h3>
                      <p>{check.summary}</p>
                      <p>
                        Baby age then: <strong>{formatBabyAge(check.monthsAfterArrival)}</strong>
                      </p>
                      <p>
                        Pregnancy timing then: <strong>{check.pregnancyWeeksAtPlan == null ? check.monthsAfterArrival != null && check.monthsAfterArrival > 0 ? "baby is already here" : "not pregnant yet" : `about ${check.pregnancyWeeksAtPlan} weeks`}</strong>
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

    </div>
  );
}

export default DreamPregnancySection;