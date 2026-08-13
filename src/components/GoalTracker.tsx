import "./GoalTracker.css";

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getDayNumber(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24);
}

function GoalTracker({ goal, setGoals, showStreak = true, trackerMode = "calendar" }) {
    const currentMonth = new Date();
    const monthName = currentMonth.toLocaleString("default", { month: "long" });
    const year = currentMonth.getFullYear();

    const daysInMonth = new Date(year, currentMonth.getMonth() + 1, 0).getDate();

    const days = Array.from(
        { length: daysInMonth },
        (_, index) => new Date(year, currentMonth.getMonth(), index + 1)
    );

    function toggleDayCompletion(day) {
        const dateString = formatDate(day);

        setGoals((previousGoals) =>
            previousGoals.map((item) => {
                if (item.id !== goal.id) {
                    return item;
                }

                const alreadyDone = item.completedDates.includes(dateString);

                return {
                    ...item,
                    completedDates: alreadyDone
                        ? item.completedDates.filter((date) => date !== dateString)
                        : [...item.completedDates, dateString],
                };
            })
        );
    }

    function deleteGoal() {
        setGoals((previousGoals) => previousGoals.filter((item) => item.id !== goal.id));
    }

    function toggleChecklistGoal() {
        const today = formatDate(new Date());

        setGoals((previousGoals) =>
            previousGoals.map((item) => {
                if (item.id !== goal.id) {
                    return item;
                }

                const isChecked = Array.isArray(item.completedDates) && item.completedDates.length > 0;

                return {
                    ...item,
                    completedDates: isChecked ? [] : [today],
                };
            })
        );
    }

    function getStreak() {
        const sortedDays = [...goal.completedDates].sort().map(getDayNumber);

        if (sortedDays.length === 0) {
            return 0;
        }

        let streak = 1;

        for (let index = sortedDays.length - 1; index > 0; index -= 1) {
            const difference = sortedDays[index] - sortedDays[index - 1];

            if (difference === 1) {
                streak += 1;
            } else {
                break;
            }
        }

        return streak;
    }

    const sortedCompletedDates = [...goal.completedDates].sort();
    const completedDaysThisMonth = sortedCompletedDates
        .filter((date) => date.startsWith(`${year}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`))
        .map((date) => Number(date.split("-")[2]));

    if (trackerMode === "checklist") {
        const isChecked = sortedCompletedDates.length > 0;
        const lastChecked = isChecked ? sortedCompletedDates[sortedCompletedDates.length - 1] : null;

        return (
            <article className="goal-tracker-card checklist-card">
                <header className="goal-tracker-header">
                    <div>
                        <h3>{goal.name}</h3>
                        <p>{isChecked ? `Checked on ${lastChecked}` : "Not checked yet"}</p>
                    </div>

                    <button type="button" className="goal-delete-btn" onClick={deleteGoal}>
                        Delete
                    </button>
                </header>

                <button
                    type="button"
                    className={`goal-checklist-toggle ${isChecked ? "is-complete" : ""}`}
                    onClick={toggleChecklistGoal}
                    aria-pressed={isChecked}
                >
                    {isChecked ? "Checked" : "Mark as Ready"}
                </button>
            </article>
        );
    }

    return (
        <article className="goal-tracker-card">
            <header className="goal-tracker-header">
                <div>
                    <h3>{goal.name}</h3>
                    <p>
                        {monthName} {year}
                    </p>
                </div>

                <button type="button" className="goal-delete-btn" onClick={deleteGoal}>
                    Delete
                </button>
            </header>

            <div className="goal-days-grid">
                {days.map((day) => {
                    const dateString = formatDate(day);
                    const isComplete = goal.completedDates.includes(dateString);

                    return (
                        <button
                            key={dateString}
                            type="button"
                            className={`goal-day-btn ${isComplete ? "is-complete" : ""}`}
                            onClick={() => toggleDayCompletion(day)}
                            aria-pressed={isComplete}
                            aria-label={`${goal.name} day ${day.getDate()} ${isComplete ? "completed" : "not completed"}`}
                        >
                            {day.getDate()}
                        </button>
                    );
                })}
            </div>

            <footer className="goal-tracker-footer">
                <p>
                    Completed this month: {completedDaysThisMonth.length > 0 ? completedDaysThisMonth.join(", ") : "None yet"}
                </p>
                {showStreak ? (
                    <p>Streak: {getStreak()} day(s)</p>
                ) : (
                    <p>Total check-ins: {sortedCompletedDates.length}</p>
                )}
            </footer>
        </article>
    );
}

export default GoalTracker;