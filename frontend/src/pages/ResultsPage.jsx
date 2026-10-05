import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchReportPage } from "../features/results/resultsSlice";
import { fetchSummary } from "../features/analysis/analysisSlice";
import { downloadReport } from "../api/download";
import Pagination from "../components/Pagination";
import styles from "./ResultsPage.module.css";

const WEIGHT_LABELS_RU = {
  financial: "Финансовый",
  reputational: "Репутационный",
  operational: "Операционный",
  legal: "Юридический",
  data_loss: "Потеря данных",
};

const LEVEL_CLASSES = {
  Низкий: "levelLow",
  Средний: "levelMedium",
  Высокий: "levelHigh",
  Критический: "levelCritical",
};

const ResultsPage = () => {
  const dispatch = useDispatch();
  const sessionId = useSelector((s) => s.session.sessionId);
  const analysisStatus = useSelector((s) => s.analysis.status);
  const summary = useSelector((s) => s.analysis.summary);
  const { page, pageSize, total, totalPages, rows, status, error } =
    useSelector((s) => s.results);

  const [downloading, setDownloading] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    if (analysisStatus === "done" && sessionId) {
      dispatch(fetchReportPage({ sessionId, page: 1, pageSize: 10 }));
    }
  }, [analysisStatus, sessionId, dispatch]);

  useEffect(() => {
    if (sessionId && analysisStatus === "done" && !summary) {
      dispatch(fetchSummary(sessionId));
    }
  }, [sessionId, analysisStatus, summary, dispatch]);

  const handlePage = (p) => {
    if (p < 1 || p > totalPages) return;
    dispatch(fetchReportPage({ sessionId, page: p, pageSize }));
  };

  const handleDownload = async (format) => {
    setDownloadError(null);
    setDownloading(format);
    try {
      await downloadReport(format, sessionId);
    } catch (e) {
      setDownloadError(
        e.response?.data?.detail || e.message || "Ошибка скачивания"
      );
    } finally {
      setDownloading(null);
    }
  };

  const renderCell = (col, val) => {
    if (val === null || val === undefined) return "—";
    if (col === "ID") return String(Math.trunc(Number(val)));
    if (col === "Уровень риска") {
      const cls = LEVEL_CLASSES[val];
      if (cls) {
        return <span className={`${styles.level} ${styles[cls]}`}>{val}</span>;
      }
    }
    if (typeof val === "number") return Number(val).toFixed(3);
    return String(val);
  };

  if (!sessionId) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Результаты</h1>
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Подключение к серверу...</p>
        </div>
      </div>
    );
  }

  if (analysisStatus !== "done") {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Результаты</h1>
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Анализ не выполнен</p>
          <p className={styles.noticeText}>
            Сначала перейдите на вкладку «Анализ» и запустите обработку данных.
          </p>
        </div>
      </div>
    );
  }

  const columns =
    rows.length > 0
      ? Object.keys(rows[0])
      : [
          "ID",
          "Значение риска",
          "Уровень риска",
          "Стратегия",
          "Детали",
          "Описание уязвимости",
          "Описание",
        ];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Результаты</h1>

      {summary && (
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Метрики модели</h2>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Accuracy</div>
              <div className={styles.metricValue}>
                {summary.acc?.toFixed(3)}
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>F1-score</div>
              <div className={styles.metricValue}>
                {summary.f1?.toFixed(3)}
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>AUC-ROC</div>
              <div className={styles.metricValue}>
                {summary.auc?.toFixed(3)}
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Всего риск-событий</div>
              <div className={styles.metricValue}>{summary.total_risks}</div>
            </div>
          </div>
        </div>
      )}

      {summary && summary.damage_weights && (
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Веса ущерба</h2>
          <div className={styles.weightsGrid}>
            {Object.entries(summary.damage_weights).map(([k, v]) => (
              <div key={k} className={styles.weightRow}>
                <span className={styles.weightLabel}>
                  {WEIGHT_LABELS_RU[k] || k}
                </span>
                <span className={styles.weightValue}>
                  {Number(v).toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Скачать отчёт</h2>
        <div className={styles.downloadGroup}>
          <span className={styles.downloadLabel}>Формат:</span>
          <button
            className={styles.btnSecondary}
            onClick={() => handleDownload("csv")}
            disabled={downloading !== null}
          >
            {downloading === "csv" ? "..." : "CSV"}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => handleDownload("html")}
            disabled={downloading !== null}
          >
            {downloading === "html" ? "..." : "HTML"}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={() => handleDownload("pdf")}
            disabled={downloading !== null}
          >
            {downloading === "pdf" ? "..." : "PDF"}
          </button>
        </div>
        {downloadError && (
          <div
            className={styles.error}
            style={{ marginTop: 16, marginBottom: 0 }}
          >
            Ошибка скачивания: {downloadError}
          </div>
        )}
      </div>

      <div className={styles.tableWrapper}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            Рекомендации по обработке рисков
          </h2>
          {total > 0 && (
            <span className={styles.tableCount}>
              Всего записей: <strong>{total}</strong>
            </span>
          )}
        </div>

        {status === "loading" && (
          <div className={styles.loading}>Загрузка таблицы...</div>
        )}

        {error && (
          <div className={styles.error} style={{ margin: "0 20px 16px 20px" }}>
            Ошибка: {error}
          </div>
        )}

        {status === "ready" && rows.length === 0 && (
          <div className={styles.empty}>В отчёте нет записей.</div>
        )}

        {rows.length > 0 && (
          <>
            <div style={{ padding: "0 20px" }}>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                onPage={handlePage}
                disabled={status === "loading"}
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
                        <td key={c}>{renderCell(c, row[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div style={{ textAlign: "center" }}>
          <p className={styles.hint}>
            Результаты готовы. Переходите на вкладку «Визуализация».
          </p>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;