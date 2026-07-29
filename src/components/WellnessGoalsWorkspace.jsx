import { useEffect, useMemo, useRef, useState } from "react";
import GoalTracker from "./GoalTracker";
import "../pages/WellnessPages.css";

function createGoal(name) {
  const goalId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `goal-${Date.now()}`;

  return {
    id: goalId,
    name,
    completedDates: [],
  };
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getGoalSummary(goals) {
  const now = new Date();
  const currentMonthKey = monthKey(now);

  const completedThisMonth = goals.reduce((sum, goal) => {
    const count = goal.completedDates.filter((dateString) => dateString.startsWith(currentMonthKey)).length;
    return sum + count;
  }, 0);

  const activeGoalsThisMonth = goals.filter((goal) =>
    goal.completedDates.some((dateString) => dateString.startsWith(currentMonthKey))
  ).length;

  return {
    totalGoals: goals.length,
    completedThisMonth,
    activeGoalsThisMonth,
  };
}

function WellnessGoalsWorkspace({
  username,
  category,
  kicker,
  title,
  description,
  infoCards,
  templates,
  inputPlaceholder,
  trackerHeading,
  emptyText,
  showStreak = true,
  trackerMode = "calendar",
  topPanel = null,
}) {
  const [goals, setGoals] = useState([]);
  const [newGoalName, setNewGoalName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const hydratedRef = useRef(false);

  function addGoal() {
    if (newGoalName.trim() === "") {
      return;
    }

    setGoals((previousGoals) => [...previousGoals, createGoal(newGoalName)]);
    setNewGoalName("");
  }

  function addTemplateGoal(template) {
    const alreadyExists = goals.some(
      (goal) => goal.name.trim().toLowerCase() === template.trim().toLowerCase()
    );

    if (alreadyExists) {
      return;
    }

    setGoals((previousGoals) => [...previousGoals, createGoal(template)]);
  }

  useEffect(() => {
    async function loadGoals() {
      try {
        hydratedRef.current = false;
        setIsLoading(true);
        setStatusMessage("");

        const response = await fetch(
          `http://localhost:3000/api/goals?username=${encodeURIComponent(username)}&category=${encodeURIComponent(category)}`
        );

        if (!response.ok) {
          throw new Error(`Could not load goals (${response.status}).`);
        }

        const data = await response.json();
        setGoals(Array.isArray(data.goals) ? data.goals : []);
      } catch (error) {
        console.error(error);
        setStatusMessage(error.message || "Could not load goals.");
      } finally {
        setIsLoading(false);
        hydratedRef.current = true;
      }
    }

    loadGoals();
  }, [username, category]);

  useEffect(() => {
    async function saveGoals() {
      try {
        const response = await fetch("http://localhost:3000/api/goals", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            category,
            goals,
          }),
        });

        if (!response.ok) {
          throw new Error(`Could not save goals (${response.status}).`);
        }

        setStatusMessage("");
      } catch (error) {
        console.error(error);
        setStatusMessage(error.message || "Could not save goals.");
      }
    }

    if (!hydratedRef.current) {
      return;
    }

    saveGoals();
  }, [goals, username, category]);

  const summary = useMemo(() => getGoalSummary(goals), [goals]);

  return (
    <div className="wellness-page-shell">
      <section className="wellness-hero-card">
        <p className="wellness-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <section className="wellness-grid-3">
        <article className="wellness-card">
          <h2>Total Goals</h2>
          <p className="wellness-value">{summary.totalGoals}</p>
          <p className="wellness-muted">Across this section</p>
        </article>

        <article className="wellness-card">
          <h2>Completed This Month</h2>
          <p className="wellness-value">{summary.completedThisMonth}</p>
          <p className="wellness-muted">All goal check-ins combined</p>
        </article>

        <article className="wellness-card">
          <h2>Active Goals This Month</h2>
          <p className="wellness-value">{summary.activeGoalsThisMonth}</p>
          <p className="wellness-muted">Goals with at least 1 check-in</p>
        </article>
      </section>

      <section className="wellness-grid-2">
        {infoCards.map((card) => (
          <article className="wellness-card" key={card.title}>
            <h2>{card.title}</h2>
            {Array.isArray(card.items) ? (
              <ul>
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="wellness-muted">{card.description}</p>
            )}
          </article>
        ))}
      </section>

      {topPanel}

      <section className="wellness-card">
        <h2>Create Goal</h2>

        <div className="wellness-input-row">
          <input
            type="text"
            placeholder={inputPlaceholder}
            value={newGoalName}
            onChange={(event) => setNewGoalName(event.target.value)}
          />

          <button type="button" onClick={addGoal}>
            Add Goal
          </button>
        </div>

        <p className="wellness-muted">Quick templates</p>
        <div className="wellness-chip-row">
          {templates.map((template) => (
            <button
              key={template}
              type="button"
              className="wellness-chip"
              onClick={() => addTemplateGoal(template)}
            >
              {template}
            </button>
          ))}
        </div>
      </section>

      <section className="wellness-card">
        <h2>{trackerHeading}</h2>

        {isLoading ? <p className="wellness-muted">Loading goals for {username}...</p> : null}
        {!isLoading && statusMessage ? <p className="wellness-muted">{statusMessage}</p> : null}

        {!isLoading && goals.length === 0 ? (
          <p className="wellness-muted">{emptyText}</p>
        ) : (
          <div className="wellness-goal-list">
            {goals.map((goal) => (
              <GoalTracker
                key={goal.id}
                goal={goal}
                setGoals={setGoals}
                showStreak={showStreak}
                trackerMode={trackerMode}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default WellnessGoalsWorkspace;
