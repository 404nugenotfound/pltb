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
    path = user_path(user['username'])
    with open(path, "w") as f:
        json.dump(user, f, indent=2)