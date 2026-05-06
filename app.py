from flask import Flask, render_template, request, send_file, redirect, url_for, session
import os
import joblib
from tensorflow.keras.models import load_model
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np

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

FEATURES = joblib.load("models/features.pkl")

# =========================
# LOAD MODEL DL (optional)
# =========================
DL_READY  = False
lstm      = None
bilstm    = None
scaler_X  = None
scaler_y  = None
X_scaled  = None
data_seq  = None
STEP      = 48
DL_INPUT_COLS: list = []

try:
    lstm   = load_model("models/lstm.h5")
    bilstm = load_model("models/bilstm.h5")

    scaler_X = joblib.load("models/scaler_X.pkl")
    scaler_y = joblib.load("models/scaler_y.pkl")

    # Simpan urutan kolom input DL — harus identik dengan saat training
    DL_INPUT_COLS = [c for c in df.columns if c != TARGET]

    X_dl     = df[DL_INPUT_COLS]
    X_scaled = scaler_X.transform(X_dl)

    # Sequence terakhir untuk prediksi 1 step ke depan
    data_seq = X_scaled[-STEP:].reshape(1, STEP, X_scaled.shape[1])

    DL_READY = True
    print("✅ DL models loaded")
except Exception as e:
    print(f"⚠️ DL tidak tersedia: {e}")

# =========================
# PREPROCESS ML
# =========================
X       = np.array(df[FEATURES].values)
y       = np.array(df[TARGET].values)
data_ml = X[-1].reshape(1, -1)

# =========================
# METRICS
# =========================
def get_metrics(y_true, y_pred):
    y_true = np.array(y_true).flatten()
    y_pred = np.array(y_pred).flatten()
    return {
        "MAE":  round(float(mean_absolute_error(y_true, y_pred)), 3),
        "RMSE": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 3),
        "MAPE": round(float(np.mean(np.abs((y_true - y_pred) / y_true)) * 100), 2),
        "R2":   round(float(r2_score(y_true, y_pred)), 3)
    }

metrics = {
    "GBR": get_metrics(y, gbr.predict(X)),
    "XGB": get_metrics(y, xgb.predict(X)),
    "KNN": get_metrics(y, knn.predict(scaler.transform(X)))
}

metrics_dl = {}
if DL_READY and X_scaled is not None:
    assert lstm is not None
    assert bilstm is not None
    assert scaler_y is not None

    sequences     = np.array([X_scaled[i-STEP:i] for i in range(STEP, len(X_scaled))])
    y_dl          = y[STEP:].reshape(-1, 1)

    y_pred_lstm   = scaler_y.inverse_transform(lstm.predict(sequences,   verbose=0))
    y_pred_bilstm = scaler_y.inverse_transform(bilstm.predict(sequences, verbose=0))

    metrics_dl["LSTM"]   = get_metrics(y_dl, y_pred_lstm)
    metrics_dl["BiLSTM"] = get_metrics(y_dl, y_pred_bilstm)

# =========================
# HELPER FUNCTIONS
# =========================
def get_best_ml_and_dl(metrics_ml, metrics_dl_local):
    best_ml = min(metrics_ml, key=lambda m: metrics_ml[m]["MAPE"])
    result  = [best_ml]
    if metrics_dl_local:
        best_dl = min(metrics_dl_local, key=lambda m: metrics_dl_local[m]["MAPE"])
        result.append(best_dl)
    return result


def build_forecast_text(df_future):
    avg     = float(df_future[TARGET].mean())
    max_val = float(df_future[TARGET].max())
    min_val = float(df_future[TARGET].min())
    std_val = float(df_future[TARGET].std())

    hourly  = df_future.groupby("HR")[TARGET].mean()
    peak_hr = int(hourly.idxmax())
    low_hr  = int(hourly.idxmin())

    week1 = float(df_future.iloc[:168][TARGET].mean()) if len(df_future) >= 168 else avg
    week4 = float(df_future.iloc[-168:][TARGET].mean()) if len(df_future) >= 168 else avg

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


def generate_nlp_report(stats, best_model_name, best_met):
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
        f"\n\nModel terbaik untuk prediksi ini adalah {best_model_name} "
        f"dengan nilai MAPE sebesar {best_met['MAPE']}% "
        f"dan RMSE sebesar {best_met['RMSE']}. "
        f"Hal ini menunjukkan bahwa model memiliki tingkat akurasi yang {akurasi} "
        f"dalam melakukan prediksi."
    )


# =========================
# ROUTE UTAMA
# =========================
@app.route("/", methods=["GET", "POST"])
def index():
    result         = []
    selected_model = "all"
    nlp_report     = session.pop("nlp_report", None)

    all_metrics      = {**metrics, **metrics_dl}
    best_model_names = get_best_ml_and_dl(metrics, metrics_dl)
    all_keys         = list(metrics.keys()) + list(metrics_dl.keys())
    ordered_models   = all_keys

    if request.method == "POST":
        selected_model = request.form.get("model", "all")
        session["selected_model"] = selected_model

        if selected_model == "best":
            rest           = [m for m in all_keys if m not in best_model_names]
            ordered_models = best_model_names + rest
        else:
            ordered_models = all_keys

        actual = float(y[-1])

        def add_row(name, pred):
            result.append({
                "model":      name,
                "prediction": round(float(pred), 3),
                "actual":     round(actual, 3),
                "error":      round(abs(float(pred) - actual), 3)
            })

        if selected_model == "best":
            for name in best_model_names:
                if name == "GBR":
                    add_row("GBR", gbr.predict(data_ml)[0])
                elif name == "XGB":
                    add_row("XGB", xgb.predict(data_ml)[0])
                elif name == "KNN":
                    add_row("KNN", knn.predict(scaler.transform(data_ml))[0])
                elif name == "LSTM" and DL_READY and data_seq is not None:
                    assert lstm is not None
                    assert scaler_y is not None
                    raw = lstm.predict(data_seq, verbose=0)
                    add_row("LSTM", scaler_y.inverse_transform(raw)[0][0])
                elif name == "BiLSTM" and DL_READY and data_seq is not None:
                    assert bilstm is not None
                    assert scaler_y is not None
                    raw = bilstm.predict(data_seq, verbose=0)
                    add_row("BiLSTM", scaler_y.inverse_transform(raw)[0][0])
        else:
            add_row("GBR", gbr.predict(data_ml)[0])
            add_row("XGB", xgb.predict(data_ml)[0])
            add_row("KNN", knn.predict(scaler.transform(data_ml))[0])
            if DL_READY and data_seq is not None:
                assert lstm is not None
                assert bilstm is not None
                assert scaler_y is not None
                raw_lstm   = lstm.predict(data_seq, verbose=0)
                raw_bilstm = bilstm.predict(data_seq, verbose=0)
                add_row("LSTM",   scaler_y.inverse_transform(raw_lstm)[0][0])
                add_row("BiLSTM", scaler_y.inverse_transform(raw_bilstm)[0][0])

        result = sorted(result, key=lambda x: x["error"])
        if result:
            pd.DataFrame(result).to_csv("hasil_prediksi.csv", index=False)

    return render_template(
        "index.html",
        result=result,
        metrics=all_metrics,
        selected_model=selected_model,
        nlp_report=nlp_report,
        best_model_names=best_model_names,
        ordered_models=ordered_models
    )


# =========================
# DASHBOARD
# =========================
@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/analitik")
def analitik():
    return render_template("analitik.html")

@app.route("/underMaintenance")
def underMaintenance():
    return render_template("underMaintenance.html")


# =========================
# GENERATE FULL CSV
# =========================
@app.route("/generate_full")
def generate_full():
    selected_model = request.args.get("model", "all")  # ✅ pakai ini saja
    try:
        if selected_model == "best":
            active_models = get_best_ml_and_dl(metrics, metrics_dl)
        else:
            active_models = list(metrics.keys()) + list(metrics_dl.keys())

        print(f"📊 Generate full CSV dimulai — mode: {selected_model}, models: {active_models}")
        
        np.random.seed(42)

        df_out = df.copy()

        # ── ML prediction data asli ──────────────────────────
        if "GBR" in active_models:
            df_out["GBR"] = gbr.predict(X)
        if "XGB" in active_models:
            df_out["XGB"] = xgb.predict(X)
        if "KNN" in active_models:
            df_out["KNN"] = knn.predict(scaler.transform(X))

        # ── DL prediction data asli ──────────────────────────
        if DL_READY and X_scaled is not None and any(m in active_models for m in ["LSTM", "BiLSTM"]):
            assert lstm is not None
            assert bilstm is not None
            assert scaler_y is not None

            seqs_hist    = np.array([X_scaled[i-STEP:i] for i in range(STEP, len(X_scaled))])
            lstm_preds   = scaler_y.inverse_transform(lstm.predict(seqs_hist,   verbose=0)).flatten()
            bilstm_preds = scaler_y.inverse_transform(bilstm.predict(seqs_hist, verbose=0)).flatten()

            df_out["LSTM"]   = np.nan
            df_out["BiLSTM"] = np.nan
            if "LSTM" in active_models:
                df_out.loc[df_out.index[STEP:], "LSTM"] = lstm_preds
            if "BiLSTM" in active_models:
                df_out.loc[df_out.index[STEP:], "BiLSTM"] = bilstm_preds

        # ── Future prediction ────────────────────────────────
        future_steps  = 24 * 31
        target_series = df[TARGET].copy().tolist()
        df_history    = df.copy().reset_index(drop=True)

        last_df_row = df.iloc[-1]
        last_time   = pd.Timestamp(
            year=int(last_df_row["YEAR"]),
            month=int(last_df_row["MO"]),
            day=int(last_df_row["DY"]),
            hour=int(last_df_row["HR"])
        )

        future_rows = []

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

            feature_dict = {}
            for col in FEATURES:
                if   col == "lag1":   feature_dict[col] = lag1
                elif col == "lag2":   feature_dict[col] = lag2
                elif col == "lag3":   feature_dict[col] = lag3
                elif col == "lag24":  feature_dict[col] = lag24
                elif col == "mean3":  feature_dict[col] = mean3
                elif col == "mean24": feature_dict[col] = mean24
                elif col == "HR":     feature_dict[col] = int(next_time.hour)
                elif col == "DY":     feature_dict[col] = int(next_time.day)
                elif col == "MO":     feature_dict[col] = int(next_time.month)
                elif col == "YEAR":   feature_dict[col] = int(next_time.year)
                else:
                    feature_dict[col] = float(last_df_row[col]) if col in last_df_row.index else 0.0

            X_future = pd.DataFrame([feature_dict], columns=FEATURES)

            pred_gbr = float(gbr.predict(X_future)[0]) if "GBR" in active_models else np.nan
            pred_xgb = float(xgb.predict(X_future)[0]) if "XGB" in active_models else np.nan
            pred_knn = float(knn.predict(scaler.transform(X_future))[0]) if "KNN" in active_models else np.nan

            # ← anchor_pred HARUS di sini, sebelum DL block
            anchor_pred = pred_gbr if not np.isnan(pred_gbr) else (
                          pred_xgb if not np.isnan(pred_xgb) else pred_knn)

            pred_lstm   = np.nan
            pred_bilstm = np.nan

            if DL_READY and X_scaled is not None and len(DL_INPUT_COLS) > 0 \
                    and any(m in active_models for m in ["LSTM", "BiLSTM"]):
                assert lstm is not None
                assert bilstm is not None
                assert scaler_X is not None
                assert scaler_y is not None

                template_row = df_history.iloc[-1].copy()
                template_row["YEAR"]   = int(next_time.year)
                template_row["MO"]     = int(next_time.month)
                template_row["DY"]     = int(next_time.day)
                template_row["HR"]     = int(next_time.hour)
                template_row[TARGET]   = anchor_pred  # ✅ sudah terdefinisi
                template_row["lag1"]   = lag1
                template_row["lag2"]   = lag2
                template_row["lag3"]   = lag3
                template_row["lag24"]  = lag24
                template_row["mean3"]  = mean3
                template_row["mean24"] = mean24

                window_df  = pd.concat([
                    df_history.iloc[-(STEP-1):],
                    pd.DataFrame([template_row])
                ], ignore_index=True)

                # Pakai DL_INPUT_COLS yang sudah di-fix saat startup
                # agar urutan kolom selalu konsisten dengan saat training
                window_dl  = window_df[DL_INPUT_COLS]
                window_sc  = scaler_X.transform(window_dl)
                seq_future = window_sc.reshape(1, STEP, window_sc.shape[1])

                if "LSTM" in active_models:
                    pred_lstm   = float(scaler_y.inverse_transform(
                        lstm.predict(seq_future, verbose=0))[0][0])
                if "BiLSTM" in active_models:
                    pred_bilstm = float(scaler_y.inverse_transform(
                        bilstm.predict(seq_future, verbose=0))[0][0])

            target_series.append(anchor_pred)  # ✅

            new_full_row = df_history.iloc[-1].copy()
            new_full_row["YEAR"]   = int(next_time.year)
            new_full_row["MO"]     = int(next_time.month)
            new_full_row["DY"]     = int(next_time.day)
            new_full_row["HR"]     = int(next_time.hour)
            new_full_row[TARGET]   = anchor_pred  # ✅
            new_full_row["lag1"]   = lag1
            new_full_row["lag2"]   = lag2
            new_full_row["lag3"]   = lag3
            new_full_row["lag24"]  = lag24
            new_full_row["mean3"]  = mean3
            new_full_row["mean24"] = mean24

            df_history = pd.concat(
                [df_history, pd.DataFrame([new_full_row])],
                ignore_index=True
            )

            future_row = {
                "YEAR": int(next_time.year),
                "MO":   int(next_time.month),
                "DY":   int(next_time.day),
                "HR":   int(next_time.hour),
                TARGET: round(anchor_pred, 3),
            }
            if "GBR"    in active_models: future_row["GBR"]    = round(pred_gbr,    3)
            if "XGB"    in active_models: future_row["XGB"]    = round(pred_xgb,    3)
            if "KNN"    in active_models: future_row["KNN"]    = round(pred_knn,    3)
            if "LSTM"   in active_models: future_row["LSTM"]   = round(pred_lstm,   3) if not np.isnan(pred_lstm)   else np.nan
            if "BiLSTM" in active_models: future_row["BiLSTM"] = round(pred_bilstm, 3) if not np.isnan(pred_bilstm) else np.nan
            future_rows.append(future_row)

        df_future = pd.DataFrame(future_rows)
        df_out    = pd.concat([df_out, df_future], ignore_index=True)
        print("✅ Future prediction selesai")

        # ── NLP Report ───────────────────────────────────────
        stats                = build_forecast_text(df_future.copy())
        all_metrics_combined = {**metrics, **metrics_dl}
        best_names           = get_best_ml_and_dl(metrics, metrics_dl)
        best_model_name      = best_names[0]
        best_met             = all_metrics_combined[best_model_name]
        nlp_report           = generate_nlp_report(stats, best_model_name, best_met)
        print("🧠 NLP REPORT:")
        print(nlp_report)

        # ── Format & Save CSV ────────────────────────────────
        base_cols  = ["YEAR", "MO", "DY", "HR", TARGET]
        model_cols = [m for m in ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"] if m in active_models]
        cols       = base_cols + model_cols

        df_out = df_out[cols]

        for col in ["YEAR", "MO", "DY", "HR"]:
            df_out[col] = df_out[col].astype(int)

        num_cols = df_out.select_dtypes(include=[np.number]).columns
        for col in num_cols:
            df_out[col] = df_out[col].round(3)
            df_out[col] = df_out[col].astype(str).str.replace(".", ",", regex=False)

        with open("hasil_prediksi_full.csv", "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write("NASA/POWER Prediction Result\n")
            f.write("Source: Machine Learning & Deep Learning Forecast\n")
            f.write("Dates (month/day/year): Generated Future Prediction (30 Days Ahead)\n")
            f.write("Location: Bawean (Latitude: -5.75, Longitude: 112.65)\n")
            f.write("Parameter(s):\n")
            f.write("WS10M  Wind Speed at 10 Meters (m/s)\n\n")
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
            f.write("-END HEADER-\n\n")
            df_out.to_csv(f, index=False, sep=";")

        print("✅ CSV selesai dibuat")
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
