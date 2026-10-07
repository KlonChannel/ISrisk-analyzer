import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchPlot,
  fetchPlotFilters,
  setFilter,
  resetPlots,
  PLOT_KINDS,
} from "../features/plots/plotsSlice";
import { downloadPlotsZip } from "../api/download";
import styles from "./PlotsPage.module.css";

const PLOT_TITLES = {
  1: "1. Распределение риск-событий: возможность реализации × оценка риска",
  2: "2. Топ-20 риск-событий по оценке риска",
  3: "3. Распределение прогнозов по факту реализации риска",
  4: "4. Прогноз риска: возможность реализации × ущерб",
  5: "5. Сводка по отделам",
  6: "6. Корреляция признаков",
  7: "7. Временной профиль риск-событий",
  8: "8. Распределение стратегий обработки рисков",
  9: "9. Матрица ошибок прогноза",
  10: "10. ROC-кривая",
  11: "11. Калибровочная кривая прогноза",
  12: "12. Суррогатное дерево прогноза реализации рисков",
};

const PLOT_DESCRIPTIONS = {
  1: "Совместное распределение риск-событий по прогнозируемой возможности реализации и оценке риска. Чем темнее область, тем чаще в неё попадают риск-события.",
  2: "Самые критичные риск-события с наибольшей оценкой риска. Цвет соответствует уровню риска (критичности).",
  3: "Распределение прогнозируемой возможности реализации для риск-событий, которые фактически реализовались и не реализовались.",
  4: "Прогноз риска: по оси X - прогнозируемая возможность реализации, по оси Y - ущерб. Цвет точки отражает итоговую оценку риска.",
  5: "Сводка по отделам: средняя оценка риска, количество риск-событий и доля критических рисков.",
  6: "Показывает, какие числовые признаки сильно коррелируют между собой.",
  7: "Динамика количества риск-событий и средней оценки риска по часам суток.",
  8: "Доли риск-событий по стратегиям обработки: принять, минимизировать, передать или уклониться.",
  9: "Сравнение прогноза модели с фактической реализацией рисков.",
  10: "Качество разделения классов: чем выше кривая и больше площадь под ней (AUC), тем лучше модель.",
  11: "Соответствие между прогнозируемой возможностью реализации и фактической долей реализованных рисков.",
  12: "Суррогатное дерево - это обычное решающее дерево, обученное на прогнозах ансамбля нечётких деревьев. Служит для визуализации логики работы модели.",
};

const PlotsPage = () => {
  const dispatch = useDispatch();
  const sessionId = useSelector((s) => s.session.sessionId);
  const analysisStatus = useSelector((s) => s.analysis.status);
  const { filters, current, images, loading, errors } = useSelector(
    (s) => s.plots
  );

  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipError, setZipError] = useState(null);

  useEffect(() => {
    if (sessionId && analysisStatus === "done") {
      dispatch(fetchPlotFilters(sessionId));
    }
  }, [sessionId, analysisStatus, dispatch]);

  useEffect(() => {
    if (!sessionId || analysisStatus !== "done") return;
    PLOT_KINDS.forEach((kind) => {
      dispatch(
        fetchPlot({
          sessionId,
          kind,
          department: current.department,
          eventType: current.eventType,
          level: current.level,
        })
      );
    });
  }, [sessionId, analysisStatus, current, dispatch]);

  const handleFilter = (name, value) => {
    dispatch(setFilter({ name, value }));
  };

  const handleReset = () => dispatch(resetPlots());

  const handleDownloadZip = async () => {
    setZipError(null);
    setDownloadingZip(true);
    try {
      await downloadPlotsZip(sessionId, current);
    } catch (e) {
      setZipError(
        e.response?.data?.detail || e.message || "Ошибка скачивания архива"
      );
    } finally {
      setDownloadingZip(false);
    }
  };

  if (!sessionId) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Визуализация</h1>
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Подключение к серверу...</p>
        </div>
      </div>
    );
  }

  if (analysisStatus !== "done") {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Визуализация</h1>
        <div className={styles.notice}>
          <p className={styles.noticeTitle}>Анализ не выполнен</p>
          <p className={styles.noticeText}>
            Сначала перейдите на вкладку «Анализ» и запустите обработку данных.
            Графики появятся здесь.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Визуализация</h1>

      <div className={styles.panel}>
        <h2 className={styles.panelTitle}>Фильтры</h2>
        <div className={styles.filtersRow}>
          <div className={styles.field}>
            <label className={styles.label}>Отдел</label>
            <select
              className={styles.select}
              value={current.department}
              onChange={(e) => handleFilter("department", e.target.value)}
            >
              {filters.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Событие</label>
            <select
              className={styles.select}
              value={current.eventType}
              onChange={(e) => handleFilter("eventType", e.target.value)}
            >
              {filters.events.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Уровень риска (критичность)</label>
            <select
              className={styles.select}
              value={current.level}
              onChange={(e) => handleFilter("level", e.target.value)}
            >
              {filters.levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <button className={styles.btnGhost} onClick={handleReset}>
            Сбросить фильтры
          </button>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.downloadBar}>
          <span className={styles.downloadBarText}>
            Скачайте все графики одним архивом с учётом текущих фильтров.
          </span>
          <button
            className={styles.btnSecondary}
            onClick={handleDownloadZip}
            disabled={downloadingZip}
          >
            {downloadingZip ? "Формирование..." : "Скачать все графики (ZIP)"}
          </button>
        </div>
        {zipError && (
          <div
            className={styles.error}
            style={{ marginTop: 16, marginBottom: 0 }}
          >
            Ошибка: {zipError}
          </div>
        )}
      </div>

      <div className={styles.plotsGrid}>
        {PLOT_KINDS.map((kind) => (
          <div key={kind} className={styles.plotCard}>
            <h3 className={styles.plotTitle}>{PLOT_TITLES[kind]}</h3>

            <div className={styles.plotImageWrapper}>
              {loading[kind] && (
                <div className={styles.plotLoading}>
                  <span className={styles.spinner} />
                  Загрузка...
                </div>
              )}

              {errors[kind] && !loading[kind] && (
                <div className={styles.plotError}>Ошибка: {errors[kind]}</div>
              )}

              {images[kind] && !loading[kind] && !errors[kind] && (
                <img
                  className={styles.plotImage}
                  src={images[kind]}
                  alt={PLOT_TITLES[kind]}
                />
              )}
            </div>

            {PLOT_DESCRIPTIONS[kind] && (
              <p className={styles.plotDescription}>
                {PLOT_DESCRIPTIONS[kind]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlotsPage;