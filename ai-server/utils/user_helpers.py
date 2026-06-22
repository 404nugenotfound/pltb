import json
import os
from config import USER_FOLDER
from datetime import datetime
import uuid


def user_path(username: str) -> str:
    return os.path.join(USER_FOLDER, f"{username}.json")


def load_user(username: str) -> dict | None:
    path = user_path(username)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def save_user(user: dict) -> None:
    os.makedirs(USER_FOLDER, exist_ok=True)
    path = user_path(user["username"])
    with open(path, "w") as f:
        json.dump(user, f, indent=2)


def list_all_usernames() -> list[str]:
    """List semua username yang punya file JSON di USER_FOLDER.
    Folder model per-user (misal users/kangkungkang/) DIABAIKAN — cuma file .json yang diambil.
    """
    if not os.path.exists(USER_FOLDER):
        return []
    return [
        f[:-5]  # strip ".json"
        for f in os.listdir(USER_FOLDER)
        if f.endswith(".json") and os.path.isfile(os.path.join(USER_FOLDER, f))
    ]

def log_usage(username: str, feature: str) -> None:
    """Catat 1 entry usage ke user['usage_logs']. Non-blocking — kalau gagal, silent."""
    try:
        user = load_user(username)
        if not user:
            return
        logs = user.get("usage_logs", [])
        logs.append({
            "id": str(uuid.uuid4())[:8],
            "feature": feature,
            "timestamp": datetime.now().isoformat(),
        })
        # Batasi 500 entry terakhir biar file gak membengkak
        user["usage_logs"] = logs[-500:]
        save_user(user)
    except Exception:
        pass  # jangan sampe error logging ganggu proses utama
    
def get_snapshot_by_id(username, snapshot_id):
    user = load_user(username)
    if not user:
        return None

    return next(
        (s for s in user.get("snapshots", []) if s["id"] == snapshot_id),
        None
    )


def add_forecast_record(username, snapshot_id, record):
    user = load_user(username)
    if not user:
        return False

    for s in user.get("snapshots", []):
        if s["id"] == snapshot_id:
            s.setdefault("forecasts", []).append(record)
            save_user(user)
            return True

    return False