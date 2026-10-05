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
  1: "1. Плотность распределения: вероятность × риск",
  2: "2. Топ-20 рисков",
  3: "3. Распределение вероятностей по факту реализации риска",
  4: "4. Тренд вероятности по отделам",
  5: "5. Пузырьковая диаграмма: риск × вероятность × ущерб",
  6: "6. Сводка по отделам",
  7: "7. Тепловая карта корреляции признаков",
  8: "8. Временной профиль рисков по часам",
  9: "9. Распределение стратегий обработки рисков",
  10: "10. Матрица ошибок",
  11: "11. ROC-кривая",
  12: "12. Калибровочная кривая",
  tree: "Суррогатное дерево для ансамбля нечётких деревьев",
};

const PLOT_DESCRIPTIONS = {
  1: "Показывает, как вероятность риска связана с совокупным риском. Чем выше плотность, тем больше риск-событий с такими значениями.",
  2: "Самые критичные события с наибольшим совокупным риском. Цвет показывает уровень риска.",
  3: "Гистограмма показывает, как предсказанные вероятности распределяются для риск-событий с реализацией и без неё.",
  4: "Изменение вероятности рисков во времени (по порядку событий) с разбивкой по отделам.",
  5: "Цвет пузырька соответствует совокупному риску.",
  6: "Сводка по отделам: средний риск, количество событий и доля критических рисков.",
  7: "Показывает, какие числовые признаки сильно коррелируют между собой и с целевой переменной.",
  8: "Динамика рисков и среднего риска по часам суток. Пики указывают на часы наибольшей уязвимости.",
  9: "Показывает, какая доля рисков требует принятия, минимизации, передачи или уклонения.",
  10: "Сколько раз модель ошиблась (ложноположительные и ложноотрицательные срабатывания).",
  11: "Чем выше кривая и больше площадь под ней (AUC), тем лучше модель разделяет классы.",
  12: "Оценивает, насколько хорошо модель калибрована: точки должны лежать на диагонали.",
  tree: "Суррогатное дерево - это обычное решающее дерево, обученное на предсказаниях ансамбля нечётких деревьев. Оно не участвует в расчётах, а служит для наглядной визуализации логики работы модели. Цвет узлов: оранжевый - предсказание класса «риск реализован», синий - предсказание класса «риск не реализован».",
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
            <label className={styles.label}>Уровень риска</label>
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
            Скачайте все 13 графиков одним архивом с учётом текущих фильтров.
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
          <div className={styles.error} style={{ marginTop: 16, marginBottom: 0 }}>
            Ошибка: {zipError}
          </div>
        )}
      </div>

      <div className={styles.plotsGrid}>
        {PLOT_KINDS.map((kind) => {
          const isWide = kind === "tree";
          return (
            <div
              key={kind}
              className={`${styles.plotCard} ${
                isWide ? styles.plotCardWide : ""
              }`}
            >
              <h3 className={styles.plotTitle}>{PLOT_TITLES[kind]}</h3>

              <div className={styles.plotImageWrapper}>
                {loading[kind] && (
                  <div className={styles.plotLoading}>
                    <span className={styles.spinner} />
                    Загрузка...
                  </div>
                )}

                {errors[kind] && !loading[kind] && (
                  <div className={styles.plotError}>
                    Ошибка: {errors[kind]}
                  </div>
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
          );
        })}
      </div>
    </div>
  );
};

export default PlotsPage;