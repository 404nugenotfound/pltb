from flask import Flask, render_template, request, send_file, redirect, url_for, session
import os, json
import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import MinMaxScaler
import numpy as np
from typing import Optional

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
# Tipe dideklarasikan dengan Any supaya Pylance tidak komplain
# =========================
from typing import Any

DL_READY:      bool              = False
lstm:          Any               = None
bilstm:        Any               = None
scaler_X:      Any               = None
scaler_y:      Any               = None
X_scaled:      Optional[np.ndarray] = None
data_seq:      Optional[np.ndarray] = None
DL_INPUT_COLS: list              = []
STEP:          int               = 48

try:
    from tensorflow.keras.models import load_model  # type: ignore
    lstm     = load_model("models/lstm.h5")
    bilstm   = load_model("models/bilstm.h5")
    scaler_X = joblib.load("models/scaler_X.pkl")
    scaler_y = joblib.load("models/scaler_y.pkl")

    DL_INPUT_COLS = [c for c in df.columns if c != TARGET]
    X_dl          = np.array(df[DL_INPUT_COLS].values)
    X_scaled      = np.array(scaler_X.transform(X_dl))
    data_seq      = X_scaled[-STEP:].reshape(1, STEP, X_scaled.shape[1])

    DL_READY = True
    print("✅ DL siap")
except Exception as e:
    print(f"⚠️ DL tidak tersedia: {e}")

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
# Pertama kali: hitung + simpan JSON
# Berikutnya  : baca JSON (cepat)
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
        print("📊 Hitung metrics DL (ini yang lama, sabar ~1-2 menit)...")
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
        # Kalau DL ready tapi cache belum ada DL metrics → hapus & hitung ulang
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
    akurasi = "tinggi" if best_met["MAPE"] < 10 else "cukup" if best_met["MAPE"] < 20 else "rendah"
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
        f"dengan MAPE {best_met['MAPE']}% dan RMSE {best_met['RMSE']}. "
        f"Tingkat akurasi: {akurasi}."
    )


# =========================
# ROUTE UTAMA
# =========================
@app.route("/", methods=["GET", "POST"])
def index():
    result:         list = []
    selected_model: str  = session.get("selected_model", "all")
    nlp_report           = session.pop("nlp_report", None)

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
        metrics=all_metrics,        # ← tambah ini sebagai alias
        selected_model=selected_model,
        nlp_report=nlp_report,
        best_model_names=best_model_names,
        ordered_models=ordered_models
    )


# =========================
# ROUTES LAIN
# =========================
@app.route("/overview")
def overview():
    return render_template("overview.html")

@app.route("/analitik")
def analitik():
    return render_template("analitik.html")

@app.route("/underMaintenance")
def underMaintenance():
    return render_template("underMaintenance.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


# =========================
# GENERATE FULL CSV
# =========================
@app.route("/generate_full")
def generate_full():
    try:
        selected_model = session.get("selected_model", "all")
        active_models  = (
            get_best_ml_and_dl(metrics, metrics_dl)
            if selected_model == "best"
            else list(metrics.keys()) + list(metrics_dl.keys())
        )

        print(f"📊 Generate CSV — mode: {selected_model} | models: {active_models}")
        np.random.seed(42)

        df_out = df.copy()

        # ── ML historis ──────────────────────────────────────
        if "GBR" in active_models: df_out["GBR"] = gbr.predict(X)
        if "XGB" in active_models: df_out["XGB"] = xgb.predict(X)
        if "KNN" in active_models: df_out["KNN"] = knn.predict(scaler.transform(X))

        # ── DL historis ──────────────────────────────────────
        need_dl = DL_READY and X_scaled is not None and any(
            m in active_models for m in ["LSTM", "BiLSTM"]
        )
        if need_dl and X_scaled is not None:  
            seqs_hist = np.array([X_scaled[i-STEP:i] for i in range(STEP, len(X_scaled))])
            lstm_preds   = scaler_y.inverse_transform(lstm.predict(seqs_hist,   verbose=0)).flatten()
            bilstm_preds = scaler_y.inverse_transform(bilstm.predict(seqs_hist, verbose=0)).flatten()

            df_out["LSTM"]   = np.nan
            df_out["BiLSTM"] = np.nan
            if "LSTM"   in active_models: df_out.loc[df_out.index[STEP:], "LSTM"]   = lstm_preds
            if "BiLSTM" in active_models: df_out.loc[df_out.index[STEP:], "BiLSTM"] = bilstm_preds

        # ── Future prediction ────────────────────────────────
        future_steps:  int  = 24 * 31
        target_series: list = df[TARGET].tolist()
        last_row_dict: dict = df.iloc[-1].to_dict()

        last_time = pd.Timestamp(
            year=int(last_row_dict["YEAR"]),
            month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),
            hour=int(last_row_dict["HR"])
        )

        # Window DL — pakai rolling array, tidak concat besar
        history_window = df.tail(STEP).copy().reset_index(drop=True)
        future_rows:   list = []

        for i in range(future_steps):
            if i % 24 == 0:
                print(f"⏳ Day {(i // 24) + 1}/31")

            next_time = last_time + pd.Timedelta(hours=i + 1)

            lag1   = target_series[-1]
            lag2   = target_series[-2]
            lag3   = target_series[-3]
            lag24  = target_series[-24]
            mean3  = float(np.mean(target_series[-3:]))
            mean24 = float(np.mean(target_series[-24:]))

            # Build feature array untuk ML
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

            X_fut = np.array(fv, dtype=np.float32).reshape(1, -1)

            pred_gbr = float(gbr.predict(X_fut)[0])             if "GBR" in active_models else float("nan")
            pred_xgb = float(xgb.predict(X_fut)[0])             if "XGB" in active_models else float("nan")
            pred_knn = float(knn.predict(scaler.transform(X_fut))[0]) if "KNN" in active_models else float("nan")

            # Anchor untuk DL rekursif — pakai ML terbaik yang tersedia
            anchor = pred_gbr
            if np.isnan(anchor): anchor = pred_xgb
            if np.isnan(anchor): anchor = pred_knn
            if np.isnan(anchor): anchor = lag1

            pred_lstm   = float("nan")
            pred_bilstm = float("nan")

            if need_dl and any(m in active_models for m in ["LSTM", "BiLSTM"]):
                try:
                    new_row = history_window.iloc[-1].copy()
                    new_row["YEAR"]   = int(next_time.year)
                    new_row["MO"]     = int(next_time.month)
                    new_row["DY"]     = int(next_time.day)
                    new_row["HR"]     = int(next_time.hour)
                    new_row[TARGET]   = anchor
                    new_row["lag1"]   = lag1
                    new_row["lag2"]   = lag2
                    new_row["lag3"]   = lag3
                    new_row["lag24"]  = lag24
                    new_row["mean3"]  = mean3
                    new_row["mean24"] = mean24

                    # Shift window secara efisien
                    history_window = pd.concat(
                        [history_window.iloc[1:], pd.DataFrame([new_row])],
                        ignore_index=True
                    )

                    window_dl  = history_window[DL_INPUT_COLS].values
                    window_sc  = scaler_X.transform(window_dl)
                    seq_future = window_sc.reshape(1, STEP, window_sc.shape[1])

                    if "LSTM" in active_models:
                        pred_lstm = float(
                            scaler_y.inverse_transform(lstm.predict(seq_future, verbose=0))[0][0]
                        )
                    if "BiLSTM" in active_models:
                        pred_bilstm = float(
                            scaler_y.inverse_transform(bilstm.predict(seq_future, verbose=0))[0][0]
                        )
                except Exception as dl_err:
                    print(f"⚠️ DL skip iter {i}: {dl_err}")

            target_series.append(anchor)

            row: dict = {
                "YEAR": int(next_time.year),
                "MO":   int(next_time.month),
                "DY":   int(next_time.day),
                "HR":   int(next_time.hour),
                TARGET: round(anchor, 3),
            }
            if "GBR"    in active_models: row["GBR"]    = round(pred_gbr, 3)    if not np.isnan(pred_gbr)    else np.nan
            if "XGB"    in active_models: row["XGB"]    = round(pred_xgb, 3)    if not np.isnan(pred_xgb)    else np.nan
            if "KNN"    in active_models: row["KNN"]    = round(pred_knn, 3)    if not np.isnan(pred_knn)    else np.nan
            if "LSTM"   in active_models: row["LSTM"]   = round(pred_lstm, 3)   if not np.isnan(pred_lstm)   else np.nan
            if "BiLSTM" in active_models: row["BiLSTM"] = round(pred_bilstm, 3) if not np.isnan(pred_bilstm) else np.nan
            future_rows.append(row)

        df_future = pd.DataFrame(future_rows)
        df_out    = pd.concat([df_out, df_future], ignore_index=True)
        print("✅ Future prediction selesai")

        # ── NLP ──────────────────────────────────────────────
        stats           = build_forecast_text(df_future.copy())
        all_m_combined  = {**metrics, **metrics_dl}
        best_names      = get_best_ml_and_dl(metrics, metrics_dl)
        best_name       = best_names[0]
        nlp_report      = generate_nlp_report(stats, best_name, all_m_combined[best_name])
        print("🧠 NLP selesai")

        # ── Format & Save ─────────────────────────────────────
        base_cols = ["YEAR", "MO", "DY", "HR", TARGET]
        pred_cols = [c for c in ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"] if c in df_out.columns]
        df_out    = df_out[base_cols + pred_cols]

        for col in ["YEAR", "MO", "DY", "HR"]:
            df_out[col] = df_out[col].astype(int)

        for col in df_out.select_dtypes(include=[np.number]).columns:
            df_out[col] = df_out[col].round(3)
            df_out[col] = df_out[col].astype(str).str.replace(".", ",", regex=False)

        with open("hasil_prediksi_full.csv", "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write("NASA/POWER Prediction Result\n")
            f.write("Source: Machine Learning & Deep Learning Forecast\n")
            f.write("Dates (month/day/year): Generated Future Prediction (30 Days Ahead)\n")
            f.write("Location: Bawean (Latitude: -5.75, Longitude: 112.65)\n")
            f.write("Parameter(s):\n")
            f.write("WS10M  Wind Speed at 10 Meters (m/s)\n\n")
            f.write("Model Information:\n")
            f.write("ML Models : Gradient Boosting Regressor (GBR), XGBoost (XGB), K-Nearest Neighbors (KNN)\n")
            f.write("DL Models : LSTM, Bidirectional LSTM\n\n")
            f.write("Feature Engineering:\n")
            f.write("Lag Features : lag1, lag2, lag3, lag24\n")
            f.write("Rolling Mean : mean3, mean24\n\n")
            f.write("Forecast Summary (AI Generated):\n")
            f.write(f"{nlp_report}\n\n")
            f.write("Notes:\n")
            f.write("Prediction uses recursive forecasting method\n")
            f.write("Long horizon prediction may become smooth due to error accumulation\n")
            df_out.to_csv(f, index=False, sep=";")

        print("✅ CSV selesai")
        session["nlp_report"] = nlp_report
        return redirect(url_for("index"))

    except Exception as e:
        import traceback
        return f"Error: {e}<br><pre>{traceback.format_exc()}</pre>"


# =========================
# DOWNLOAD
# =========================
@app.route("/download")
def download():
    if os.path.exists("hasil_prediksi.csv"):
        return send_file("hasil_prediksi.csv", as_attachment=True)
    return "File belum ada"


@app.route("/download_full")
def download_full():
    if os.path.exists("hasil_prediksi_full.csv"):
        return send_file("hasil_prediksi_full.csv", as_attachment=True)
    return "File belum ada, generate dulu"


# =========================
# RUN
# =========================
if __name__ == "__main__":
    app.run(debug=True)