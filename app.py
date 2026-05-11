from flask import Flask, render_template, request, send_file, redirect, url_for, session, jsonify
import os, json
import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import MinMaxScaler
import numpy as np
from typing import Optional, Any
import threading
import time
import traceback
from threading import Lock


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

progress_lock = Lock()

app = Flask(__name__)
app.secret_key = "ventara-secret-key-2025"

TARGET = "WS10M"

# =========================
# LOAD DATA
# =========================
df = pd.read_csv("Dataset/NASA Bawean Hourly Full.csv")

# =========================
# FEATURE ENGINEERING
# =========================
for lag in [1, 2, 3, 24]:
    df[f"lag{lag}"] = df[TARGET].shift(lag)

df["mean3"]  = df[TARGET].rolling(3).mean()
df["mean24"] = df[TARGET].rolling(24).mean()
df = df.dropna()

# =========================
# LOAD MODEL ML
# =========================
gbr    = joblib.load("models/gbr.pkl")
xgb    = joblib.load("models/xgb.pkl")
knn    = joblib.load("models/knn.pkl")
scaler = joblib.load("models/scaler.pkl")
FEATURES: list = joblib.load("models/features.pkl")

# =========================
# PREPROCESS ML
# =========================
X       = np.array(df[FEATURES].values)
y       = np.array(df[TARGET].values)
data_ml = X[-1].reshape(1, -1)

# =========================
# DL SETUP
# =========================
DL_READY:      bool                  = False
lstm:          Any                   = None
bilstm:        Any                   = None
scaler_X:      Any                   = None
scaler_y:      Any                   = None
X_scaled:      Optional[np.ndarray]  = None
data_seq:      Optional[np.ndarray]  = None
DL_INPUT_COLS: list                  = []
STEP:          int                   = 48

try:
    from tensorflow.keras.models import load_model  # type: ignore

    print("📦 Load DL model...")
    
    lstm     = load_model("models/lstm.h5")
    bilstm   = load_model("models/bilstm.h5")

    scaler_X = joblib.load("models/scaler_X.pkl")
    scaler_y = joblib.load("models/scaler_y.pkl")

    # =========================
    # AMBIL FEATURE ASLI DARI SCALER
    # =========================
    if hasattr(scaler_X, "feature_names_in_"):
        DL_INPUT_COLS = list(scaler_X.feature_names_in_)
    else:
        DL_INPUT_COLS = FEATURES.copy()

    print("📋 DL INPUT COLS =", DL_INPUT_COLS)

    # =========================
    # VALIDASI FEATURE
    # =========================
    missing_cols = [c for c in DL_INPUT_COLS if c not in df.columns]

    if missing_cols:
        raise ValueError(f"Kolom DL belum ada di dataframe: {missing_cols}")

    # =========================
    # PREPARE DL INPUT
    # =========================
    X_dl = df[DL_INPUT_COLS].copy()

    scaled_result = scaler_X.transform(X_dl)

    if scaled_result is None:
        raise ValueError("Scaling gagal — X_scaled None")

    X_scaled = np.array(scaled_result, dtype=np.float32)

    if X_scaled.shape[0] < STEP:
        raise ValueError(
            f"Data sequence kurang dari STEP ({STEP})"
        )

    data_seq = X_scaled[-STEP:].reshape(
        1,
        STEP,
        X_scaled.shape[1]
    )

    DL_READY = True

    print("✅ DL siap digunakan")
    print("✅ Shape X_scaled =", X_scaled.shape)
    print("✅ Shape data_seq =", data_seq.shape)
    
except Exception as e:
    DL_READY = False

    print("⚠️ DL tidak tersedia")
    print("❌ Error DL:", str(e))

    traceback.print_exc()

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

# =========================
# METRICS CACHE
# =========================
METRICS_CACHE = "models/metrics_cache.json"

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
        y_pred_lstm   = scaler_y.inverse_transform(lstm.predict(seqs, verbose=1))
        y_pred_bilstm = scaler_y.inverse_transform(bilstm.predict(seqs, verbose=1))
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
            print("🔄 Cache tidak ada DL metrics, hitung ulang...")
            os.remove(METRICS_CACHE)
            return load_or_compute_metrics()
        return cache["ml"], cache.get("dl", {})

    print("🆕 Belum ada cache, hitung pertama kali...")
    ml, dl = _compute_metrics_fresh()
    with open(METRICS_CACHE, "w") as f:
        json.dump({"ml": ml, "dl": dl}, f, indent=2)
    print(f"✅ Cache disimpan → {METRICS_CACHE}")
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
        mape     = None
        akurasi  = "tidak tersedia"
        mape_str = "N/A"
    else:
        mape     = float(mape_raw)
        akurasi  = (
            "tinggi" if mape < 10 else
            "cukup"  if mape < 20 else
            "rendah"
        )
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
# ROUTE UTAMA
# =========================
@app.route("/", methods=["GET", "POST"])
def index():
    result:         list = []
    selected_model: str  = session.get("selected_model", "all")

    # Baca nlp_report dari session — JANGAN pakai pop() supaya tidak hilang saat refresh
    nlp_report      = session.get("nlp_report", None)
    last_gen_mode   = session.get("last_generate_mode", "general")

    all_metrics:      dict = {**metrics, **metrics_dl}
    best_model_names: list = get_best_ml_and_dl(metrics, metrics_dl)
    all_keys:         list = list(metrics.keys()) + list(metrics_dl.keys())

    if selected_model == "best":
        rest           = [m for m in all_keys if m not in best_model_names]
        ordered_models = best_model_names + rest
    else:
        ordered_models = all_keys

    if request.method == "POST":
        selected_model = request.form.get("model", "all")
        session["selected_model"] = selected_model

        # Reset NLP saat user ganti pilihan & run prediksi baru
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

        if "GBR" in active_models:
            add_row("GBR", gbr.predict(data_ml)[0])
        if "XGB" in active_models:
            add_row("XGB", xgb.predict(data_ml)[0])
        if "KNN" in active_models:
            add_row("KNN", knn.predict(scaler.transform(data_ml))[0])

        if DL_READY and data_seq is not None:
            if "LSTM" in active_models:
                raw = lstm.predict(data_seq, verbose=0)
                add_row("LSTM", scaler_y.inverse_transform(raw)[0][0])
            if "BiLSTM" in active_models:
                raw = bilstm.predict(data_seq, verbose=0)
                add_row("BiLSTM", scaler_y.inverse_transform(raw)[0][0])

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
        ordered_models=ordered_models
    )


@app.route("/overview", methods=["GET", "POST"])
def overview():
    selected_model   = session.get("selected_model", "all")
    nlp_report       = session.get("nlp_report", None)
    all_metrics      = {**metrics, **metrics_dl}
    best_model_names = get_best_ml_and_dl(metrics, metrics_dl)
    all_keys         = list(metrics.keys()) + list(metrics_dl.keys())

    labels      = [f"{i}:00" for i in range(24)]
    actual_data = y[-24:].tolist()
    gbr_data    = gbr.predict(X[-24:]).tolist()
    xgb_data    = xgb.predict(X[-24:]).tolist()
    knn_data    = knn.predict(scaler.transform(X[-24:])).tolist()

    return render_template(
        "overview.html",
        result=[],
        all_metrics=all_metrics,
        metrics=all_metrics,
        selected_model=selected_model,
        nlp_report=nlp_report,
        best_model_names=best_model_names,
        ordered_models=all_keys,
        labels=labels,
        actual_data=actual_data,
        gbr_data=gbr_data,
        xgb_data=xgb_data,
        knn_data=knn_data
    )


# =========================
# ROUTES LAIN
# =========================
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
# ROUTE PROGRESS (polling dari JS)
# =========================
@app.route("/generate_progress")
def get_progress():
    with progress_lock:
        p = generate_progress.copy()

    elapsed = time.time() - p["start_time"] if p.get("start_time") else 0
    day     = p.get("day", 0)
    total   = p.get("total", 31)

    if day > 0 and elapsed > 0:
        avg_per_day = elapsed / day
        remaining   = max(0, (total - day) * avg_per_day)
        eta_str     = f"{int(remaining // 60)}m {int(remaining % 60)}s"
    else:
        eta_str = "Menghitung..."
        
    return jsonify({
        "running":    p.get("running", False),
        "done":       p.get("done", False),
        "day":        day,
        "total":      total,
        "mode":       p.get("mode", ""),
        "eta":        eta_str,
        "elapsed":    f"{int(elapsed // 60)}m {int(elapsed % 60)}s",
        "error":      p.get("error"),
        "nlp_report": p.get("nlp_report"),
        "last_mode":  p.get("last_mode", "general")
    })

@app.route("/generate_commit", methods=["POST"])
def generate_commit():
    with progress_lock:
        p = generate_progress.copy()

    print(f"🔒 Commit dipanggil — done={p.get('done')}, nlp ada={bool(p.get('nlp_report'))}")

    if p.get("done") and p.get("nlp_report"):
        session["nlp_report"]         = p["nlp_report"]
        session["last_generate_mode"] = p.get("last_mode", "general")
        session.modified = True  # ← paksa Flask tandai session berubah
        print(f"✅ Session ditulis — mode={session['last_generate_mode']}")
        return jsonify({"status": "ok"})

    print("⚠️ Commit gagal — progress belum done atau nlp kosong")
    return jsonify({"status": "no_data"}), 400

# =========================
# BACKGROUND WORKER — GENERATE FULL
# =========================
def _worker_generate_full(selected_model: str, active_models: list) -> None:
    try:
        np.random.seed(42)
        df_out = df.copy()

        # ML historis
        if "GBR" in active_models: df_out["GBR"] = gbr.predict(X)
        if "XGB" in active_models: df_out["XGB"] = xgb.predict(X)
        if "KNN" in active_models: df_out["KNN"] = knn.predict(scaler.transform(X))

        # DL historis
        need_dl = DL_READY and X_scaled is not None and any(
            m in active_models for m in ["LSTM", "BiLSTM"]
        )
        if need_dl and X_scaled is not None:
            seqs_hist    = np.array([X_scaled[i-STEP:i] for i in range(STEP, len(X_scaled))])
            lstm_preds   = scaler_y.inverse_transform(lstm.predict(seqs_hist,   verbose=0)).flatten()
            bilstm_preds = scaler_y.inverse_transform(bilstm.predict(seqs_hist, verbose=0)).flatten()
            df_out["LSTM"]   = np.nan
            df_out["BiLSTM"] = np.nan
            if "LSTM"   in active_models: df_out.loc[df_out.index[STEP:], "LSTM"]   = lstm_preds
            if "BiLSTM" in active_models: df_out.loc[df_out.index[STEP:], "BiLSTM"] = bilstm_preds

        # Future prediction
        future_steps:  int  = 24 * 31
        target_series: list = df[TARGET].tolist()
        last_row_dict: dict = df.iloc[-1].to_dict()
        last_time = pd.Timestamp(
            year=int(last_row_dict["YEAR"]),
            month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),
            hour=int(last_row_dict["HR"])
        )
        history_window = df.tail(STEP).copy().reset_index(drop=True)
        future_rows:   list = []

        for i in range(future_steps):
            if i % 24 == 0:
                day_num = (i // 24) + 1
                print(f"⏳ Day {day_num}/31")
                with progress_lock:
                    generate_progress["day"] = day_num

            next_time = last_time + pd.Timedelta(hours=i + 1)
            lag1   = target_series[-1]; lag2  = target_series[-2]
            lag3   = target_series[-3]; lag24 = target_series[-24]
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
            pred_gbr = float(gbr.predict(X_fut)[0])             if "GBR" in active_models else float("nan")
            pred_xgb = float(xgb.predict(X_fut)[0])             if "XGB" in active_models else float("nan")
            pred_knn = float(knn.predict(scaler.transform(X_fut))[0]) if "KNN" in active_models else float("nan")

            anchor = pred_gbr
            if np.isnan(anchor): anchor = pred_xgb
            if np.isnan(anchor): anchor = pred_knn
            if np.isnan(anchor): anchor = lag1

            pred_lstm = pred_bilstm = float("nan")

            if need_dl and any(m in active_models for m in ["LSTM", "BiLSTM"]):
                try:
                    new_row = history_window.iloc[-1].copy()
                    new_row["YEAR"]  = int(next_time.year);  new_row["MO"]    = int(next_time.month)
                    new_row["DY"]    = int(next_time.day);   new_row["HR"]    = int(next_time.hour)
                    new_row[TARGET]  = anchor
                    new_row["lag1"]  = lag1;  new_row["lag2"]   = lag2
                    new_row["lag3"]  = lag3;  new_row["lag24"]  = lag24
                    new_row["mean3"] = mean3; new_row["mean24"] = mean24

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

        df_future = pd.DataFrame(future_rows)
        df_out    = pd.concat([df_out, df_future], ignore_index=True)

        # NLP
        stats          = build_forecast_text(df_future.copy())
        all_m_combined = {**metrics, **metrics_dl}
        best_name      = get_best_ml_and_dl(metrics, metrics_dl)[0]
        nlp_report     = generate_nlp_report(stats, best_name, all_m_combined[best_name])

        # Format & Save
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
            f.write("NASA/POWER Prediction Result\n")
            f.write("Source: Machine Learning & Deep Learning Forecast\n")
            f.write("Dates (month/day/year): Generated Future Prediction (30 Days Ahead)\n")
            f.write("Location: Bawean (Latitude: -5.75, Longitude: 112.65)\n")
            f.write("Parameter(s):\nWS10M  Wind Speed at 10 Meters (m/s)\n\n")
            f.write("ML Models : GBR, XGBoost, KNN\nDL Models : LSTM, BiLSTM\n\n")
            f.write("Forecast Summary (AI Generated):\n")
            f.write(f"{nlp_report}\n\n")
            f.write("Notes:\nPrediction uses recursive forecasting method\n")
            f.write("Long horizon prediction may become smooth due to error accumulation\n")
            f.write("-END HEADER-\n\n")
            df_out.to_csv(f, index=False, sep=";")

        print("✅ CSV General selesai")
        with progress_lock:
            generate_progress.update({
                "running":    False,
                "done":       True,
                "nlp_report": nlp_report,
                "last_mode":  "general",
                "error":      None
            })

    except Exception as e:
        import traceback
        print(f"❌ Worker error: {traceback.format_exc()}")
        with progress_lock:
            generate_progress.update({
                "running": False, "done": True,
                "nlp_report": None, "error": str(e)
            })


# =========================
# BACKGROUND WORKER — GENERATE BEST
# =========================
def _worker_generate_best() -> None:
    try:
        np.random.seed(42)
        df_out = df.copy()
        df_out["XGB_Base"] = xgb.predict(X)

        if not DL_READY or X_scaled is None:
            raise RuntimeError("LSTM belum siap")

        seqs_hist = np.array([X_scaled[i-STEP:i] for i in range(STEP, len(X_scaled))])
        stacked_preds = scaler_y.inverse_transform(
            lstm.predict(seqs_hist, verbose=0)
        ).flatten()

        df_out["XGB_LSTM_Stacked"] = np.nan
        df_out.loc[df_out.index[STEP:], "XGB_LSTM_Stacked"] = stacked_preds

        # Hitung metrics dari data historis
        stacked_hist   = np.array(stacked_preds, dtype=np.float64)
        y_hist_aligned = np.array(y[STEP:STEP + len(stacked_hist)], dtype=np.float64)
        stacking_metrics = get_metrics(y_hist_aligned, stacked_hist)
        print(f"📊 Stacking Metrics: {stacking_metrics}")

        future_steps  = 24 * 31
        target_series = df[TARGET].tolist()
        last_row_dict = df.iloc[-1].to_dict()
        last_time     = pd.Timestamp(
            year=int(last_row_dict["YEAR"]),
            month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),
            hour=int(last_row_dict["HR"])
        )
        history_window = df.tail(STEP).copy().reset_index(drop=True)
        future_rows    = []

        for i in range(future_steps):
            if i % 24 == 0:
                day_num = (i // 24) + 1
                print(f"⏳ Day {day_num}/31")
                with progress_lock:
                    generate_progress["day"] = day_num

            next_time = last_time + pd.Timedelta(hours=i + 1)
            lag1   = target_series[-1]; lag2  = target_series[-2]
            lag3   = target_series[-3]; lag24 = target_series[-24]
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

            new_row          = history_window.iloc[-1].copy()
            new_row["YEAR"]  = int(next_time.year);  new_row["MO"]    = int(next_time.month)
            new_row["DY"]    = int(next_time.day);   new_row["HR"]    = int(next_time.hour)
            new_row[TARGET]  = pred_xgb
            new_row["lag1"]  = lag1;  new_row["lag2"]   = lag2
            new_row["lag3"]  = lag3;  new_row["lag24"]  = lag24
            new_row["mean3"] = mean3; new_row["mean24"] = mean24

            history_window = pd.concat(
                [history_window.iloc[1:], pd.DataFrame([new_row])],
                ignore_index=True
            )

            window_sc    = scaler_X.transform(history_window[DL_INPUT_COLS].values)
            seq_future   = window_sc.reshape(1, STEP, window_sc.shape[1])
            pred_stacked = float(scaler_y.inverse_transform(
                lstm.predict(seq_future, verbose=0))[0][0])

            target_series.append(pred_stacked)
            future_rows.append({
                "YEAR":             int(next_time.year),
                "MO":               int(next_time.month),
                "DY":               int(next_time.day),
                "HR":               int(next_time.hour),
                "XGB_Base":         round(pred_xgb,     3),
                "XGB_LSTM_Stacked": round(pred_stacked, 3)
            })

        df_future = pd.DataFrame(future_rows)
        df_out    = pd.concat([df_out, df_future], ignore_index=True)

        output_cols = ["YEAR", "MO", "DY", "HR", TARGET, "XGB_Base", "XGB_LSTM_Stacked"]
        df_out = df_out[output_cols]

        stats      = build_forecast_text(df_future.rename(columns={"XGB_LSTM_Stacked": TARGET}))
        nlp_report = generate_nlp_report(stats, "XGB-LSTM Stacking", stacking_metrics)

        for col in ["YEAR", "MO", "DY", "HR"]:
            df_out[col] = df_out[col].astype(int)
        for col in df_out.select_dtypes(include=[np.number]).columns:
            df_out[col] = df_out[col].round(3)
            df_out[col] = df_out[col].astype(str).str.replace(".", ",", regex=False)

        with open("hasil_prediksi_best.csv", "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write("NASA/POWER Prediction Result\n")
            f.write("Source: XGB-LSTM Stacking Forecast\n")
            f.write("Location: Bawean (Latitude: -5.75, Longitude: 112.65)\n")
            f.write("Parameter(s):\nWS10M  Wind Speed at 10 Meters (m/s)\n\n")
            f.write(f"Stacking Metrics:\nMAE: {stacking_metrics['MAE']} | RMSE: {stacking_metrics['RMSE']} | MAPE: {stacking_metrics['MAPE']}% | R2: {stacking_metrics['R2']}\n\n")
            f.write("Forecast Summary (AI Generated):\n")
            f.write(f"{nlp_report}\n\n")
            f.write("Notes:\nPrediction uses recursive forecasting method\n")
            f.write("Long horizon prediction may become smooth due to error accumulation\n")
            f.write("-END HEADER-\n\n")
            df_out.to_csv(f, index=False, sep=";")

        print("✅ CSV Best selesai")
        with progress_lock:
            generate_progress.update({
                "running":    False,
                "done":       True,
                "nlp_report": nlp_report,
                "last_mode":  "best",
                "error":      None
            })

    except Exception as e:
        import traceback
        print(f"❌ Worker Best error: {traceback.format_exc()}")
        with progress_lock:
            generate_progress.update({
                "running": False, "done": True,
                "nlp_report": None, "error": str(e)
            })


# =========================
# ROUTE GENERATE FULL
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
            "running": True, "day": 0, "total": 31,
            "mode": "General", "start_time": time.time(),
            "done": False, "nlp_report": None, "error": None
        })

    t = threading.Thread(
        target=_worker_generate_full,
        args=(selected_model, active_models),
        daemon=True
    )
    t.start()
    return jsonify({"status": "started"})


# =========================
# ROUTE GENERATE BEST
# =========================
@app.route("/generate_best")
def generate_best():
    with progress_lock:
        if generate_progress.get("running"):
            return jsonify({"status": "already_running"}), 409

    with progress_lock:
        generate_progress.update({
            "running": True, "day": 0, "total": 31,
            "mode": "Best Stacking", "start_time": time.time(),
            "done": False, "nlp_report": None, "error": None
        })

    t = threading.Thread(target=_worker_generate_best, daemon=True)
    t.start()
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