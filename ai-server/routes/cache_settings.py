from flask import Blueprint, jsonify, request, session

from utils.cache_settings import (
    get_cache_settings,
    save_cache_settings
)

cache_settings_bp = Blueprint("cache_settings", __name__)


def get_username():
    return request.headers.get("X-Username") or session.get("username")


@cache_settings_bp.route("/cache_settings", methods=["GET"])
def get_settings():
    username = get_username()
    if not username:
        return jsonify({"success": False, "message": "Not logged in."}), 401

    return jsonify(get_cache_settings(username))


@cache_settings_bp.route("/cache_settings", methods=["POST"])
def update_settings():
    username = get_username()
    if not username:
        return jsonify({"success": False, "message": "Not logged in."}), 401

    data = request.json
    settings = get_cache_settings(username)

    settings["model_cache"] = data.get("model_cache", settings["model_cache"])
    settings["metrics_cache"] = data.get("metrics_cache", settings["metrics_cache"])

    save_cache_settings(settings, username)

    return jsonify({
        "success": True,
        "settings": settings
    })