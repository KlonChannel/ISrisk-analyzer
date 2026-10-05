# -*- coding: utf-8 -*-
"""Генерация всех графиков в виде PNG base64."""

import io
import base64
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import pandas as pd
from matplotlib.patches import Patch
from sklearn.metrics import confusion_matrix, roc_curve
from sklearn.calibration import calibration_curve


DEPT_TRANSLATION = {
    "IT_Ops": "ИТ-операции",
    "DevOps": "DevOps",
    "Finance": "Финансы",
    "HR": "HR",
    "Development": "Разработка",
    "Security": "Безопасность",
}
EVENT_TRANSLATION = {
    "Auth_Attempt": "Попытка аутентификации",
    "File_Access": "Доступ к файлам",
    "Network_Connection": "Сетевое соединение",
    "DB_Query": "Запрос к БД",
    "Config_Change": "Изменение конфигурации",
    "VPN_Connect": "Подключение VPN",
}
DEPT_REVERSE = {v: k for k, v in DEPT_TRANSLATION.items()}
EVENT_REVERSE = {v: k for k, v in EVENT_TRANSLATION.items()}

COLORS = {
    "Низкий": "#17A2B8",
    "Средний": "#FFC107",
    "Высокий": "#FD7E14",
    "Критический": "#DC3545",
}


def _fig_to_base64(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
    buf.seek(0)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    plt.close(fig)
    return f"data:image/png;base64,{encoded}"


def _filter_df(sess, department, event_type, level):
    df = sess["risk_df"].copy()
    if department and department != "Все":
        dept_en = DEPT_REVERSE.get(department, department)
        df = df[df["department"] == dept_en]
    if event_type and event_type != "Все":
        event_en = EVENT_REVERSE.get(event_type, event_type)
        df = df[df["event_type"] == event_en]
    if level and level != "Все":
        df = df[df["risk_level"] == level]
    return df


# 1. Плотность вероятность × риск
def plot_1_heatmap(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level)
    fig, ax = plt.subplots(figsize=(8, 6))
    if len(filtered) > 10:
        sns.kdeplot(
            data=filtered, x="pred_prob", y="aggregate_risk", ax=ax,
            cmap="Blues", fill=True, thresh=0.05, cbar=True,
            cbar_kws={"label": "Плотность"},
        )
        ax.set_title("1. Плотность распределения: вероятность × риск", fontsize=14)
    else:
        ax.scatter(filtered["pred_prob"], filtered["aggregate_risk"], alpha=0.7)
        ax.set_title("1. Точки: вероятность × риск", fontsize=14)
    ax.set_xlabel("Вероятность риска", fontsize=12)
    ax.set_ylabel("Совокупный риск", fontsize=12)
    return _fig_to_base64(fig)


# 2. Топ-20 рисков
def plot_2_top(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level)
    top = filtered.nlargest(20, "aggregate_risk")
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.barh(
        range(len(top)), top["aggregate_risk"],
        color=[COLORS.get(l, "gray") for l in top["risk_level"]],
    )
    ax.set_yticks(range(len(top)))
    ax.set_yticklabels([f"Событие {i}" for i in top.index])
    ax.set_xlabel("Совокупный риск", fontsize=12)
    ax.set_title("2. Топ-20 рисков", fontsize=14)
    legend = [Patch(facecolor=COLORS[l], label=l) for l in COLORS if l in top["risk_level"].unique()]
    ax.legend(handles=legend, title="Уровень риска")
    return _fig_to_base64(fig)


# 3. Распределение вероятностей
def plot_3_distribution(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level)
    fig, ax = plt.subplots(figsize=(8, 6))
    for flag in [0, 1]:
        subset = filtered[filtered["incident_flag"] == flag]
        ax.hist(subset["pred_prob"], bins=30, alpha=0.5,
                label=f"Реализация риска = {flag}")
    ax.set_xlabel("Вероятность риска", fontsize=12)
    ax.set_ylabel("Количество событий", fontsize=12)
    ax.set_title("3. Распределение вероятностей по факту реализации риска", fontsize=14)
    ax.legend(title="Реализация риска")
    return _fig_to_base64(fig)


# 4. Тренд по отделам
def plot_4_trend(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level)
    fig, ax = plt.subplots(figsize=(10, 6))
    for dept_en in sorted(filtered["department"].unique()):
        sub = filtered[filtered["department"] == dept_en]
        ax.plot(sub.index, sub["pred_prob"], marker="o",
                label=DEPT_TRANSLATION.get(dept_en, dept_en), alpha=0.7)
    ax.set_xlabel("Номер события", fontsize=12)
    ax.set_ylabel("Вероятность", fontsize=12)
    ax.set_title("4. Тренд вероятности по отделам", fontsize=14)
    ax.legend(loc="best", title="Отдел")
    return _fig_to_base64(fig)


# 5. Пузырьковая
def plot_5_bubble(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level)
    fig, ax = plt.subplots(figsize=(9, 6))
    scatter = ax.scatter(
        filtered["pred_prob"], filtered["total_damage"],
        s=60,
        c=filtered["aggregate_risk"], cmap="Reds", alpha=0.6,
        edgecolors="black", linewidth=0.5,
    )
    ax.set_xlabel("Вероятность риска", fontsize=12)
    ax.set_ylabel("Оценка ущерба", fontsize=12)
    ax.set_title("5. Пузырьковая диаграмма: риск × вероятность × ущерб", fontsize=14)
    cbar = plt.colorbar(scatter, ax=ax)
    cbar.set_label("Совокупный риск", fontsize=10)
    return _fig_to_base64(fig)


# 6. Сводка по отделам
def plot_6_dept_summary(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level)
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    stats = filtered.groupby("department").agg(
        avg_risk=("aggregate_risk", "mean"),
        count=("incident_flag", "count"),
        critical_ratio=("risk_level", lambda x: (x == "Критический").mean()),
    ).reset_index()
    stats["department_ru"] = stats["department"].map(DEPT_TRANSLATION)

    axes[0].bar(stats["department_ru"], stats["avg_risk"], color="#2B7AEC")
    axes[0].set_title("Средний риск по отделам", fontsize=12)
    axes[0].set_ylabel("Средний риск", fontsize=10)
    axes[0].tick_params(axis="x", rotation=45)

    axes[1].bar(stats["department_ru"], stats["count"], color="#17A2B8")
    axes[1].set_title("Количество событий", fontsize=12)
    axes[1].set_ylabel("Количество", fontsize=10)
    axes[1].tick_params(axis="x", rotation=45)

    axes[2].bar(stats["department_ru"], stats["critical_ratio"], color="#DC3545")
    axes[2].set_title("Доля критических рисков", fontsize=12)
    axes[2].set_ylabel("Доля", fontsize=10)
    axes[2].tick_params(axis="x", rotation=45)

    plt.tight_layout()
    return _fig_to_base64(fig)


# 7. Корреляция
def plot_7_correlation(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level)
    df_full = sess["df"]
    df_corr = df_full.loc[filtered.index].select_dtypes(include=[np.number])
    fig, ax = plt.subplots(figsize=(10, 8))
    if len(df_corr.columns) > 1:
        sns.heatmap(df_corr.corr(), annot=True, fmt=".2f", cmap="coolwarm",
                    square=True, ax=ax, cbar_kws={"label": "Корреляция"})
    ax.set_title("7. Тепловая карта корреляции признаков", fontsize=14)
    return _fig_to_base64(fig)


# 8. Временной профиль
def plot_8_temporal(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level).copy()
    fig, ax = plt.subplots(figsize=(10, 6))
    filtered["hour"] = pd.to_datetime(filtered["timestamp"]).dt.hour
    hourly = filtered.groupby("hour").agg(
        count=("incident_flag", "count"),
        avg_risk=("aggregate_risk", "mean"),
    ).reset_index()
    ax.plot(hourly["hour"], hourly["count"], marker="o",
            label="Количество рисков", color="#2B7AEC")
    ax.set_xlabel("Час дня", fontsize=12)
    ax.set_ylabel("Количество рисков", fontsize=12, color="#2B7AEC")
    ax.tick_params(axis="y", labelcolor="#2B7AEC")
    ax.grid(True, alpha=0.3)
    ax2 = ax.twinx()
    ax2.plot(hourly["hour"], hourly["avg_risk"], marker="s",
             label="Средний риск", color="#DC3545", linestyle="--")
    ax2.set_ylabel("Средний риск", fontsize=12, color="#DC3545")
    ax2.tick_params(axis="y", labelcolor="#DC3545")
    ax.set_title("8. Временной профиль рисков по часам", fontsize=14)
    lines1, labels1 = ax.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(lines1 + lines2, labels1 + labels2, loc="upper left")
    return _fig_to_base64(fig)


# 9. Стратегии
def plot_9_strategies(sess, department, event_type, level):
    filtered = _filter_df(sess, department, event_type, level).copy()
    strategy_map = {
        "Низкий": "Принять риск",
        "Средний": "Минимизировать риск",
        "Высокий": "Передать риск",
        "Критический": "Уклониться от риска",
    }
    filtered["Стратегия"] = filtered["risk_level"].map(strategy_map)
    counts = filtered["Стратегия"].value_counts()
    fig, ax = plt.subplots(figsize=(8, 8))
    ax.pie(counts, labels=counts.index, autopct="%1.1f%%", startangle=90,
           colors=["#17A2B8", "#FFC107", "#FD7E14", "#DC3545"])
    ax.set_title("9. Распределение стратегий обработки рисков", fontsize=14)
    return _fig_to_base64(fig)


# 10. Матрица ошибок
def plot_10_confusion(sess, department, event_type, level):
    y_test = sess["y_test"]
    y_pred = sess["y_pred"]
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues", ax=ax,
        xticklabels=["Прогноз: 0\n(риск не реализован)", "Прогноз: 1\n(риск реализован)"],
        yticklabels=["Факт: 0\n(риск не реализован)", "Факт: 1\n(риск реализован)"],
    )
    ax.set_title("10. Матрица ошибок", fontsize=14)
    ax.set_xlabel("Прогноз модели", fontsize=12)
    ax.set_ylabel("Фактическое значение", fontsize=12)
    return _fig_to_base64(fig)


# 11. ROC-кривая
def plot_11_roc(sess, department, event_type, level):
    y_test = sess["y_test"]
    y_prob = sess["y_prob"]
    auc = sess["auc"]
    fpr, tpr, _ = roc_curve(y_test, y_prob)
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.plot(fpr, tpr, color="#2B7AEC", lw=2, label=f"ROC (AUC = {auc:.3f})")
    ax.plot([0, 1], [0, 1], "k--", label="Случайный классификатор")
    ax.set_xlabel("Ложноположительная доля (FPR)", fontsize=12)
    ax.set_ylabel("Истинноположительная доля (TPR)", fontsize=12)
    ax.set_title("11. ROC-кривая", fontsize=14)
    ax.legend(loc="lower right")
    return _fig_to_base64(fig)


# 12. Калибровка
def plot_12_calibration(sess, department, event_type, level):
    y_test = sess["y_test"]
    y_prob = sess["y_prob"]
    prob_true, prob_pred = calibration_curve(y_test, y_prob, n_bins=10)
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.plot(prob_pred, prob_true, marker="o", label="Модель", color="#2B7AEC")
    ax.plot([0, 1], [0, 1], "k--", label="Идеальная калибровка")
    ax.set_xlabel("Средняя предсказанная вероятность", fontsize=12)
    ax.set_ylabel("Доля фактических рисков", fontsize=12)
    ax.set_title("12. Калибровочная кривая", fontsize=14)
    ax.legend(loc="lower right")
    ax.grid(True, alpha=0.3)
    return _fig_to_base64(fig)

# 13. Суррогатное дерево
def plot_13_surrogate_tree(sess, department, event_type, level):
    from sklearn.tree import DecisionTreeClassifier, plot_tree

    X_train = sess["X_train"]
    model = sess["model"]
    feature_indices = sess["feature_indices"]
    X_cols = sess["X_cols"]

    y_surrogate_prob = None
    import numpy as np
    if hasattr(X_train, "values"):
        X_np = X_train.values
    else:
        X_np = X_train

    n_samples = X_np.shape[0]
    n_trees = len(model)
    probas = np.zeros((n_samples, n_trees))
    for i, (tree, idx) in enumerate(zip(model, feature_indices)):
        probas[:, i] = tree.predict_proba(X_np[:, idx])[:, 1]
    y_surrogate_prob = probas.mean(axis=1)
    y_surrogate = (y_surrogate_prob >= 0.5).astype(int)

    surrogate = DecisionTreeClassifier(max_depth=4, random_state=42)
    surrogate.fit(X_train, y_surrogate)

    fig, ax = plt.subplots(figsize=(20, 10))
    plot_tree(
        surrogate,
        feature_names=X_cols,
        class_names=["Риск не реализован", "Риск реализован"],
        filled=True,
        rounded=True,
        max_depth=3,
        fontsize=10,
        ax=ax,
    )
    ax.set_title("Суррогатное дерево для ансамбля нечётких деревьев", fontsize=14)
    plt.tight_layout()
    return _fig_to_base64(fig)

PLOT_DISPATCH = {
    "1": plot_1_heatmap,
    "2": plot_2_top,
    "3": plot_3_distribution,
    "4": plot_4_trend,
    "5": plot_5_bubble,
    "6": plot_6_dept_summary,
    "7": plot_7_correlation,
    "8": plot_8_temporal,
    "9": plot_9_strategies,
    "10": plot_10_confusion,
    "11": plot_11_roc,
    "12": plot_12_calibration,
    "tree": plot_13_surrogate_tree,
}