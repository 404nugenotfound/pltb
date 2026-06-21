import json
import os
from config import USER_FOLDER


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