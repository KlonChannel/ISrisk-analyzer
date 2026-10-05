import uuid
import threading

_lock = threading.Lock()

SESSIONS: dict[str, dict] = {}
TASKS: dict[str, dict] = {}


def create_session() -> str:
    sid = str(uuid.uuid4())
    with _lock:
        SESSIONS[sid] = {
            "df": None,
            "meta": None,
            "model": None,
            "feature_indices": None,
            "X_train": None,
            "y_train": None,
            "X_test": None,
            "y_test": None,
            "y_prob": None,
            "y_pred": None,
            "damages": None,
            "risks": None,
            "categories": None,
            "report_df": None,
            "damage_weights": None,
            "acc": None,
            "f1": None,
            "auc": None,
            "scenario": None,
            "uploaded_filename": None,
            "page_size": 10,
            "risk_df": None,
        }
    return sid


def get_session(sid: str) -> dict:
    return SESSIONS.get(sid)


def delete_session(sid: str) -> None:
    with _lock:
        SESSIONS.pop(sid, None)


def create_task() -> str:
    tid = str(uuid.uuid4())
    with _lock:
        TASKS[tid] = {"status": "pending", "progress": 0, "message": "", "result": None, "error": None}
    return tid


def update_task(tid: str, **kwargs) -> None:
    with _lock:
        if tid in TASKS:
            TASKS[tid].update(kwargs)


def get_task(tid: str) -> dict:
    return TASKS.get(tid)