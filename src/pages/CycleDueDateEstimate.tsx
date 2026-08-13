function toDateString(value) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function addDays(dateString, days) {
  if (!dateString) {
    return null;
  }

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DueDateRow({ label, sourceDate, dueDate, helperText }) {
  return (
    <article
      style={{
        border: "1px solid #e3e3e3",
        borderRadius: "10px",
        padding: "14px",
        background: "#fff",
        display: "grid",
        gap: "6px",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "1rem" }}>{label}</h3>

      <p style={{ margin: 0, color: "#555" }}>
        Source Date: {sourceDate ? toDateString(sourceDate) : "Not available"}
      </p>

      <p style={{ margin: 0, color: "#1e5b2c", fontWeight: 700 }}>
        Estimated Due Date: {dueDate ? toDateString(dueDate) : "Not enough data"}
      </p>

      {helperText ? (
        <p style={{ margin: 0, color: "#777", fontSize: "0.84rem" }}>{helperText}</p>
      ) : null}
    </article>
  );
}

function CycleDueDateEstimate({ cycleSummary }) {
  if (!cycleSummary) {
    return (
      <div style={{ display: "grid", gap: "12px" }}>
        <h1 style={{ marginBottom: 0 }}>Due Date Estimate</h1>
        <p style={{ margin: 0, color: "#666" }}>
          Open this page from Unprotected Sex Events on the dashboard so this cycle is preloaded.
        </p>
      </div>
    );
  }

  const periodStartDate = cycleSummary.cycleStartDate || "";
  const confirmedOvulationDates = Array.isArray(cycleSummary.confirmedOvulationDates)
    ? cycleSummary.confirmedOvulationDates
    : [];
  const estimatedOvulationDate = cycleSummary.estimatedOvulationDate || null;
  const estimatedIsAnovulatory = cycleSummary.estimatedIsAnovulatory === true;

  const dueDateFromPeriodStart = addDays(periodStartDate, 280);
  const dueDateFromEstimatedOvulation = addDays(estimatedOvulationDate, 266);

  const confirmedDueDateRows = confirmedOvulationDates.map((confirmedDate) => ({
    confirmedDate,
    dueDate: addDays(confirmedDate, 266),
  }));

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
      <h1 style={{ marginBottom: 0 }}>Due Date Estimate</h1>

      <p style={{ margin: 0, color: "#555" }}>
        Based on your currently selected cycle: {toDateString(periodStartDate) || "Unknown start"}
      </p>

      <DueDateRow
        label="Based on Period Start Date"
        sourceDate={periodStartDate}
        dueDate={dueDateFromPeriodStart}
        helperText="Calculated as cycle start + 280 days (40 weeks)."
      />

      <DueDateRow
        label="Based on Estimated Ovulation"
        sourceDate={estimatedOvulationDate}
        dueDate={dueDateFromEstimatedOvulation}
        helperText={estimatedIsAnovulatory
          ? "This cycle is marked likely anovulatory, so no estimated ovulation due date is provided."
          : "Calculated as estimated ovulation + 266 days (38 weeks from conception)."}
      />

      <section
        style={{
          border: "1px solid #e3e3e3",
          borderRadius: "10px",
          padding: "14px",
          background: "#fff",
          display: "grid",
          gap: "10px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Based on Confirmed Ovulation</h3>

        {confirmedDueDateRows.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>
            No confirmed ovulation date logged for this cycle yet.
          </p>
        ) : (
          confirmedDueDateRows.map((row) => (
            <p key={row.confirmedDate} style={{ margin: 0, color: "#2f2f2f" }}>
              {toDateString(row.confirmedDate)} {"->"} Estimated Due Date: {toDateString(row.dueDate) || "Not enough data"}
            </p>
          ))
        )}

        <p style={{ margin: 0, color: "#777", fontSize: "0.84rem" }}>
          Confirmed ovulation due dates are calculated as ovulation + 266 days.
        </p>
      </section>

      <p style={{ margin: 0, color: "#777", fontSize: "0.84rem" }}>
        Disclaimer: this is an estimate only and does not replace medical advice.
      </p>
    </div>
  );
}

export default CycleDueDateEstimate;
