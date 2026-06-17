from flask import *
import os
import time
import shutil
import threading

from werkzeug.utils import secure_filename

from config import *

from utils.dataset import *
from utils.validation import *

from utils.registry import *
from utils.reload_state import *

from utils.progress import *

from training.worker_retrain import worker_retrain

upload_bp = Blueprint("upload", __name__)


# =========================
# UPLOAD DATASET
# =========================
@upload_bp.route("/upload_dataset", methods=["POST"])
def upload_dataset():

    username = session.get("username")

    with train_lock:

        if train_progress.get(username, {}).get("running"):

            return (
                jsonify({"status": "error", "message": "Training sedang berjalan"}),
                409,
            )

    # =========================
    # HANDLE SKIP SNAPSHOT (re-submit tanpa upload ulang)
    # =========================
    skip_snapshot = request.form.get("skip_snapshot", "false").lower() == "true"
    reuse_filename = request.form.get("filename", "")

    if skip_snapshot and reuse_filename and "dataset" not in request.files:
        final_path = os.path.join(UPLOAD_FOLDER, secure_filename(reuse_filename))
        if not os.path.exists(final_path):
            return jsonify({"status": "error", "message": "File tidak ditemukan di server."}), 404

        set_active_dataset_path_for_user(final_path)

        with train_lock:
            train_progress[username] = {
                "running": True,
                "step": "Memulai training...",
                "done": False,
                "error": None,
                "log": [],
                "cancel": False,
                "skip_snapshot": True,
            }

        threading.Thread(
            target=worker_retrain,
            args=(username, final_path, train_progress, train_lock),
            daemon=True,
        ).start()

        return jsonify({"status": "started", "filename": reuse_filename, "message": "Training dimulai tanpa snapshot"})

    # =========================
    # VALIDASI FILE
    # =========================
    if "dataset" not in request.files:

        return jsonify({"status": "error", "message": "Tidak ada dataset"}), 400

    file = request.files["dataset"]

    raw_filename = file.filename or ""

    if raw_filename == "":

        return jsonify({"status": "error", "message": "Filename kosong"}), 400

    if not allowed_file(raw_filename):

        return jsonify({"status": "error", "message": "File harus CSV"}), 400

    # =========================
    # SAVE TEMP FILE
    # =========================
    filename = secure_filename(raw_filename)

    pending_path = os.path.join(UPLOAD_FOLDER, f"pending_{filename}")

    file.save(pending_path)

    # =========================
    # VALIDATE CSV
    # =========================
    validation = validate_csv(pending_path)

    if not validation["valid"]:

        os.remove(pending_path)

        return (
            jsonify(
                {
                    "status": "invalid",
                    "errors": validation["errors"],
                    "info": validation["info"],
                }
            ),
            422,
        )

    # =========================
    # FINAL SAVE
    # =========================
    final_path = os.path.join(UPLOAD_FOLDER, filename)

    shutil.move(pending_path, final_path)

    set_active_dataset_path_for_user(final_path)

    # =========================
    # HITUNG HASH
    # =========================
    file_hash = compute_file_hash(final_path)

    # =========================
    # CHECK CACHE TRAIN
    # =========================
    from utils.cache_settings import get_cache_settings

    settings = get_cache_settings()

    already_trained, _ = is_dataset_already_trained(final_path, username)

    if settings["model_cache"] and already_trained:

        # Cari snapshot yang matching hash ini
        from utils.user_helpers import load_user
        user = load_user(username)
        snapshots = user.get("snapshots", []) if user else []
        snap = next((s for s in snapshots if s.get("hash") == file_hash), None)

        if snap:
            # Restore model dari snapshot yang matching
            restore_snapshot(username, snap["id"])
        
        reload_all_globals(final_path, username=username)

        return jsonify(
            {
                "status": "skipped",
                "filename": filename,
                "message": "Dataset sudah pernah di-train",
                "trained_at": snap.get("trained_at", "") if snap else "",
            }
        )

    # =========================
    # CEK QUOTA SNAPSHOT
    # =========================
    skip_snapshot = request.form.get("skip_snapshot", "false").lower() == "true"

    if not skip_snapshot:

        quota = check_snapshot_quota(username, file_hash)

        if not quota["allowed"]:

            return jsonify(
                {
                    "status": "snapshot_full",
                    "message": "Slot snapshot penuh. Kelola snapshot atau lanjut tanpa menyimpan.",
                    "snapshot_count": quota["count"],
                    "snapshot_limit": quota["limit"],
                    "tier": quota["tier"],
                }
            ), 200

    # =========================
    # START TRAIN
    # =========================
    with train_lock:
        train_progress[username] = {
            "running": True,
            "step": "Memulai training...",
            "done": False,
            "error": None,
            "log": [],
            "cancel": False,
            "skip_snapshot": skip_snapshot,
        }

    threading.Thread(
        target=worker_retrain,
        args=(username, final_path, train_progress, train_lock),
        daemon=True,
    ).start()

    return jsonify(
        {"status": "started", "filename": filename, "message": "Training dimulai"}
    )


# =========================
# TRAIN PROGRESS
# =========================
@upload_bp.route("/train_progress")
def get_train_progress():

    username = session.get("username")

    with train_lock:

        p = train_progress.get(
            username,
            {
                "running": False,
                "step": "",
                "done": False,
                "cancelled": False,
                "error": None,
                "log": [],
            },
        )

    return jsonify(p)


# =========================
# CANCEL TRAINING
# =========================
@upload_bp.route("/cancel_training", methods=["POST"])
def cancel_training():

    username = session.get("username")

    with train_lock:

        if username in train_progress:

            train_progress[username]["cancel"] = True

    return jsonify({"status": "cancel_requested"})


# =========================
# CLEAR TRAIN PROGRESS
# =========================
@upload_bp.route("/clear_train_progress", methods=["POST"])
def clear_train_progress():

    username = session.get("username")

    with train_lock:

        train_progress.pop(username, None)

    return jsonify({"status": "cleared"})


# =========================
# CANCEL UPLOAD
# =========================
@upload_bp.route("/cancel_upload", methods=["POST"])
def cancel_upload():

    pending_path = session.pop("pending_dataset", None)

    if pending_path and os.path.exists(pending_path):

        os.remove(pending_path)

    return jsonify({"status": "cancelled"})


# =========================
# DATASET INFO
# =========================
@upload_bp.route("/dataset_info")
def dataset_info():

    return jsonify(
        {
            "filename": os.path.basename(get_active_dataset_path_for_user()),
            "rows": 0,
            "is_custom": get_active_dataset_path_for_user() != DEFAULT_DATASET,
        }
    )


# =========================
# DOWNLOAD TEMPLATE
# =========================
@upload_bp.route("/download_template")
def download_template():
    path = os.path.join("Dataset", "NASA Bawean Hourly.csv")
    return send_file(
        os.path.abspath(path), as_attachment=True, download_name="template_dataset.csv"
    )