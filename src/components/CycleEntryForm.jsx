import { useState } from "react";
import { emptyCycleEntry } from "../models/cycleEntryModel";

function CycleEntryForm({ saveEntry }) {

  const [entry, setEntry] = useState(emptyCycleEntry);


  function handleChange(event) {
    const { name, value } = event.target;

    setEntry({
      ...entry,
      [name]: value,
    });
  }


  function handleSubmit(event) {
    event.preventDefault();

    saveEntry({
      ...entry,
      id: Date.now(),
    });

    setEntry(emptyCycleEntry);
  }


  return (
    <form onSubmit={handleSubmit}>

      <h2>Daily Cycle Entry</h2>


      <label>
        Date
        <input
          type="date"
          name="date"
          value={entry.date}
          onChange={handleChange}
        />
      </label>


      <label>
        Cycle Number
        <input
          type="number"
          name="cycleNumber"
          value={entry.cycleNumber}
          onChange={handleChange}
        />
      </label>


      <label>
        Cycle Day
        <input
          type="number"
          name="cycleDay"
          value={entry.cycleDay}
          onChange={handleChange}
        />
      </label>


      <label>
        Wrist Temperature
        <input
          type="number"
          step="0.01"
          name="wristTemp"
          value={entry.wristTemp}
          onChange={handleChange}
        />
      </label>


      <label>
        Thermometer Temperature
        <input
          type="number"
          step="0.01"
          name="thermometerTemp"
          value={entry.thermometerTemp}
          onChange={handleChange}
        />
      </label>


      <label>
        LH Morning
        <input
          type="number"
          step="0.01"
          name="lhMorning"
          value={entry.lhMorning}
          onChange={handleChange}
        />
      </label>


      <label>
        LH Night
        <input
          type="number"
          step="0.01"
          name="lhNight"
          value={entry.lhNight}
          onChange={handleChange}
        />
      </label>


      <label>
        CM Amount
        <input
          name="cmAmount"
          value={entry.cmAmount}
          onChange={handleChange}
        />
      </label>


      <label>
        CM Type
        <input
          name="cmType"
          value={entry.cmType}
          onChange={handleChange}
        />
      </label>


      <label>
        Bleeding / Spotting
        <input
          name="bleeding"
          value={entry.bleeding}
          onChange={handleChange}
        />
      </label>


      <label>
        Pregnancy Test
        <input
          name="pregnancyTest"
          value={entry.pregnancyTest}
          onChange={handleChange}
        />
      </label>


      <label>
        Weight
        <input
          type="number"
          name="weight"
          value={entry.weight}
          onChange={handleChange}
        />
      </label>


      <label>
        Sleep Hours
        <input
          type="number"
          name="sleepHours"
          value={entry.sleepHours}
          onChange={handleChange}
        />
      </label>


      <label>
        Notes
        <textarea
          name="notes"
          value={entry.notes}
          onChange={handleChange}
        />
      </label>


      <button type="submit">
        Save Entry
      </button>

    </form>
  );
}

export default CycleEntryForm;