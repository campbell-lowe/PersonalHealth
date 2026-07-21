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

function GoalTracker({ goal, goals, setGoals }) {

    const currentMonth = new Date();

    const monthName = currentMonth.toLocaleString("default", {
        month: "long",
    });

    const year = currentMonth.getFullYear();

    const daysInMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0
    ).getDate();

    const days = Array.from({ length: daysInMonth }, (_, i) => {
        return new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth(),
            i + 1
        );
    });


    function completeDay(day) {
        const newGoals = goals.map((item) => {

            if (item.name === goal.name) {

                let updatedDates;

                if (item.completedDates.includes(formatDate(day))) {
                    updatedDates = item.completedDates.filter(
                        (date) => date !== formatDate(day)
                    );
                } else {
                    updatedDates = [
                        ...item.completedDates,
                        formatDate(day),
                    ];
                }

                return {
                    ...item,
                    completedDates: updatedDates,
                };
            }

            return item;
        });

        setGoals(newGoals);
    }


    function getStreak() {
        const dates = [...goal.completedDates]
            .sort((a, b) => a.localeCompare(b))
            .map(getDayNumber);

        if (dates.length === 0) {
            return 0;
        }

        let streak = 1;

        for (let i = dates.length - 1; i > 0; i--) {
            const difference = dates[i] - dates[i - 1];

            if (difference === 1) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }


    return (
        <div>
            <h2>{goal.name}</h2>

            <h3>{monthName} {year}</h3>

            <div>
                {days.map((day) => {
                    const dateString = formatDate(day);

                    return (
                        <button
                            key={dateString}
                            onClick={() => completeDay(day)}
                        >
                            {day.getDate()}
                            {goal.completedDates.includes(dateString) ? "✓" : ""}
                        </button>
                    );
                })}
            </div>


            <p>
                Completed days:
                {" "}
                {[...goal.completedDates]
                    .sort((a, b) => a.localeCompare(b))
                    .map(date => Number(date.split("-")[2]))
                    .join(", ")}
            </p>


            <p>
                🔥 Streak: {getStreak()} days
            </p>

        </div>
    );
}

export default GoalTracker;