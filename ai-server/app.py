from flask import Flask, jsonify, request

# from dotenv import load_dotenv
# import os

# load_dotenv()

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
# UTILS
# =========================
from utils.dataset import *

# =========================
# FEATURE ENGINEERING
# =========================
from training.feature_engineering import *

# =========================
# LOAD MODEL
# =========================
from training.load_ml import (
    init_ml_state
)

from training.load_dl import (
    init_dl_models
)

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

# =========================
# LOAD DATASET
# =========================
_dataset_path = get_active_dataset_path()
df = load_and_engineer(
    _dataset_path,
    target_var=TARGET    # ✅ tambah ini
)
print(
    f"✅ Dataset loaded: "
    f"{_dataset_path} "
    f"({len(df)} rows)"
)

# =========================
# INIT ML
# =========================
ml_state = init_ml_state(df)
gbr      = ml_state["gbr"]
xgb      = ml_state["xgb"]
knn      = ml_state["knn"]
scaler   = ml_state["scaler"]
FEATURES = ml_state["FEATURES"]
ML_READY = ml_state["ML_READY"]
X        = ml_state["X"]
y        = ml_state["y"]
data_ml  = ml_state["data_ml"]
print(f"✅ ML Ready: {ML_READY}")

# =========================
# INIT DL
# =========================
dl_state      = init_dl_models(df, target_var=TARGET)    # ✅ tambah ini
lstm          = dl_state["lstm"]
bilstm        = dl_state["bilstm"]
scaler_X      = dl_state["scaler_X"]
scaler_y      = dl_state["scaler_y"]
X_scaled      = dl_state["X_scaled"]
data_seq      = dl_state["data_seq"]
DL_INPUT_COLS = dl_state["DL_INPUT_COLS"]
DL_READY      = dl_state["DL_READY"]
is_circular = dl_state.get("is_circular", False)

# =========================
# LOAD METRICS
# =========================
metrics    = {}
metrics_dl = {}

print(
    f"✅ Metrics loaded | "
    f"ML={list(metrics.keys())} | "
    f"DL={list(metrics_dl.keys())}"
)

# =========================
# RUN APP
# =========================
if __name__ == "__main__":

    app.run(
        debug=True
    )