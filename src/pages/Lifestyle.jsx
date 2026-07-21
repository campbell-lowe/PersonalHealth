import { useState } from "react";
import GoalTracker from "../components/GoalTracker";

function Lifestyle() {

  const [goals, setGoals] = useState([]);
  const [newGoalName, setNewGoalName] = useState("");

  function addGoal() {
    if (newGoalName.trim() === "") {
      return;
    }

    const newGoal = {
      id: Date.now(),
      name: newGoalName,
      completedDates: [],
    };

    setGoals([...goals, newGoal]);
    setNewGoalName("");
  }

  return (
    <div>
      <h1>Lifestyle</h1>
        <h2>This is the place to set and track your lifestyle goals.</h2>


      <input
        type="text"
        placeholder="Enter a goal..."
        value={newGoalName}
        onChange={(e) => setNewGoalName(e.target.value)}
      />

      <button onClick={addGoal}>
        + Add New Goal
      </button>

      {goals.map((goal) => (
        <GoalTracker
          key={goal.id}
          goal={goal}
          setGoals={setGoals}
        />
      ))}
    </div>
  );
}

export default Lifestyle;
