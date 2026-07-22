import { useState } from "react";
import AddCycleEntry from "./AddCycleEntry";


function CycleTracking() {

  const [cycleData, setCycleData] = useState([]);


  function saveEntry(entry) {

    setCycleData((previousData) => {

      const exists = previousData.find(
        item => item.date === entry.date
      );


      if (exists) {
        return previousData.map(item =>
          item.date === entry.date
            ? entry
            : item
        );
      }


      return [
        ...previousData,
        entry
      ];
    });

  }


  return (
    <div>

      <h1>Cycle Tracking</h1>

      <AddCycleEntry
        saveEntry={saveEntry}
      />


      <pre>
        {JSON.stringify(cycleData, null, 2)}
      </pre>

    </div>
  );
}

export default CycleTracking;