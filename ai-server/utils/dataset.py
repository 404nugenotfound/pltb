import os
from flask import session
from config import (
    DEFAULT_DATASET,
    ALLOWED_EXTENSIONS,
)


# =========================
# GET ACTIVE DATASET PER USER
# =========================
def get_active_dataset_path_for_user(username: str = None) -> str:
    from utils.user_helpers import load_user

    if not username:
        username = session.get("username")
    if not username:
        # Fail loud daripada diem-diem leak ke fallback global.
        raise PermissionError("No authenticated user in session")

    user = load_user(username)
    if user:
        path = user.get("active_dataset", "")
        if path and os.path.exists(path):
            return path

    # User belum pernah upload dataset sendiri / path-nya kosong / file hilang
    # -> DEFAULT_DATASET di sini cuma dipakai sebagai fallback BACA (preview/template),
    #    bukan berarti dataset ini "aktif" buat training siapapun.
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
    # Itu yang nulis ke file global shared dan jadi sumber leak fallback.


# =========================
# RESET ACTIVE DATASET PER USER — hapus file upload + reset pointer
# =========================
def reset_dataset_for_user(username: str) -> dict:
    """
    Hapus file dataset aktif milik user ini DARI DISK, lalu kosongkan
    user["active_dataset"]. File fisik hanya dihapus kalau gak ada user lain
    yang masih punya active_dataset ATAU snapshot yang menunjuk ke file yang sama
    (reference counting) — karena UPLOAD_FOLDER bersifat shared/global by filename.

    Returns dict berisi status, buat dipakai route -> toast notification.
    """
    from utils.user_helpers import load_user, save_user, list_all_usernames

    user = load_user(username)
    if not user:
        return {"success": False, "message": "User not found.", "file_deleted": False}

    active_path = user.get("active_dataset", "")

    if not active_path:
        # Gak ada dataset aktif sama sekali, no-op
        return {"success": True, "message": "Tidak ada dataset aktif untuk direset.", "file_deleted": False}

    if active_path == DEFAULT_DATASET:
        # DEFAULT_DATASET itu file contoh/template, BUKAN dataset kerja siapapun.
        # Jangan pernah dihapus, cukup kosongkan pointer.
        user["active_dataset"] = ""
        save_user(user)
        return {"success": True, "message": "Dataset direset.", "file_deleted": False}

    abs_active_path = os.path.abspath(active_path)

    # =========================
    # REFERENCE COUNT — cek semua user LAIN
    # =========================
    still_referenced = False

    for other_username in list_all_usernames():
        if other_username == username:
            continue  # skip diri sendiri, dicek terpisah di bawah

        other_user = load_user(other_username)
        if not other_user:
            continue

        # 1) Cek active_dataset user lain
        other_active = other_user.get("active_dataset", "")
        if other_active and os.path.abspath(other_active) == abs_active_path:
            still_referenced = True
            break

        # 2) Cek snapshots milik user lain — snapshot nyimpen nama file dataset
        for snap in other_user.get("snapshots", []):
            snap_dataset = snap.get("dataset", "")
            if snap_dataset and os.path.basename(snap_dataset) == os.path.basename(active_path):
                still_referenced = True
                break

        if still_referenced:
            break

    # =========================
    # Cek snapshot milik USER ITU SENDIRI juga —
    # kalau dia masih punya snapshot yang nunjuk ke dataset ini,
    # jangan hapus filenya supaya restore snapshot dia sendiri gak rusak.
    # =========================
    if not still_referenced:
        for snap in user.get("snapshots", []):
            snap_dataset = snap.get("dataset", "")
            if snap_dataset and os.path.basename(snap_dataset) == os.path.basename(active_path):
                still_referenced = True
                break

    file_deleted = False
    if not still_referenced and os.path.exists(active_path):
        try:
            os.remove(active_path)
            file_deleted = True
        except OSError as e:
            # Gagal hapus fisik (misal file lagi dipakai/locked) -> tetap lanjut reset pointer,
            # tapi laporin biar gak silent.
            print(f"⚠️ Gagal hapus file dataset {active_path}: {e}")

    user["active_dataset"] = ""
    save_user(user)

    return {
        "success": True,
        "message": "Dataset direset.",
        "file_deleted": file_deleted,
        "still_referenced": still_referenced,
    }


# =========================
# VALIDATE FILE
# =========================
def allowed_file(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )