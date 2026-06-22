from flask import Blueprint, jsonify, session, request
import os
import shutil

from utils.registry import (
    get_snapshot_dir,
    restore_snapshot,
    check_snapshot_quota,
    SNAPSHOT_LIMITS,
)

snapshot_bp = Blueprint("snapshot_bp", __name__)


def get_username():
    return request.headers.get("X-Username") or session.get("username")


# =========================
# GET SNAPSHOTS
# =========================
@snapshot_bp.route("/snapshots", methods=["GET"])
def get_snapshots():
    from utils.user_helpers import load_user

    username = get_username()
    if not username:
        return jsonify({"success": False, "message": "Not logged in."}), 401

    user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    tier = user.get("storage_tier", "free")
    limit = SNAPSHOT_LIMITS.get(tier, SNAPSHOT_LIMITS["free"])
    snapshots = user.get("snapshots", [])

    # Sanitize — jangan expose model_dir path ke FE
    result = [
        {
            "id": s.get("id"),
            "dataset": s.get("dataset"),
            "hash": s.get("hash"),
            "trained_at": s.get("trained_at"),
            "metrics": s.get("metrics", {}),
        }
        for s in snapshots
    ]

    return jsonify(
        {
            "success": True,
            "tier": tier,
            "limit": limit,
            "count": len(snapshots),
            "snapshots": result,
        }
    )


# =========================
# DELETE SNAPSHOT
# =========================
@snapshot_bp.route("/snapshots/<snapshot_id>", methods=["DELETE"])
def delete_snapshot(snapshot_id):
    from utils.user_helpers import load_user, save_user

    username = get_username()
    if not username:
        return jsonify({"success": False, "message": "Not logged in."}), 401

    user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    snapshots = user.get("snapshots", [])
    snap = next((s for s in snapshots if s["id"] == snapshot_id), None)

    if not snap:
        return jsonify({"success": False, "message": "Snapshot tidak ditemukan."}), 404

    # Hapus folder fisik
    snap_dir = snap.get("model_dir")
    if snap_dir and os.path.exists(snap_dir):
        shutil.rmtree(snap_dir, ignore_errors=True)

    # Hapus dari user JSON
    user["snapshots"] = [s for s in snapshots if s["id"] != snapshot_id]
    save_user(user)

    return jsonify({"success": True, "message": "Snapshot dihapus."})


# =========================
# RESTORE SNAPSHOT
# =========================
@snapshot_bp.route("/snapshots/<snapshot_id>/restore", methods=["POST"])
def restore_snapshot_route(snapshot_id):
    from utils.user_helpers import load_user, save_user
    from utils.reload_state import reload_all_globals

    username = get_username()
    if not username:
        return jsonify({"success": False, "message": "Not logged in."}), 401

    # ✅ Restore + baca registry LOKAL dari folder snapshot — sumber kebenaran independen
    registry = restore_snapshot(username, snapshot_id)
    if not registry:
        return jsonify({"success": False, "message": "Gagal restore snapshot atau registry.json tidak ditemukan."}), 500

    user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    # ✅ Update metrics di user JSON DULU — pakai data dari registry LOKAL
    user["metrics"] = registry.get("metrics", {})
    save_user(user)

    # Update active_dataset ke dataset dari registry LOKAL, lalu reload globals
    from utils.dataset import set_active_dataset_path_for_user
    from config import UPLOAD_FOLDER

    dataset_path = os.path.join(UPLOAD_FOLDER, registry.get("dataset", ""))
    print(f"🔍 RESTORE dataset_path: {dataset_path}")
    print(f"🔍 RESTORE exists: {os.path.exists(dataset_path)}")
    print(f"🔍 RESTORE username: {username}")

    if os.path.exists(dataset_path):
        set_active_dataset_path_for_user(dataset_path, username=username)
        # ✅ FIX — registry harus di-pass biar reload_all_globals masuk branch
        # "skip recompute" (load_metrics_for_var dari registry), bukan compute_metrics_fresh.
        # Sebelumnya parameter ini kelewat, jadi restore selalu ngitung ulang metrics dari nol.
        reload_all_globals(dataset_path, username=username, registry=registry)

    return jsonify(
        {
            "success": True,
            "message": "Snapshot berhasil di-restore.",
            "snapshot_id": snapshot_id,
            "dataset": registry.get("dataset"),
            "trained_at": registry.get("trained_at"),
        }
    )