import os
import json
import hashlib

from config import MODEL_FOLDER
from utils.dataset import get_active_dataset_path

# =========================
# FILE HASH
# =========================
def compute_file_hash(
    path: str,
    chunk_size: int = 65536
) -> str:

    h = hashlib.md5()

    with open(path, "rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)

    return h.hexdigest()


# =========================
# REGISTRY PATH
# =========================
def get_registry_path(
    dataset_path: str = ""
) -> str:

    if not dataset_path:
        dataset_path = get_active_dataset_path()

    name = os.path.basename(dataset_path)

    name = name.replace(".csv", "")

    return os.path.join(
        MODEL_FOLDER,
        f"registry_{name}.json"
    )


# =========================
# LOAD REGISTRY
# =========================
def load_model_registry(
    dataset_path: str = ""
) -> dict:

    path = get_registry_path(dataset_path)

    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)

        except Exception:
            pass

    return {}


# =========================
# SAVE REGISTRY
# =========================
def save_model_registry(
    registry: dict,
    dataset_path: str = ""
) -> None:

    path = get_registry_path(dataset_path)

    with open(path, "w") as f:
        json.dump(registry, f, indent=2)


# =========================
# CHECK TRAINED
# =========================
def is_dataset_already_trained(
    dataset_path: str
):

    file_hash = compute_file_hash(dataset_path)

    registry = load_model_registry(dataset_path)

    return file_hash in registry, file_hash


# =========================
# MODEL SNAPSHOT DIR
# =========================
def get_model_dir_for_hash(file_hash: str, username: str = "") -> str:
    suffix = f"{username}_{file_hash[:8]}" if username else file_hash[:12]
    return os.path.join(MODEL_FOLDER, f"snap_{suffix}")