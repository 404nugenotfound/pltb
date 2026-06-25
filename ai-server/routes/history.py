from flask import Blueprint, request, jsonify, session
import os, json
from config import UPLOAD_FOLDER
from utils.registry import get_model_dir_for_user, get_snapshot_limit

history_bp = Blueprint("history_bp", __name__)

# =========================
# TIER LIMITS
# =========================
TIER_LIMITS = {
    "free":     125 * 1024 * 1024,   # 125 MB
    "basic":    550 * 1024 * 1024,   # 550 MB
    "business": 2048 * 1024 * 1024,  # 2048 MB
}

def get_username():
    return request.headers.get("X-Username") or session.get("username")

def get_history_usage_bytes(user: dict) -> int:
    return len(json.dumps(user.get("history", [])).encode("utf-8"))


# =========================
# SAVE HISTORY
#=========================
@history_bp.route("/save_history", methods=["POST"])
def save_history():
    from utils.user_helpers import load_user, save_user
    from config import UPLOAD_FOLDER

    username = get_username()
    if not username:
        return jsonify({"success": False, "message": "Not logged in."}), 401

    user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data provided."}), 400

    tier = user.get("storage_tier", "free")
    limit = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

    # hitung usage sama persis dengan storage_info
    history_size = get_history_usage_bytes(user)

    csv_paths = set()
    for item in user.get("history", []):
        entry = item.get("entry", item)
        file_name = entry.get("file", "")
        if file_name:
            candidate = os.path.join(UPLOAD_FOLDER, file_name)
            if os.path.exists(candidate):
                csv_paths.add(candidate)

    csv_size = sum(os.path.getsize(p) for p in csv_paths)
    current_usage = history_size + csv_size
    new_entry_size = len(json.dumps(data).encode("utf-8"))

    if current_usage + new_entry_size > limit:
        return jsonify({
            "success": False,
            "message": "Storage penuh. Upgrade tier untuk menyimpan lebih banyak.",
            "storage_full": True,
            "tier": tier,
            "usage": current_usage,
            "limit": limit,
        }), 403

    if "history" not in user:
        user["history"] = []

    user["history"].insert(0, {"entry": data.get("entry", data)})
    save_user(user)

    return jsonify({"success": True, "message": "History saved"})


# =========================
# GET HISTORY
# =========================
@history_bp.route("/get_history", methods=["GET"])
def get_history():
    from utils.user_helpers import load_user

    username = get_username()

    if not username:
        return jsonify([]), 401

    user = load_user(username)

    if not user:
        return jsonify([]), 404

    history = user.get("history", [])

    result = []

    for item in history:
        if isinstance(item, dict) and "entry" in item:
            result.append(item["entry"])
        else:
            result.append(item)

    return jsonify(result)


# =========================
# STORAGE INFO
# =========================
@history_bp.route("/storage_info", methods=["GET"])
def storage_info():
    from utils.user_helpers import load_user
    from utils.dataset import get_active_dataset_path_for_user

    username = get_username()

    if not username:
        return jsonify({"success": False}), 401

    user = load_user(username)

    # TAMBAH INI
    import json

    if not user:
        return jsonify({"success": False}), 404

    tier = user.get("storage_tier", "free")
    limit = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

    # history size
    history_size = get_history_usage_bytes(user)

    # csv size
    csv_paths = set()
    for item in user.get("history", []):
        entry = item.get("entry", item)
        file_name = entry.get("file", "")
        if file_name:
            candidate = os.path.join(UPLOAD_FOLDER, file_name)
            if os.path.exists(candidate):
                csv_paths.add(candidate)
                
    csv_size = sum(os.path.getsize(path) for path in csv_paths)
    
    from utils.registry import get_model_dir_for_user
    from config import MODEL_FOLDER
    import glob

    model_dir  = get_model_dir_for_user(username)
    model_size = 0
    if os.path.exists(model_dir):
        for fname in os.listdir(model_dir):
            fpath = os.path.join(model_dir, fname)
            if os.path.isfile(fpath):
                model_size += os.path.getsize(fpath)

    # snapshot size (models/snapshots/<username>/**)
    snap_base = os.path.join(MODEL_FOLDER, "snapshots", username)
    snap_size = 0
    if os.path.exists(snap_base):
        for fpath in glob.glob(os.path.join(snap_base, "**", "*"), recursive=True):
            if os.path.isfile(fpath):
                snap_size += os.path.getsize(fpath)

    # hash cache count
    hash_count = len(user.get("snapshots", []))

    usage = history_size + csv_size 

    print("HISTORY COUNT =", len(user.get("history", [])))
    print("HISTORY SIZE =", history_size)
    print("CSV SIZE =", csv_size)
    print("TOTAL USAGE =", usage)

    return jsonify({
        "success":    True,
        "tier":       tier,
        "usage":      usage,
        "limit":      limit,
        "usage_mb":   round(usage / 1024 / 1024, 4),
        "limit_mb":   round(limit / 1024 / 1024, 2),
        "percent":    round((usage / limit) * 100, 4),
        "history_mb": round(history_size / 1024 / 1024, 4),
        "csv_mb":     round(csv_size / 1024 / 1024, 4),
        "model_mb":   round(model_size / 1024 / 1024, 4),
        "snap_mb":    round(snap_size / 1024 / 1024, 4),
        "hash_count": hash_count,
        "snapshot_limit":  get_snapshot_limit(tier)
    })

# =========================
# UPGRADE TIER
# =========================
@history_bp.route("/upgrade_tier", methods=["POST"])
def upgrade_tier():
    from utils.user_helpers import load_user, save_user

    username = get_username()
    if not username:
        return jsonify({"success": False}), 401

    data = request.get_json()
        
    new_tier = data.get("tier")

    if new_tier not in TIER_LIMITS:
        return jsonify({"success": False, "message": "Tier tidak valid."}), 400

    user = load_user(username)
    if not user:
        return jsonify({"success": False}), 404

    user["storage_tier"] = new_tier
    save_user(user)

    return jsonify({
        "success": True,
        "tier": new_tier,
        "limit_mb": round(TIER_LIMITS[new_tier] / 1024 / 1024, 2),
    })


# =========================
# DELETE HISTORY
# =========================
@history_bp.route("/delete_history", methods=["DELETE"])
def delete_history():
    from utils.user_helpers import load_user, save_user

    username = get_username()
    if not username:
        return jsonify({"success": False}), 401

    entry_id = request.args.get("id")
    if not entry_id:
        return jsonify({"success": False, "message": "ID required."}), 400

    user = load_user(username)
    if not user:
        return jsonify({"success": False}), 404

    user["history"] = [
    h for h in user.get("history", [])
    if str((h.get("entry") or h).get("id")) != str(entry_id)
]
    save_user(user)

    return jsonify({"success": True})

# =========================
# DOWNLOAD CSV
# =========================
@history_bp.route("/download_history_csv", methods=["GET"])
def download_history_csv():
    from flask import send_file
    
    username = get_username()
    if not username:
        return jsonify({"success": False}), 401

    filename = request.args.get("file")
    if not filename:
        return jsonify({"success": False, "message": "Filename required"}), 400

    # ✅ Validasi — file harus ada di history user ini
    from utils.user_helpers import load_user
    user = load_user(username)
    if not user:
        return jsonify({"success": False}), 404

    history_files = set()
    for item in user.get("history", []):
        entry = item.get("entry", item)
        f = entry.get("file", "")
        if f:
            history_files.add(f)

    if filename not in history_files:
        return jsonify({"success": False, "message": "Akses ditolak"}), 403

    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(filepath):
        return jsonify({"success": False, "message": "File tidak ditemukan"}), 404

    return send_file(filepath, as_attachment=True, download_name=filename)