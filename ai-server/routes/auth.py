from flask import Blueprint, request, jsonify, session
import json
import os
from config import USER_FOLDER
from utils.recaptcha import verify_recaptcha
from utils.progress import (
    generate_progress,
    train_progress,
    progress_lock,
    train_lock
)
from utils.user_helpers import load_user, save_user, user_path

auth_bp = Blueprint("auth_bp", __name__)

ADMINS_FILE = "admins.json"

# Default admin
DEFAULT_ADMINS = [
    {
        "username": "admin",
        "password": "admin123",
        "role":     "admin",
        "name":     "Administrator"
    }
]


# =========================
# LOAD / SAVE HELPERS
# =========================

def load_admins():
    if os.path.exists(ADMINS_FILE):
        with open(ADMINS_FILE, "r") as f:
            return json.load(f)
    with open(ADMINS_FILE, "w") as f:
        json.dump(DEFAULT_ADMINS, f, indent=2)
    return DEFAULT_ADMINS


def delete_user(username: str) -> bool:
    """Hapus file JSON user. Return True kalau berhasil."""
    path = user_path(username)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


def load_all_users() -> list[dict]:
    """Load semua user dari folder USER_FOLDER."""
    if not os.path.exists(USER_FOLDER):
        return []
    users = []
    for filename in os.listdir(USER_FOLDER):
        if filename.endswith(".json"):
            with open(os.path.join(USER_FOLDER, filename), "r") as f:
                try:
                    users.append(json.load(f))
                except json.JSONDecodeError:
                    pass
    return users


def username_exists(username: str) -> bool:
    """Cek apakah username sudah dipakai (user atau admin)."""
    if os.path.exists(user_path(username)):
        return True
    return any(a["username"] == username for a in load_admins())


def email_exists(email: str, exclude_username: str = "") -> bool:
    """Cek apakah email sudah dipakai user lain."""
    for filename in os.listdir(USER_FOLDER) if os.path.exists(USER_FOLDER) else []:
        if not filename.endswith(".json"):
            continue
        with open(os.path.join(USER_FOLDER, filename), "r") as f:
            try:
                u = json.load(f)
                if u.get("email") == email and u["username"] != exclude_username:
                    return True
            except json.JSONDecodeError:
                pass
    return False


# =========================
# REGISTER (user only)
# =========================

@auth_bp.route("/register", methods=["POST"])
def register():
    data     = request.get_json()
    username = data.get("username", "").strip()
    email    = data.get("email", "").strip()
    password = data.get("password", "").strip()
    name     = data.get("name", username).strip()

    if not username or not email or not password:
        return jsonify({"success": False, "message": "All fields are required."}), 400

    if username_exists(username):
        return jsonify({"success": False, "message": "Username already taken."}), 400

    if email_exists(email):
        return jsonify({"success": False, "message": "Email already registered."}), 400

    new_user = {
        "username": username,
        "email":    email,
        "password": password,
        "role":     "user",
        "name":     name
    }

    save_user(new_user)

    return jsonify({"success": True, "message": f"Welcome {name}!"})


# =========================
# LOGIN (cek admin dulu, lalu user)
# =========================

@auth_bp.route("/login", methods=["POST"])
def login():
    data     = request.get_json()
    token    = data.get("token")
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    # if not verify_recaptcha(token):
    #     return jsonify({"success": False, "message": "Captcha verification failed."}), 400

    # Cek admin dulu
    admins = load_admins()
    found  = next(
        (a for a in admins if a["username"] == username and a["password"] == password),
        None
    )

    # Kalau bukan admin, cek user
    if not found:
        user = load_user(username)
        if user and user["password"] == password:
            found = user
    
    if not found:
        all_users = load_all_users()
        found = next(
            (u for u in all_users if u.get("email") == username and u["password"] == password),
            None
        )

    if not found:
        return jsonify({"success": False, "message": "Wrong username or password."}), 401

    # hapus session lama
    session.clear()

    # buat session baru
    session["username"] = found["username"]
    session["role"] = found["role"]
    session.modified = True

    print("LOGIN SESSION =", dict(session))

    return jsonify({
        "success":  True,
        "role":     found["role"],
        "name":     found["name"],
        "username": found["username"],
        "email":    found.get("email", ""),
        "dataset": found.get("active_dataset", ""),
        "avatar":   found.get("avatar", "")
    })

# =========================
# LOGOUT
# =========================
@auth_bp.route("/logout", methods=["POST"])
def logout():

    username = session.get("username")

    with progress_lock:
        generate_progress.pop(username, None)

    with train_lock:
        train_progress.pop(username, None)

    session.clear()

    return jsonify({
        "success": True
    })

# =========================
# UPDATE PROFILE (user only)
# =========================

@auth_bp.route("/update_profile", methods=["POST"])
def update_profile():
    data      = request.get_json()
    token     = data.get("token")
    username  = data.get("username", "").strip()
    new_name  = data.get("name", "").strip()
    new_email = data.get("email", "").strip()
    new_avatar = data.get("avatar", "").strip()
    
    # if not verify_recaptcha(token):
    #     return jsonify({"success": False, "message": "Captcha verification failed."}), 400

    if not username:
        return jsonify({"success": False, "message": "Username required."}), 400

    user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    if new_email and email_exists(new_email, exclude_username=username):
        return jsonify({"success": False, "message": "Email already used."}), 400

    if new_name:
        user["name"] = new_name
    if new_email:
        user["email"] = new_email
    if new_avatar:
        user["avatar"] = new_avatar
        print(f"DEBUG avatar length: {len(new_avatar)}")

    save_user(user)

    return jsonify({
        "success": True,
        "name":    user["name"],
        "email":   user.get("email", ""),
    })

# =========================
# CHANGE PASSWORD (user only)
# =========================
@auth_bp.route("/change_password", methods=["POST"])
def change_password():
    data = request.get_json()
    username = data.get("username", "").strip()
    current_password = data.get("current_password", "").strip()
    new_password = data.get("new_password", "").strip()

    if not username or not current_password or not new_password:
        return jsonify({"success": False, "message": "All fields required."}), 400

    user = load_user(username)
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404

    if user["password"] != current_password:
        return jsonify({"success": False, "message": "Password saat ini salah."}), 401

    user["password"] = new_password
    save_user(user)

    return jsonify({"success": True, "message": "Password berhasil diubah."})

# =========================
# GET USERS (user biasa aja)
# =========================

@auth_bp.route("/users", methods=["GET"])
def get_users():
    return jsonify(load_all_users())


# =========================
# GET ADMINS (opsional)
# =========================

@auth_bp.route("/admins", methods=["GET"])
def get_admins():
    return jsonify(load_admins())
