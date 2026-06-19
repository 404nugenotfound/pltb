import os
from flask import session
from config import (
    ACTIVE_DATASET_FILE,
    DEFAULT_DATASET,
    ALLOWED_EXTENSIONS
)

# =========================
# GET/SET ACTIVE DATASET (legacy/global)
# Catatan: gak dipanggil lagi dari alur per-user (lihat di bawah).
# Cek grep di codebase — kalau gak ada caller lain, 2 fungsi ini bisa dihapus.
# =========================
def get_active_dataset_path() -> str:
    if os.path.exists(ACTIVE_DATASET_FILE):
        with open(ACTIVE_DATASET_FILE, "r") as f:
            path = f.read().strip()
        if path and os.path.exists(path):
            return path
    return DEFAULT_DATASET

def set_active_dataset_path(path: str) -> None:
    with open(ACTIVE_DATASET_FILE, "w") as f:
        f.write(path)

# =========================
# GET ACTIVE DATASET PER USER
# =========================
def get_active_dataset_path_for_user() -> str:
    from utils.user_helpers import load_user
    username = session.get("username")
    if not username:
        # Harusnya gak pernah sampai sini kalau guard Bug #3 udah dipasang di route.
        # Fail loud daripada diem-diem leak ke fallback global.
        raise PermissionError("No authenticated user in session")

    user = load_user(username)
    if user:
        path = user.get("active_dataset", "")
        if path and os.path.exists(path):
            return path

    # User belum pernah upload dataset sendiri / path-nya hilang
    # -> default konstan, BUKAN file shared yang bisa ketulis user lain
    return DEFAULT_DATASET

# =========================
# SET ACTIVE DATASET PER USER
# =========================
def set_active_dataset_path_for_user(path: str, username: str = None) -> None:
    from utils.user_helpers import load_user, save_user
    if not username:
        username = session.get("username")
    if not username:
        raise PermissionError("No authenticated user in session")

    user = load_user(username)
    if user:
        user["active_dataset"] = path
        save_user(user)
    # SENGAJA gak manggil set_active_dataset_path(path) lagi.
    # Itu yang nulis ke file global shared dan jadi sumber leak fallback Bug #2.

# =========================
# VALIDATE FILE
# =========================
def allowed_file(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )