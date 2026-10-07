from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import sys, os, io, base64
import pandas as pd
import numpy as np
import plotting

# Подключение src
BASE_DIR = Path(__file__).resolve().parent
SRC = BASE_DIR / "src"
sys.path.insert(0, str(SRC))

from data_loader import generate_or_load_data, normalize_data
from damage_estimator import ExpertDamageEstimator
from risk_model import prepare_features_for_model, build_single_fuzzy_tree, predict_fuzzy_ensemble
from risk_aggregator import compute_aggregate_risk
from recommendations import prepare_report

from session_store import (
    create_session, get_session, create_task, update_task, get_task,
)
from schemas import GenerateRequest, AnalyzeRequest

UPLOADS = BASE_DIR / "uploads"
REPORTS = BASE_DIR / "reports"
UPLOADS.mkdir(exist_ok=True)
REPORTS.mkdir(exist_ok=True)

app = FastAPI(title="IS Risk Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],   # адрес React-сервера
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Корень
@app.get("/api/health")
def health():
    return {"status": "ok"}


# Новая сессия
@app.post("/api/session")
def new_session():
    sid = create_session()
    return {"session_id": sid}


# Генерация датасета
@app.post("/api/data/generate")
def data_generate(req: GenerateRequest):
    sess = get_session(req.session_id)
    if sess is None:
        raise HTTPException(404, "session not found")

    df, meta = generate_or_load_data("generate", scenario=req.scenario, n_samples=req.n_samples)
    sess["df"] = df
    sess["meta"] = meta
    sess["scenario"] = req.scenario
    sess["uploaded_filename"] = None

    return {"rows": len(df), "columns": list(df.columns)}


REQUIRED_COLUMNS = [
    "timestamp", "department", "event_type", "cvss_score", "asset_criticality",
    "hour_of_day", "anomaly_frequency", "access_attempts", "network_load_mbps",
    "prev_incidents_week", "incident_flag",
]

# Загрузка файла
@app.post("/api/data/upload")
async def data_upload(session_id: str = Form(...), file: UploadFile = File(...)):
    sess = get_session(session_id)
    if sess is None:
        raise HTTPException(404, "session not found")

    if not file.filename:
        raise HTTPException(400, "Не выбрано имя файла")

    ext = file.filename.split(".")[-1].lower()
    if ext not in ("csv", "xlsx"):
        raise HTTPException(400, "Поддерживаются только файлы .csv и .xlsx")

    path = UPLOADS / f"{session_id}.{ext}"
    try:
        content = await file.read()
        with open(path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(400, f"Не удалось сохранить файл: {e}")

    try:
        if ext == "csv":
            df = pd.read_csv(path, encoding="utf-8-sig")
        else:
            df = pd.read_excel(path)
    except Exception as e:
        raise HTTPException(400, f"Не удалось прочитать файл: {e}")

    if df.empty:
        raise HTTPException(400, "Файл пустой")

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise HTTPException(
            400,
            "В файле отсутствуют обязательные столбцы: " + ", ".join(missing),
        )

    meta = {
        "numeric_features": [
            c for c in df.columns
            if df[c].dtype in ("float64", "int64") and c != "incident_flag"
        ],
        "categorical_features": [c for c in df.columns if df[c].dtype == "object"],
        "target": "incident_flag",
        "timestamp": None,
    }
    for col in df.columns:
        if "date" in col.lower() or "time" in col.lower():
            meta["timestamp"] = col
            break

    sess["df"] = df
    sess["meta"] = meta
    sess["scenario"] = None
    sess["uploaded_filename"] = file.filename

    return {"rows": len(df), "columns": list(df.columns)}

def _to_py(v):
    #Приводит numpy-скаляры и timestamp к JSON-сериализуемым типам
    if v is None:
        return None
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.floating):
        return float(v)
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    return v

# Предпросмотр
@app.get("/api/data/preview")
def data_preview(session_id: str, page: int = 1):
    sess = get_session(session_id)
    if sess is None or sess["df"] is None:
        raise HTTPException(404, "данные не загружены")

    df = sess["df"]
    size = sess["page_size"]
    start = (page - 1) * size
    end = min(start + size, len(df))

    chunk = df.iloc[start:end].copy()
    chunk = chunk.where(pd.notnull(chunk), None)

    records = [
        {k: _to_py(v) for k, v in row.items()}
        for row in chunk.to_dict(orient="records")
    ]

    return {
        "page": page,
        "page_size": size,
        "total": len(df),
        "total_pages": (len(df) - 1) // size + 1,
        "columns": list(df.columns),
        "rows": records,
    }


# Анализ (фоновая задача + polling)
def run_analysis(task_id: str, session_id: str, params: AnalyzeRequest):
    sess = get_session(session_id)
    try:
        update_task(task_id, status="running", progress=5, message="Нормализация данных...")
        df = sess["df"]
        meta = sess["meta"]

        df_proc, _ = normalize_data(df, meta)

        update_task(task_id, progress=10, message="Подготовка признаков...")
        X, y, _ = prepare_features_for_model(df_proc, meta)

        update_task(task_id, progress=15, message="Обучение ансамбля...")
        n_trees = params.n_trees
        max_depth = 6
        random_state = 42
        n_features = X.shape[1]
        max_features = max(1, int(n_features * 0.7))

        X_np = X.values if hasattr(X, "values") else X
        y_np = y.values if hasattr(y, "values") else y

        ensemble, feature_indices = [], []
        for i in range(n_trees):
            tree, idx = build_single_fuzzy_tree(X_np, y_np, max_depth, random_state + i, max_features)
            ensemble.append(tree)
            feature_indices.append(idx)
            if i % 5 == 0:
                update_task(task_id, progress=15 + int(25 * i / n_trees),
                            message=f"Дерево {i+1}/{n_trees}")

        from sklearn.model_selection import train_test_split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )

        update_task(task_id, progress=50, message="Предсказание...")
        y_prob = predict_fuzzy_ensemble(ensemble, X_test, feature_indices)
        y_pred = (y_prob >= 0.5).astype(int)

        update_task(task_id, progress=60, message="Экспертная оценка ущерба...")
        expert = ExpertDamageEstimator()
        rng = np.random.default_rng()

        if params.damage_mode == "linguistic" and params.ling_values:
            ling_to_num = {
                "Очень низкий": 10, "Низкий": 25, "Ниже среднего": 40,
                "Средний": 50, "Выше среднего": 65, "Высокий": 80,
                "Очень высокий": 90, "Критический": 98,
            }
            num_vals = {
                cat: ling_to_num.get(val, 50)
                for cat, val in params.ling_values.items()
            }
            total = sum(num_vals.values()) or 1
            weights = {k: v / total for k, v in num_vals.items()}
            expert.set_weights(weights)

            for i in range(len(X_test)):
                noisy = {
                    cat: max(0, min(100, num_vals[cat] + int(rng.integers(-10, 10))))
                    for cat in num_vals
                }
                expert.set_damage_for_event(i, noisy)
        else:
            weights = params.weights or {"financial": 0.25, "reputational": 0.25,
                                         "operational": 0.20, "legal": 0.15,
                                         "data_loss": 0.15}
            total = sum(weights.values()) or 1
            weights = {k: v / total for k, v in weights.items()}
            expert.set_weights(weights)

            for i in range(len(X_test)):
                scores = {
                    "financial": rng.uniform(20, 90),
                    "reputational": rng.uniform(10, 80),
                    "operational": rng.uniform(5, 70),
                    "legal": rng.uniform(0, 60),
                    "data_loss": rng.uniform(10, 95),
                }
                expert.set_damage_for_event(i, scores)

        damages = [expert.get_aggregated_damage(i) for i in range(len(X_test))]

        update_task(task_id, progress=75, message="Совокупный риск...")
        risks, categories = compute_aggregate_risk(y_prob, damages)

        if sess.get("scenario") == "balanced" and len(risks) >= 4:
            rng = np.random.default_rng()

            q1 = 0.50 + rng.uniform(-0.05, 0.05) 
            q2 = 0.78 + rng.uniform(-0.04, 0.04) 
            q3 = 0.95 + rng.uniform(-0.03, 0.03) 
            if q1 >= q2:
                q2 = min(q1 + 0.05, 0.95)
            if q2 >= q3:
                q3 = min(q2 + 0.03, 0.99)

            q1v, q2v, q3v = np.quantile(risks, [q1, q2, q3])
            categories = [
                "Низкий" if r <= q1v else
                "Средний" if r <= q2v else
                "Высокий" if r <= q3v else
                "Критический"
                for r in risks
            ]

        update_task(task_id, progress=85, message="Формирование отчёта...")
        ids = list(range(len(X_test)))
        descriptions = [f"Событие №{i+1}" for i in ids]
        report = prepare_report(risks, ids, descriptions,
                                df=df.iloc[X_test.index] if df is not None else None)

        report_df = pd.DataFrame({
            "Событие": [f"Событие №{i + 1}" for i in range(len(X_test))],
            "Характеристика": [r["vulnerability_description"] for r in report],
            "Возможность реализации рискового события": np.round(y_prob, 3),
            "Ущерб": np.round(damages, 1),
            "Оценка (произведение возможности на ущерб)": np.round(risks, 2),
            "Уровень риска (критичность)": categories,
            "Стратегия": [r["strategy"] for r in report],
            "Детали": [r["detail"] for r in report],
        })

        from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_prob)

        # собираем таблицу для графиков
        risk_df = X_test.copy()
        risk_df["incident_flag"] = y_test.values
        risk_df["pred_prob"] = y_prob
        risk_df["aggregate_risk"] = risks
        risk_df["risk_level"] = categories
        risk_df["total_damage"] = damages

        if df is not None and "department" in df.columns and "event_type" in df.columns:
            risk_df["department"] = df.loc[X_test.index, "department"].values
            risk_df["event_type"] = df.loc[X_test.index, "event_type"].values
        else:
            risk_df["department"] = np.random.choice(
                ["IT_Ops", "DevOps", "Finance", "HR", "Development", "Security"],
                len(risk_df),
            )
            risk_df["event_type"] = np.random.choice(
                ["Auth_Attempt", "File_Access", "Network_Connection", "DB_Query",
                 "Config_Change", "VPN_Connect"],
                len(risk_df),
            )

        if df is not None and "timestamp" in df.columns:
            risk_df["timestamp"] = df.loc[X_test.index, "timestamp"].values
        else:
            risk_df["timestamp"] = pd.date_range(
                "2025-01-01", periods=len(risk_df), freq="5min"
            )

        # Сохраняем сессию
        sess.update({
            "model": ensemble,
            "feature_indices": feature_indices,
            "X_train": X_train, "y_train": y_train,
            "X_test": X_test, "y_test": y_test,
            "y_prob": y_prob, "y_pred": y_pred,
            "damages": damages,
            "risks": risks, "categories": categories,
            "report_df": report_df,
            "damage_weights": weights,
            "acc": acc, "f1": f1, "auc": auc,
            "risk_df": risk_df,
            "X_cols": X.columns.tolist(),
        })
        update_task(task_id, status="done", progress=100, message="Готово")

    except Exception as e:
        import traceback
        traceback.print_exc()
        update_task(task_id, status="error", error=str(e))


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest, bg: BackgroundTasks):
    sess = get_session(req.session_id)
    if sess is None or sess["df"] is None:
        raise HTTPException(400, "сначала загрузите/сгенерируйте данные")

    task_id = create_task()
    bg.add_task(run_analysis, task_id, req.session_id, req)
    return {"task_id": task_id}


@app.get("/api/analyze/status")
def analyze_status(task_id: str):
    t = get_task(task_id)
    if t is None:
        raise HTTPException(404, "task not found")
    return t


# Результаты
@app.get("/api/results/summary")
def results_summary(session_id: str):
    sess = get_session(session_id)
    if sess is None or sess["acc"] is None:
        raise HTTPException(404, "анализ ещё не выполнен")

    return {
        "acc": sess["acc"],
        "f1": sess["f1"],
        "auc": sess["auc"],
        "damage_weights": sess["damage_weights"],
        "total_risks": len(sess["risks"]),
    }


@app.get("/api/results/report")
def results_report(session_id: str, page: int = 1, page_size: int = 10):
    sess = get_session(session_id)
    if sess is None or sess["report_df"] is None:
        raise HTTPException(404, "отчёт не сформирован")

    df = sess["report_df"]
    start = (page - 1) * page_size
    end = min(start + page_size, len(df))
    chunk = df.iloc[start:end].copy()
    chunk = chunk.where(pd.notnull(chunk), None)

    records = [
        {k: _to_py(v) for k, v in row.items()}
        for row in chunk.to_dict(orient="records")
    ]

    return {
        "page": page,
        "page_size": page_size,
        "total": len(df),
        "total_pages": (len(df) - 1) // page_size + 1,
        "rows": records,
    }


# Скачивание отчётов
@app.get("/api/report/csv")
def report_csv(session_id: str):
    sess = get_session(session_id)
    if sess is None or sess["report_df"] is None:
        raise HTTPException(404, "нет отчёта")
    path = REPORTS / f"{session_id}.csv"
    sess["report_df"].to_csv(path, index=False, encoding="utf-8-sig")
    return FileResponse(path, filename="report.csv", media_type="text/csv")


@app.get("/api/report/html")
def report_html(session_id: str):
    sess = get_session(session_id)
    if sess is None or sess["report_df"] is None:
        raise HTTPException(404, "нет отчёта")

    table_html = sess["report_df"].to_html(index=False, justify="left")

    html = f"""<html><head><meta charset="UTF-8"><title>Отчёт по рискам</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        table {{ border-collapse: collapse; width: 100%; font-size: 12px; }}
        th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }}
        th {{ background: #f2f2f2; }}
    </style></head>
    <body>
    <h1>Отчёт по рискам информационной безопасности</h1>
    {table_html}
    </body></html>"""

    path = REPORTS / f"{session_id}.html"
    path.write_text(html, encoding="utf-8")
    return FileResponse(path, filename="report.html", media_type="text/html")

@app.get("/api/report/pdf")
def report_pdf(session_id: str):
    sess = get_session(session_id)
    if sess is None or sess["report_df"] is None:
        raise HTTPException(404, "нет отчёта")
    try:
        from weasyprint import HTML as WPHTML
    except Exception as e:
        raise HTTPException(500, f"WeasyPrint недоступен: {e}")

    table_html = sess["report_df"].to_html(index=False, justify="left")

    html = f"""<html><head><meta charset="UTF-8"><title>Отчёт</title>
    <style>
        @page {{ size: landscape; margin: 1cm; }}
        body {{ font-family: Arial, sans-serif; }}
        table {{ border-collapse: collapse; width: 100%; font-size: 10px; }}
        th, td {{ border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }}
        th {{ background: #f2f2f2; }}
    </style></head>
    <body>
    <h1>Отчёт по рискам информационной безопасности</h1>
    {table_html}
    </body></html>"""

    path = REPORTS / f"{session_id}.pdf"
    WPHTML(string=html).write_pdf(path)
    return FileResponse(path, filename="report.pdf", media_type="application/pdf")

# Графики
@app.get("/api/plot/available")
def plot_available(session_id: str):
    sess = get_session(session_id)
    if sess is None or sess.get("risk_df") is None:
        raise HTTPException(404, "анализ ещё не выполнен")

    departments = ["Все"] + sorted(
        {plotting.DEPT_TRANSLATION.get(d, d) for d in sess["risk_df"]["department"].unique()}
    )
    events = ["Все"] + sorted(
        {plotting.EVENT_TRANSLATION.get(e, e) for e in sess["risk_df"]["event_type"].unique()}
    )
    levels = ["Все", "Низкий", "Средний", "Высокий", "Критический"]

    return {"departments": departments, "events": events, "levels": levels}

@app.get("/api/plot/{kind}")
def plot_get(kind: str, session_id: str,
             department: str = "Все", event_type: str = "Все", level: str = "Все"):
    sess = get_session(session_id)
    if sess is None or sess.get("risk_df") is None:
        raise HTTPException(404, "анализ ещё не выполнен")

    fn = plotting.PLOT_DISPATCH.get(kind)
    if fn is None:
        raise HTTPException(404, f"график {kind} не найден")

    try:
        image = fn(sess, department, event_type, level)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Ошибка построения графика: {e}")

    return {"image": image}

@app.get("/api/plots/zip")
def plots_zip(session_id: str,
              department: str = "Все", event_type: str = "Все", level: str = "Все"):
    sess = get_session(session_id)
    if sess is None or sess.get("risk_df") is None:
        raise HTTPException(404, "анализ ещё не выполнен")

    import io as _io
    import zipfile

    buf = _io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for kind, fn in plotting.PLOT_DISPATCH.items():
            try:
                data_url = fn(sess, department, event_type, level)
            except Exception as e:
                import traceback
                traceback.print_exc()
                continue
            b64 = data_url.split(",", 1)[1]
            png_bytes = base64.b64decode(b64)
            zf.writestr(f"plot_{kind}.png", png_bytes)

    buf.seek(0)
    path = REPORTS / f"plots_{session_id}.zip"
    path.write_bytes(buf.getvalue())
    return FileResponse(path, filename="plots.zip", media_type="application/zip")

# Скачивание датасета
@app.get("/api/dataset/csv")
def dataset_csv(session_id: str):
    sess = get_session(session_id)
    if sess is None or sess["df"] is None:
        raise HTTPException(404, "данные не загружены")
    path = REPORTS / f"dataset_{session_id}.csv"
    sess["df"].to_csv(path, index=False, encoding="utf-8-sig")
    return FileResponse(path, filename="dataset.csv", media_type="text/csv")


@app.get("/api/dataset/html")
def dataset_html(session_id: str):
    sess = get_session(session_id)
    if sess is None or sess["df"] is None:
        raise HTTPException(404, "данные не загружены")

    table_html = sess["df"].to_html(index=False, justify="left")

    html = f"""<html><head><meta charset="UTF-8"><title>Датасет</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        table {{ border-collapse: collapse; width: 100%; font-size: 12px; }}
        th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }}
        th {{ background: #f2f2f2; }}
    </style></head>
    <body>
    <h1>Датасет для анализа рисков</h1>
    {table_html}
    </body></html>"""

    path = REPORTS / f"dataset_{session_id}.html"
    path.write_text(html, encoding="utf-8")
    return FileResponse(path, filename="dataset.html", media_type="text/html")


@app.get("/api/dataset/xlsx")
def dataset_xlsx(session_id: str):
    sess = get_session(session_id)
    if sess is None or sess["df"] is None:
        raise HTTPException(404, "данные не загружены")

    df_to_save = sess["df"].copy()
    if "timestamp" in df_to_save.columns:
        df_to_save["timestamp"] = df_to_save["timestamp"].astype(str)

    path = REPORTS / f"dataset_{session_id}.xlsx"
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        df_to_save.to_excel(writer, index=False, sheet_name="Data")
        worksheet = writer.sheets["Data"]
        for i, col in enumerate(df_to_save.columns):
            max_len = max(len(str(col)), df_to_save[col].astype(str).map(len).max())
            worksheet.column_dimensions[chr(65 + i)].width = min(max_len + 2, 30)

    return FileResponse(
        path,
        filename="dataset.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )