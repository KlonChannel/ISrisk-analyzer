import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  startAnalysis,
  fetchStatus,
} from "../features/analysis/analysisSlice";
import { resetResults } from "../features/results/resultsSlice";
import { resetPlots } from "../features/plots/plotsSlice";
import styles from "./AnalysisPage.module.css";

const WEIGHT_CATEGORIES = [
  { key: "financial", label: "Финансовый" },
  { key: "reputational", label: "Репутационный" },
  { key: "operational", label: "Операционный" },
  { key: "legal", label: "Юридический" },
  { key: "data_loss", label: "Потеря данных" },
];

const LING_OPTIONS = [
  "Очень низкий",
  "Низкий",
  "Ниже среднего",
  "Средний",
  "Выше среднего",
  "Высокий",
  "Очень высокий",
  "Критический",
];

const MIN_TREES = 10;
const MAX_TREES = 100;

const AnalysisPage = () => {
  const dispatch = useDispatch();
  const sessionId = useSelector((s) => s.session.sessionId);
  const dataRows = useSelector((s) => s.data.rows);
  const { taskId, status, progress, message, error } = useSelector(
    (s) => s.analysis
  );

  const [nTrees, setNTrees] = useState(30);
  const [nTreesError, setNTreesError] = useState(null);
  const [damageMode, setDamageMode] = useState("numeric");
  const [weights, setWeights] = useState({
    financial: 0.25,
    reputational: 0.25,
    operational: 0.2,
    legal: 0.15,
    data_loss: 0.15,
  });
  const [lingValues, setLingValues] = useState({
    financial: "Средний",
    reputational: "Средний",
    operational: "Средний",
    legal: "Средний",
    data_loss: "Средний",
  });

  useEffect(() => {
    if (status !== "running" || !taskId || !sessionId) return;
    const id = setInterval(
      () => dispatch(fetchStatus({ taskId, sessionId })),
      1500
    );
    return () => clearInterval(id);
  }, [status, taskId, sessionId, dispatch]);

  const validateTrees = (value) => {
    if (value === "" || value === null || value === undefined) {
      return "Укажите число деревьев";
    }
    const n = Number(value);
    if (!Number.isInteger(n)) {
      return "Число должно быть целым";
    }
    if (n < MIN_TREES) {
      return `Минимум ${MIN_TREES}`;
    }
    if (n > MAX_TREES) {
      return `Максимум ${MAX_TREES}`;
    }
    return null;
  };

  const handleTreesChange = (e) => {
    const v = e.target.value;
    setNTrees(v);
    if (v === "") {
      setNTreesError(null);
      return;
    }
    setNTreesError(validateTrees(v));
  };

  const handleStart = () => {
    if (!sessionId || dataRows === 0) return;
    const err = validateTrees(nTrees);
    if (err) {
      setNTreesError(err);
      return;
    }
    setNTreesError(null);
    const payload = {
      session_id: sessionId,
      n_trees: Number(nTrees),
      damage_mode: damageMode,
      weights: damageMode === "numeric" ? weights : null,
      ling_values: damageMode === "linguistic" ? lingValues : null,
    };
    dispatch(startAnalysis(payload));
  };

  const handleReset = () => {
    dispatch({ type: "analysis/resetAnalysis" });
    dispatch(resetResults());
    dispatch(resetPlots());
  };

  const updateWeight = (key, value) => {
    setWeights((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const updateLing = (key, value) => {
    setLingValues((prev) => ({ ...prev, [key]: value }));
  };

  const busy = status === "starting" || status === "running";

  if (!sessionId) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Анализ</h1>
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Подключение к серверу...</p>
        </div>
      </div>
    );
  }

  if (dataRows === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Анализ</h1>
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Данные не загружены</p>
          <p className={styles.noticeText}>
            Сначала перейдите на вкладку «Данные» и сгенерируйте или загрузите
            датасет.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Анализ</h1>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Параметры модели</h2>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Количество деревьев</label>
            <input
              className={`${styles.input} ${
                nTreesError ? styles.inputError : ""
              }`}
              type="number"
              min={MIN_TREES}
              max={MAX_TREES}
              step={5}
              value={nTrees}
              onChange={handleTreesChange}
              disabled={busy}
            />
            {nTreesError ? (
              <span className={styles.fieldError}>{nTreesError}</span>
            ) : (
              <span className={styles.fieldHint}>
                от {MIN_TREES} до {MAX_TREES}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Оценка ущерба</h2>

        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="numeric"
              checked={damageMode === "numeric"}
              onChange={() => setDamageMode("numeric")}
              disabled={busy}
            />
            Числовой
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="linguistic"
              checked={damageMode === "linguistic"}
              onChange={() => setDamageMode("linguistic")}
              disabled={busy}
            />
            Лингвистический
          </label>
        </div>

        {damageMode === "numeric" && (
          <div style={{ marginTop: 24 }}>
            {WEIGHT_CATEGORIES.map(({ key, label }) => (
              <div key={key} className={styles.sliderRow}>
                <span className={styles.sliderLabel}>{label}</span>
                <input
                  className={styles.slider}
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weights[key]}
                  onChange={(e) => updateWeight(key, e.target.value)}
                  disabled={busy}
                />
                <span className={styles.sliderValue}>
                  {weights[key].toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {damageMode === "linguistic" && (
          <div style={{ marginTop: 24 }}>
            {WEIGHT_CATEGORIES.map(({ key, label }) => (
              <div key={key} className={styles.lingRow}>
                <span className={styles.sliderLabel}>{label}</span>
                <select
                  className={styles.lingSelect}
                  value={lingValues[key]}
                  onChange={(e) => updateLing(key, e.target.value)}
                  disabled={busy}
                >
                  {LING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.panel}>
        <div className={styles.actions}>
          <button
            className={styles.btnPrimary}
            onClick={handleStart}
            disabled={busy || !!nTreesError}
          >
            {busy ? "Анализ выполняется..." : "▶ Запустить анализ"}
          </button>
          <button
            className={styles.btnGhost}
            onClick={handleReset}
            disabled={busy}
          >
            Сбросить
          </button>
        </div>

        {(busy || status === "done") && (
          <div className={styles.progressWrapper}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={styles.progressInfo}>
              <span className={styles.progressMessage}>{message}</span>
              <span className={styles.progressPercent}>{progress}%</span>
            </div>
          </div>
        )}

        {error && <div className={styles.error}>Ошибка: {error}</div>}

        {status === "done" && (
          <div style={{ textAlign: "center" }}>
            <p className={styles.doneHint}>
              Анализ завершён. Переходите на вкладку «Результаты».
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPage;