from flask import Flask, jsonify, request
from config import *
from flask_cors import CORS

# =========================
# ROUTES
# =========================
from routes.main_routes import main_bp
from routes.upload import upload_bp
from routes.generate import generate_bp
from routes.auth import auth_bp
from routes.history import history_bp
from routes.cache_settings import (
    cache_settings_bp
)
from routes.snapshot import snapshot_bp

# =========================
# APP INIT
# =========================
app = Flask(__name__)
CORS(
    app,
    supports_credentials=True,
    origins=["http://localhost:3000"],
    allow_headers=["Content-Type", "X-Username"],
    methods=["GET", "POST", "OPTIONS", "DELETE"]
)
app.secret_key = SECRET_KEY
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_HTTPONLY=True,
)

# =========================
# REGISTER BLUEPRINT
# =========================
app.register_blueprint(main_bp)
app.register_blueprint(upload_bp)
app.register_blueprint(generate_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(history_bp)
app.register_blueprint(cache_settings_bp)
app.register_blueprint(snapshot_bp)

print("✅ Server siap — model & dataset dimuat on-demand per-user saat request masuk")

# =========================
# RUN APP
# =========================
if __name__ == "__main__":
    app.run(debug=True)