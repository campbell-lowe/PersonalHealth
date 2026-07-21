import { useState } from "react";

function App() {
  const [selectedGoal, setSelectedGoal] = useState("Sugar Free");

  const [goals, setGoals] = useState([
    {
      name: "Prenatal",
      completedDates: [],
    },
    {
      name: "Sugar Free",
      completedDates: [],
    },
    {
      name: "Pilates",
      completedDates: [],
    },
    {
      name: "Pelvic Floor Exercises",
      completedDates: [],
    },
  ]);

  const currentGoal = goals.find(
    (goal) => goal.name === selectedGoal
  );

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

  function formatDate(date) {
    return date.toISOString().split("T")[0];
  }

  function completeDay(day) {
    const newGoals = goals.map((goal) => {
      if (goal.name === selectedGoal) {
        let updatedDates;

        if (goal.completedDates.includes(day)) {
          // Remove the day
          updatedDates = goal.completedDates.filter(
            (date) => date !== day
          );
        } else {
          // Add the day
          updatedDates = [
            ...goal.completedDates,
            day,
          ];
        }

        return {
          ...goal,
          completedDates: updatedDates,
        };
      }

      return goal;
    });

    setGoals(newGoals);
  }

  function getStreak() {
    const dates = [...currentGoal.completedDates]
      .sort()
      .map(date => new Date(date));

    if (dates.length === 0) {
      return 0;
    }

    let streak = 1;

    for (let i = dates.length - 1; i > 0; i--) {
      const difference =
        (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);

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
      <h1>Preconception Tracker</h1>
      <p>Welcome!</p>

      <h2>Select Goal</h2>
      <div>
        {goals.map((goal) => (
          <button
            key={goal.name}
            onClick={() => setSelectedGoal(goal.name)}
          >
            {selectedGoal === goal.name ? "✓ " : ""}
            {goal.name}
          </button>
        ))}
      </div>


      <h2>Today's Goals</h2>
      <p>Tracking: {selectedGoal}</p>
      <h3>{monthName} {year}</h3>


      <div>
        {days.map((day) => {
          const dateString = formatDate(day);

          return (
            <button
              key={dateString}
              onClick={() => completeDay(dateString)}
            >
              {day.getDate()}
              {currentGoal.completedDates.includes(dateString) ? "✓" : ""}
            </button>
          );
        })}
      </div>

      <p>Completed days:</p>
      <p>
        {[...currentGoal.completedDates]
          .sort()
          .map(date => new Date(date).getDate())
          .join(", ")}
      </p>


      <p>
        Current goal: {selectedGoal}
      </p>

      <p>
        {selectedGoal} 🔥 {getStreak()} day streak!
      </p>

    </div >
  );
}


export default App;
