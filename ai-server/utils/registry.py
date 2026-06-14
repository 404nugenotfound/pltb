import os
import json
import hashlib
from config import MODEL_FOLDER


# =========================
# FILE HASH
# =========================
def compute_file_hash(path: str, chunk_size: int = 65536) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()


# =========================
# MODEL DIR PER USER
# =========================
def get_model_dir_for_user(username: str) -> str:
    return os.path.join(MODEL_FOLDER, f"snap_{username}")


# =========================
# CHECK TRAINED — per user
# =========================
def is_dataset_already_trained(dataset_path: str, username: str = "") -> tuple:
    file_hash = compute_file_hash(dataset_path)

    if not username:
        return False, file_hash

    from utils.user_helpers import load_user

    user = load_user(username)
    if not user:
        return False, file_hash

    registry = user.get("registry", {})
    already_trained = file_hash in registry and os.path.exists(
        get_model_dir_for_user(username)
    )
    return already_trained, file_hash


# =========================
# SAVE REGISTRY — ke user JSON
# =========================
def save_model_registry(username: str, file_hash: str, dataset_path: str) -> None:
    from utils.user_helpers import load_user, save_user

    user = load_user(username)
    if not user:
        return
    if "registry" not in user:
        user["registry"] = {}
    user["registry"][file_hash] = {
        "trained_at": __import__("pandas").Timestamp.now().isoformat(),
        "dataset": os.path.basename(dataset_path),
    }
    save_user(user)


# =========================
# LOAD REGISTRY — dari user JSON
# =========================
def load_model_registry(username: str = "") -> dict:
    if not username:
        return {}
    from utils.user_helpers import load_user

    user = load_user(username)
    if not user:
        return {}
    return user.get("registry", {})
