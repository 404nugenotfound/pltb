from flask import Flask, render_template, request, send_file, redirect, url_for, session
import os
import joblib
from tensorflow.keras.models import load_model
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np
import subprocess

app = Flask(__name__)
app.secret_key = "ventara-secret-key-2025"

# load sekali saja (jangan di dalam function)
# bart-large-cnn = model summarizer yang proper, bukan t5-small
# device=-1 artinya CPU (tidak butuh GPU)

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

df["mean3"] = df[TARGET].rolling(3).mean()
df["mean24"] = df[TARGET].rolling(24).mean()

df = df.dropna()

# =========================
# LOAD MODEL
# =========================
gbr = joblib.load("models/gbr.pkl")
xgb = joblib.load("models/xgb.pkl")
knn = joblib.load("models/knn.pkl")
scaler = joblib.load("models/scaler.pkl")


FEATURES = joblib.load("models/features.pkl")  # 🔥 TAMBAHAN

# ⚠️ DL optional (biar gak berat kalau error)
try:
    lstm = load_model("models/lstm.h5")
    bilstm = load_model("models/bilstm.h5")
    DL_READY = True
except:
    DL_READY = False

# =========================
# PREPROCESS
# =========================
X = df[FEATURES].values
y = df[TARGET].values

data_ml = X[-1].reshape(1, -1)

# =========================
# LSTM DATA (optional)
# =========================
if DL_READY:
    scaler_lstm = joblib.load("models/scaler_lstm.pkl")

    X_lstm = scaler_lstm.transform(df.values)
    data_seq = X_lstm[-24:].reshape(1, 24, X_lstm.shape[1])

# =========================
# METRICS
# =========================
def get_metrics(y_true, y_pred):
    return {
        "MAE": round(mean_absolute_error(y_true, y_pred), 3),
        "RMSE": round(np.sqrt(mean_squared_error(y_true, y_pred)), 3),
        "MAPE": round(np.mean(np.abs((y_true - y_pred) / y_true)) * 100, 2),
        "R2": round(r2_score(y_true, y_pred), 3)
    }

metrics = {
    "GBR": get_metrics(y, gbr.predict(X)),
    "XGB": get_metrics(y, xgb.predict(X)),
    "KNN": get_metrics(y, knn.predict(scaler.transform(X)))
}

def get_best_model(metrics):
    best_model = min(metrics, key=lambda m: metrics[m]["MAPE"])
    return best_model, metrics[best_model]

def generate_nlp_report(stats, best_model_name, best_metrics):
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
        f"dengan nilai MAPE sebesar {best_metrics['MAPE']}% "
        f"dan RMSE sebesar {best_metrics['RMSE']}. "
        
        f"Hal ini menunjukkan bahwa model memiliki tingkat akurasi yang "
        f"{'tinggi' if best_metrics['MAPE'] < 10 else 'cukup' if best_metrics['MAPE'] < 20 else 'rendah'} "
        f"dalam melakukan prediksi."
    )

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

    if week4 > week1 + 0.1:
        trend = "meningkat menuju akhir periode"
    elif week4 < week1 - 0.1:
        trend = "menurun menuju akhir periode"
    else:
        trend = "relatif stabil sepanjang periode"

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
    
    
# =========================
# ROUTE UTAMA
# =========================
@app.route("/", methods=["GET", "POST"])
def index():
    result = []
    selected_model = "all"
    nlp_report = session.pop('nlp_report', None)

    if request.method == "POST":
        selected_model = request.form.get("model")
        actual = y[-1]

        def add_row(name, pred):
            error = abs(pred - actual)
            result.append({
                "model": name,
                "prediction": round(pred, 3),
                "actual": round(actual, 3),
                "error": round(error, 3)
            })

        # ===== ML =====
        if selected_model in ["gbr", "all"]:
            add_row("GBR", float(gbr.predict(data_ml)[0]))

        if selected_model in ["xgb", "all"]:
            add_row("XGB", float(xgb.predict(data_ml)[0]))

        if selected_model in ["knn", "all"]:
            add_row("KNN", float(knn.predict(scaler.transform(data_ml))[0]))

        # ===== DL =====
        if DL_READY:
            if selected_model in ["lstm", "all"]:
                add_row("LSTM", float(lstm.predict(data_seq, verbose=0)[0][0]))

            if selected_model in ["bilstm", "all"]:
                add_row("BiLSTM", float(bilstm.predict(data_seq, verbose=0)[0][0]))

        # sort berdasarkan error
        result = sorted(result, key=lambda x: x["error"])

        # simpan CSV kecil
        if result:
            pd.DataFrame(result).to_csv("hasil_prediksi.csv", index=False)

    return render_template(
        "index.html",
        result=result,
        metrics=metrics,
        selected_model=selected_model,
        nlp_report=nlp_report
    )

# =========================
# PINDAH KE DASHBOARD
# =========================
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

# =========================
# GENERATE FULL CSV
# =========================
@app.route("/generate_full")
def generate_full():
    try:
        print("📊 Generate full CSV dimulai...")

        np.random.seed(42)

        df_out = df.copy()

        # =========================
        # ML PREDICTION (DATA ASLI)
        # =========================
        df_out["GBR"] = gbr.predict(X)
        df_out["XGB"] = xgb.predict(X)
        df_out["KNN"] = knn.predict(scaler.transform(X))

        # =========================
        # DL PREDICTION (DATA ASLI)
        # =========================
        if DL_READY:
            sequences = [X_lstm[i-24:i] for i in range(24, len(X_lstm))]
            sequences = np.array(sequences)

            lstm_preds   = lstm.predict(sequences, verbose=0).flatten()
            bilstm_preds = bilstm.predict(sequences, verbose=0).flatten()

            df_out["LSTM"]   = np.nan
            df_out["BiLSTM"] = np.nan

            df_out.loc[df_out.index[24:], "LSTM"]   = lstm_preds
            df_out.loc[df_out.index[24:], "BiLSTM"] = bilstm_preds

        # =========================
        # 🚀 FUTURE PREDICTION (FIXED v6)
        # =========================
        future_steps = 24 * 31

        # ⚠️ KUNCI: simpan TARGET history sebagai Series murni
        # Lag & rolling SELALU dihitung dari sini — tidak dari kolom lag di df_history
        target_series = df[TARGET].copy().tolist()  # pakai list untuk append O(1)

        # df_history untuk LSTM window — harus punya semua kolom df
        df_history = df.copy().reset_index(drop=True)

        last_df_row = df.iloc[-1]
        last_time = pd.Timestamp(
            year=int(last_df_row["YEAR"]),
            month=int(last_df_row["MO"]),
            day=int(last_df_row["DY"]),
            hour=int(last_df_row["HR"])
        )

        future_rows = []

        for i in range(future_steps):
            if i % 24 == 0:
                day_num = (i // 24) + 1
                print(f"⏳ Generating future prediction... Day {day_num}/31")
                next_time = last_time + pd.Timedelta(hours=i + 1)

            # ===========================
            # LAG & ROLLING — dari target_series MURNI
            # Ini satu-satunya sumber kebenaran untuk rekursif
            # ===========================
            lag1  = target_series[-1]
            lag2  = target_series[-2]
            lag3  = target_series[-3]
            lag24 = target_series[-24]

            mean3  = float(np.mean(target_series[-3:]))
            mean24 = float(np.mean(target_series[-24:]))

            # ===========================
            # FEATURE DICT UNTUK ML
            # ===========================
            feature_dict = {}
            for col in FEATURES:
                if col == "lag1":     feature_dict[col] = lag1
                elif col == "lag2":   feature_dict[col] = lag2
                elif col == "lag3":   feature_dict[col] = lag3
                elif col == "lag24":  feature_dict[col] = lag24
                elif col == "mean3":  feature_dict[col] = mean3
                elif col == "mean24": feature_dict[col] = mean24
                elif col == "HR":     feature_dict[col] = next_time.hour
                elif col == "DY":     feature_dict[col] = next_time.day
                elif col == "MO":     feature_dict[col] = next_time.month
                elif col == "YEAR":   feature_dict[col] = next_time.year
                else:
                    feature_dict[col] = float(last_df_row[col]) if col in last_df_row.index else 0.0

            X_future = pd.DataFrame([feature_dict], columns=FEATURES)

            # ===========================
            # ML PREDICTION
            # ===========================
            pred_gbr = float(gbr.predict(X_future)[0])
            pred_xgb = float(xgb.predict(X_future)[0])
            pred_knn = float(knn.predict(scaler.transform(X_future))[0])

            # ===========================
            # DL PREDICTION
            # Window dari df_history — format persis seperti saat training
            # ===========================
            pred_lstm   = np.nan
            pred_bilstm = np.nan

            if DL_READY:
                # Bangun template baris baru dengan semua kolom df
                # Update nilai dinamis, sisanya dari baris terakhir df_history
                template_row = df_history.iloc[-1].copy()
                template_row["YEAR"]   = next_time.year
                template_row["MO"]     = next_time.month
                template_row["DY"]     = next_time.day
                template_row["HR"]     = next_time.hour
                template_row[TARGET]   = pred_gbr
                template_row["lag1"]   = lag1
                template_row["lag2"]   = lag2
                template_row["lag3"]   = lag3
                template_row["lag24"]  = lag24
                template_row["mean3"]  = mean3
                template_row["mean24"] = mean24

                # Sliding window 24 jam: 23 baris terakhir + 1 baris baru
                window_df = pd.concat([
                    df_history.iloc[-23:],
                    pd.DataFrame([template_row])
                ], ignore_index=True)

                # Transform — input harus df.values persis seperti saat fit scaler_lstm
                window_scaled     = scaler_lstm.transform(window_df[df.columns].values)
                data_seq_future   = window_scaled.reshape(1, 24, window_scaled.shape[1])

                pred_lstm   = float(lstm.predict(data_seq_future, verbose=0)[0][0])
                pred_bilstm = float(bilstm.predict(data_seq_future, verbose=0)[0][0])

            # ===========================
            # UPDATE HISTORY
            # target_series: append pred_gbr (TANPA noise — noise merusak lag berikutnya)
            # df_history: append baris lengkap untuk LSTM window
            # ===========================
            target_series.append(pred_gbr)

            new_full_row = df_history.iloc[-1].copy()
            new_full_row["YEAR"]   = next_time.year
            new_full_row["MO"]     = next_time.month
            new_full_row["DY"]     = next_time.day
            new_full_row["HR"]     = next_time.hour
            new_full_row[TARGET]   = pred_gbr
            # Lag di df_history diupdate sesuai rolling terbaru
            # supaya LSTM punya context yang konsisten
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

            # ===========================
            # SIMPAN ROW HASIL
            # ===========================
            new_row = {
                "YEAR":   next_time.year,
                "MO":     next_time.month,
                "DY":     next_time.day,
                "HR":     next_time.hour,
                TARGET:   round(pred_gbr, 3),
                "GBR":    round(pred_gbr, 3),
                "XGB":    round(pred_xgb, 3),
                "KNN":    round(pred_knn, 3),
                "LSTM":   round(pred_lstm, 3)   if not np.isnan(pred_lstm)   else np.nan,
                "BiLSTM": round(pred_bilstm, 3) if not np.isnan(pred_bilstm) else np.nan,
            }
            future_rows.append(new_row)
            
        df_future = pd.DataFrame(future_rows)
        df_out = pd.concat([df_out, df_future], ignore_index=True)
        print("✅ Future prediction (ML + DL) selesai")
        
        # ambil hanya future (misalnya 30 hari terakhir)
        df_future_only = df_future.copy()

        stats = build_forecast_text(df_future_only)

        best_model_name, best_metrics = get_best_model(metrics)

        nlp_report = generate_nlp_report(stats, best_model_name, best_metrics)
        
        print("🧠 NLP REPORT:")
        print(nlp_report)

        # =========================
        # FORMAT FINAL
        # =========================
        cols = ["YEAR", "MO", "DY", "HR", TARGET, "GBR", "XGB", "KNN"]
        if DL_READY:
            cols += ["LSTM", "BiLSTM"]

        df_out = df_out[cols]

        for col in ["YEAR", "MO", "DY", "HR"]:
            df_out[col] = df_out[col].astype(int)

        num_cols = df_out.select_dtypes(include=[np.number]).columns
        for col in num_cols:
            df_out[col] = df_out[col].round(3)
            df_out[col] = df_out[col].astype(str).str.replace(".", ",", regex=False)

        # =========================
        # SAVE CSV
        # =========================
        with open("hasil_prediksi_full.csv", "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write("NASA/POWER Prediction Result\n")
            f.write("Source: Machine Learning & Deep Learning Forecast\n")
            f.write("Dates (month/day/year): Generated Future Prediction (30 Days Ahead)\n")
            f.write("Location: Bawean (Latitude: -5.75, Longitude: 112.65)\n")
            f.write("Parameter(s):\n")
            f.write("WS10M  Wind Speed at 10 Meters (m/s)\n")
            f.write("\n")
            f.write("Model Information:\n")
            f.write("ML Models : Gradient Boosting Regressor (GBR), XGBoost (XGB), K-Nearest Neighbors (KNN)\n")
            f.write("DL Models : LSTM, Bidirectional LSTM\n")
            f.write("\n")
            f.write("Feature Engineering:\n")
            f.write("Lag Features : lag1, lag2, lag3, lag24\n")
            f.write("Rolling Mean : mean3, mean24\n")
            f.write("\n")
            f.write("Forecast Summary (AI Generated):\n")
            f.write(f"{nlp_report}\n")
            f.write("\n")
            f.write("Notes:\n")
            f.write("Prediction uses recursive forecasting method\n")
            f.write("Long horizon prediction may become smooth due to error accumulation\n")
            f.write("-END HEADER-\n\n")

            df_out.to_csv(f, index=False, sep=";")

        print("✅ CSV selesai dibuat")
        session['nlp_report'] = nlp_report
        return redirect(url_for('index'))

    except Exception as e:
        import traceback
        return f"Error: {e}<br><pre>{traceback.format_exc()}</pre>"
    
# =========================
# DOWNLOAD FULL CSV
# =========================
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
    