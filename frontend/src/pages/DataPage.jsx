import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  generateData,
  uploadFile,
  fetchPreview,
  clearError,
} from "../features/data/dataSlice";
import { resetAll } from "../app/resetAll";
import { resetAnalysis } from "../features/analysis/analysisSlice";
import { resetResults } from "../features/results/resultsSlice";
import { resetPlots } from "../features/plots/plotsSlice";
import { downloadDataset } from "../api/download";
import Pagination from "../components/Pagination";
import styles from "./DataPage.module.css";

const SCENARIOS = [
  { value: "balanced", label: "Сбалансированный" },
  { value: "high_risk", label: "Высокие риски" },
  { value: "low_risk", label: "Низкие риски" },
];

const MIN_SAMPLES = 100;
const MAX_SAMPLES = 100000;

const DataPage = () => {
  const dispatch = useDispatch();
  const sessionId = useSelector((s) => s.session.sessionId);
  const { status, error, rows, columns, preview, source } = useSelector(
    (s) => s.data
  );

  const [mode, setMode] = useState("generate");
  const [scenario, setScenario] = useState("balanced");
  const [nSamples, setNSamples] = useState(2000);
  const [nSamplesError, setNSamplesError] = useState(null);
  const [file, setFile] = useState(null);
  const [downloadingDataset, setDownloadingDataset] = useState(null);
  const [datasetError, setDatasetError] = useState(null);

  const prevKeyRef = useRef(null);

  useEffect(() => {
    const key = `${source}-${rows}`;
    if (
      prevKeyRef.current &&
      prevKeyRef.current !== key &&
      rows > 0 &&
      source
    ) {
      dispatch(resetAnalysis());
      dispatch(resetResults());
      dispatch(resetPlots());
    }
    prevKeyRef.current = key;
  }, [source, rows, dispatch]);

  useEffect(() => {
    if (sessionId && source && rows > 0) {
      dispatch(fetchPreview({ sessionId, page: 1 }));
    }
  }, [sessionId, source, rows, dispatch]);

  const validateSamples = (value) => {
    if (value === "" || value === null || value === undefined) {
      return "Укажите число записей";
    }
    const n = Number(value);
    if (!Number.isInteger(n)) {
      return "Число должно быть целым";
    }
    if (n < MIN_SAMPLES) {
      return `Минимум ${MIN_SAMPLES} записей`;
    }
    if (n > MAX_SAMPLES) {
      return `Максимум ${MAX_SAMPLES} записей`;
    }
    return null;
  };

  const handleSamplesChange = (e) => {
    const v = e.target.value;
    setNSamples(v);
    if (v === "") {
      setNSamplesError(null);
      return;
    }
    setNSamplesError(validateSamples(v));
  };

  const handleGenerate = () => {
    if (!sessionId) return;
    const err = validateSamples(nSamples);
    if (err) {
      setNSamplesError(err);
      return;
    }
    setNSamplesError(null);
    dispatch(
      generateData({ sessionId, scenario, nSamples: Number(nSamples) })
    );
  };

  const handleUpload = () => {
    if (!sessionId || !file) return;
    dispatch(uploadFile({ sessionId, file }));
  };

  const handlePage = (page) => {
    if (!sessionId) return;
    dispatch(fetchPreview({ sessionId, page }));
  };

  const handleReset = () => {
    dispatch(resetAll());
    setFile(null);
    setNSamplesError(null);
    setDatasetError(null);
    dispatch(clearError());
  };

  const handleDownloadDataset = async (format) => {
    setDatasetError(null);
    setDownloadingDataset(format);
    try {
      await downloadDataset(format, sessionId);
    } catch (e) {
      setDatasetError(
        e.response?.data?.detail || e.message || "Ошибка скачивания"
      );
    } finally {
      setDownloadingDataset(null);
    }
  };

  const busy =
    status === "generating" ||
    status === "uploading" ||
    status === "loadingPreview";

  if (!sessionId) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Данные</h1>
        <div className={styles.empty}>Подключение к серверу...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Данные</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            mode === "generate" ? styles.tabActive : ""
          }`}
          onClick={() => {
            setMode("generate");
            dispatch(clearError());
          }}
        >
          Сгенерировать
        </button>
        <button
          className={`${styles.tab} ${
            mode === "upload" ? styles.tabActive : ""
          }`}
          onClick={() => {
            setMode("upload");
            dispatch(clearError());
          }}
        >
          Загрузить файл
        </button>
      </div>

      <div className={styles.panel}>
        {mode === "generate" && (
          <>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Сценарий</label>
                <select
                  className={styles.select}
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  disabled={busy}
                >
                  {SCENARIOS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span className={styles.fieldHint}>&nbsp;</span>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Записей</label>
                <input
                  className={`${styles.input} ${
                    nSamplesError ? styles.inputError : ""
                  }`}
                  type="number"
                  min={MIN_SAMPLES}
                  max={MAX_SAMPLES}
                  step={100}
                  value={nSamples}
                  onChange={handleSamplesChange}
                  disabled={busy}
                />
                {nSamplesError ? (
                  <span className={styles.fieldError}>{nSamplesError}</span>
                ) : (
                  <span className={styles.fieldHint}>&nbsp;</span>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.btnPrimary}
                onClick={handleGenerate}
                disabled={busy || !!nSamplesError}
              >
                {status === "generating" ? "Генерация..." : "Сгенерировать"}
              </button>
            </div>
          </>
        )}

        {mode === "upload" && (
          <>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Файл данных</label>
                <div
                  className={`${styles.fileInputWrapper} ${
                    file ? styles.hasFile : ""
                  }`}
                >
                  <span
                    className={`${styles.fileText} ${
                      !file ? styles.filePlaceholder : ""
                    }`}
                  >
                    {file ? file.name : "Нажмите, чтобы выбрать файл"}
                  </span>
                  <input
                    className={styles.fileInputHidden}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => setFile(e.target.files[0] || null)}
                    disabled={busy}
                  />
                </div>
                <span className={styles.fileHint}>
                  Поддерживаются форматы .csv и .xlsx. Столбцы должны
                  соответствовать структуре датасета.
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                className={styles.btnPrimary}
                onClick={handleUpload}
                disabled={!file || busy}
              >
                {status === "uploading" ? "Загрузка..." : "Загрузить"}
              </button>
              {file && (
                <button
                  className={styles.btnGhost}
                  onClick={() => {
                    setFile(null);
                    dispatch(clearError());
                  }}
                  disabled={busy}
                >
                  Отменить
                </button>
              )}
            </div>
          </>
        )}

        {error && <div className={styles.error}>Ошибка: {error}</div>}
      </div>

      {rows > 0 && (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryText}>
              Загружено: <strong>{rows}</strong> записей,{" "}
              <strong>{columns.length}</strong> столбцов
            </div>
            <div className={styles.downloadGroup}>
              <span className={styles.downloadLabel}>Скачать:</span>
              <button
                className={styles.btnSecondary}
                onClick={() => handleDownloadDataset("csv")}
                disabled={downloadingDataset !== null}
              >
                {downloadingDataset === "csv" ? "..." : "CSV"}
              </button>
              <button
                className={styles.btnSecondary}
                onClick={() => handleDownloadDataset("html")}
                disabled={downloadingDataset !== null}
              >
                {downloadingDataset === "html" ? "..." : "HTML"}
              </button>
              <button
                className={styles.btnSecondary}
                onClick={() => handleDownloadDataset("xlsx")}
                disabled={downloadingDataset !== null}
              >
                {downloadingDataset === "xlsx" ? "..." : "XLSX"}
              </button>
              <button
                className={styles.btnDanger}
                onClick={handleReset}
                disabled={busy}
              >
                Сбросить
              </button>
            </div>
          </div>

          {datasetError && (
            <div className={styles.error}>
              Ошибка скачивания: {datasetError}
            </div>
          )}

          <div className={styles.tableWrapper}>
            <PreviewTable preview={preview} onPage={handlePage} busy={busy} />
          </div>

          <div style={{ textAlign: "center" }}>
            <p className={styles.hint}>
              Данные загружены. Переходите на вкладку «Анализ».
            </p>
          </div>
        </>
      )}
    </div>
  );
};

const PreviewTable = ({ preview, onPage, busy }) => {
  const { page, totalPages, rows, pageSize, total } = preview;

  if (!rows || rows.length === 0) {
    return <div className={styles.empty}>Нет данных для предпросмотра.</div>;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div>
      <div style={{ padding: "4px 20px 0 20px" }}>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPage={onPage}
          disabled={busy}
        />
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {columns.map((c) => (
                  <td key={c}>
                    {row[c] === null || row[c] === undefined
                      ? "—"
                      : String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataPage;