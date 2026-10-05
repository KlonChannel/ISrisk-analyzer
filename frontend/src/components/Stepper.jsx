import React from "react";
import { useSelector } from "react-redux";

const STEPS = [
  { key: "data", label: "Данные" },
  { key: "analysis", label: "Анализ" },
  { key: "results", label: "Результаты" },
  { key: "plots", label: "Визуализация" },
];

const Stepper = () => {
  const dataRows = useSelector((s) => s.data.rows);
  const analysisStatus = useSelector((s) => s.analysis.status);
  const resultsTotal = useSelector((s) => s.results.total);
  const plotsImages = useSelector((s) => s.plots.images);

  const completed = {
    data: dataRows > 0,
    analysis: analysisStatus === "done",
    results: resultsTotal > 0,
    plots: Object.keys(plotsImages || {}).length > 0,
  };

  const order = STEPS.map((s) => s.key);
  let currentIdx = order.findIndex((k) => !completed[k]);
  if (currentIdx === -1) currentIdx = order.length;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px 24px",
      }}
    >
      {STEPS.map((step, i) => {
        const done = completed[step.key];
        const active = i === currentIdx;

        return (
          <React.Fragment key={step.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 13,
                  border: "2px solid",
                  borderColor: done || active ? "#2B7AEC" : "#ccc",
                  background: done ? "#2B7AEC" : "#fff",
                  color: done ? "#fff" : active ? "#2B7AEC" : "#999",
                  transition: "all 0.25s",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: done || active ? 600 : 400,
                  color: done || active ? "#1d1d1f" : "#999",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                style={{
                  height: 2,
                  width: 60,
                  background: done ? "#2B7AEC" : "#e5e5e5",
                  margin: "0 12px",
                  transition: "background 0.25s",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default Stepper;