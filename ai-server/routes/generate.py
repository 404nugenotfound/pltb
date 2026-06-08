from flask import *

import os
import time
import traceback
import threading
import joblib

import numpy as np
import pandas as pd

from config import *
from config import TARGET

from utils.dataset import *
from utils.progress import *

from training.nlp import *
from training.metrics import load_metrics_for_var, load_dl_metrics_for_var

from config import OUTPUT_FOLDER


generate_bp = Blueprint(
    "generate",
    __name__
)

# =========================
# ROUTE PROGRESS GENERATE
# =========================
@generate_bp.route("/generate_progress")
def get_progress():
    with progress_lock:
        username = session.get("username")
        p = generate_progress.get(username, {})

    elapsed = time.time() - p["start_time"] if p.get("start_time") else 0
    day     = p.get("day", 0)
    total   = p.get("total", 7)
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

# =========================
# ROUTE COMMIT GENERATE
# =========================
@generate_bp.route("/generate_commit", methods=["POST"])
def generate_commit():
    username = session.get("username")

    with progress_lock:
        p = generate_progress.get(username, {})

    if p.get("done") and p.get("nlp_report"):
        session["nlp_report"]         = p["nlp_report"]
        session["last_generate_mode"] = p.get("last_mode", "general")
        session.modified = True
        return jsonify({"status": "ok"})

    return jsonify({"status": "no_data"}), 400

# =========================
# BACKGROUND WORKER — GENERATE FULL
# =========================
def _worker_generate_full(
    username: str,
    selected_model: str,
    active_models: list,
    output_mode: str = "general",
    selected_var: str = "WS10M"
) -> None:

    from app import df
    from training.load_ml import load_ml_for_var
    from training.load_dl import load_dl_for_var

    # ✅ Load model per variabel
    gbr, xgb, knn, scaler, FEATURES = load_ml_for_var(selected_var)
    print("ML FEATURES =", FEATURES)
    ML_READY = all([
        gbr is not None, xgb is not None,
        knn is not None, scaler is not None,
        len(FEATURES) > 0
    ])
    X = np.array(df[FEATURES].values) if ML_READY else np.array([])

    dl_state      = load_dl_for_var(df, selected_var)
    DL_READY      = dl_state["DL_READY"]
    lstm          = dl_state["lstm"]
    bilstm        = dl_state["bilstm"]
    scaler_X      = dl_state["scaler_X"]
    scaler_y      = dl_state["scaler_y"]
    X_scaled      = dl_state["X_scaled"]
    DL_INPUT_COLS = dl_state["DL_INPUT_COLS"]

    # ✅ Load metrics per variabel — bukan dari app global
    metrics    = load_metrics_for_var(selected_var)
    metrics_dl = load_dl_metrics_for_var(selected_var)

    print("=" * 50)
    print("🚀 WORKER FULL START")
    print("SELECTED VAR =", selected_var)
    print("METRICS ML   =", list(metrics.keys()))
    print("METRICS DL   =", list(metrics_dl.keys()))
    print("=" * 50)

    try:
        np.random.seed(42)
        df_out = df.copy()

        # — Prediksi historis —
        if ML_READY:
            if "GBR" in active_models and gbr is not None:
                df_out["GBR"] = gbr.predict(X)
            if "XGB" in active_models and xgb is not None:
                df_out["XGB"] = xgb.predict(X)
            if "KNN" in active_models and knn is not None and scaler is not None:
                df_out["KNN"] = knn.predict(scaler.transform(X))

        need_dl = DL_READY and X_scaled is not None and any(
            m in active_models for m in ["LSTM", "BiLSTM"]
        )
        if need_dl and scaler_y is not None and lstm is not None and bilstm is not None:
            seqs_hist = np.array([
                X_scaled[i-STEP:i]
                for i in range(STEP, len(X_scaled))
            ])
            lstm_preds   = scaler_y.inverse_transform(lstm.predict(seqs_hist,   verbose=0)).flatten()
            bilstm_preds = scaler_y.inverse_transform(bilstm.predict(seqs_hist, verbose=0)).flatten()

            df_out["LSTM"]   = np.nan
            df_out["BiLSTM"] = np.nan
            if "LSTM"   in active_models: df_out.loc[df_out.index[STEP:], "LSTM"]   = lstm_preds
            if "BiLSTM" in active_models: df_out.loc[df_out.index[STEP:], "BiLSTM"] = bilstm_preds

        # — Setup future forecast —
        future_steps   = 24 * 7
        target_series  = df[selected_var].tolist()
        last_row_dict  = df.iloc[-1].to_dict()
        last_time      = pd.Timestamp(
            year=int(last_row_dict["YEAR"]), month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),   hour=int(last_row_dict["HR"])
        )
        history_window = df.tail(STEP).copy().reset_index(drop=True)
        future_rows    = []

        for i in range(future_steps):
            # — Cek cancel —
            with progress_lock:
                if generate_progress.get(username, {}).get("cancel"):
                    generate_progress[username].update({
                        "running": False, "done": True,
                        "error": "Dibatalkan user"
                    })
                    return

            if i % 24 == 0:
                with progress_lock:
                    generate_progress[username]["day"] = (i // 24) + 1
                print(f"⏳ Day {(i//24)+1}/7")

            next_time = last_time + pd.Timedelta(hours=i + 1)
            lag1  = target_series[-1]
            lag2  = target_series[-2]
            lag3  = target_series[-3]
            lag24 = target_series[-24]
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
            pred_gbr = float(gbr.predict(X_fut)[0])                    if ("GBR" in active_models and gbr    is not None)                        else float("nan")
            pred_xgb = float(xgb.predict(X_fut)[0])                    if ("XGB" in active_models and xgb    is not None)                        else float("nan")
            pred_knn = float(knn.predict(scaler.transform(X_fut))[0])  if ("KNN" in active_models and knn    is not None and scaler is not None)  else float("nan")

            # Anchor = model terbaik yang tersedia
            anchor = pred_gbr
            if np.isnan(anchor): anchor = pred_xgb
            if np.isnan(anchor): anchor = pred_knn
            if np.isnan(anchor): anchor = lag1

            pred_lstm = pred_bilstm = float("nan")
            if need_dl and any(m in active_models for m in ["LSTM", "BiLSTM"]):
                try:
                    new_row = history_window.iloc[-1].copy()
                    new_row["YEAR"]       = int(next_time.year)
                    new_row["MO"]         = int(next_time.month)
                    new_row["DY"]         = int(next_time.day)
                    new_row["HR"]         = int(next_time.hour)
                    new_row[selected_var] = anchor
                    new_row["lag1"]       = lag1
                    new_row["lag2"]       = lag2
                    new_row["lag3"]       = lag3
                    new_row["lag24"]      = lag24
                    new_row["mean3"]      = mean3
                    new_row["mean24"]     = mean24

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
                selected_var: round(anchor, 3),
            }
            if "GBR"    in active_models: row["GBR"]    = round(pred_gbr,    3) if not np.isnan(pred_gbr)    else np.nan
            if "XGB"    in active_models: row["XGB"]    = round(pred_xgb,    3) if not np.isnan(pred_xgb)    else np.nan
            if "KNN"    in active_models: row["KNN"]    = round(pred_knn,    3) if not np.isnan(pred_knn)    else np.nan
            if "LSTM"   in active_models: row["LSTM"]   = round(pred_lstm,   3) if not np.isnan(pred_lstm)   else np.nan
            if "BiLSTM" in active_models: row["BiLSTM"] = round(pred_bilstm, 3) if not np.isnan(pred_bilstm) else np.nan
            future_rows.append(row)

        df_future = pd.DataFrame(future_rows)
        df_out    = pd.concat([df_out, df_future], ignore_index=True)

        # ✅ NLP report pakai metrics per variabel
        stats      = build_forecast_text(df_future.copy(), selected_var)
        best_name  = get_best_ml_and_dl(metrics, metrics_dl)[0]
        all_metrics_var = {**metrics, **metrics_dl}

        # ✅ Guard: kalau best_name tidak ada di metrics variabel ini
        if best_name not in all_metrics_var:
            print(f"⚠️ best_name '{best_name}' tidak ada di metrics {selected_var}, fallback ke model pertama")
            best_name = list(all_metrics_var.keys())[0] if all_metrics_var else "GBR"

        nlp_report = generate_nlp_report(stats, best_name, all_metrics_var[best_name])

        # — Susun kolom output —
        base_cols = ["YEAR", "MO", "DY", "HR", selected_var]
        pred_cols = [c for c in ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"] if c in df_out.columns]
        df_out    = df_out[base_cols + pred_cols]

        for col in ["YEAR", "MO", "DY", "HR"]:
            df_out[col] = df_out[col].astype(int)
        for col in df_out.select_dtypes(include=[np.number]).columns:
            df_out[col] = df_out[col].round(3)
            df_out[col] = df_out[col].astype(str).str.replace(".", ",", regex=False)

        filename = (
            f"{username}_hasil_prediksi_best.csv"
            if output_mode == "best"
            else f"{username}_hasil_prediksi_general.csv"
        )
        output_path = os.path.join(OUTPUT_FOLDER, filename)

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write(f"Dataset: {os.path.basename(get_active_dataset_path())}\n")
            f.write(f"Variabel: {selected_var}\n")  # ✅ info variabel di header
            f.write(f"Forecast Summary:\n{nlp_report}\n\n-END HEADER-\n\n")
            df_out.to_csv(f, index=False, sep=";")

        with progress_lock:
            generate_progress[username].update({
                "running": False, "done": True,
                "nlp_report": nlp_report,
                "last_mode": output_mode,
                "error": None
            })

    except Exception as e:
        print(f"❌ Worker Full error: {traceback.format_exc()}")
        with progress_lock:
            generate_progress[username].update({
                "running": False, "done": True,
                "nlp_report": None, "error": str(e)
            })


# =========================
# BACKGROUND WORKER — GENERATE BEST
# =========================
def _worker_generate_best(username: str) -> None:
    from app import df
    from training.load_ml import load_ml_for_var
    from training.load_dl import load_dl_for_var
    from training.metrics import get_metrics, load_metrics_for_var, load_dl_metrics_for_var
    from training.nlp import build_forecast_text, generate_nlp_report_best
    from tensorflow.keras.models import load_model as _load

    try:
        np.random.seed(42)

        last_row_dict = df.iloc[-1].to_dict()
        last_time     = pd.Timestamp(
            year=int(last_row_dict["YEAR"]), month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),   hour=int(last_row_dict["HR"])
        )
        future_steps = 24 * 7

        # ✅ Hasil per variabel
        all_future_dfs  = []   # list df_future per var untuk digabung ke CSV
        stats_per_var   = {}   # untuk NLP report
        best_per_var    = {}   # untuk NLP report
        stacking_info   = []   # untuk header CSV

        # =========================
        # LOOP PER VARIABEL
        # =========================
        for var_idx, var in enumerate(TRAIN_VARS):
            if var not in df.columns:
                print(f"⚠️ Skip {var} — kolom tidak ada")
                continue

            print(f"\n{'='*50}")
            print(f"🚀 Processing {var} ({var_idx+1}/{len(TRAIN_VARS)})")
            print(f"{'='*50}")

            # — Load model —
            gbr, xgb, knn, scaler, FEATURES = load_ml_for_var(var)
            dl_state      = load_dl_for_var(df, var)
            DL_READY      = dl_state["DL_READY"]
            scaler_X      = dl_state["scaler_X"]
            scaler_y      = dl_state["scaler_y"]
            DL_INPUT_COLS = dl_state["DL_INPUT_COLS"]

            if not DL_READY:
                print(f"⚠️ DL {var} tidak siap, skip")
                continue

            metrics_var    = load_metrics_for_var(var)
            metrics_dl_var = load_dl_metrics_for_var(var)

            # — Pilih DL terbaik —
            best_dl_name = min(metrics_dl_var, key=lambda m: metrics_dl_var[m]["sMAPE"]) if metrics_dl_var else "LSTM"
            dl_filename  = f"bilstm_{var}.h5" if best_dl_name.upper() == "BILSTM" else f"lstm_{var}.h5"
            print(f"🤖 Best DL [{var}]: {best_dl_name}")

            _lstm    = _load(os.path.join(MODEL_FOLDER, dl_filename))
            _dl_cols = DL_INPUT_COLS if DL_INPUT_COLS else [c for c in df.columns if c != var]

            ML_READY = all([gbr is not None, xgb is not None, scaler is not None, len(FEATURES) > 0])
            X = np.array(df[FEATURES].values) if ML_READY else np.array([])
            y = np.array(df[var].values)

            # — Stacking metrics historis —
            _X_sc     = np.array(scaler_X.transform(df[_dl_cols].values), dtype=np.float32)
            seqs_hist = np.array([_X_sc[i-STEP:i] for i in range(STEP, len(_X_sc))])
            stacked_preds = scaler_y.inverse_transform(
                _lstm.predict(seqs_hist, verbose=0)
            ).flatten()

            stacking_metrics = get_metrics(
                np.array(y[STEP:STEP + len(stacked_preds)]),
                np.array(stacked_preds)
            )
            stacked_col   = f"XGB_{best_dl_name}_{var}"
            stacking_name = f"XGB-{best_dl_name} [{var}]"
            print(f"📊 Stacking [{var}]: {stacking_metrics}")

            # — Future forecast —
            target_series  = df[var].tolist()
            history_window = df.tail(STEP).copy().reset_index(drop=True)
            future_rows    = []
            
            # ✅ Tambah ini sebelum loop TRAIN_VARS
            lo, hi = {"WS10M": (0, 50), "RH2M": (0, 100), "WD10M": (0, 360)}.get(var, (None, None))

            for i in range(future_steps):
                # Cek cancel
                with progress_lock:
                    if generate_progress.get(username, {}).get("cancel"):
                        generate_progress[username].update({
                            "running": False, "done": True,
                            "error": "Dibatalkan user"
                        })
                        return

                # Update progress — total = 7 hari × 3 variabel
                if i % 24 == 0:
                    day_overall = var_idx * 7 + (i // 24) + 1
                    with progress_lock:
                        generate_progress[username]["day"]   = day_overall
                        generate_progress[username]["total"] = 7 * len(TRAIN_VARS)
                    print(f"⏳ [{var}] Day {(i//24)+1}/7")

                next_time = last_time + pd.Timedelta(hours=i + 1)
                lag1  = target_series[-1]
                lag2  = target_series[-2]
                lag3  = target_series[-3]
                lag24 = target_series[-24]
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
                pred_xgb = float(xgb.predict(X_fut)[0]) if xgb is not None else float("nan")
                # ✅ Clip
                if lo is not None and not np.isnan(pred_xgb):
                    pred_xgb = float(np.clip(pred_xgb, lo, hi))

                new_row           = history_window.iloc[-1].copy()
                new_row["YEAR"]   = int(next_time.year)
                new_row["MO"]     = int(next_time.month)
                new_row["DY"]     = int(next_time.day)
                new_row["HR"]     = int(next_time.hour)
                new_row[var]      = pred_xgb
                new_row["lag1"]   = lag1
                new_row["lag2"]   = lag2
                new_row["lag3"]   = lag3
                new_row["lag24"]  = lag24
                new_row["mean3"]  = mean3
                new_row["mean24"] = mean24

                history_window = pd.concat(
                    [history_window.iloc[1:], pd.DataFrame([new_row])],
                    ignore_index=True
                )
                window_sc    = scaler_X.transform(history_window[_dl_cols].values)
                seq_future   = window_sc.reshape(1, STEP, window_sc.shape[1])
                pred_stacked = float(scaler_y.inverse_transform(
                    _lstm.predict(seq_future, verbose=0))[0][0])
                # ✅ Clip
                if lo is not None:
                    pred_stacked = float(np.clip(pred_stacked, lo, hi))

                target_series.append(pred_stacked)
                future_rows.append({
                    "YEAR":      int(next_time.year),
                    "MO":        int(next_time.month),
                    "DY":        int(next_time.day),
                    "HR":        int(next_time.hour),
                    var:         round(pred_stacked, 3),
                    stacked_col: round(pred_stacked, 3),
                    f"XGB_Base_{var}": round(pred_xgb, 3),
                })

            df_future = pd.DataFrame(future_rows)
            all_future_dfs.append(df_future)

            # — Kumpulkan stats untuk NLP —
            stats_per_var[var] = build_forecast_text(df_future.copy(), var)

            # — Best model per var untuk NLP —
            all_met = {**metrics_var, **metrics_dl_var}
            best_name_var = min(all_met, key=lambda m: all_met[m]["sMAPE"]) if all_met else stacking_name
            best_per_var[var] = (stacking_name, stacking_metrics)

            stacking_info.append(
                f"{var} | Model: {stacking_name} | "
                f"MAE={stacking_metrics['MAE']} RMSE={stacking_metrics['RMSE']} "
                f"sMAPE={stacking_metrics['sMAPE']}% R2={stacking_metrics['R2']}"
            )

            # ✅ Clear TF session antar variabel — bebaskan memory
            import tensorflow as tf
            tf.keras.backend.clear_session()

        # =========================
        # GABUNG CSV — semua variabel dalam satu file
        # =========================
        if not all_future_dfs:
            raise ValueError("Tidak ada variabel yang berhasil diproses")

        # Merge semua df_future berdasarkan YEAR, MO, DY, HR
        df_combined = all_future_dfs[0][["YEAR", "MO", "DY", "HR"]].copy()
        for df_f in all_future_dfs:
            cols_to_add = [c for c in df_f.columns if c not in ["YEAR", "MO", "DY", "HR"]]
            df_combined = df_combined.join(df_f[cols_to_add])

        for col in ["YEAR", "MO", "DY", "HR"]:
            df_combined[col] = df_combined[col].astype(int)
        for col in df_combined.select_dtypes(include=[np.number]).columns:
            df_combined[col] = df_combined[col].round(3)
            df_combined[col] = df_combined[col].astype(str).str.replace(".", ",", regex=False)

        # =========================
        # NLP REPORT — multi variabel
        # =========================
        nlp_report = generate_nlp_report_best(stats_per_var, best_per_var)

        # =========================
        # SIMPAN CSV
        # =========================
        output_path = os.path.join(OUTPUT_FOLDER, f"{username}_hasil_prediksi_best.csv")
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write(f"Dataset: {os.path.basename(get_active_dataset_path())}\n")
            f.write(f"Variabel: {', '.join(TRAIN_VARS)}\n")
            f.write(f"Mode: Best Stacking (XGB + Best DL) per variabel\n")
            for info in stacking_info:
                f.write(f"{info}\n")
            f.write(f"\nForecast Summary:\n{nlp_report}\n\n-END HEADER-\n\n")
            df_combined.to_csv(f, index=False, sep=";")

        with progress_lock:
            generate_progress[username].update({
                "running": False, "done": True,
                "nlp_report": nlp_report,
                "last_mode": "best",
                "error": None
            })

    except Exception as e:
        print(f"❌ Worker Best error: {traceback.format_exc()}")
        with progress_lock:
            generate_progress[username].update({
                "running": False, "done": True,
                "nlp_report": None, "error": str(e)
            })

# =========================
# GENERATE FULL
# =========================
@generate_bp.route("/generate_full", methods=["POST"])
def generate_full():

    from app import metrics, metrics_dl

    username     = session.get("username")
    selected_var = request.form.get("var", "WS10M")
    print(f"🔍 SELECTED VAR: {selected_var}")

    with progress_lock:
        if generate_progress.get(username, {}).get("running"):
            return jsonify({"status": "already_running"}), 409

        generate_progress[username] = {
            "running": True, "done": False,
            "day": 0, "total": 7,
            "mode": f"General [{selected_var}]",
            "start_time": time.time(),
            "error": None, "nlp_report": None, "cancel": False
        }

    selected_model = request.form.get("model", "all")

    # ✅ Gunakan metrics per variabel untuk tentukan active_models
    metrics_var    = load_metrics_for_var(selected_var)
    metrics_dl_var = load_dl_metrics_for_var(selected_var)
    all_models     = list(metrics_var.keys()) + list(metrics_dl_var.keys())

    active_models = (
        get_best_ml_and_dl(metrics_var, metrics_dl_var)
        if selected_model == "best"
        else all_models
    )

    threading.Thread(
        target=_worker_generate_full,
        args=(username, selected_model, active_models, "general", selected_var),
        daemon=True
    ).start()

    return jsonify({"status": "started"})


# =========================
# GENERATE BEST
# =========================
@generate_bp.route("/generate_best", methods=["POST"])
def generate_best():
    username = session.get("username")

    with progress_lock:
        if generate_progress.get(username, {}).get("running"):
            return jsonify({"status": "already_running"}), 409

        generate_progress[username] = {
            "running": True, "done": False,
            "day": 0, "total": 7 * len(TRAIN_VARS),  # ✅ 7 hari × 3 variabel
            "mode": "Best Stacking (All Variables)",
            "start_time": time.time(),
            "error": None, "nlp_report": None, "cancel": False
        }

    # ✅ Validasi minimal satu variabel punya metrics
    any_ready = any(
        load_metrics_for_var(var)
        for var in TRAIN_VARS
    )
    if not any_ready:
        with progress_lock:
            generate_progress[username].update({"running": False, "done": True})
        return jsonify({
            "status": "error",
            "message": "Belum ada model terlatih — upload dan train dataset dulu"
        }), 400

    threading.Thread(
        target=_worker_generate_best,
        args=(username,),   # ✅ tidak perlu selected_var
        daemon=True
    ).start()

    return jsonify({"status": "started"})
# =========================
# CANCEL GENERATE
# =========================
@generate_bp.route("/cancel_generate", methods=["POST"])
def cancel_generate():
    username = session.get("username")
    with progress_lock:
        if username in generate_progress:
            generate_progress[username]["cancel"] = True
    return jsonify({"success": True})


# =========================
# DOWNLOAD
# =========================
@generate_bp.route("/download_full/<mode>")
def download_full(mode):
    username = session.get("username")
    filename = (
        f"{username}_hasil_prediksi_best.csv"
        if mode == "best"
        else f"{username}_hasil_prediksi_general.csv"
    )
    filepath = os.path.join(OUTPUT_FOLDER, filename)
    if os.path.exists(filepath):
        return send_file(filepath, as_attachment=True)
    return "File belum ada", 404


# =========================
# OVERVIEW DATA
# =========================
@generate_bp.route("/overview_data")
def overview_data():
    return jsonify({
        "nlp_report":    session.get("nlp_report", ""),
        "generate_mode": session.get("last_generate_mode", "general")
    })