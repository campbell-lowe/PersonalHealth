import WellnessGoalsWorkspace from "../components/WellnessGoalsWorkspace";

const LIFESTYLE_TEMPLATES = [
  "30 minutes movement",
  "No caffeine after 2 PM",
  "Bedtime wind-down routine",
  "8+ cups water",
  "10 minutes stretch",
  "Whole-food lunch",
  "20 minutes outside",
  "5 minutes breathing practice",
];

function Lifestyle({ username }) {
  return (
    <WellnessGoalsWorkspace
      username={username}
      category="lifestyle"
      kicker="Support Section"
      title="Lifestyle"
      description="Strengthen the habits that support hormones, recovery, mood, and cycle stability over time."
      infoCards={[
        {
          title: "Sleep",
          description: "Consistent sleep and wake times improve resilience and energy.",
        },
        {
          title: "Movement",
          description: "Mix lighter days with strength and moderate cardio for balance.",
        },
        {
          title: "Nourishment",
          description: "Prioritize protein, fiber, hydration, and blood-sugar stability.",
        },
      ]}
      templates={LIFESTYLE_TEMPLATES}
      inputPlaceholder="Enter a lifestyle goal..."
      trackerHeading="Lifestyle Goal Trackers"
      emptyText="No lifestyle goals yet. Add one above or choose from the quick templates."
    />
  );
}

export default Lifestyle;
