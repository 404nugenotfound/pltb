from flask import Flask, render_template, request, send_file, redirect, url_for, session, jsonify
import os, json, shutil, traceback
import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.neighbors import KNeighborsRegressor
import numpy as np
from typing import Optional, Any
import threading
import time
from threading import Lock
from werkzeug.utils import secure_filename
import xgboost as xgb_lib
from typing import Any, Optional
import traceback

# =========================
# PROGRESS TRACKER
# =========================
generate_progress: dict = {
    "running":    False,
    "day":        0,
    "total":      31,
    "mode":       "",
    "start_time": 0.0,
    "done":       False,
    "nlp_report": None,
    "error":      None,
    "last_mode":  "general"
}

train_progress: dict = {
    "running": False,
    "step":    "",
    "done":    False,
    "error":   None,
    "log":     []
}

progress_lock = Lock()
train_lock    = Lock()

app = Flask(__name__)
app.secret_key = "ventara-secret-key-2025"

# =========================
# FOLDER SETUP
# =========================
UPLOAD_FOLDER  = "uploads"
MODEL_FOLDER   = "models"
ARCHIVE_FOLDER = "uploads/archive"

os.makedirs(UPLOAD_FOLDER,  exist_ok=True)
os.makedirs(MODEL_FOLDER,   exist_ok=True)
os.makedirs(ARCHIVE_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS      = {"csv"}
TARGET                  = "WS10M"
DEFAULT_DATASET         = "Dataset/NASA Bawean Hourly Full.csv"
ACTIVE_DATASET_FILE     = os.path.join(UPLOAD_FOLDER, "active_dataset.txt")
REQUIRED_COLUMNS        = ["YEAR", "MO", "DY", "HR", "WS10M"]
METRICS_CACHE           = f"{MODEL_FOLDER}/metrics_cache.json"
STEP: int               = 48

# =========================
# HELPER — DATASET PATH
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


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# =========================
# LOAD DATASET & FEATURE ENGINEERING
# =========================
def load_and_engineer(path: str) -> pd.DataFrame:
    _df = pd.read_csv(path)
    for lag in [1, 2, 3, 24]:
        _df[f"lag{lag}"] = _df[TARGET].shift(lag)
    _df["mean3"]  = _df[TARGET].rolling(3).mean()
    _df["mean24"] = _df[TARGET].rolling(24).mean()
    return _df.dropna().reset_index(drop=True)


# =========================
# LOAD DATASET AKTIF
# =========================
_dataset_path = get_active_dataset_path()
df            = load_and_engineer(_dataset_path)
print(f"✅ Dataset loaded: {_dataset_path} ({len(df)} rows)")

# =========================
# LOAD MODEL ML
# =========================
def load_ml_models() -> tuple:
    _gbr    = joblib.load(f"{MODEL_FOLDER}/gbr.pkl")
    _xgb    = joblib.load(f"{MODEL_FOLDER}/xgb.pkl")
    _knn    = joblib.load(f"{MODEL_FOLDER}/knn.pkl")
    _scaler = joblib.load(f"{MODEL_FOLDER}/scaler.pkl")
    _feats  = joblib.load(f"{MODEL_FOLDER}/features.pkl")
    return _gbr, _xgb, _knn, _scaler, _feats


gbr, xgb, knn, scaler, FEATURES = load_ml_models()

X       = np.array(df[FEATURES].values)
y       = np.array(df[TARGET].values)
data_ml = X[-1].reshape(1, -1)

# =========================
# DL SETUP
# =========================
DL_READY: bool = False

lstm: Any = None
bilstm: Any = None

scaler_X: Any = None
scaler_y: Any = None

X_scaled: Optional[np.ndarray] = None
data_seq: Optional[np.ndarray] = None

DL_INPUT_COLS: list[str] = []


# =========================
# INIT DL MODELS
# =========================
def init_dl_models(df_ref):

    try:
        from tensorflow.keras.models import load_model

        print("📦 Load DL model...")

        _lstm = load_model(
            os.path.join(MODEL_FOLDER, "lstm.h5")
        )

        _bilstm = load_model(
            os.path.join(MODEL_FOLDER, "bilstm.h5")
        )

        _scaler_X = joblib.load(
            os.path.join(MODEL_FOLDER, "scaler_X.pkl")
        )

        _scaler_y = joblib.load(
            os.path.join(MODEL_FOLDER, "scaler_y.pkl")
        )

        if hasattr(_scaler_X, "feature_names_in_"):
            _dl_cols = list(_scaler_X.feature_names_in_)
        else:
            _dl_cols = [
                c for c in df_ref.columns
                if c != TARGET
            ]

        missing = [
            c for c in _dl_cols
            if c not in df_ref.columns
        ]

        if missing:
            raise ValueError(
                f"Kolom DL tidak ada: {missing}"
            )

        _X_sc = np.array(
            _scaler_X.transform(
                df_ref[_dl_cols].copy()
            ),
            dtype=np.float32
        )

        if len(_X_sc) < STEP:
            raise ValueError(
                f"Data kurang dari STEP ({STEP})"
            )

        _data_seq = _X_sc[-STEP:].reshape(
            1,
            STEP,
            _X_sc.shape[1]
        )

        print(f"✅ DL siap | shape={_X_sc.shape}")

        return (
            _lstm,
            _bilstm,
            _scaler_X,
            _scaler_y,
            _X_sc,
            _data_seq,
            _dl_cols,
            True
        )

    except Exception as e:

        print(f"⚠️ DL tidak tersedia: {e}")
        traceback.print_exc()

        return (
            None,
            None,
            None,
            None,
            None,
            None,
            [],
            False
        )


# =========================
# INIT DL
# =========================
dl_result = init_dl_models(df)

# =========================
# VALIDASI CSV UPLOAD
# =========================
def validate_csv(path: str) -> dict:
    errors = []
    info   = {}
    try:
        df_check        = pd.read_csv(path, nrows=5)
        info["columns"] = list(df_check.columns)
        info["preview"] = df_check.to_dict(orient="records")

        missing = [c for c in REQUIRED_COLUMNS if c not in df_check.columns]
        if missing:
            errors.append(f"Kolom wajib tidak ada: {missing}")

        df_full       = pd.read_csv(path)
        info["rows"]  = len(df_full)
        info["cols"]  = len(df_full.columns)

        if len(df_full) < 200:
            errors.append(f"Data terlalu sedikit ({len(df_full)} baris). Minimal 200.")

        if TARGET in df_full.columns:
            nulls = int(df_full[TARGET].isna().sum())
            if nulls > 0:
                errors.append(f"Kolom {TARGET} punya {nulls} nilai kosong.")

        for col in REQUIRED_COLUMNS:
            if col in df_full.columns:
                if not pd.api.types.is_numeric_dtype(df_full[col]):
                    errors.append(f"Kolom {col} harus numerik.")

    except Exception as e:
        errors.append(f"Gagal membaca CSV: {str(e)}")

    return {"valid": len(errors) == 0, "errors": errors, "info": info}


# =========================
# METRICS HELPER
# =========================
def get_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    yt = np.array(y_true).flatten()
    yp = np.array(y_pred).flatten()
    return {
        "MAE":  round(float(mean_absolute_error(yt, yp)), 3),
        "RMSE": round(float(np.sqrt(mean_squared_error(yt, yp))), 3),
        "MAPE": round(float(np.mean(np.abs((yt - yp) / yt)) * 100), 2),
        "R2":   round(float(r2_score(yt, yp)), 3)
    }


def _compute_metrics_fresh() -> tuple:
    print("📊 Hitung metrics ML...")
    ml = {
        "GBR": get_metrics(y, gbr.predict(X)),
        "XGB": get_metrics(y, xgb.predict(X)),
        "KNN": get_metrics(y, knn.predict(scaler.transform(X)))
    }
    dl: dict = {}
    if DL_READY and X_scaled is not None:
        print("📊 Hitung metrics DL...")
        seqs          = np.array([X_scaled[i-STEP:i] for i in range(STEP, len(X_scaled))])
        y_dl          = y[STEP:].reshape(-1, 1)
        y_pred_lstm   = scaler_y.inverse_transform(lstm.predict(seqs, verbose=0))
        y_pred_bilstm = scaler_y.inverse_transform(bilstm.predict(seqs, verbose=0))
        dl["LSTM"]    = get_metrics(y_dl, y_pred_lstm)
        dl["BiLSTM"]  = get_metrics(y_dl, y_pred_bilstm)
        print("✅ Metrics DL selesai")
    return ml, dl


def load_or_compute_metrics() -> tuple:
    if os.path.exists(METRICS_CACHE):
        print("⚡ Load metrics dari cache...")
        with open(METRICS_CACHE, "r") as f:
            cache = json.load(f)
        if DL_READY and not cache.get("dl"):
            os.remove(METRICS_CACHE)
            return load_or_compute_metrics()
        return cache["ml"], cache.get("dl", {})
    print("🆕 Hitung metrics pertama kali...")
    ml, dl = _compute_metrics_fresh()
    with open(METRICS_CACHE, "w") as f:
        json.dump({"ml": ml, "dl": dl}, f, indent=2)
    return ml, dl


metrics, metrics_dl = load_or_compute_metrics()
print(f"✅ Metrics siap — ML: {list(metrics.keys())} | DL: {list(metrics_dl.keys())}")

# =========================
# HELPER FUNCTIONS
# =========================
def get_best_ml_and_dl(m_ml: dict, m_dl: dict) -> list:
    best_ml = min(m_ml, key=lambda m: m_ml[m]["MAPE"])
    result  = [best_ml]
    if m_dl:
        best_dl = min(m_dl, key=lambda m: m_dl[m]["MAPE"])
        result.append(best_dl)
    return result


def build_forecast_text(df_future: pd.DataFrame) -> dict:
    avg     = float(df_future[TARGET].mean())
    max_val = float(df_future[TARGET].max())
    min_val = float(df_future[TARGET].min())
    std_val = float(df_future[TARGET].std())
    hourly  = df_future.groupby("HR")[TARGET].mean()
    peak_hr = int(hourly.idxmax())
    low_hr  = int(hourly.idxmin())
    week1   = float(df_future.iloc[:168][TARGET].mean()) if len(df_future) >= 168 else avg
    week4   = float(df_future.iloc[-168:][TARGET].mean()) if len(df_future) >= 168 else avg

    if week4 > week1 + 0.1:   trend = "meningkat menuju akhir periode"
    elif week4 < week1 - 0.1: trend = "menurun menuju akhir periode"
    else:                      trend = "relatif stabil sepanjang periode"

    if avg < 1.5:    category = "tenang (calm)"
    elif avg < 3.3:  category = "angin sepoi ringan (light breeze)"
    elif avg < 5.5:  category = "angin sedang (gentle to moderate breeze)"
    elif avg < 8.0:  category = "angin segar (fresh to strong breeze)"
    else:            category = "angin kencang (near gale or above)"

    return {
        "avg": avg, "max_val": max_val, "min_val": min_val,
        "std_val": std_val, "peak_hr": peak_hr, "low_hr": low_hr,
        "trend": trend, "category": category
    }


def generate_nlp_report(stats: dict, best_model_name: str, best_met: dict) -> str:
    mape_raw = str(best_met.get("MAPE", "-")).replace(",", ".").replace("%", "").strip()
    rmse_raw = str(best_met.get("RMSE", "-")).replace(",", ".").strip()

    if mape_raw.lower() in ("-", "", "nan", "none"):
        mape_str = "N/A"
        akurasi  = "tidak tersedia"
    else:
        mape     = float(mape_raw)
        akurasi  = "tinggi" if mape < 10 else "cukup" if mape < 20 else "rendah"
        mape_str = f"{mape:.2f}%"

    rmse_str = "N/A" if rmse_raw.lower() in ("-", "", "nan", "none") else rmse_raw

    return (
        f"Prediksi kecepatan angin di Pulau Bawean untuk periode Januari 2025 "
        f"menunjukkan rata-rata {stats['avg']:.2f} m/s, "
        f"termasuk kategori {stats['category']}. "
        f"Kecepatan tertinggi mencapai {stats['max_val']:.2f} m/s "
        f"dan terendah {stats['min_val']:.2f} m/s "
        f"dengan standar deviasi {stats['std_val']:.2f} m/s. "
        f"Angin cenderung terkencang sekitar pukul {stats['peak_hr']:02d}:00 "
        f"dan terlemah sekitar pukul {stats['low_hr']:02d}:00. "
        f"Tren keseluruhan: {stats['trend']}. "
        f"\n\nModel terbaik adalah {best_model_name} "
        f"dengan MAPE {mape_str} dan RMSE {rmse_str}. "
        f"Tingkat akurasi: {akurasi}."
    )


# =========================
# BACKGROUND WORKER — RETRAIN SEMUA MODEL
# =========================
def _worker_retrain(dataset_path: str) -> None:
    global df, X, y, data_ml, gbr, xgb, knn, scaler, FEATURES
    global lstm, bilstm, scaler_X, scaler_y, X_scaled, data_seq
    global DL_INPUT_COLS, DL_READY, metrics, metrics_dl

    def log(msg: str) -> None:
        print(msg)
        with train_lock:
            train_progress["step"] = msg
            train_progress["log"].append(msg)

    try:
        # 1. Load dataset
        log("📂 Load dataset baru...")
        _df = load_and_engineer(dataset_path)
        log(f"✅ Dataset: {len(_df)} baris")

        # 2. Siapkan fitur
        lag_cols  = ["lag1", "lag2", "lag3", "lag24"]
        roll_cols = ["mean3", "mean24"]
        time_cols = ["HR", "DY", "MO", "YEAR"]
        extra_cols = [
            c for c in _df.columns
            if c not in [TARGET] + lag_cols + roll_cols + time_cols
            and pd.api.types.is_numeric_dtype(_df[c])
        ]
        _features = [f for f in time_cols + extra_cols + lag_cols + roll_cols
                     if f in _df.columns]
        _X = np.array(_df[_features].values)
        _y = np.array(_df[TARGET].values)
        log(f"📋 Fitur ({len(_features)}): {_features}")

        # 3. Train GBR
        log("🔧 Training GBR...")
        _gbr = GradientBoostingRegressor(
            n_estimators=200, learning_rate=0.05, max_depth=4, random_state=42
        )
        _gbr.fit(_X, _y)
        joblib.dump(_gbr, f"{MODEL_FOLDER}/gbr.pkl")
        log("✅ GBR selesai")

        # 4. Train XGBoost
        log("🔧 Training XGBoost...")
        _xgb = xgb_lib.XGBRegressor(
            n_estimators=300, learning_rate=0.05,
            max_depth=5, random_state=42, verbosity=0
        )
        _xgb.fit(_X, _y)
        joblib.dump(_xgb, f"{MODEL_FOLDER}/xgb.pkl")
        log("✅ XGBoost selesai")

        # 5. Train KNN
        log("🔧 Training KNN...")
        _scaler = MinMaxScaler()
        _X_knn  = _scaler.fit_transform(_X)
        _knn    = KNeighborsRegressor(n_neighbors=5, metric="euclidean")
        _knn.fit(_X_knn, _y)
        joblib.dump(_knn,    f"{MODEL_FOLDER}/knn.pkl")
        joblib.dump(_scaler, f"{MODEL_FOLDER}/scaler.pkl")
        joblib.dump(_features, f"{MODEL_FOLDER}/features.pkl")
        log("✅ KNN selesai")

        # 6. Train LSTM & BiLSTM
        log("🔧 Training LSTM & BiLSTM...")
        try:
            import tensorflow as tf
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import LSTM as KerasLSTM, Bidirectional, Dense, Dropout
            from tensorflow.keras.callbacks import EarlyStopping

            _dl_cols  = [c for c in _df.columns if c != TARGET]
            _scaler_X_new = MinMaxScaler()
            _scaler_y_new = MinMaxScaler()
            _X_dl_sc  = _scaler_X_new.fit_transform(_df[_dl_cols].values).astype(np.float32)
            _y_dl_sc  = _scaler_y_new.fit_transform(_y.reshape(-1, 1)).astype(np.float32)

            _seqs, _targets = [], []
            for i in range(STEP, len(_X_dl_sc)):
                _seqs.append(_X_dl_sc[i - STEP:i])
                _targets.append(_y_dl_sc[i])
            _seqs    = np.array(_seqs,    dtype=np.float32)
            _targets = np.array(_targets, dtype=np.float32)

            n_feat = _seqs.shape[2]
            es     = EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)

            # LSTM
            log("🔧 Build LSTM...")
            _lstm_m = Sequential([
                KerasLSTM(64, input_shape=(STEP, n_feat)),
                Dropout(0.2),
                Dense(32, activation="relu"),
                Dense(1)
            ])
            _lstm_m.compile(optimizer="adam", loss="mse")
            _lstm_m.fit(_seqs, _targets, epochs=50, batch_size=64,
                        validation_split=0.1, callbacks=[es], verbose=0)
            _lstm_m.save(f"{MODEL_FOLDER}/lstm.h5")
            log("✅ LSTM selesai")

            # BiLSTM
            log("🔧 Build BiLSTM...")
            _bilstm_m = Sequential([
                Bidirectional(KerasLSTM(64), input_shape=(STEP, n_feat)),
                Dropout(0.2),
                Dense(32, activation="relu"),
                Dense(1)
            ])
            _bilstm_m.compile(optimizer="adam", loss="mse")
            _bilstm_m.fit(_seqs, _targets, epochs=50, batch_size=64,
                          validation_split=0.1, callbacks=[es], verbose=0)
            _bilstm_m.save(f"{MODEL_FOLDER}/bilstm.h5")
            log("✅ BiLSTM selesai")

            joblib.dump(_scaler_X_new, f"{MODEL_FOLDER}/scaler_X.pkl")
            joblib.dump(_scaler_y_new, f"{MODEL_FOLDER}/scaler_y.pkl")

        except Exception as dl_err:
            log(f"⚠️ DL training gagal: {dl_err}")
            traceback.print_exc()

        # 7. Update globals
        log("🔄 Update globals...")
        df       = _df
        X        = _X
        y        = _y
        data_ml  = _X[-1].reshape(1, -1)
        gbr      = _gbr
        xgb      = _xgb
        knn      = _knn
        scaler   = _scaler
        FEATURES = _features

        (lstm, bilstm, scaler_X, scaler_y,
         X_scaled, data_seq, DL_INPUT_COLS, DL_READY) = init_dl_models(df)

        if os.path.exists(METRICS_CACHE):
            os.remove(METRICS_CACHE)
        metrics, metrics_dl = load_or_compute_metrics()
        set_active_dataset_path(dataset_path)

        log("🎉 Retrain selesai!")
        with train_lock:
            train_progress.update({
                "running": False, "done": True,
                "error": None, "step": "Selesai"
            })

    except Exception as e:
        print(f"❌ Retrain error: {traceback.format_exc()}")
        with train_lock:
            train_progress.update({
                "running": False, "done": True,
                "error": str(e), "step": "Error"
            })


# =========================
# ROUTES — UPLOAD & TRAINING
# =========================
@app.route("/upload_dataset", methods=["POST"])
def upload_dataset():

    # =========================
    # VALIDASI FILE
    # =========================
    if "dataset" not in request.files:
        return jsonify({
            "status": "error",
            "message": "Tidak ada dataset"
        }), 400

    file = request.files["dataset"]

    raw_filename = file.filename or ""

    if raw_filename == "":
        return jsonify({
            "status": "error",
            "message": "Filename kosong"
        }), 400

    if not allowed_file(raw_filename):
        return jsonify({
            "status": "error",
            "message": "File harus .csv"
        }), 400

    # =========================
    # SAVE FILE
    # =========================
    filename = secure_filename(raw_filename)

    pending_path = os.path.join(
        UPLOAD_FOLDER,
        f"pending_{filename}"
    )

    file.save(pending_path)

    # =========================
    # VALIDATE CSV
    # =========================
    validation = validate_csv(pending_path)

    if not validation["valid"]:

        # hapus file invalid
        if os.path.exists(pending_path):
            os.remove(pending_path)

        return jsonify({
            "status": "invalid",
            "errors": validation["errors"],
            "info": validation["info"]
        }), 422

    # =========================
    # FINAL PATH
    # =========================
    final_name = os.path.basename(pending_path).replace("pending_", "")
    final_path = os.path.join(UPLOAD_FOLDER, final_name)

    shutil.move(pending_path, final_path)

    # =========================
    # START AUTO TRAINING
    # =========================
    with train_lock:
        train_progress.update({
            "running": True,
            "step": "Memulai training...",
            "done": False,
            "error": None,
            "log": []
        })

    threading.Thread(
        target=_worker_retrain,
        args=(final_path,),
        daemon=True
    ).start()

    # =========================
    # RESPONSE
    # =========================
    return jsonify({
        "status": "valid",
        "filename": filename,
        "info": validation["info"],
        "message": "Dataset valid. Training model dimulai..."
    })


@app.route("/start_training", methods=["POST"])
def start_training():
    with train_lock:
        if train_progress.get("running"):
            return jsonify({"status": "already_running"}), 409

    pending_path = session.get("pending_dataset")
    if not pending_path or not os.path.exists(pending_path):
        return jsonify({"error": "Tidak ada dataset pending. Upload dulu."}), 400

    # Arsip dataset lama
    current_path = get_active_dataset_path()
    if current_path and os.path.exists(current_path) and current_path != DEFAULT_DATASET:
        archive_name = f"archive_{int(time.time())}_{os.path.basename(current_path)}"
        shutil.move(current_path, os.path.join(ARCHIVE_FOLDER, archive_name))
        print(f"📦 Dataset lama diarsip")

    # Pending → aktif
    final_name = os.path.basename(pending_path).replace("pending_", "")
    final_path = os.path.join(UPLOAD_FOLDER, final_name)
    shutil.move(pending_path, final_path)
    session.pop("pending_dataset", None)

    with train_lock:
        train_progress.update({
            "running": True, "step": "Memulai training...",
            "done": False, "error": None, "log": []
        })

    threading.Thread(target=_worker_retrain, args=(final_path,), daemon=True).start()
    return jsonify({"status": "started"})


@app.route("/train_progress")
def get_train_progress():
    with train_lock:
        p = train_progress.copy()
    return jsonify(p)


@app.route("/cancel_upload", methods=["POST"])
def cancel_upload():
    pending_path = session.pop("pending_dataset", None)
    if pending_path and os.path.exists(pending_path):
        os.remove(pending_path)
    return jsonify({"status": "cancelled"})


@app.route("/dataset_info")
def dataset_info():
    return jsonify({
        "filename":  os.path.basename(get_active_dataset_path()),
        "rows":      len(df),
        "is_custom": get_active_dataset_path() != DEFAULT_DATASET,
        "features":  FEATURES
    })


# =========================
# ROUTE UTAMA
# =========================
@app.route("/", methods=["GET", "POST"])
def index():
    result:       list = []
    selected_model: str = session.get("selected_model", "all")
    nlp_report          = session.get("nlp_report", None)
    last_gen_mode       = session.get("last_generate_mode", "general")

    all_metrics      = {**metrics, **metrics_dl}
    best_model_names = get_best_ml_and_dl(metrics, metrics_dl)
    all_keys         = list(metrics.keys()) + list(metrics_dl.keys())
    ordered_models   = all_keys

    if selected_model == "best":
        rest           = [m for m in all_keys if m not in best_model_names]
        ordered_models = best_model_names + rest

    if request.method == "POST":
        selected_model = request.form.get("model", "all")
        session["selected_model"] = selected_model
        session.pop("nlp_report", None)
        nlp_report = None

        if selected_model == "best":
            rest           = [m for m in all_keys if m not in best_model_names]
            ordered_models = best_model_names + rest
        else:
            ordered_models = all_keys

        active_models = best_model_names if selected_model == "best" else all_keys
        actual        = float(y[-1])

        def add_row(name: str, pred: float) -> None:
            result.append({
                "model":      name,
                "prediction": round(float(pred), 3),
                "actual":     round(actual, 3),
                "error":      round(abs(float(pred) - actual), 3)
            })

        if "GBR" in active_models: add_row("GBR", gbr.predict(data_ml)[0])
        if "XGB" in active_models: add_row("XGB", xgb.predict(data_ml)[0])
        if "KNN" in active_models: add_row("KNN", knn.predict(scaler.transform(data_ml))[0])

        if DL_READY and data_seq is not None:
            if "LSTM"   in active_models:
                add_row("LSTM",   scaler_y.inverse_transform(lstm.predict(data_seq,   verbose=0))[0][0])
            if "BiLSTM" in active_models:
                add_row("BiLSTM", scaler_y.inverse_transform(bilstm.predict(data_seq, verbose=0))[0][0])

        result = sorted(result, key=lambda x: x["error"])
        if result:
            pd.DataFrame(result).to_csv("hasil_prediksi.csv", index=False)

    return render_template(
        "index.html",
        result=result,
        all_metrics=all_metrics,
        metrics=all_metrics,
        selected_model=selected_model,
        nlp_report=nlp_report,
        last_generate_mode=last_gen_mode,
        best_model_names=best_model_names,
        ordered_models=ordered_models,
        dataset_name=os.path.basename(get_active_dataset_path()),
        is_custom_dataset=get_active_dataset_path() != DEFAULT_DATASET
    )


@app.route("/overview", methods=["GET", "POST"])
def overview():
    selected_model   = session.get("selected_model", "all")
    nlp_report       = session.get("nlp_report", None)
    all_metrics      = {**metrics, **metrics_dl}
    best_model_names = get_best_ml_and_dl(metrics, metrics_dl)
    all_keys         = list(metrics.keys()) + list(metrics_dl.keys())
    labels           = [f"{i}:00" for i in range(24)]
    actual_data      = y[-24:].tolist()
    gbr_data         = gbr.predict(X[-24:]).tolist()
    xgb_data         = xgb.predict(X[-24:]).tolist()
    knn_data         = knn.predict(scaler.transform(X[-24:])).tolist()

    return render_template(
        "overview.html",
        result=[], all_metrics=all_metrics, metrics=all_metrics,
        selected_model=selected_model, nlp_report=nlp_report,
        best_model_names=best_model_names, ordered_models=all_keys,
        labels=labels, actual_data=actual_data,
        gbr_data=gbr_data, xgb_data=xgb_data, knn_data=knn_data
    )


@app.route("/analitik")
def analitik():
    return render_template("analitik.html")

@app.route("/underMaintenance")
def underMaintenance():
    return render_template("underMaintenance.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/reset_nlp", methods=["POST"])
def reset_nlp():
    session.pop("nlp_report", None)
    session.pop("last_generate_mode", None)
    session.modified = True
    return jsonify({"status": "ok"})


# =========================
# ROUTE PROGRESS GENERATE
# =========================
@app.route("/generate_progress")
def get_progress():
    with progress_lock:
        p = generate_progress.copy()
    elapsed = time.time() - p["start_time"] if p.get("start_time") else 0
    day     = p.get("day", 0)
    total   = p.get("total", 31)
    eta_str = (
        f"{int(max(0,(total-day)*(elapsed/day))//60)}m "
        f"{int(max(0,(total-day)*(elapsed/day))%60)}s"
        if day > 0 and elapsed > 0 else "Menghitung..."
    )
    return jsonify({
        "running":    p.get("running", False),
        "done":       p.get("done", False),
        "day":        day, "total": total,
        "mode":       p.get("mode", ""),
        "eta":        eta_str,
        "elapsed":    f"{int(elapsed//60)}m {int(elapsed%60)}s",
        "error":      p.get("error"),
        "nlp_report": p.get("nlp_report"),
        "last_mode":  p.get("last_mode", "general")
    })


@app.route("/generate_commit", methods=["POST"])
def generate_commit():
    with progress_lock:
        p = generate_progress.copy()
    if p.get("done") and p.get("nlp_report"):
        session["nlp_report"]         = p["nlp_report"]
        session["last_generate_mode"] = p.get("last_mode", "general")
        session.modified = True
        return jsonify({"status": "ok"})
    return jsonify({"status": "no_data"}), 400


# =========================
# BACKGROUND WORKER — GENERATE FULL
# =========================
def _worker_generate_full(selected_model: str, active_models: list) -> None:
    try:
        np.random.seed(42)
        df_out = df.copy()

        if "GBR" in active_models: df_out["GBR"] = gbr.predict(X)
        if "XGB" in active_models: df_out["XGB"] = xgb.predict(X)
        if "KNN" in active_models: df_out["KNN"] = knn.predict(scaler.transform(X))

        need_dl = DL_READY and X_scaled is not None and any(
            m in active_models for m in ["LSTM", "BiLSTM"]
        )
        if (
            need_dl
            and X_scaled is not None
            and scaler_y is not None
            and lstm is not None
            and bilstm is not None
        ):

            seqs_hist = np.array([
                X_scaled[i-STEP:i]
                for i in range(STEP, len(X_scaled))
            ])

            lstm_preds = scaler_y.inverse_transform(
                lstm.predict(seqs_hist, verbose=0)
            ).flatten()

            bilstm_preds = scaler_y.inverse_transform(
                bilstm.predict(seqs_hist, verbose=0)
            ).flatten()

            df_out["LSTM"] = np.nan
            df_out["BiLSTM"] = np.nan

            if "LSTM" in active_models:
                df_out.loc[df_out.index[STEP:], "LSTM"] = lstm_preds

            if "BiLSTM" in active_models:
                df_out.loc[df_out.index[STEP:], "BiLSTM"] = bilstm_preds
                
        future_steps  = 24 * 31
        target_series = df[TARGET].tolist()
        last_row_dict = df.iloc[-1].to_dict()
        last_time     = pd.Timestamp(
            year=int(last_row_dict["YEAR"]), month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),   hour=int(last_row_dict["HR"])
        )
        history_window = df.tail(STEP).copy().reset_index(drop=True)
        future_rows    = []

        for i in range(future_steps):
            if i % 24 == 0:
                with progress_lock:
                    generate_progress["day"] = (i // 24) + 1
                print(f"⏳ Day {(i//24)+1}/31")

            next_time = last_time + pd.Timedelta(hours=i + 1)
            lag1  = target_series[-1];  lag2  = target_series[-2]
            lag3  = target_series[-3];  lag24 = target_series[-24]
            mean3  = float(np.mean(target_series[-3:]))
            mean24 = float(np.mean(target_series[-24:]))

            fv: list = []
            for col in FEATURES:
                if   col == "lag1":   fv.append(lag1)
                elif col == "lag2":   fv.append(lag2)
                elif col == "lag3":   fv.append(lag3)
                elif col == "lag24":  fv.append(lag24)
                elif col == "mean3":  fv.append(mean3)
                elif col == "mean24": fv.append(mean24)
                elif col == "HR":     fv.append(int(next_time.hour))
                elif col == "DY":     fv.append(int(next_time.day))
                elif col == "MO":     fv.append(int(next_time.month))
                elif col == "YEAR":   fv.append(int(next_time.year))
                else:                 fv.append(float(last_row_dict.get(col, 0.0)))

            X_fut    = np.array(fv, dtype=np.float32).reshape(1, -1)
            pred_gbr = float(gbr.predict(X_fut)[0])                    if "GBR" in active_models else float("nan")
            pred_xgb = float(xgb.predict(X_fut)[0])                    if "XGB" in active_models else float("nan")
            pred_knn = float(knn.predict(scaler.transform(X_fut))[0])  if "KNN" in active_models else float("nan")

            anchor = pred_gbr
            if np.isnan(anchor): anchor = pred_xgb
            if np.isnan(anchor): anchor = pred_knn
            if np.isnan(anchor): anchor = lag1

            pred_lstm = pred_bilstm = float("nan")
            if need_dl and any(m in active_models for m in ["LSTM", "BiLSTM"]):
                try:
                    new_row = history_window.iloc[-1].copy()
                    new_row["YEAR"]  = int(next_time.year)
                    new_row["MO"]    = int(next_time.month)
                    new_row["DY"]    = int(next_time.day)
                    new_row["HR"]    = int(next_time.hour)

                    new_row[TARGET]  = anchor

                    new_row["lag1"]  = lag1
                    new_row["lag2"]  = lag2
                    new_row["lag3"]  = lag3
                    new_row["lag24"] = lag24

                    new_row["mean3"]  = mean3
                    new_row["mean24"] = mean24
                    
                    history_window = pd.concat(
                        [history_window.iloc[1:], pd.DataFrame([new_row])],
                        ignore_index=True
                    )
                    window_sc  = scaler_X.transform(history_window[DL_INPUT_COLS].values)
                    seq_future = window_sc.reshape(1, STEP, window_sc.shape[1])
                    if "LSTM"   in active_models:
                        pred_lstm   = float(scaler_y.inverse_transform(lstm.predict(seq_future,   verbose=0))[0][0])
                    if "BiLSTM" in active_models:
                        pred_bilstm = float(scaler_y.inverse_transform(bilstm.predict(seq_future, verbose=0))[0][0])
                except Exception as dl_err:
                    print(f"⚠️ DL skip iter {i}: {dl_err}")

            target_series.append(anchor)
            row: dict = {
                "YEAR": int(next_time.year), "MO": int(next_time.month),
                "DY":   int(next_time.day),  "HR": int(next_time.hour),
                TARGET: round(anchor, 3),
            }
            if "GBR"    in active_models: row["GBR"]    = round(pred_gbr,    3) if not np.isnan(pred_gbr)    else np.nan
            if "XGB"    in active_models: row["XGB"]    = round(pred_xgb,    3) if not np.isnan(pred_xgb)    else np.nan
            if "KNN"    in active_models: row["KNN"]    = round(pred_knn,    3) if not np.isnan(pred_knn)    else np.nan
            if "LSTM"   in active_models: row["LSTM"]   = round(pred_lstm,   3) if not np.isnan(pred_lstm)   else np.nan
            if "BiLSTM" in active_models: row["BiLSTM"] = round(pred_bilstm, 3) if not np.isnan(pred_bilstm) else np.nan
            future_rows.append(row)

        df_future  = pd.DataFrame(future_rows)
        df_out     = pd.concat([df_out, df_future], ignore_index=True)
        stats      = build_forecast_text(df_future.copy())
        best_name  = get_best_ml_and_dl(metrics, metrics_dl)[0]
        nlp_report = generate_nlp_report(stats, best_name, {**metrics, **metrics_dl}[best_name])

        base_cols = ["YEAR", "MO", "DY", "HR", TARGET]
        pred_cols = [c for c in ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"] if c in df_out.columns]
        df_out    = df_out[base_cols + pred_cols]
        for col in ["YEAR", "MO", "DY", "HR"]:
            df_out[col] = df_out[col].astype(int)
        for col in df_out.select_dtypes(include=[np.number]).columns:
            df_out[col] = df_out[col].round(3)
            df_out[col] = df_out[col].astype(str).str.replace(".", ",", regex=False)

        with open("hasil_prediksi_general.csv", "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write(f"Dataset: {os.path.basename(get_active_dataset_path())}\n")
            f.write(f"Forecast Summary:\n{nlp_report}\n\n-END HEADER-\n\n")
            df_out.to_csv(f, index=False, sep=";")

        with progress_lock:
            generate_progress.update({
                "running": False, "done": True,
                "nlp_report": nlp_report, "last_mode": "general", "error": None
            })

    except Exception as e:
        print(f"❌ Worker error: {traceback.format_exc()}")
        with progress_lock:
            generate_progress.update({
                "running": False, "done": True, "nlp_report": None, "error": str(e)
            })


# =========================
# BACKGROUND WORKER — GENERATE BEST
# =========================
def _worker_generate_best() -> None:
    try:
        # Load fresh di thread ini — hindari TF cross-thread issue
        from tensorflow.keras.models import load_model as _load
        _lstm     = _load(f"{MODEL_FOLDER}/lstm.h5")
        _scaler_X = joblib.load(f"{MODEL_FOLDER}/scaler_X.pkl")
        _scaler_y = joblib.load(f"{MODEL_FOLDER}/scaler_y.pkl")
        _dl_cols  = DL_INPUT_COLS if DL_INPUT_COLS else [c for c in df.columns if c != TARGET]

        np.random.seed(42)
        df_out          = df.copy()
        df_out["XGB_Base"] = xgb.predict(X)

        _X_sc     = np.array(_scaler_X.transform(df[_dl_cols].values), dtype=np.float32)
        seqs_hist = np.array([_X_sc[i-STEP:i] for i in range(STEP, len(_X_sc))])
        stacked_preds = _scaler_y.inverse_transform(
            _lstm.predict(seqs_hist, verbose=0)
        ).flatten()

        df_out["XGB_LSTM_Stacked"] = np.nan
        df_out.loc[df_out.index[STEP:], "XGB_LSTM_Stacked"] = stacked_preds

        stacking_metrics = get_metrics(
            np.array(y[STEP:STEP + len(stacked_preds)]),
            np.array(stacked_preds)
        )
        print(f"📊 Stacking Metrics: {stacking_metrics}")

        future_steps  = 24 * 31
        target_series = df[TARGET].tolist()
        last_row_dict = df.iloc[-1].to_dict()
        last_time     = pd.Timestamp(
            year=int(last_row_dict["YEAR"]), month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),   hour=int(last_row_dict["HR"])
        )
        history_window = df.tail(STEP).copy().reset_index(drop=True)
        future_rows    = []

        for i in range(future_steps):
            if i % 24 == 0:
                with progress_lock:
                    generate_progress["day"] = (i // 24) + 1
                print(f"⏳ Day {(i//24)+1}/31")

            next_time = last_time + pd.Timedelta(hours=i + 1)
            lag1  = target_series[-1];  lag2  = target_series[-2]
            lag3  = target_series[-3];  lag24 = target_series[-24]
            mean3  = float(np.mean(target_series[-3:]))
            mean24 = float(np.mean(target_series[-24:]))

            fv = []
            for col in FEATURES:
                if   col == "lag1":   fv.append(lag1)
                elif col == "lag2":   fv.append(lag2)
                elif col == "lag3":   fv.append(lag3)
                elif col == "lag24":  fv.append(lag24)
                elif col == "mean3":  fv.append(mean3)
                elif col == "mean24": fv.append(mean24)
                elif col == "HR":     fv.append(int(next_time.hour))
                elif col == "DY":     fv.append(int(next_time.day))
                elif col == "MO":     fv.append(int(next_time.month))
                elif col == "YEAR":   fv.append(int(next_time.year))
                else:                 fv.append(float(last_row_dict.get(col, 0.0)))

            X_fut    = np.array(fv, dtype=np.float32).reshape(1, -1)
            pred_xgb = float(xgb.predict(X_fut)[0])

            new_row = history_window.iloc[-1].copy()
            new_row["YEAR"] = int(next_time.year)
            new_row["MO"]   = int(next_time.month)
            new_row["DY"]   = int(next_time.day)
            new_row["HR"]   = int(next_time.hour)

            new_row[TARGET] = pred_xgb

            new_row["lag1"]  = lag1
            new_row["lag2"]  = lag2
            new_row["lag3"]  = lag3
            new_row["lag24"] = lag24

            new_row["mean3"]  = mean3
            new_row["mean24"] = mean24
            
            history_window = pd.concat(
                [history_window.iloc[1:], pd.DataFrame([new_row])],
                ignore_index=True
            )
            window_sc    = _scaler_X.transform(history_window[_dl_cols].values)
            seq_future   = window_sc.reshape(1, STEP, window_sc.shape[1])
            pred_stacked = float(_scaler_y.inverse_transform(
                _lstm.predict(seq_future, verbose=0))[0][0])

            target_series.append(pred_stacked)
            future_rows.append({
                "YEAR": int(next_time.year), "MO": int(next_time.month),
                "DY":   int(next_time.day),  "HR": int(next_time.hour),
                "XGB_Base":         round(pred_xgb,     3),
                "XGB_LSTM_Stacked": round(pred_stacked, 3)
            })

        df_future   = pd.DataFrame(future_rows)
        df_out      = pd.concat([df_out, df_future], ignore_index=True)
        df_out      = df_out[["YEAR","MO","DY","HR",TARGET,"XGB_Base","XGB_LSTM_Stacked"]]
        stats       = build_forecast_text(df_future.rename(columns={"XGB_LSTM_Stacked": TARGET}))
        nlp_report  = generate_nlp_report(stats, "XGB-LSTM Stacking", stacking_metrics)

        for col in ["YEAR", "MO", "DY", "HR"]:
            df_out[col] = df_out[col].astype(int)
        for col in df_out.select_dtypes(include=[np.number]).columns:
            df_out[col] = df_out[col].round(3)
            df_out[col] = df_out[col].astype(str).str.replace(".", ",", regex=False)

        with open("hasil_prediksi_best.csv", "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write(f"Dataset: {os.path.basename(get_active_dataset_path())}\n")
            f.write(f"Stacking Metrics: MAE={stacking_metrics['MAE']} RMSE={stacking_metrics['RMSE']} MAPE={stacking_metrics['MAPE']}% R2={stacking_metrics['R2']}\n")
            f.write(f"Forecast Summary:\n{nlp_report}\n\n-END HEADER-\n\n")
            df_out.to_csv(f, index=False, sep=";")

        with progress_lock:
            generate_progress.update({
                "running": False, "done": True,
                "nlp_report": nlp_report, "last_mode": "best", "error": None
            })

    except Exception as e:
        print(f"❌ Worker Best error: {traceback.format_exc()}")
        with progress_lock:
            generate_progress.update({
                "running": False, "done": True, "nlp_report": None, "error": str(e)
            })


# =========================
# ROUTE GENERATE
# =========================
@app.route("/generate_full")
def generate_full():
    with progress_lock:
        if generate_progress.get("running"):
            return jsonify({"status": "already_running"}), 409
    selected_model = session.get("selected_model", "all")
    active_models  = (
        get_best_ml_and_dl(metrics, metrics_dl)
        if selected_model == "best"
        else list(metrics.keys()) + list(metrics_dl.keys())
    )
    with progress_lock:
        generate_progress.update({
            "running": True, "day": 0, "total": 31, "mode": "General",
            "start_time": time.time(), "done": False, "nlp_report": None, "error": None
        })
    threading.Thread(target=_worker_generate_full,
                     args=(selected_model, active_models), daemon=True).start()
    return jsonify({"status": "started"})


@app.route("/generate_best")
def generate_best():
    with progress_lock:
        if generate_progress.get("running"):
            return jsonify({"status": "already_running"}), 409
    with progress_lock:
        generate_progress.update({
            "running": True, "day": 0, "total": 31, "mode": "Best Stacking",
            "start_time": time.time(), "done": False, "nlp_report": None, "error": None
        })
    threading.Thread(target=_worker_generate_best, daemon=True).start()
    return jsonify({"status": "started"})


# =========================
# DOWNLOAD
# =========================
@app.route("/download_full/<mode>")
def download_full(mode):
    filename = "hasil_prediksi_best.csv" if mode == "best" else "hasil_prediksi_general.csv"
    if os.path.exists(filename):
        return send_file(filename, as_attachment=True)
    return "File belum ada", 404


# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True, threaded=True)