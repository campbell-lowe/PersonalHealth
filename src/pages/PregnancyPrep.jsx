import { useState } from "react";
import GoalTracker from "../components/GoalTracker";

function PregnancyPrep() {

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


  return (
    <div>
      <h1>Pregnancy Prep</h1>

      {goals.map((goal) => (
        <GoalTracker
          key={goal.name}
          goal={goal}
          goals={goals}
          setGoals={setGoals}
        />
      ))}


      <button>
        + Add New Goal
      </button>

    </div>
  );
}

export default PregnancyPrep;