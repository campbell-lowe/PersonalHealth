import { useEffect, useMemo, useState } from "react";

const CURRENT_USERNAME = "campbell.lowe";
const OVULATION_SIGNAL_DELTA = 0.2;
const LH_POSITIVE_THRESHOLD = 1;

const TEMPERATURE_SOURCES = [
  { key: "thermometer", label: "Thermometer", dataKey: "thermometerTemp", color: "#ff5d57" },
  { key: "apple-watch", label: "Apple Watch", dataKey: "wristTemp", color: "#2470ff" },
  // Add future sources here (e.g., Oura Ring, Tempdrop) without chart rewrites.
];

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toPlottableNumber(value, options = {}) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }

  if (options.excludeZero && numeric === 0) {
    return null;
  }

  return numeric;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function findSustainedRiseStart(points, startIndex = 6, minDelta = 0.2) {
  const firstIndex = Math.max(6, startIndex);

  for (let index = firstIndex; index <= points.length - 3; index += 1) {
    const previousSixValues = points.slice(index - 6, index).map((point) => point.value);
    const baselineCandidate = average(previousSixValues);
    if (baselineCandidate === null) {
      continue;
    }

    const hasSustainedRise = [0, 1, 2].every(
      (offset) => points[index + offset].value >= baselineCandidate + minDelta
    );

    if (hasSustainedRise) {
      return {
        index,
        baseline: baselineCandidate,
      };
    }
  }

  return null;
}

function computeBaselineForTemperature(points) {
  if (points.length === 0) {
    return { baseline: null, isEstimated: true };
  }

  const ovulationIndex = points.findIndex((point) => point.ovulationConfirmed === true);
  const riseStart = findSustainedRiseStart(points, ovulationIndex >= 0 ? ovulationIndex : 6, 0.2);

  if (riseStart) {
    return {
      baseline: Number(riseStart.baseline.toFixed(2)),
      isEstimated: false,
    };
  }

  const candidatePool =
    ovulationIndex > 0
      ? points.slice(0, ovulationIndex)
      : points.slice(0, Math.max(points.length - 2, 1));

  const lows = candidatePool
    .map((point) => point.value)
    .sort((a, b) => a - b)
    .slice(0, Math.min(6, candidatePool.length));

  const estimatedBaseline = average(lows);

  return {
    baseline: estimatedBaseline === null ? null : Number(estimatedBaseline.toFixed(2)),
    isEstimated: true,
  };
}

function normalizeCmType(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getCombinedTemperature(entry) {
  if (entry?.sick === true) {
    return null;
  }

  const wrist = toPlottableNumber(entry?.wristTemp, { excludeZero: true });
  const thermometer = toPlottableNumber(entry?.thermometerTemp, { excludeZero: true });
  const values = [wrist, thermometer].filter((value) => value !== null);

  return values.length > 0 ? average(values) : null;
}

function getDailyLhMax(entry) {
  const values = [entry?.lhMorning, entry?.lhAfternoon, entry?.lhNight]
    .map((value) => toPlottableNumber(value, { excludeZero: true }))
    .filter((value) => value !== null);

  return values.length > 0 ? Math.max(...values) : null;
}

function getOvulationConfidence(score) {
  if (score >= 10) return "High";
  if (score >= 7) return "Medium";
  return "Low";
}

function addScoreReason(day, code, label, points) {
  if (!day.reasonMap[code]) {
    day.reasonMap[code] = {
      code,
      label,
      points: 0,
    };
  }

  day.reasonMap[code].points += points;
  day.score += points;
}

function estimateOvulationForCycle(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      estimatedOvulationDate: null,
      estimatedOvulationCycleDay: null,
      estimatedOvulationScore: 0,
      estimatedOvulationConfidence: "Low",
      estimatedOvulationReasons: [],
      estimatedOvulationTopCandidates: [],
      estimatedBaseline: null,
      estimatedBaselineIsEstimated: true,
      estimatedCycleLhPeak: null,
    };
  }

  const days = entries.map((entry, index) => {
    const combinedTemperature = getCombinedTemperature(entry);
    const lhMax = getDailyLhMax(entry);
    const cmType = normalizeCmType(entry?.cmType);

    return {
      index,
      date: entry?.date || null,
      cycleDay: entry?.cycleDay ?? null,
      combinedTemperature,
      lhMax,
      cmType,
      score: 0,
      reasonMap: {},
    };
  });

  const tempPoints = days
    .filter((day) => day.combinedTemperature !== null)
    .map((day) => ({
      index: day.index,
      value: day.combinedTemperature,
      ovulationConfirmed: entries[day.index]?.ovulationConfirmed === true,
    }));

  const baselineResult = computeBaselineForTemperature(tempPoints);
  const riseStart =
    baselineResult.baseline === null
      ? null
      : findSustainedRiseStart(tempPoints, 6, OVULATION_SIGNAL_DELTA);

  const riseStartEntryIndex = riseStart ? tempPoints[riseStart.index]?.index : null;

  if (baselineResult.baseline !== null) {
    days.forEach((day) => {
      const nextThreeIndices = [day.index + 1, day.index + 2, day.index + 3];
      const hasThreeConsecutiveAbove = nextThreeIndices.every((entryIndex) => {
        const nextDay = days[entryIndex];
        return nextDay && nextDay.combinedTemperature !== null && nextDay.combinedTemperature > baselineResult.baseline;
      });

      if (hasThreeConsecutiveAbove) {
        addScoreReason(
          day,
          "temp-rise-3",
          "3 consecutive temperatures above baseline after this day",
          6
        );
      }

      if (riseStartEntryIndex !== null && day.index === riseStartEntryIndex - 1) {
        addScoreReason(
          day,
          "pre-rise",
          "Immediately before sustained temperature rise",
          4
        );
      }
    });
  }

  const lhValues = days.map((day) => day.lhMax).filter((value) => value !== null);
  const cycleLhMax = lhValues.length > 0 ? Math.max(...lhValues) : null;
  const firstPositiveLhDayIndex = days.findIndex(
    (day) => day.lhMax !== null && day.lhMax >= LH_POSITIVE_THRESHOLD
  );

  const peakLhDayIndex =
    cycleLhMax === null
      ? -1
      : days.findIndex((day) => day.lhMax !== null && day.lhMax === cycleLhMax);

  if (firstPositiveLhDayIndex >= 0 || peakLhDayIndex >= 0) {
    days.forEach((day) => {
      if (firstPositiveLhDayIndex >= 0) {
        const deltaFromFirstPositive = day.index - firstPositiveLhDayIndex;

        if (deltaFromFirstPositive === 1) {
          addScoreReason(
            day,
            "lh-after-first-positive-24-36",
            "24-36h after first positive LH",
            7
          );
        } else if (deltaFromFirstPositive === 2) {
          addScoreReason(
            day,
            "lh-after-first-positive-36-48",
            "Around 36-48h after first positive LH",
            4
          );
        } else if (deltaFromFirstPositive === 0) {
          addScoreReason(
            day,
            "lh-first-positive-day",
            "First positive LH day",
            2
          );
        }
      }

      if (peakLhDayIndex >= 0) {
        const deltaFromPeak = day.index - peakLhDayIndex;

        if (deltaFromPeak === 1) {
          addScoreReason(
            day,
            "lh-after-peak-10-24",
            "10-24h after LH peak",
            9
          );
        } else if (deltaFromPeak === 0) {
          addScoreReason(
            day,
            "lh-peak-day-window",
            "LH peak day (ovulation often follows soon)",
            6
          );
        } else if (deltaFromPeak === 2) {
          addScoreReason(
            day,
            "lh-after-peak-24-48",
            "About 24-48h after LH peak",
            3
          );
        }
      }

      const currentIsPositive = day.lhMax !== null && day.lhMax >= LH_POSITIVE_THRESHOLD;
      const nextDay = days[day.index + 1] || null;
      const previousDay = days[day.index - 1] || null;
      const nextIsPositive =
        nextDay !== null && nextDay.lhMax !== null && nextDay.lhMax >= LH_POSITIVE_THRESHOLD;
      const previousIsPositive =
        previousDay !== null &&
        previousDay.lhMax !== null &&
        previousDay.lhMax >= LH_POSITIVE_THRESHOLD;

      if (currentIsPositive && nextIsPositive) {
        addScoreReason(
          day,
          "lh-sustained-start",
          "Start of sustained positive LH surge (about 24h)",
          4
        );
      }

      if (currentIsPositive && previousIsPositive) {
        addScoreReason(
          day,
          "lh-sustained-continuation",
          "Continuation of sustained positive LH surge",
          3
        );
      }
    });
  }

  if (firstPositiveLhDayIndex >= 0) {
    days.forEach((day) => {
      if (day.index < firstPositiveLhDayIndex) {
        addScoreReason(
          day,
          "before-lh-penalty",
          "Before first positive LH (penalty)",
          -5
        );
      }
    });
  }

  days.forEach((day) => {
    if (day.cmType.includes("egg white") || day.cmType.includes("eggwhite") || day.cmType.includes("ewcm")) {
      addScoreReason(day, "cm-eggwhite", "Egg white cervical mucus present", 0.5);
    } else if (day.cmType.includes("watery")) {
      addScoreReason(day, "cm-watery", "Watery cervical mucus present", 0.25);
    }
  });

  const winningDay = days.reduce((best, current) => {
    if (!best) {
      return current;
    }

    if (current.score > best.score) {
      return current;
    }

    if (current.score === best.score && current.index < best.index) {
      return current;
    }

    return best;
  }, null);

  const estimatedScore = winningDay?.score ?? 0;

  const estimatedOvulationReasons = winningDay
    ? Object.values(winningDay.reasonMap)
        .filter((reason) => reason.points > 0)
        .sort((a, b) => b.points - a.points)
    : [];

  const estimatedOvulationTopCandidates = days
    .map((day) => ({
      date: day.date,
      cycleDay: day.cycleDay,
      score: day.score,
      confidence: getOvulationConfidence(day.score),
      reasons: Object.values(day.reasonMap)
        .filter((reason) => reason.points > 0)
        .sort((a, b) => b.points - a.points),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const dayA = Number(a.cycleDay);
      const dayB = Number(b.cycleDay);

      if (Number.isFinite(dayA) && Number.isFinite(dayB)) {
        return dayA - dayB;
      }

      return 0;
    })
    .slice(0, 5);

  return {
    estimatedOvulationDate: winningDay?.date || null,
    estimatedOvulationCycleDay: winningDay?.cycleDay ?? null,
    estimatedOvulationScore: estimatedScore,
    estimatedOvulationConfidence: getOvulationConfidence(estimatedScore),
    estimatedOvulationReasons,
    estimatedOvulationTopCandidates,
    estimatedBaseline: baselineResult.baseline,
    estimatedBaselineIsEstimated: baselineResult.isEstimated,
    estimatedCycleLhPeak: cycleLhMax,
  };
}

function formatPointLabel({
  seriesLabel,
  value,
  date,
  cycleDay,
}) {
  const dateLabel = date || "Unknown date";
  const dayLabel = cycleDay ? `CD ${cycleDay}` : "CD -";
  const valueLabel = Number.isFinite(value) ? value.toFixed(2) : String(value);
  return `${seriesLabel}: ${valueLabel} | ${dateLabel} (${dayLabel})`;
}

function buildCycleDayTicks(entries, maxLabels = 12) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const indices = [];

  if (entries.length <= maxLabels) {
    for (let index = 0; index < entries.length; index += 1) {
      indices.push(index);
    }
  } else {
    const lastIndex = entries.length - 1;
    const step = Math.ceil(lastIndex / Math.max(maxLabels - 1, 1));
    const unique = new Set([0, lastIndex]);

    for (let index = 0; index <= lastIndex; index += step) {
      unique.add(index);
    }

    indices.push(...Array.from(unique).sort((a, b) => a - b));
  }

  return indices.map((index) => {
    const cycleDayValue = Number(entries[index]?.cycleDay);
    const label = Number.isFinite(cycleDayValue) && cycleDayValue > 0 ? String(cycleDayValue) : "-";
    return { index, label };
  });
}

function buildCycleWindows(entries) {
  const starts = entries
    .filter((entry) => Number(entry.cycleDay) === 1 && entry.date)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  return starts.map((startEntry, index) => {
    const nextStart = starts[index + 1]?.date || null;

    const entriesInWindow = entries.filter((entry) => {
      if (!entry.date) return false;
      if (entry.date < startEntry.date) return false;
      if (nextStart && entry.date >= nextStart) return false;
      return true;
    });

    const endDate = entriesInWindow.at(-1)?.date || startEntry.date;

    return {
      startDate: startEntry.date,
      endDate,
      entries: entriesInWindow,
      length: entriesInWindow.length,
    };
  });
}

function SimpleLineChart({
  title,
  entries,
  series,
  excludeZero = false,
  confirmedDateSet = null,
  confirmedLabel = "",
  estimatedDateSet = null,
  estimatedLabel = "",
  aboveBaselineDateSet = null,
  aboveBaselineLabel = "",
  shadedDateSet = null,
  shadedLabel = "",
  secondaryShadedDateSet = null,
  secondaryShadedLabel = "",
  showCycleDayTicks = false,
  referenceLineValue = null,
  referenceLineLabel = "",
}) {
  const width = 760;
  const height = 240;
  const margin = 28;

  const pointsBySeries = series.map((definition) => ({
    ...definition,
    points: entries
      .map((entry, index) => ({
        index,
        value: toPlottableNumber(entry[definition.key], { excludeZero }),
        date: entry.date,
        cycleDay: entry.cycleDay,
        isConfirmed: Boolean(entry.date && confirmedDateSet?.has(entry.date)),
        isEstimated: Boolean(entry.date && estimatedDateSet?.has(entry.date)),
        isAboveBaseline: Boolean(entry.date && aboveBaselineDateSet?.has(entry.date)),
      }))
      .filter((point) => point.value !== null),
  }));

  const confirmedIndexSet = new Set(
    entries
      .map((entry, index) => ({ index, date: entry.date }))
      .filter((item) => item.date && confirmedDateSet?.has(item.date))
      .map((item) => item.index)
  );

  const estimatedIndexSet = new Set(
    entries
      .map((entry, index) => ({ index, date: entry.date }))
      .filter((item) => item.date && estimatedDateSet?.has(item.date))
      .map((item) => item.index)
  );

  const shadedIndexSet = new Set(
    entries
      .map((entry, index) => ({ index, date: entry.date }))
      .filter((item) => item.date && shadedDateSet?.has(item.date))
      .map((item) => item.index)
  );

  const secondaryShadedIndexSet = new Set(
    entries
      .map((entry, index) => ({ index, date: entry.date }))
      .filter((item) => item.date && secondaryShadedDateSet?.has(item.date))
      .map((item) => item.index)
  );

  const allValues = pointsBySeries.flatMap((item) => item.points.map((point) => point.value));
  const hasData = allValues.length > 0;

  let minY = hasData ? Math.min(...allValues) : 0;
  let maxY = hasData ? Math.max(...allValues) : 1;

  if (minY === maxY) {
    minY -= 0.5;
    maxY += 0.5;
  }

  const xForIndex = (index) => {
    const denominator = Math.max(entries.length - 1, 1);
    return margin + (index / denominator) * (width - margin * 2);
  };

  const yForValue = (value) => {
    return margin + ((maxY - value) / (maxY - minY)) * (height - margin * 2);
  };

  const xBandWidth = entries.length <= 1
    ? 16
    : Math.max(
        14,
        Math.min(32, (width - margin * 2) / Math.max(entries.length - 1, 1) * 0.55)
      );

  const cycleDayTicks = showCycleDayTicks ? buildCycleDayTicks(entries) : [];

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "20px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>

      {!hasData ? (
        <div
          style={{
            height: "220px",
            borderRadius: "8px",
            background: "#f6f6f6",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "#666",
          }}
        >
          No numeric data in this cycle yet.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title} chart`}
          style={{
            width: "100%",
            maxWidth: `${width}px`,
            background: "#fff",
            borderRadius: "8px",
            border: "1px solid #eee",
          }}
        >
          <line
            x1={margin}
            y1={height - margin}
            x2={width - margin}
            y2={height - margin}
            stroke="#d8d8d8"
            strokeWidth="1"
          />

          <line
            x1={margin}
            y1={margin}
            x2={margin}
            y2={height - margin}
            stroke="#d8d8d8"
            strokeWidth="1"
          />

          {Array.from(secondaryShadedIndexSet)
            .filter((index) => !shadedIndexSet.has(index))
            .map((index) => (
              <rect
                key={`shade-secondary-${index}`}
                x={xForIndex(index) - xBandWidth / 2}
                y={margin}
                width={xBandWidth}
                height={height - margin * 2}
                fill="#f57c00"
                opacity="0.16"
                rx="4"
              />
            ))}

          {Array.from(shadedIndexSet).map((index) => (
            <rect
              key={`shade-${index}`}
              x={xForIndex(index) - xBandWidth / 2}
              y={margin}
              width={xBandWidth}
              height={height - margin * 2}
              fill="#b71c1c"
              opacity="0.14"
              rx="4"
            />
          ))}

          {referenceLineValue !== null &&
          Number.isFinite(referenceLineValue) &&
          referenceLineValue >= minY &&
          referenceLineValue <= maxY ? (
            <g>
              <line
                x1={margin}
                y1={yForValue(referenceLineValue)}
                x2={width - margin}
                y2={yForValue(referenceLineValue)}
                stroke="#1f1f1f"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                opacity="0.8"
              />
              {referenceLineLabel ? (
                <text
                  x={width - margin}
                  y={yForValue(referenceLineValue) - 4}
                  fill="#333"
                  fontSize="10"
                  textAnchor="end"
                >
                  {referenceLineLabel}
                </text>
              ) : null}
            </g>
          ) : null}

          {Array.from(estimatedIndexSet).map((index) => (
            <g key={`estimated-ov-${index}`}>
              <line
                x1={xForIndex(index)}
                y1={margin}
                x2={xForIndex(index)}
                y2={height - margin}
                stroke="#ef6c00"
                strokeWidth="2"
                strokeDasharray="5 4"
                opacity="0.9"
              />
            </g>
          ))}

          {Array.from(confirmedIndexSet).map((index) => (
            <g key={`confirmed-ov-${index}`}>
              <line
                x1={xForIndex(index)}
                y1={margin}
                x2={xForIndex(index)}
                y2={height - margin}
                stroke="#c62828"
                strokeWidth="2.4"
                opacity="0.95"
              />
            </g>
          ))}

          {pointsBySeries.map((item) => {
            if (item.points.length === 0) {
              return null;
            }

            const polylinePoints = item.points
              .map((point) => `${xForIndex(point.index)},${yForValue(point.value)}`)
              .join(" ");

            return (
              <g key={item.key}>
                <polyline
                  fill="none"
                  stroke={item.color}
                  strokeWidth="2.5"
                  points={polylinePoints}
                />

                {item.points.map((point) => (
                  <circle
                    key={`${item.key}-${point.index}`}
                    cx={xForIndex(point.index)}
                    cy={yForValue(point.value)}
                    r={point.isConfirmed ? "5.25" : point.isAboveBaseline ? "4" : "3"}
                    fill={item.color}
                    stroke={point.isConfirmed ? "#b71c1c" : "none"}
                    strokeWidth={point.isConfirmed ? "2" : "0"}
                  >
                    <title>
                      {formatPointLabel({
                        seriesLabel: item.label,
                        value: point.value,
                        date: point.date,
                        cycleDay: point.cycleDay,
                      })}
                    </title>
                  </circle>
                ))}

                {item.points
                  .filter((point) => point.isAboveBaseline)
                  .map((point) => (
                    <path
                      key={`${item.key}-rise-${point.index}`}
                      d={`M ${xForIndex(point.index)} ${Math.max(margin + 8, yForValue(point.value) - 12)} L ${xForIndex(point.index) - 4} ${Math.max(margin + 14, yForValue(point.value) - 6)} L ${xForIndex(point.index) + 4} ${Math.max(margin + 14, yForValue(point.value) - 6)} Z`}
                      fill="#1b5e20"
                      opacity="0.95"
                    />
                  ))}

                {item.points
                  .filter((point) => point.isConfirmed)
                  .map((point) => (
                    <text
                      key={`${item.key}-ov-${point.index}`}
                      x={xForIndex(point.index)}
                      y={Math.max(margin + 10, yForValue(point.value) - 9)}
                      textAnchor="middle"
                      fill="#8e0000"
                      fontSize="9"
                      fontWeight="700"
                    >
                      OV
                    </text>
                  ))}
              </g>
            );
          })}

          {cycleDayTicks.map((tick) => (
            <g key={`cd-${tick.index}`}>
              <line
                x1={xForIndex(tick.index)}
                y1={height - margin}
                x2={xForIndex(tick.index)}
                y2={height - margin + 4}
                stroke="#8c8c8c"
                strokeWidth="1"
              />
              <text
                x={xForIndex(tick.index)}
                y={height - 6}
                fill="#666"
                fontSize="10"
                textAnchor="middle"
              >
                {tick.label}
              </text>
            </g>
          ))}

        </svg>
      )}

      {hasData ? (
        <div style={{ marginTop: "8px", color: "#666", fontSize: "0.85rem" }}>
          Min: {minY.toFixed(2)} | Max: {maxY.toFixed(2)}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "12px",
        }}
      >
        {series.map((item) => (
          <span
            key={item.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.9rem",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: item.color,
              }}
            />
            {item.label}
          </span>
        ))}

        {confirmedLabel ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.9rem",
              color: "#6d1111",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "16px",
                borderTop: "2px solid #c62828",
              }}
            />
            {confirmedLabel}
          </span>
        ) : null}

        {estimatedLabel ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.9rem",
              color: "#a34a00",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "16px",
                borderTop: "2px dashed #ef6c00",
              }}
            />
            {estimatedLabel}
          </span>
        ) : null}

        {aboveBaselineLabel ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.9rem",
              color: "#1b5e20",
            }}
          >
            <span aria-hidden="true" style={{ width: "10px", height: "10px", display: "inline-flex" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" role="presentation">
                <path d="M5 1 L1 8 L9 8 Z" fill="#1b5e20" />
              </svg>
            </span>
            {aboveBaselineLabel}
          </span>
        ) : null}

        {shadedLabel ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.9rem",
              color: "#7a1a1a",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "12px",
                height: "12px",
                background: "rgba(183, 28, 28, 0.14)",
                border: "1px solid rgba(183, 28, 28, 0.35)",
                borderRadius: "2px",
              }}
            />
            {shadedLabel}
          </span>
        ) : null}

        {secondaryShadedLabel ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.9rem",
              color: "#8f4d00",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "12px",
                height: "12px",
                background: "rgba(245, 124, 0, 0.16)",
                border: "1px solid rgba(143, 77, 0, 0.35)",
                borderRadius: "2px",
              }}
            />
            {secondaryShadedLabel}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function TemperatureSection({ entries, estimatedOvulationDate = null }) {
  const [selectedSourceKey, setSelectedSourceKey] = useState(TEMPERATURE_SOURCES[0].key);
  const [showTemperatureExport, setShowTemperatureExport] = useState(false);

  const selectedSource =
    TEMPERATURE_SOURCES.find((source) => source.key === selectedSourceKey) ||
    TEMPERATURE_SOURCES[0];

  const nonSickEntries = useMemo(
    () => entries.filter((entry) => entry.sick !== true),
    [entries]
  );

  const baselinePoints = useMemo(
    () =>
      nonSickEntries
        .map((entry, index) => ({
          index,
          date: entry.date,
          cycleDay: entry.cycleDay,
          ovulationConfirmed: entry.ovulationConfirmed,
          value: toPlottableNumber(entry[selectedSource.dataKey], { excludeZero: true }),
        }))
        .filter((point) => point.value !== null),
    [nonSickEntries, selectedSource.dataKey]
  );

  const baselineResult = useMemo(
    () => computeBaselineForTemperature(baselinePoints),
    [baselinePoints]
  );

  const confirmedOvulationDateSet = useMemo(
    () =>
      new Set(
        entries
          .filter((entry) => entry.ovulationConfirmed === true && entry.date)
          .map((entry) => entry.date)
      ),
    [entries]
  );

  const estimatedOvulationDateSet = useMemo(
    () => new Set(estimatedOvulationDate ? [estimatedOvulationDate] : []),
    [estimatedOvulationDate]
  );

  const aboveBaselineDateSet = useMemo(() => {
    if (baselineResult.baseline === null) {
      return new Set();
    }

    return new Set(
      nonSickEntries
        .filter((entry) => {
          const value = toPlottableNumber(entry[selectedSource.dataKey], { excludeZero: true });
          return (
            value !== null &&
            value >= baselineResult.baseline + OVULATION_SIGNAL_DELTA &&
            entry.date
          );
        })
        .map((entry) => entry.date)
    );
  }, [baselineResult.baseline, nonSickEntries, selectedSource.dataKey]);

  const spottingDateSet = useMemo(
    () =>
      new Set(
        entries
          .filter(
            (entry) =>
              entry.date &&
              String(entry.bleeding || "").toLowerCase() === "spotting" &&
              entry.period !== true
          )
          .map((entry) => entry.date)
      ),
    [entries]
  );

  const periodDateSet = useMemo(
    () =>
      new Set(
        entries
          .filter(
            (entry) =>
              entry.date &&
              (entry.period === true ||
                ["light", "medium", "heavy"].includes(String(entry.bleeding || "").toLowerCase()))
          )
          .map((entry) => entry.date)
      ),
    [entries]
  );

  const exportRows = useMemo(
    () =>
      baselinePoints.map((point) => {
        let baselinePosition = "No baseline";

        if (baselineResult.baseline !== null) {
          if (point.value > baselineResult.baseline) {
            baselinePosition = "Above baseline";
          } else if (point.value < baselineResult.baseline) {
            baselinePosition = "Below baseline";
          } else {
            baselinePosition = "At baseline";
          }
        }

        return {
          date: point.date,
          cycleDay: point.cycleDay,
          temperature: point.value,
          baselinePosition,
        };
      }),
    [baselinePoints, baselineResult.baseline]
  );

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "20px",
        display: "grid",
        gap: "14px",
      }}
    >
      <div style={{ display: "grid", gap: "8px" }}>
        <h2 style={{ margin: 0 }}>Temperature</h2>

        <label style={{ display: "grid", gap: "6px", maxWidth: "260px" }}>
          <span style={{ fontSize: "0.9rem", color: "#444" }}>Temperature Source</span>
          <select
            value={selectedSource.key}
            onChange={(event) => setSelectedSourceKey(event.target.value)}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "#fff",
            }}
          >
            {TEMPERATURE_SOURCES.map((source) => (
              <option key={source.key} value={source.key}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SimpleLineChart
        title={selectedSource.label}
        entries={nonSickEntries}
        excludeZero
        showCycleDayTicks
        confirmedDateSet={confirmedOvulationDateSet}
        confirmedLabel="Confirmed Ovulation (Manual)"
        estimatedDateSet={estimatedOvulationDateSet}
        estimatedLabel="Estimated Ovulation (Calculated)"
        aboveBaselineDateSet={aboveBaselineDateSet}
        aboveBaselineLabel={`Above Baseline (+${OVULATION_SIGNAL_DELTA.toFixed(1)} Ovulation Signal)`}
        shadedDateSet={periodDateSet}
        shadedLabel="Period / Bleeding"
        secondaryShadedDateSet={spottingDateSet}
        secondaryShadedLabel="Spotting"
        referenceLineValue={baselineResult.baseline}
        referenceLineLabel={baselineResult.baseline === null ? "" : "Baseline"}
        series={[
          {
            key: selectedSource.dataKey,
            label: selectedSource.label,
            color: selectedSource.color,
          },
        ]}
      />

      {baselineResult.baseline !== null ? (
        <p style={{ margin: 0, color: "#666", fontSize: "0.85rem" }}>
          Baseline {baselineResult.isEstimated ? "(estimated)" : ""}: {baselineResult.baseline.toFixed(2)}
        </p>
      ) : (
        <p style={{ margin: 0, color: "#666", fontSize: "0.85rem" }}>
          Baseline: not enough temperature data yet.
        </p>
      )}

      <div style={{ display: "grid", gap: "10px" }}>
        <button
          type="button"
          onClick={() => setShowTemperatureExport((previous) => !previous)}
          style={{
            justifySelf: "start",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #c7c7c7",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {showTemperatureExport ? "Hide Temp Export" : "Export Temp"}
        </button>

        {showTemperatureExport ? (
          <section
            style={{
              border: "1px solid #e2e2e2",
              borderRadius: "8px",
              padding: "12px",
              background: "#fafafa",
              display: "grid",
              gap: "8px",
            }}
          >
            <p style={{ margin: 0, color: "#444", fontSize: "0.9rem" }}>
              Export snapshot for {selectedSource.label}. This list matches the temperatures currently plotted on the graph.
            </p>

            {exportRows.length === 0 ? (
              <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                No plotted temperatures to export for this source yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "460px",
                    background: "#fff",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Cycle Day</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Baseline Status</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Temperature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportRows.map((row) => (
                      <tr key={`${row.date || "no-date"}-${row.cycleDay || "no-cd"}-${row.temperature}`}>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {row.cycleDay ? `CD ${row.cycleDay}` : "CD -"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {row.baselinePosition}
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {row.temperature.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </section>
  );
}

function LhTimelineChart({ entries, estimatedOvulationDate = null }) {
  const [showLhExport, setShowLhExport] = useState(false);
  const width = 760;
  const height = 240;
  const margin = 28;

  const lhDefinitions = [
    { key: "lhMorning", label: "Morning", color: "#9c27b0", xOffset: -0.8 },
    { key: "lhAfternoon", label: "Afternoon", color: "#ff9800", xOffset: 0 },
    { key: "lhNight", label: "Evening", color: "#26a69a", xOffset: 0.8 },
  ];

  const points = [];

  entries.forEach((entry, dayIndex) => {
    lhDefinitions.forEach((definition) => {
      const value = toPlottableNumber(entry[definition.key], { excludeZero: true });

      if (value === null) {
        return;
      }

      points.push({
        dayIndex,
        value,
        label: definition.label,
        color: definition.color,
        xOffset: definition.xOffset,
        date: entry.date,
        cycleDay: entry.cycleDay,
      });
    });
  });

  const confirmedOvulationPoints = entries
    .map((entry, index) => ({
      index,
      date: entry.date,
      cycleDay: entry.cycleDay,
      ovulationConfirmed: entry.ovulationConfirmed,
    }))
    .filter((point) => point.ovulationConfirmed === true && point.date);

  const estimatedOvulationPoint =
    estimatedOvulationDate
      ? entries
          .map((entry, index) => ({
            index,
            date: entry.date,
            cycleDay: entry.cycleDay,
          }))
          .find((point) => point.date === estimatedOvulationDate) || null
      : null;

  const hasData = points.length > 0;
  const allValues = points.map((point) => point.value);
  const cyclePeak = hasData ? Math.max(...allValues) : null;

  let minY = hasData ? Math.min(Math.min(...allValues), 1) : 0;
  let maxY = hasData ? Math.max(Math.max(...allValues), 1) : 1;

  if (minY === maxY) {
    minY -= 0.5;
    maxY += 0.5;
  }

  const xForDayIndex = (dayIndex) => {
    const denominator = Math.max(entries.length - 1, 1);
    return margin + (dayIndex / denominator) * (width - margin * 2);
  };

  const xBandWidth = entries.length <= 1
    ? 16
    : Math.max(
        14,
        Math.min(32, ((width - margin * 2) / Math.max(entries.length - 1, 1)) * 0.55)
      );

  const periodIndexSet = new Set(
    entries
      .map((entry, index) => ({ index, date: entry.date }))
      .filter(
        (item) =>
          item.date &&
          (entries[item.index].period === true ||
            ["light", "medium", "heavy"].includes(String(entries[item.index].bleeding || "").toLowerCase()))
      )
      .map((item) => item.index)
  );

  const spottingIndexSet = new Set(
    entries
      .map((entry, index) => ({ index, date: entry.date }))
      .filter(
        (item) =>
          item.date &&
          String(entries[item.index].bleeding || "").toLowerCase() === "spotting" &&
          entries[item.index].period !== true
      )
      .map((item) => item.index)
  );

  const perDayNudge = Math.max(
    3,
    Math.min(10, (width - margin * 2) / Math.max(entries.length, 2) * 0.35)
  );

  const xForPoint = (point) => xForDayIndex(point.dayIndex) + point.xOffset * perDayNudge;

  const yForValue = (value) => {
    return margin + ((maxY - value) / (maxY - minY)) * (height - margin * 2);
  };

  const overlapWithPositive = cyclePeak !== null && Math.abs(cyclePeak - 1) < 0.05;

  const polylinePoints = points
    .map((point) => `${xForPoint(point)},${yForValue(point.value)}`)
    .join(" ");

  const cycleDayTicks = buildCycleDayTicks(entries);

  const lhExportRows = points.map((point) => ({
    cycleDay: point.cycleDay,
    date: point.date,
    timeOfDay: point.label,
    value: point.value,
    status: point.value >= LH_POSITIVE_THRESHOLD ? "Positive" : "Negative",
  }));

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "20px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>LH Throughout Cycle</h2>

      {!hasData ? (
        <div
          style={{
            height: "220px",
            borderRadius: "8px",
            background: "#f6f6f6",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "#666",
          }}
        >
          No LH data in this cycle yet.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="LH timeline chart"
          style={{
            width: "100%",
            maxWidth: `${width}px`,
            background: "#fff",
            borderRadius: "8px",
            border: "1px solid #eee",
            overflow: "visible",
          }}
        >
          <line
            x1={margin}
            y1={height - margin}
            x2={width - margin}
            y2={height - margin}
            stroke="#d8d8d8"
            strokeWidth="1"
          />

          <line
            x1={margin}
            y1={margin}
            x2={margin}
            y2={height - margin}
            stroke="#d8d8d8"
            strokeWidth="1"
          />

          {Array.from(spottingIndexSet)
            .filter((index) => !periodIndexSet.has(index))
            .map((index) => (
              <rect
                key={`lh-spotting-${index}`}
                x={xForDayIndex(index) - xBandWidth / 2}
                y={margin}
                width={xBandWidth}
                height={height - margin * 2}
                fill="#f57c00"
                opacity="0.16"
                rx="4"
              />
            ))}

          {Array.from(periodIndexSet).map((index) => (
            <rect
              key={`lh-period-${index}`}
              x={xForDayIndex(index) - xBandWidth / 2}
              y={margin}
              width={xBandWidth}
              height={height - margin * 2}
              fill="#b71c1c"
              opacity="0.14"
              rx="4"
            />
          ))}

          {estimatedOvulationPoint ? (
            <line
              x1={xForDayIndex(estimatedOvulationPoint.index)}
              y1={margin}
              x2={xForDayIndex(estimatedOvulationPoint.index)}
              y2={height - margin}
              stroke="#ef6c00"
              strokeWidth="2"
              strokeDasharray="5 4"
              opacity="0.9"
            />
          ) : null}

          {confirmedOvulationPoints.map((point) => (
            <line
              key={`lh-confirmed-${point.index}`}
              x1={xForDayIndex(point.index)}
              y1={margin}
              x2={xForDayIndex(point.index)}
              y2={height - margin}
              stroke="#c62828"
              strokeWidth="2.4"
              opacity="0.95"
            />
          ))}

          {hasData ? (
            <g>
              <line
                x1={margin}
                y1={yForValue(1)}
                x2={width - margin}
                y2={yForValue(1)}
                stroke="#1f1f1f"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                opacity="0.85"
              />
              <text
                x={margin - 10}
                y={yForValue(1) + (overlapWithPositive ? 12 : 3)}
                fill="#333"
                fontSize="10"
                textAnchor="end"
              >
                Positive
              </text>
            </g>
          ) : null}

          {cyclePeak !== null && cyclePeak >= minY && cyclePeak <= maxY ? (
            <g>
              <line
                x1={margin}
                y1={yForValue(cyclePeak)}
                x2={width - margin}
                y2={yForValue(cyclePeak)}
                stroke="#6a1b9a"
                strokeWidth="1.75"
                strokeDasharray="2 3"
                opacity="0.9"
              />
              <text
                x={margin - 10}
                y={yForValue(cyclePeak) + (overlapWithPositive ? -7 : -4)}
                fill="#6a1b9a"
                fontSize="10"
                textAnchor="end"
              >
                Peak
              </text>
            </g>
          ) : null}

          <polyline
            fill="none"
            stroke="#4f4f4f"
            strokeWidth="2.25"
            points={polylinePoints}
          />

          {points.map((point, pointIndex) => (
            <circle
              key={`${point.label}-${pointIndex}`}
              cx={xForPoint(point)}
              cy={yForValue(point.value)}
              r="3.75"
              fill={point.color}
            >
              <title>
                {formatPointLabel({
                  seriesLabel: point.label,
                  value: point.value,
                  date: point.date,
                  cycleDay: point.cycleDay,
                })}
              </title>
            </circle>
          ))}

          {cycleDayTicks.map((tick) => (
            <g key={`lh-cd-${tick.index}-${tick.label}`}>
              <line
                x1={xForDayIndex(tick.index)}
                y1={height - margin}
                x2={xForDayIndex(tick.index)}
                y2={height - margin + 4}
                stroke="#8c8c8c"
                strokeWidth="1"
              />
              <text
                x={xForDayIndex(tick.index)}
                y={height - 6}
                fill="#666"
                fontSize="10"
                textAnchor="middle"
              >
                {tick.label}
              </text>
            </g>
          ))}

        </svg>
      )}

      {hasData ? (
        <div style={{ marginTop: "8px", color: "#666", fontSize: "0.85rem" }}>
          Min: {minY.toFixed(2)} | Max: {maxY.toFixed(2)}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "10px", marginTop: "10px" }}>
        <button
          type="button"
          onClick={() => setShowLhExport((previous) => !previous)}
          style={{
            justifySelf: "start",
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid #c7c7c7",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {showLhExport ? "Hide LH Export" : "Export LH"}
        </button>

        {showLhExport ? (
          <section
            style={{
              border: "1px solid #e2e2e2",
              borderRadius: "8px",
              padding: "12px",
              background: "#fafafa",
              display: "grid",
              gap: "8px",
            }}
          >
            <p style={{ margin: 0, color: "#444", fontSize: "0.9rem" }}>
              Export snapshot for LH. This list matches the LH points currently plotted on the graph.
            </p>

            {lhExportRows.length === 0 ? (
              <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                No plotted LH values to export yet.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "560px",
                    background: "#fff",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Cycle Day</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Date</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Time</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>LH Value</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lhExportRows.map((row, index) => (
                      <tr key={`${row.date || "no-date"}-${row.cycleDay || "no-cd"}-${row.timeOfDay}-${index}`}>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {row.cycleDay ? `CD ${row.cycleDay}` : "CD -"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {row.date || "Unknown"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {row.timeOfDay}
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {row.value.toFixed(2)}
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "12px",
        }}
      >
        {lhDefinitions.map((item) => (
          <span
            key={item.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.9rem",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "999px",
                background: item.color,
              }}
            />
            {item.label}
          </span>
        ))}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9rem",
            color: "#333",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "16px",
              borderTop: "2px dashed #1f1f1f",
              opacity: 0.85,
            }}
          />
          Positive
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9rem",
            color: "#6a1b9a",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "16px",
              borderTop: "2px dashed #6a1b9a",
              opacity: 0.9,
            }}
          />
          Peak
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9rem",
            color: "#6d1111",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "16px",
              borderTop: "2px solid #c62828",
            }}
          />
          Confirmed Ovulation (Manual)
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9rem",
            color: "#a34a00",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "16px",
              borderTop: "2px dashed #ef6c00",
            }}
          />
          Estimated Ovulation (Calculated)
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9rem",
            color: "#7a1a1a",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "12px",
              height: "12px",
              background: "rgba(183, 28, 28, 0.14)",
              border: "1px solid rgba(183, 28, 28, 0.35)",
              borderRadius: "2px",
            }}
          />
          Period / Bleeding
        </span>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.9rem",
            color: "#8f4d00",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "12px",
              height: "12px",
              background: "rgba(245, 124, 0, 0.16)",
              border: "1px solid rgba(143, 77, 0, 0.35)",
              borderRadius: "2px",
            }}
          />
          Spotting
        </span>
      </div>
    </section>
  );
}

function UnprotectedSexTimelineChart({ entries, estimatedOvulationDate = null }) {
  const width = 760;
  const height = 250;
  const margin = 92;

  function getWindowChanceFromDistance(distance) {
    // Only fertile-window days get a non-zero estimate.
    if (distance <= -6 || distance >= 3) return 0;
    if (distance === -5) return 4;
    if (distance === -4) return 8;
    if (distance === -3) return 13;
    if (distance === -2) return 18;
    if (distance === -1) return 24;
    if (distance === 0) return 20;
    if (distance === 1) return 10;
    if (distance === 2) return 4;
    return 0;
  }

  function getEstimatedChancePercent(dayIndex, ovulationIndices, peakIndices) {
    const referenceIndices = ovulationIndices.length > 0 ? ovulationIndices : peakIndices;

    if (referenceIndices.length === 0) {
      return 0;
    }

    const combined = Math.max(
      ...referenceIndices.map((index) => getWindowChanceFromDistance(dayIndex - index))
    );

    return combined;
  }

  const eventPoints = entries
    .map((entry, index) => ({
      index,
      date: entry.date,
      cycleDay: entry.cycleDay,
      intercourse: entry.intercourse,
      usedProtection: entry.usedProtection,
      protectionType: entry.protectionType,
    }))
    .filter(
      (point) =>
        point.intercourse === true &&
        (point.usedProtection === false || point.protectionType === "none")
    );

  const ovulationPoints = entries
    .map((entry, index) => ({
      index,
      date: entry.date,
      cycleDay: entry.cycleDay,
      ovulationConfirmed: entry.ovulationConfirmed,
    }))
    .filter((point) => point.ovulationConfirmed === true);

  const estimatedOvulationPoint =
    estimatedOvulationDate
      ? entries
          .map((entry, index) => ({
            index,
            date: entry.date,
            cycleDay: entry.cycleDay,
          }))
          .find((point) => point.date === estimatedOvulationDate) || null
      : null;

  const peakPoints = entries
    .map((entry, index) => ({
      index,
      date: entry.date,
      cycleDay: entry.cycleDay,
      peak: entry.peak,
    }))
    .filter((point) => point.peak === true);

  const ovulationIndices = ovulationPoints.map((point) => point.index);
  const estimatedIndices = estimatedOvulationPoint ? [estimatedOvulationPoint.index] : [];
  const peakIndices = peakPoints.map((point) => point.index);

  const eventPointsWithChance = eventPoints.map((point) => ({
    ...point,
    chancePercent: getEstimatedChancePercent(
      point.index,
      ovulationIndices.length > 0 ? ovulationIndices : estimatedIndices,
      peakIndices
    ),
  }));

  const xForIndex = (index) => {
    const denominator = Math.max(entries.length - 1, 1);
    return margin + (index / denominator) * (width - margin * 2);
  };

  const xBandWidth = entries.length <= 1
    ? 16
    : Math.max(
        14,
        Math.min(32, ((width - margin * 2) / Math.max(entries.length - 1, 1)) * 0.55)
      );

  const periodIndexSet = new Set(
    entries
      .map((entry, index) => ({ index, date: entry.date }))
      .filter(
        (item) =>
          item.date &&
          (entries[item.index].period === true ||
            ["light", "medium", "heavy"].includes(String(entries[item.index].bleeding || "").toLowerCase()))
      )
      .map((item) => item.index)
  );

  const spottingIndexSet = new Set(
    entries
      .map((entry, index) => ({ index, date: entry.date }))
      .filter(
        (item) =>
          item.date &&
          String(entries[item.index].bleeding || "").toLowerCase() === "spotting" &&
          entries[item.index].period !== true
      )
      .map((item) => item.index)
  );

  function assignPercentLabelRows(pointsWithChance) {
    const rowLastX = [];
    const minSpacing = 34;

    return pointsWithChance.map((point) => {
      const x = xForIndex(point.index);
      let row = 0;

      while (row < rowLastX.length && x - rowLastX[row] < minSpacing) {
        row += 1;
      }

      rowLastX[row] = x;

      return {
        ...point,
        labelRow: row,
        x,
      };
    });
  }

  const ovulationLaneY = 52;
  const peakLaneY = 84;
  const unprotectedLaneY = 116;
  const axisY = 146;
  const cycleDayTicks = buildCycleDayTicks(entries);
  const eventPointsWithLayout = assignPercentLabelRows(eventPointsWithChance);

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "20px",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Unprotected Sex Events</h2>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Unprotected sex timeline"
        style={{
          width: "100%",
          maxWidth: `${width}px`,
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #eee",
        }}
      >
        <line
          x1={margin}
          y1={ovulationLaneY}
          x2={width - margin}
          y2={ovulationLaneY}
          stroke="#e3edf9"
          strokeWidth="1"
        />

        {Array.from(spottingIndexSet)
          .filter((index) => !periodIndexSet.has(index))
          .map((index) => (
            <rect
              key={`unprotected-spotting-${index}`}
              x={xForIndex(index) - xBandWidth / 2}
              y={ovulationLaneY - 10}
              width={xBandWidth}
              height={axisY - (ovulationLaneY - 10)}
              fill="#f57c00"
              opacity="0.16"
              rx="4"
            />
          ))}

        {Array.from(periodIndexSet).map((index) => (
          <rect
            key={`unprotected-period-${index}`}
            x={xForIndex(index) - xBandWidth / 2}
            y={ovulationLaneY - 10}
            width={xBandWidth}
            height={axisY - (ovulationLaneY - 10)}
            fill="#b71c1c"
            opacity="0.14"
            rx="4"
          />
        ))}

        <line
          x1={margin}
          y1={peakLaneY}
          x2={width - margin}
          y2={peakLaneY}
          stroke="#efe3f8"
          strokeWidth="1"
        />

        <line
          x1={margin}
          y1={unprotectedLaneY}
          x2={width - margin}
          y2={unprotectedLaneY}
          stroke="#f9e3e3"
          strokeWidth="1"
        />

        <line
          x1={margin}
          y1={axisY}
          x2={width - margin}
          y2={axisY}
          stroke="#d8d8d8"
          strokeWidth="1.2"
        />

        <text x="8" y={ovulationLaneY + 3} fill="#0d47a1" fontSize="10" textAnchor="start">
          Ovulation
        </text>
        <text x="8" y={peakLaneY + 3} fill="#6a1b9a" fontSize="10" textAnchor="start">
          Peak
        </text>
        <text x="8" y={unprotectedLaneY + 3} fill="#7f0000" fontSize="10" textAnchor="start">
          Unprotected
        </text>

        {eventPointsWithLayout.map((point, pointIndex) => (
          <g key={`unprotected-${point.index}-${pointIndex}`}>
            <line
              x1={point.x}
              y1={axisY}
              x2={point.x}
              y2={unprotectedLaneY}
              stroke="#e53935"
              strokeWidth="1.6"
              opacity="0.95"
            />
            <circle
              cx={point.x}
              cy={unprotectedLaneY}
              r="7"
              fill="#fff"
              stroke="#7f0000"
              strokeWidth="2.2"
            >
              <title>
                {`Unprotected sex | ${point.date || "Unknown date"} (CD ${point.cycleDay || "-"})`}
              </title>
            </circle>
            <circle
              cx={point.x}
              cy={unprotectedLaneY}
              r="3"
              fill="#e53935"
            />
            <text
              x={point.x}
              y={axisY + 18 + point.labelRow * 14}
              fill="#7f0000"
              fontSize="11"
              fontWeight="800"
              stroke="#fff"
              strokeWidth="2"
              paintOrder="stroke"
              textAnchor="middle"
            >
              {point.chancePercent}%
            </text>
          </g>
        ))}

        {ovulationPoints.map((point, pointIndex) => (
          <g key={`ovulation-${point.index}-${pointIndex}`}>
            <line
              x1={xForIndex(point.index)}
              y1={axisY}
              x2={xForIndex(point.index)}
              y2={ovulationLaneY}
              stroke="#1e88e5"
              strokeWidth="1.6"
              opacity="0.9"
            />
            <circle
              cx={xForIndex(point.index)}
              cy={ovulationLaneY}
              r="6.6"
              fill="#fff"
              stroke="#0d47a1"
              strokeWidth="2.4"
            >
              <title>
                {`Ovulation confirmed | ${point.date || "Unknown date"} (CD ${point.cycleDay || "-"})`}
              </title>
            </circle>
          </g>
        ))}

        {estimatedOvulationPoint ? (
          <g key={`estimated-ovulation-${estimatedOvulationPoint.index}`}>
            <line
              x1={xForIndex(estimatedOvulationPoint.index)}
              y1={axisY}
              x2={xForIndex(estimatedOvulationPoint.index)}
              y2={ovulationLaneY}
              stroke="#ef6c00"
              strokeWidth="1.8"
              strokeDasharray="5 4"
              opacity="0.95"
            />
            <rect
              x={xForIndex(estimatedOvulationPoint.index) - 5.5}
              y={ovulationLaneY - 5.5}
              width="11"
              height="11"
              fill="#fff3e0"
              stroke="#ef6c00"
              strokeWidth="2"
              rx="2"
            >
              <title>
                {`Estimated ovulation | ${estimatedOvulationPoint.date || "Unknown date"} (CD ${estimatedOvulationPoint.cycleDay || "-"})`}
              </title>
            </rect>
          </g>
        ) : null}

        {peakPoints.map((point, pointIndex) => (
          <g key={`peak-${point.index}-${pointIndex}`}>
            <line
              x1={xForIndex(point.index)}
              y1={axisY}
              x2={xForIndex(point.index)}
              y2={peakLaneY}
              stroke="#8e24aa"
              strokeWidth="1.6"
              opacity="0.9"
            />
            <polygon
              points={`${xForIndex(point.index)},${peakLaneY - 7} ${xForIndex(point.index) + 7},${peakLaneY} ${xForIndex(point.index)},${peakLaneY + 7} ${xForIndex(point.index) - 7},${peakLaneY}`}
              fill="#6a1b9a"
            >
              <title>
                {`Peak | ${point.date || "Unknown date"} (CD ${point.cycleDay || "-"})`}
              </title>
            </polygon>
          </g>
        ))}

        {cycleDayTicks.map((tick) => (
          <g key={`unprotected-cd-${tick.index}`}>
            <line
              x1={xForIndex(tick.index)}
              y1={axisY}
              x2={xForIndex(tick.index)}
              y2={axisY + 4}
              stroke="#8c8c8c"
              strokeWidth="1"
            />
            <text
              x={xForIndex(tick.index)}
              y={height - 8}
              fill="#666"
              fontSize="10"
              textAnchor="middle"
            >
              {tick.label}
            </text>
          </g>
        ))}
      </svg>

      {eventPoints.length === 0 ? (
        <p style={{ margin: "10px 0 0", color: "#666" }}>
          No unprotected sex logged in this cycle.
        </p>
      ) : (
        <p style={{ margin: "10px 0 0", color: "#666" }}>
          {eventPoints.length} unprotected event{eventPoints.length === 1 ? "" : "s"} logged.
        </p>
      )}

      <p style={{ margin: "6px 0 0", color: "#777", fontSize: "0.82rem" }}>
        Disclaimer: Estimated only on the data you entered.
      </p>

      <div
        style={{
          marginTop: "10px",
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          color: "#444",
          fontSize: "0.88rem",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              border: "2px solid #7f0000",
              background: "#fff",
              boxSizing: "border-box",
              position: "relative",
            }}
          />
          Unprotected Sex
        </span>

        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "999px",
              border: "2px solid #0d47a1",
              background: "#fff",
              boxSizing: "border-box",
            }}
          />
          Ovulation Confirmed
        </span>

        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "9px",
              height: "9px",
              background: "#fff3e0",
              border: "2px solid #ef6c00",
              boxSizing: "border-box",
            }}
          />
          Estimated Ovulation
        </span>

        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "8px",
              height: "8px",
              background: "#6a1b9a",
              transform: "rotate(45deg)",
              display: "inline-block",
            }}
          />
          Peak
        </span>

        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "12px",
              height: "12px",
              background: "rgba(183, 28, 28, 0.14)",
              border: "1px solid rgba(183, 28, 28, 0.35)",
              borderRadius: "2px",
            }}
          />
          Period / Bleeding
        </span>

        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            aria-hidden="true"
            style={{
              width: "12px",
              height: "12px",
              background: "rgba(245, 124, 0, 0.16)",
              border: "1px solid rgba(143, 77, 0, 0.35)",
              borderRadius: "2px",
            }}
          />
          Spotting
        </span>
      </div>
    </section>
  );
}

function CycleDashboard() {
  const [entries, setEntries] = useState([]);
  const [selectedCycleStartDate, setSelectedCycleStartDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showEstimateDetails, setShowEstimateDetails] = useState(false);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);

  useEffect(() => {
    async function loadEntries() {
      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(
          `http://localhost:3000/api/cycle?username=${encodeURIComponent(CURRENT_USERNAME)}`
        );

        if (!response.ok) {
          throw new Error(`Could not load dashboard data (${response.status}).`);
        }

        const data = await response.json();
        const sorted = [...data].sort((a, b) => (a.date > b.date ? 1 : -1));

        setEntries(sorted);
      } catch (error) {
        console.error(error);
        setErrorMessage(error.message || "Could not load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadEntries();
  }, []);

  const cycleWindows = useMemo(() => buildCycleWindows(entries), [entries]);

  useEffect(() => {
    if (cycleWindows.length === 0) {
      setSelectedCycleStartDate("");
      return;
    }

    setSelectedCycleStartDate((previousDate) => {
      if (previousDate && cycleWindows.some((cycle) => cycle.startDate === previousDate)) {
        return previousDate;
      }

      return cycleWindows.at(-1).startDate;
    });
  }, [cycleWindows]);

  const selectedCycle = useMemo(
    () => cycleWindows.find((cycle) => cycle.startDate === selectedCycleStartDate) || null,
    [cycleWindows, selectedCycleStartDate]
  );

  const selectedEntries = selectedCycle?.entries || [];

  const estimatedOvulation = useMemo(
    () => estimateOvulationForCycle(selectedEntries),
    [selectedEntries]
  );

  const confirmedOvulationDates = useMemo(
    () =>
      selectedEntries
        .filter((entry) => entry.ovulationConfirmed === true && entry.date)
        .map((entry) => entry.date),
    [selectedEntries]
  );

  const estimatedDiffersFromConfirmed =
    estimatedOvulation.estimatedOvulationDate &&
    !confirmedOvulationDates.includes(estimatedOvulation.estimatedOvulationDate);

  useEffect(() => {
    setShowEstimateDetails(false);
    setSelectedCandidateIndex(0);
  }, [selectedCycleStartDate]);

  useEffect(() => {
    if (!showEstimateDetails) {
      return;
    }

    setSelectedCandidateIndex(0);
  }, [showEstimateDetails, estimatedOvulation.estimatedOvulationDate]);

  const selectedCandidateBreakdown =
    estimatedOvulation.estimatedOvulationTopCandidates[selectedCandidateIndex] || null;

  if (isLoading) {
    return <p>Loading dashboard...</p>;
  }

  if (errorMessage) {
    return <p>Could not load dashboard: {errorMessage}</p>;
  }

  if (entries.length === 0) {
    return <p>No cycle entries yet. Add entries first, then come back to dashboard.</p>;
  }

  if (cycleWindows.length === 0) {
    return <p>No cycle starts found yet. Set at least one entry to cycle day 1.</p>;
  }

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "20px",
        display: "grid",
        gap: "24px",
      }}
    >
      <h1 style={{ marginBottom: 0 }}>Cycle Dashboard</h1>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "20px",
          display: "grid",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>Select Cycle</h2>

        <select
          value={selectedCycleStartDate}
          onChange={(event) => setSelectedCycleStartDate(event.target.value)}
          style={{
            maxWidth: "340px",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        >
          {cycleWindows.map((cycle) => (
            <option key={cycle.startDate} value={cycle.startDate}>
              {`${cycle.startDate} to ${cycle.endDate} (${cycle.length} entries)`}
            </option>
          ))}
        </select>

        {selectedCycle && (
          <p style={{ margin: 0, color: "#555" }}>
            Viewing cycle starting {selectedCycle.startDate} with {selectedCycle.length} logged entries.
          </p>
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "20px",
          display: "grid",
          gap: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>Ovulation Status</h2>

        <p style={{ margin: 0, color: "#444" }}>
          Estimated Ovulation (calculated): {estimatedOvulation.estimatedOvulationDate || "Not enough data"}
          {estimatedOvulation.estimatedOvulationCycleDay ? ` (CD ${estimatedOvulation.estimatedOvulationCycleDay})` : ""}
        </p>

        <button
          type="button"
          onClick={() => setShowEstimateDetails((previous) => !previous)}
          style={{
            margin: 0,
            padding: "0",
            border: "none",
            background: "transparent",
            color: "#0b57d0",
            textAlign: "left",
            cursor: "pointer",
            fontSize: "1rem",
            fontFamily: "inherit",
            justifySelf: "start",
          }}
          aria-expanded={showEstimateDetails}
        >
          Estimated Score: {estimatedOvulation.estimatedOvulationScore} | Confidence: {estimatedOvulation.estimatedOvulationConfidence}
          {showEstimateDetails ? " (hide why)" : " (click to see why)"}
        </button>

        <p style={{ margin: 0, color: "#444" }}>
          Confirmed Ovulation (manual): {confirmedOvulationDates.length > 0 ? confirmedOvulationDates.join(", ") : "None marked"}
        </p>

        {estimatedDiffersFromConfirmed ? (
          <p style={{ margin: 0, color: "#9a3f00", fontWeight: 600 }}>
            Estimated and confirmed ovulation differ in this cycle. Both markers are shown on graphs.
          </p>
        ) : null}

        {showEstimateDetails ? (
          <div
            style={{
              marginTop: "4px",
              border: "1px solid #e7e7e7",
              borderRadius: "8px",
              padding: "12px",
              background: "#fafafa",
              display: "grid",
              gap: "8px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Why This Score Was Given</h3>

            <p style={{ margin: 0, color: "#444" }}>
              Confidence is based on score: High (10+), Medium (7-9), Low (&lt;7).
            </p>

            <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
              Baseline used: {estimatedOvulation.estimatedBaseline !== null ? estimatedOvulation.estimatedBaseline.toFixed(2) : "Not available"}
              {estimatedOvulation.estimatedBaseline !== null
                ? estimatedOvulation.estimatedBaselineIsEstimated
                  ? " (estimated)"
                  : " (confirmed)"
                : ""}
              {estimatedOvulation.estimatedCycleLhPeak !== null
                ? ` | Cycle LH peak: ${estimatedOvulation.estimatedCycleLhPeak.toFixed(2)}`
                : " | Cycle LH peak: Not available"}
            </p>

            {estimatedOvulation.estimatedOvulationReasons.length > 0 ? (
              <div style={{ display: "grid", gap: "4px" }}>
                <p style={{ margin: 0, color: "#333", fontWeight: 600 }}>
                  Winning day rule breakdown:
                </p>
                {estimatedOvulation.estimatedOvulationReasons.map((reason) => (
                  <p key={reason.code} style={{ margin: 0, color: "#444", fontSize: "0.9rem" }}>
                    {reason.points >= 0 ? "+" : ""}{reason.points} {reason.label}
                  </p>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: "#666" }}>
                Not enough signal data to produce a strong rule breakdown yet.
              </p>
            )}

            {estimatedOvulation.estimatedOvulationTopCandidates.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: "520px",
                    background: "#fff",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Cycle Day</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Date</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Score</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: "8px" }}>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimatedOvulation.estimatedOvulationTopCandidates.map((candidate, index) => (
                      <tr
                        key={`${candidate.date || "no-date"}-${candidate.cycleDay || "no-cd"}-${candidate.score}`}
                        style={{ background: selectedCandidateIndex === index ? "#fff8ef" : "#fff" }}
                      >
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {candidate.cycleDay ? `CD ${candidate.cycleDay}` : "CD -"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {candidate.date || "Unknown"}
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedCandidateIndex(index)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#0b57d0",
                              cursor: "pointer",
                              padding: 0,
                              font: "inherit",
                              textDecoration: "underline",
                            }}
                            aria-label={`Show score breakdown for cycle day ${candidate.cycleDay || "unknown"}`}
                          >
                            {candidate.score}
                          </button>
                        </td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: "8px" }}>
                          {candidate.confidence}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {selectedCandidateBreakdown ? (
              <div
                style={{
                  border: "1px solid #ececec",
                  borderRadius: "6px",
                  padding: "10px",
                  background: "#fff",
                  display: "grid",
                  gap: "6px",
                }}
              >
                <p style={{ margin: 0, color: "#333", fontWeight: 600 }}>
                  Score Breakdown for {selectedCandidateBreakdown.cycleDay ? `CD ${selectedCandidateBreakdown.cycleDay}` : "selected day"}
                  {selectedCandidateBreakdown.date ? ` (${selectedCandidateBreakdown.date})` : ""}
                </p>

                {selectedCandidateBreakdown.reasons.length > 0 ? (
                  selectedCandidateBreakdown.reasons.map((reason) => (
                    <p key={`${selectedCandidateBreakdown.date || "day"}-${reason.code}`} style={{ margin: 0, color: "#444", fontSize: "0.9rem" }}>
                      {reason.points >= 0 ? "+" : ""}{reason.points} {reason.label}
                    </p>
                  ))
                ) : (
                  <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                    No direct scoring rules were triggered for this day.
                  </p>
                )}
              </div>
            ) : null}

            <p style={{ margin: 0, color: "#666", fontSize: "0.82rem" }}>
              Tie-break rule: if two days have the same score, the earlier cycle day is selected.
            </p>
          </div>
        ) : null}
      </section>

      <TemperatureSection
        entries={selectedEntries}
        estimatedOvulationDate={estimatedOvulation.estimatedOvulationDate}
      />

      <LhTimelineChart
        entries={selectedEntries}
        estimatedOvulationDate={estimatedOvulation.estimatedOvulationDate}
      />

      <UnprotectedSexTimelineChart
        entries={selectedEntries}
        estimatedOvulationDate={estimatedOvulation.estimatedOvulationDate}
      />

    </div>
  );
}

export default CycleDashboard;
