function toDateLabel(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dayDiff(fromDateString, toDateString) {
  if (!fromDateString || !toDateString) {
    return null;
  }

  const from = new Date(`${fromDateString}T00:00:00`);
  const to = new Date(`${toDateString}T00:00:00`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  const diffMs = to - from;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function isPeriodLike(entry) {
  const bleeding = lower(entry?.bleeding);
  return entry?.period === true || ["light", "medium", "heavy"].includes(bleeding);
}

function pickReferenceOvulationDate({
  confirmedOvulationDates,
  estimatedOvulationDate,
  currentDate,
}) {
  const sortedConfirmed = [...(confirmedOvulationDates || [])].sort((a, b) =>
    a > b ? 1 : -1
  );

  if (sortedConfirmed.length === 0) {
    return estimatedOvulationDate || null;
  }

  if (!currentDate) {
    return sortedConfirmed.at(-1);
  }

  const onOrBefore = sortedConfirmed.filter((date) => date <= currentDate);
  if (onOrBefore.length > 0) {
    return onOrBefore.at(-1);
  }

  return sortedConfirmed[0];
}

function getPhaseDefinition(summary) {
  const currentEntry = summary?.currentEntry || null;
  const currentDate = currentEntry?.date || null;
  const cycleDay = Number(currentEntry?.cycleDay);
  const hasCycleDay = Number.isFinite(cycleDay) && cycleDay > 0;
  const periodLike = isPeriodLike(currentEntry);

  const estimatedIsAnovulatory = summary?.estimatedIsAnovulatory === true;

  const ovulationReferenceDate = pickReferenceOvulationDate({
    confirmedOvulationDates: summary?.confirmedOvulationDates || [],
    estimatedOvulationDate: summary?.estimatedOvulationDate || null,
    currentDate,
  });

  const daysFromOvulation = dayDiff(ovulationReferenceDate, currentDate);

  if (estimatedIsAnovulatory) {
    if (periodLike) {
      return {
        key: "anovulatory-menstrual",
        title: "Menstrual Phase (Likely Anovulatory Cycle)",
        summary:
          "You are bleeding now, but this cycle currently does not show a clear ovulation signal.",
        expect: [
          "Bleeding, cramping, lower energy, and possible mood shifts.",
          "This cycle may be longer or less predictable than usual.",
          "Ovulation-timed predictions (fertile window and due date by ovulation) are less reliable.",
        ],
      };
    }

    return {
      key: "anovulatory",
      title: "Likely Anovulatory Cycle",
      summary:
        "Your current cycle does not show a strong ovulation pattern yet (or may be anovulatory).",
      expect: [
        "Cycle timing may feel irregular this month.",
        "Cervical mucus and LH patterns can still fluctuate without clear ovulation.",
        "Focus on tracking consistently; signals may clarify with more entries.",
      ],
    };
  }

  if (periodLike || (hasCycleDay && cycleDay <= 5)) {
    return {
      key: "menstrual",
      title: "Menstrual Phase",
      summary: "You are likely in your period phase right now.",
      expect: [
        "Bleeding, cramps, lower energy, and appetite changes are common.",
        "Fertility is typically low during this phase.",
        "Hydration, iron-rich foods, and sleep can help recovery.",
      ],
    };
  }

  if (daysFromOvulation !== null) {
    if (daysFromOvulation === 0) {
      return {
        key: "ovulation",
        title: "Ovulation Phase",
        summary: "You appear to be at ovulation today.",
        expect: [
          "Fertility is at or near peak.",
          "Some people notice wetter/egg-white mucus or one-sided pelvic sensations.",
          "Libido may increase around this point in the cycle.",
        ],
      };
    }

    if (daysFromOvulation >= -5 && daysFromOvulation <= -1) {
      return {
        key: "fertile-window",
        title: "Fertile Window",
        summary: "You are likely in the days leading up to ovulation.",
        expect: [
          "Fertility rises each day as ovulation approaches.",
          "Cervical mucus often becomes clearer, stretchier, or more slippery.",
          "Ovulation signs may sharpen over the next few days.",
        ],
      };
    }

    if (daysFromOvulation >= 1) {
      return {
        key: "luteal",
        title: "Luteal Phase",
        summary: "You are likely in the post-ovulation luteal phase.",
        expect: [
          "Body temperature often stays elevated versus pre-ovulation baseline.",
          "Bloating, breast tenderness, mood changes, or fatigue can appear.",
          "If pregnancy does not occur, bleeding typically starts after this phase.",
        ],
      };
    }
  }

  if (hasCycleDay) {
    if (cycleDay <= 12) {
      return {
        key: "follicular",
        title: "Follicular Phase",
        summary: "You are likely in the follicular phase before the fertile window.",
        expect: [
          "Energy and mood may gradually improve after period days.",
          "Cervical mucus can increase as ovulation approaches.",
          "Fertility is building but not yet at peak.",
        ],
      };
    }

    if (cycleDay <= 17) {
      return {
        key: "fertile-likely",
        title: "Fertile / Ovulatory Window",
        summary: "You may be entering or within your fertile window.",
        expect: [
          "LH and mucus signals may become more pronounced.",
          "Fertility is typically higher in this window.",
          "Keep daily tracking for best estimate precision.",
        ],
      };
    }

    return {
      key: "luteal-likely",
      title: "Likely Luteal Phase",
      summary: "You are likely in the second half of your cycle.",
      expect: [
        "Progesterone-related symptoms may increase (bloating, PMS-like changes).",
        "Body temperature is often steadier and higher than pre-ovulation days.",
        "Period may be due in the coming days depending on cycle length.",
      ],
    };
  }

  return {
    key: "unknown",
    title: "Phase Not Clear Yet",
    summary: "There is not enough cycle data yet to classify your current phase confidently.",
    expect: [
      "Continue entering daily LH, temperature, and bleeding details.",
      "Phase confidence improves as more consecutive days are logged.",
      "Use this guide as informational only while data is still sparse.",
    ],
  };
}

function CyclePhaseGuide({ cycleSummary }) {
  if (!cycleSummary) {
    return (
      <div style={{ display: "grid", gap: "12px" }}>
        <h1 style={{ marginBottom: 0 }}>Cycle Phase Guide</h1>
        <p style={{ margin: 0, color: "#666" }}>
          Open this page from the Cycle Dashboard so your selected cycle is preloaded.
        </p>
      </div>
    );
  }

  const currentEntry = cycleSummary.currentEntry || null;
  const phase = getPhaseDefinition(cycleSummary);

  return (
    <div
      style={{
        maxWidth: "920px",
        margin: "0 auto",
        padding: "20px",
        display: "grid",
        gap: "16px",
      }}
    >
      <h1 style={{ marginBottom: 0 }}>Cycle Phase Guide</h1>

      <p style={{ margin: 0, color: "#555" }}>
        Based on selected cycle {toDateLabel(cycleSummary.cycleStartDate)} to {toDateLabel(cycleSummary.cycleEndDate)}
      </p>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          background: "#fff",
          display: "grid",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>{phase.title}</h2>
        <p style={{ margin: 0, color: "#444" }}>{phase.summary}</p>

        <p style={{ margin: 0, color: "#444" }}>
          Current logged day: {currentEntry?.date ? toDateLabel(currentEntry.date) : "Unknown"}
          {currentEntry?.cycleDay ? ` (CD ${currentEntry.cycleDay})` : ""}
        </p>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          background: "#fff",
          display: "grid",
          gap: "8px",
        }}
      >
        <h3 style={{ margin: 0 }}>What To Expect</h3>

        {phase.expect.map((line) => (
          <p key={line} style={{ margin: 0, color: "#444" }}>
            - {line}
          </p>
        ))}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "16px",
          background: "#fff",
          display: "grid",
          gap: "8px",
        }}
      >
        <h3 style={{ margin: 0 }}>Cycle Signals Used</h3>
        <p style={{ margin: 0, color: "#444" }}>
          Confirmed ovulation dates: {(cycleSummary.confirmedOvulationDates || []).length > 0
            ? cycleSummary.confirmedOvulationDates.join(", ")
            : "None"}
        </p>
        <p style={{ margin: 0, color: "#444" }}>
          Estimated ovulation date: {cycleSummary.estimatedOvulationDate || "Not available"}
        </p>
        <p style={{ margin: 0, color: "#444" }}>
          Ovulation interpretation: {cycleSummary.estimatedIsAnovulatory ? "Likely anovulatory" : "Ovulatory pattern detected"}
        </p>
      </section>

      <p style={{ margin: 0, color: "#777", fontSize: "0.84rem" }}>
        This guide is educational and estimate-based, and it does not replace medical advice.
      </p>
    </div>
  );
}

export default CyclePhaseGuide;
