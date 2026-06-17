import os
import json
import hashlib
from datetime import datetime
from config import MODEL_FOLDER, USER_FOLDER


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
# MODEL DIR PER USER (aktif)
# =========================
def get_model_dir_for_user(username: str) -> str:
    """Model aktif — users/<username>/"""
    return os.path.join(USER_FOLDER, username)


# =========================
# SNAP DIR PER USER (legacy — 1 folder)
# =========================
def get_snap_dir_for_user(username: str) -> str:
    """Legacy snapshot — models/snap_<username>/"""
    return os.path.join(MODEL_FOLDER, f"snap_{username}")


# =========================
# SNAPSHOT LIMITS PER TIER
# =========================
SNAPSHOT_LIMITS = {
    "gratis":   2,
    "basic":    3,
    "pro":      10,
    "business": -1,  # unlimited
}

def get_snapshot_limit(tier: str) -> int:
    """Return max snapshot slots. -1 = unlimited."""
    return SNAPSHOT_LIMITS.get(tier, SNAPSHOT_LIMITS["gratis"])


# =========================
# SNAP DIR — per snapshot entry
# =========================
def get_snapshot_dir(username: str, snapshot_id: str) -> str:
    """Folder fisik tiap snapshot — models/snapshots/<username>/<snapshot_id>/"""
    return os.path.join(MODEL_FOLDER, "snapshots", username, snapshot_id)


# =========================
# CEK QUOTA SNAPSHOT
# =========================
def check_snapshot_quota(username: str, file_hash: str) -> dict:
    """
    Cek apakah masih ada slot snapshot.
    Kalau hash sudah ada di snapshots → dianggap overwrite, selalu allowed.

    Return:
        {
            "allowed": bool,
            "is_overwrite": bool,   # True = hash sama, tinggal overwrite
            "count": int,
            "limit": int,
            "tier": str
        }
    """
    from utils.user_helpers import load_user

    user = load_user(username)
    if not user:
        return {"allowed": False, "is_overwrite": False, "count": 0, "limit": 0, "tier": "gratis"}

    tier     = user.get("storage_tier", "gratis")
    limit    = get_snapshot_limit(tier)
    snapshots = user.get("snapshots", [])
    count    = len(snapshots)

    # Hash sudah ada → overwrite snapshot lama, tidak perlu slot baru
    existing = next((s for s in snapshots if s.get("hash") == file_hash), None)
    if existing:
        return {"allowed": True, "is_overwrite": True, "count": count, "limit": limit, "tier": tier, "existing_id": existing["id"]}

    # Hash baru → perlu slot baru
    allowed = (limit == -1) or (count < limit)
    return {"allowed": allowed, "is_overwrite": False, "count": count, "limit": limit, "tier": tier}


# =========================
# SAVE SNAPSHOT — ke user JSON + copy model
# =========================
def save_snapshot(username: str, file_hash: str, dataset_path: str, metrics: dict, existing_id: str = None) -> str:
    """
    Bikin/update snapshot entry di user.json + copy model aktif ke folder snapshot.
    Return snapshot_id.
    """
    from utils.user_helpers import load_user, save_user

    user = load_user(username)
    if not user:
        return ""

    model_dir = get_model_dir_for_user(username)

    # Pakai existing_id kalau overwrite, bikin baru kalau slot baru
    snapshot_id = existing_id or f"snap_{file_hash[:8]}_{int(datetime.now().timestamp())}"
    snap_dir    = get_snapshot_dir(username, snapshot_id)

    os.makedirs(snap_dir, exist_ok=True)

    # Copy semua model aktif ke folder snapshot
    for fname in os.listdir(model_dir):
        src = os.path.join(model_dir, fname)
        if os.path.isfile(src):
            import shutil
            shutil.copy2(src, os.path.join(snap_dir, fname))

    # Update atau insert entry di snapshots[]
    entry = {
        "id":         snapshot_id,
        "dataset":    os.path.basename(dataset_path),
        "hash":       file_hash,
        "trained_at": datetime.now().isoformat(),
        "model_dir":  snap_dir,
        "metrics":    metrics,
    }

    snapshots = user.get("snapshots", [])

    if existing_id:
        # Overwrite entry lama
        snapshots = [entry if s["id"] == existing_id else s for s in snapshots]
    else:
        # Insert di depan
        snapshots.insert(0, entry)

    user["snapshots"] = snapshots
    save_user(user)

    return snapshot_id


# =========================
# RESTORE SNAPSHOT — copy model snapshot ke model aktif
# =========================
def restore_snapshot(username: str, snapshot_id: str) -> bool:
    """
    Copy model dari snapshot ke users/<username>/ (model aktif).
    Return True kalau berhasil.
    """
    import shutil
    from utils.user_helpers import load_user

    user = load_user(username)
    if not user:
        return False

    snapshots = user.get("snapshots", [])
    snap = next((s for s in snapshots if s["id"] == snapshot_id), None)
    if not snap:
        return False

    snap_dir  = snap["model_dir"]
    model_dir = get_model_dir_for_user(username)

    if not os.path.exists(snap_dir):
        return False

    os.makedirs(model_dir, exist_ok=True)
    for fname in os.listdir(snap_dir):
        src = os.path.join(snap_dir, fname)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(model_dir, fname))

    return True


# =========================
# CHECK TRAINED — cek via snapshots[]
# =========================
def is_dataset_already_trained(dataset_path: str, username: str = "") -> tuple:
    file_hash = compute_file_hash(dataset_path)

    if not username:
        return False, file_hash

    from utils.user_helpers import load_user

    user = load_user(username)
    if not user:
        return False, file_hash

    snapshots = user.get("snapshots", [])
    already_trained = any(
        s.get("hash") == file_hash for s in snapshots
    ) and os.path.exists(get_model_dir_for_user(username))

    return already_trained, file_hash


# =========================
# SAVE REGISTRY — ke user JSON (tetap dipakai untuk backward compat)
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