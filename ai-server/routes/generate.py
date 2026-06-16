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
from training.metrics import get_metrics_for_var, save_ensemble_metrics
from training.feature_engineering import load_and_engineer

from config import OUTPUT_FOLDER

generate_bp = Blueprint("generate", __name__)


# =========================
# ROUTE PROGRESS GENERATE
# =========================
@generate_bp.route("/generate_progress")
def get_progress():
    with progress_lock:
        username = session.get("username")
        p = generate_progress.get(username, {})

    elapsed = time.time() - p["start_time"] if p.get("start_time") else 0
    day = p.get("day", 0)
    total = p.get("total", 7)
    eta_str = (
        f"{int(max(0,(total-day)*(elapsed/day))//60)}m "
        f"{int(max(0,(total-day)*(elapsed/day))%60)}s"
        if day > 0 and elapsed > 0
        else "Menghitung..."
    )
    return jsonify(
        {
            "running": p.get("running", False),
            "done": p.get("done", False),
            "day": day,
            "total": total,
            "mode": p.get("mode", ""),
            "eta": eta_str,
            "elapsed": f"{int(elapsed//60)}m {int(elapsed%60)}s",
            "error": p.get("error"),
            "nlp_report": p.get("nlp_report"),
            "last_mode": p.get("last_mode", "general"),
            "ensemble_summary": p.get("ensemble_summary", {}),
        }
    )


# =========================
# ROUTE COMMIT GENERATE
# =========================
@generate_bp.route("/generate_commit", methods=["POST"])
def generate_commit():
    username = session.get("username")

    with progress_lock:
        p = generate_progress.get(username, {})

    if p.get("done") and p.get("nlp_report"):
        session["nlp_report"] = p["nlp_report"]
        session["last_generate_mode"] = p.get("last_mode", "general")
        session.modified = True
        return jsonify({"status": "ok"})

    return jsonify({"status": "no_data"}), 400


# =========================
# BACKGROUND WORKER — GENERATE FULL
# =========================
def _worker_generate_full(
    username, selected_model, active_models, output_mode, selected_var, dataset_path
):

    from app import df
    from training.load_ml import load_ml_for_var
    from training.load_dl import load_dl_for_var
    from training.feature_engineering import load_and_engineer

    # ✅ Load model per variabel
    gbr, xgb, knn, scaler, FEATURES = load_ml_for_var(selected_var, username=username)
    print("ML FEATURES =", FEATURES)
    ML_READY = all(
        [
            gbr is not None,
            xgb is not None,
            knn is not None,
            scaler is not None,
            len(FEATURES) > 0,
        ]
    )

    # ✅ Bug 3 fix — pakai df_var yang udah di-engineer
    df_var = load_and_engineer(dataset_path, target_var=selected_var)
    X = np.array(df_var[FEATURES].values) if ML_READY else np.array([])

    dl_state = load_dl_for_var(df_var, selected_var, username=username)
    DL_READY = dl_state["DL_READY"]
    lstm = dl_state["lstm"]
    bilstm = dl_state["bilstm"]
    scaler_X = dl_state["scaler_X"]
    scaler_y = dl_state["scaler_y"]
    X_scaled = dl_state["X_scaled"]
    DL_INPUT_COLS = dl_state["DL_INPUT_COLS"]
    is_circular = dl_state.get("is_circular", False)

    def decode_dl(raw):
        if is_circular:
            return np.rad2deg(np.arctan2(raw[:, 0], raw[:, 1])) % 360
        else:
            return scaler_y.inverse_transform(raw).flatten()

    # ✅ Load metrics per variabel
    metrics = load_metrics_for_var(selected_var, username=username)
    metrics_dl = load_dl_metrics_for_var(selected_var, username=username)

    print("=" * 50)
    print("🚀 WORKER FULL START")
    print("SELECTED VAR =", selected_var)
    print("METRICS ML   =", list(metrics.keys()))
    print("METRICS DL   =", list(metrics_dl.keys()))
    print("=" * 50)

    try:
        np.random.seed(42)
        df_out = df.copy()

        # — Prediksi historis ML —
        if ML_READY:
            if "GBR" in active_models and gbr is not None:
                df_out["GBR"] = gbr.predict(X)
            if "XGB" in active_models and xgb is not None:
                df_out["XGB"] = xgb.predict(X)
            if "KNN" in active_models and knn is not None and scaler is not None:
                df_out["KNN"] = knn.predict(scaler.transform(X))

        need_dl = (
            DL_READY
            and X_scaled is not None
            and any(m in active_models for m in ["LSTM", "BiLSTM"])
        )

        # ✅ Bug 1 fix — historis DL bersih, tanpa seq_future
        if (
            need_dl
            and (scaler_y is not None or is_circular)
            and lstm is not None
            and bilstm is not None
        ):
            seqs_hist = np.array(
                [X_scaled[i - STEP : i] for i in range(STEP, len(X_scaled))]
            )
            lstm_preds = decode_dl(lstm.predict(seqs_hist, verbose=0))
            bilstm_preds = decode_dl(bilstm.predict(seqs_hist, verbose=0))

            df_out["LSTM"] = np.nan
            df_out["BiLSTM"] = np.nan
            if "LSTM" in active_models:
                df_out.loc[df_out.index[STEP:], "LSTM"] = lstm_preds
            if "BiLSTM" in active_models:
                df_out.loc[df_out.index[STEP:], "BiLSTM"] = bilstm_preds

        # — Setup future forecast —
        future_steps = 24 * 7
        target_series = df[selected_var].tolist()
        last_row_dict = df.iloc[-1].to_dict()
        last_time = pd.Timestamp(
            year=int(last_row_dict["YEAR"]),
            month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),
            hour=int(last_row_dict["HR"]),
        )
        history_window = df_var.tail(STEP).copy().reset_index(drop=True)
        future_rows = []
        
        lo, hi = {"WS10M": (0, 50), "RH2M": (0, 100), "WD10M": (0, 360)}.get(selected_var, (None, None))    
        for i in range(future_steps):
            with progress_lock:
                if generate_progress.get(username, {}).get("cancel"):
                    generate_progress[username].update(
                        {"running": False, "done": True, "error": "Dibatalkan user"}
                    )
                    return

            if i % 24 == 0:
                with progress_lock:
                    generate_progress[username]["day"] = (i // 24) + 1
                print(f"⏳ Day {(i//24)+1}/7")

            next_time = last_time + pd.Timedelta(hours=i + 1)
            lag1 = target_series[-1]
            lag2 = target_series[-2]
            lag3 = target_series[-3]
            lag24 = target_series[-24]
            mean3 = float(np.mean(target_series[-3:]))
            mean24 = float(np.mean(target_series[-24:]))

            fv: list = []
            for col in FEATURES:
                if col == "lag1":
                    fv.append(lag1)
                elif col == "lag2":
                    fv.append(lag2)
                elif col == "lag3":
                    fv.append(lag3)
                elif col == "lag24":
                    fv.append(lag24)
                elif col == "mean3":
                    fv.append(mean3)
                elif col == "mean24":
                    fv.append(mean24)
                elif col == "HR":
                    fv.append(int(next_time.hour))
                elif col == "DY":
                    fv.append(int(next_time.day))
                elif col == "MO":
                    fv.append(int(next_time.month))
                elif col == "YEAR":
                    fv.append(int(next_time.year))
                elif col == "hour_sin":
                    fv.append(float(np.sin(2 * np.pi * next_time.hour / 24)))
                elif col == "hour_cos":
                    fv.append(float(np.cos(2 * np.pi * next_time.hour / 24)))
                elif col == "WD10M_sin":
                    fv.append(float(np.sin(np.deg2rad(target_series[-1]))))
                elif col == "WD10M_cos":
                    fv.append(float(np.cos(np.deg2rad(target_series[-1]))))
                elif col == "T2M":  # ← TAMBAH INI
                    same_hour = df[df["HR"] == next_time.hour]["T2M"].mean()
                    fv.append(float(same_hour))
                elif col == "std24":
                    fv.append(float(np.std(target_series[-24:])))
                else:
                    fv.append(float(last_row_dict.get(col, 0.0)))

            X_fut = np.array(fv, dtype=np.float32).reshape(1, -1)
            pred_gbr = (
                float(gbr.predict(X_fut)[0])
                if ("GBR" in active_models and gbr is not None)
                else float("nan")
            )
            pred_xgb = (
                float(xgb.predict(X_fut)[0])
                if ("XGB" in active_models and xgb is not None)
                else float("nan")
            )
            pred_knn = (
                float(knn.predict(scaler.transform(X_fut))[0])
                if ("KNN" in active_models and knn is not None and scaler is not None)
                else float("nan")
            )

            anchor = pred_gbr
            if np.isnan(anchor):
                anchor = pred_xgb
            if np.isnan(anchor):
                anchor = pred_knn
            if np.isnan(anchor):
                anchor = lag1
            
            
            if lo is not None and not np.isnan(anchor):
                anchor = float(np.clip(anchor, lo, hi))

            pred_lstm = pred_bilstm = float("nan")
            if need_dl and any(m in active_models for m in ["LSTM", "BiLSTM"]):
                try:
                    new_row = history_window.iloc[-1].copy()
                    new_row["YEAR"] = int(next_time.year)
                    new_row["MO"] = int(next_time.month)
                    new_row["DY"] = int(next_time.day)
                    new_row["HR"] = int(next_time.hour)
                    new_row[selected_var] = anchor
                    new_row["lag1"] = lag1
                    new_row["lag2"] = lag2
                    new_row["lag3"] = lag3
                    new_row["lag24"] = lag24
                    new_row["mean3"] = mean3
                    new_row["mean24"] = mean24
                    if selected_var == "WD10M":
                        if "WD10M_sin" in new_row.index:
                            new_row["WD10M_sin"] = float(np.sin(np.deg2rad(anchor)))
                        if "WD10M_cos" in new_row.index:
                            new_row["WD10M_cos"] = float(np.cos(np.deg2rad(anchor)))
                    if "T2M" in new_row.index:
                        same_hour = df[df["HR"] == next_time.hour]["T2M"].mean()
                        new_row["T2M"] = float(same_hour)

                    history_window = pd.concat(
                        [history_window.iloc[1:], pd.DataFrame([new_row])],
                        ignore_index=True,
                    )
                    window_sc = scaler_X.transform(history_window[DL_INPUT_COLS].values)
                    seq_future = window_sc.reshape(1, STEP, window_sc.shape[1])

                    # ✅ Bug 2 fix — pakai decode_dl
                    if "LSTM" in active_models:
                        pred_lstm = float(
                            decode_dl(lstm.predict(seq_future, verbose=0))[0]
                        )
                        if lo is not None and not np.isnan(pred_lstm):
                            pred_lstm = float(np.clip(pred_lstm, lo, hi))
                    if "BiLSTM" in active_models:
                        pred_bilstm = float(
                            decode_dl(bilstm.predict(seq_future, verbose=0))[0]
                        )
                        if lo is not None and not np.isnan(pred_bilstm):
                            pred_bilstm = float(np.clip(pred_bilstm, lo, hi))
                            
                except Exception as dl_err:
                    print(f"⚠️ DL skip iter {i}: {dl_err}")

            target_series.append(anchor)
            if selected_var == "WD10M":
                last_row_dict["WD10M_sin"] = float(np.sin(np.deg2rad(anchor)))
                last_row_dict["WD10M_cos"] = float(np.cos(np.deg2rad(anchor)))

            row: dict = {
                "YEAR": int(next_time.year),
                "MO": int(next_time.month),
                "DY": int(next_time.day),
                "HR": int(next_time.hour),
                selected_var: round(anchor, 3),
            }
            if "GBR" in active_models:
                row["GBR"] = round(pred_gbr, 3) if not np.isnan(pred_gbr) else np.nan
            if "XGB" in active_models:
                row["XGB"] = round(pred_xgb, 3) if not np.isnan(pred_xgb) else np.nan
            if "KNN" in active_models:
                row["KNN"] = round(pred_knn, 3) if not np.isnan(pred_knn) else np.nan
            if "LSTM" in active_models:
                row["LSTM"] = round(pred_lstm, 3) if not np.isnan(pred_lstm) else np.nan
            if "BiLSTM" in active_models:
                row["BiLSTM"] = (
                    round(pred_bilstm, 3) if not np.isnan(pred_bilstm) else np.nan
                )
            future_rows.append(row)

        df_future = pd.DataFrame(future_rows)
        df_out = pd.concat([df_out, df_future], ignore_index=True)

        stats = build_forecast_text(df_future.copy(), selected_var)
        best_name = get_best_ml_and_dl(metrics, metrics_dl)[0]
        all_metrics_var = {**metrics, **metrics_dl}

        if best_name not in all_metrics_var:
            print(
                f"⚠️ best_name '{best_name}' tidak ada di metrics {selected_var}, fallback ke model pertama"
            )
            best_name = list(all_metrics_var.keys())[0] if all_metrics_var else "GBR"

        nlp_report = generate_nlp_report(stats, best_name, all_metrics_var[best_name])

        base_cols = ["YEAR", "MO", "DY", "HR", selected_var]
        pred_cols = [
            c for c in ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"] if c in df_out.columns
        ]
        df_out = df_out[base_cols + pred_cols]

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
            f.write(f"Dataset: {os.path.basename(dataset_path)}\n")
            f.write(f"Variabel: {selected_var}\n")
            f.write(f"Forecast Summary:\n{nlp_report}\n\n-END HEADER-\n\n")
            df_out.to_csv(f, index=False, sep=";")

        with progress_lock:
            generate_progress[username].update(
                {
                    "running": False,
                    "done": True,
                    "nlp_report": nlp_report,
                    "last_mode": output_mode,
                    "error": None,
                }
            )

    except Exception as e:
        print(f"❌ Worker Full error: {traceback.format_exc()}")
        with progress_lock:
            generate_progress[username].update(
                {"running": False, "done": True, "nlp_report": None, "error": str(e)}
            )


# =========================
# BACKGROUND WORKER — GENERATE BEST
# =========================
def _worker_generate_best(username: str, dataset_path: str) -> None:
    from app import df
    from training.load_ml import load_ml_for_var
    from training.load_dl import load_dl_for_var
    from training.metrics import (
        get_metrics,
        get_metrics_for_var,
        load_metrics_for_var,
        load_dl_metrics_for_var,
    )
    from training.nlp import build_forecast_text, generate_nlp_report_best
    from training.feature_engineering import load_and_engineer
    from tensorflow.keras.models import load_model as _load

    try:
        np.random.seed(42)

        last_row_dict = df.iloc[-1].to_dict()
        last_time = pd.Timestamp(
            year=int(last_row_dict["YEAR"]),
            month=int(last_row_dict["MO"]),
            day=int(last_row_dict["DY"]),
            hour=int(last_row_dict["HR"]),
        )
        future_steps = 24 * 7

        all_future_dfs = []
        stats_per_var = {}
        best_per_var = {}
        stacking_info = []
        hist_preds_per_var = {}
        ensemble_summary = {}

        for var_idx, var in enumerate(TRAIN_VARS):
            if var not in df.columns:
                print(f"⚠️ Skip {var} — kolom tidak ada")
                continue

            print(f"\n{'='*50}")
            print(f"🚀 Processing {var} ({var_idx+1}/{len(TRAIN_VARS)})")
            print(f"{'='*50}")

            gbr, xgb, knn, scaler, FEATURES = load_ml_for_var(var, username=username)
            df_var = load_and_engineer(dataset_path, target_var=var)
            dl_state = load_dl_for_var(df_var, var, username=username)
            DL_READY = dl_state["DL_READY"]
            scaler_X = dl_state["scaler_X"]
            scaler_y = dl_state["scaler_y"]
            DL_INPUT_COLS = dl_state["DL_INPUT_COLS"]
            is_circular = dl_state.get("is_circular", False)  # ← tambah

            # ✅ Helper decode per variabel
            def decode_dl(raw):
                if is_circular:
                    return np.rad2deg(np.arctan2(raw[:, 0], raw[:, 1])) % 360
                else:
                    return scaler_y.inverse_transform(raw).flatten()

            if not DL_READY:
                print(f"⚠️ DL {var} tidak siap, skip")
                continue

            metrics_var = load_metrics_for_var(var, username=username)
            metrics_dl_var = load_dl_metrics_for_var(var, username=username)

            best_dl_name = (
                min(
                    metrics_dl_var,
                    key=lambda m: metrics_dl_var[m].get(
                        "primary_value", metrics_dl_var[m].get("sMAPE", 999)
                    ),
                )
                if metrics_dl_var
                else "LSTM"
            )
            dl_filename = (
                f"bilstm_{var}.h5"
                if best_dl_name.upper() == "BILSTM"
                else f"lstm_{var}.h5"
            )
            print(f"🤖 Best DL [{var}]: {best_dl_name}")
            
            user_model_dir = (
                os.path.join(USER_FOLDER, username)
                if username
                else MODEL_FOLDER
            )


            _lstm = _load(os.path.join(user_model_dir, dl_filename))
            _dl_cols = (
                DL_INPUT_COLS
                if DL_INPUT_COLS
                else [c for c in df_var.columns if c != var]
            )

            ML_READY = all(
                [
                    gbr is not None,
                    xgb is not None,
                    scaler is not None,
                    len(FEATURES) > 0,
                ]
            )
            X = np.array(df_var[FEATURES].values) if ML_READY else np.array([])
            y = np.array(df_var[var].values)

            # — Stacking metrics historis — ✅ Bug 1 fix
            _X_sc = np.array(
                scaler_X.transform(df_var[_dl_cols].values), dtype=np.float32
            )

            BATCH = 2048
            n = len(_X_sc)
            split_train = int(n * 0.8)
            split_val   = int(n * 0.9)

            # --- TRAIN predictions ---
            raw_train = []
            for start in range(STEP, split_train, BATCH):
                end = min(start + BATCH, split_train)
                batch_seqs = np.array(
                    [_X_sc[i - STEP : i] for i in range(start, end)], dtype=np.float32
                )
                raw_train.append(_lstm.predict(batch_seqs, verbose=0))
            stacked_train_preds = decode_dl(np.concatenate(raw_train, axis=0))
            y_train_slice = y[STEP:split_train]

            # --- TEST predictions ---
            raw_test = []
            for start in range(split_val, n, BATCH):
                end = min(start + BATCH, n)
                batch_seqs = np.array(
                    [_X_sc[i - STEP : i] for i in range(start, end)], dtype=np.float32
                )
                raw_test.append(_lstm.predict(batch_seqs, verbose=0))
            stacked_test_preds = decode_dl(np.concatenate(raw_test, axis=0))
            y_test_slice = y[split_val:]

            # --- Metrics terpisah ---
            train_metrics = get_metrics_for_var(
                np.array(y_train_slice),
                np.array(stacked_train_preds[:len(y_train_slice)]),
                var,
            )
            test_metrics = get_metrics_for_var(
                np.array(y_test_slice),
                np.array(stacked_test_preds[:len(y_test_slice)]),
                var,
            )
            stacking_metrics = test_metrics  # untuk NLP report & stacking_info

            # --- ALL data untuk chart historis ---
            raw_all = []
            for start in range(STEP, n, BATCH):
                end = min(start + BATCH, n)
                batch_seqs = np.array(
                    [_X_sc[i - STEP : i] for i in range(start, end)], dtype=np.float32
                )
                raw_all.append(_lstm.predict(batch_seqs, verbose=0))
            stacked_preds = decode_dl(np.concatenate(raw_all, axis=0))

            from training.metrics import save_ensemble_metrics
            save_ensemble_metrics(var, "XGB", best_dl_name, train_metrics, test_metrics, username=username)

            ensemble_summary[var] = {
                "ml": "XGB",
                "dl": best_dl_name,
                "ensemble": f"XGB + {best_dl_name}",
                "metrics": stacking_metrics,
            }

            stacked_col = f"XGB_{best_dl_name}_{var}"
            stacking_name = f"XGB-{best_dl_name} [{var}]"
            print(f"📊 Stacking [{var}]: {stacking_metrics}")

            hist_preds_per_var[var] = {
                "stacked_col": stacked_col,
                "stacked_preds": stacked_preds,
                "xgb_preds": xgb.predict(X) if ML_READY and xgb is not None else None,
            }

            target_series = df[var].tolist()
            history_window = df_var.tail(STEP).copy().reset_index(drop=True)
            future_rows = []

            lo, hi = {"WS10M": (0, 50), "RH2M": (0, 100), "WD10M": (0, 360)}.get(
                var, (None, None)
            )

            for i in range(future_steps):
                with progress_lock:
                    if generate_progress.get(username, {}).get("cancel"):
                        generate_progress[username].update(
                            {"running": False, "done": True, "error": "Dibatalkan user"}
                        )
                        return

                if i % 24 == 0:
                    day_overall = var_idx * 7 + (i // 24) + 1
                    with progress_lock:
                        generate_progress[username]["day"] = day_overall
                        generate_progress[username]["total"] = 7 * len(TRAIN_VARS)
                    print(f"⏳ [{var}] Day {(i//24)+1}/7")

                next_time = last_time + pd.Timedelta(hours=i + 1)
                lag1 = target_series[-1]
                lag2 = target_series[-2]
                lag3 = target_series[-3]
                lag24 = target_series[-24]
                mean3 = float(np.mean(target_series[-3:]))
                mean24 = float(np.mean(target_series[-24:]))

                # ✅ Bug 3 fix — tambah handler sin/cos
                fv = []
                for col in FEATURES:
                    if col == "lag1":
                        fv.append(lag1)
                    elif col == "lag2":
                        fv.append(lag2)
                    elif col == "lag3":
                        fv.append(lag3)
                    elif col == "lag24":
                        fv.append(lag24)
                    elif col == "mean3":
                        fv.append(mean3)
                    elif col == "mean24":
                        fv.append(mean24)
                    elif col == "HR":
                        fv.append(int(next_time.hour))
                    elif col == "DY":
                        fv.append(int(next_time.day))
                    elif col == "MO":
                        fv.append(int(next_time.month))
                    elif col == "YEAR":
                        fv.append(int(next_time.year))
                    elif col == "hour_sin":
                        fv.append(float(np.sin(2 * np.pi * next_time.hour / 24)))
                    elif col == "hour_cos":
                        fv.append(float(np.cos(2 * np.pi * next_time.hour / 24)))
                    elif col == "WD10M_sin":
                        fv.append(float(np.sin(np.deg2rad(target_series[-1]))))
                    elif col == "WD10M_cos":
                        fv.append(float(np.cos(np.deg2rad(target_series[-1]))))
                    elif col == "T2M":
                        # ambil rata-rata T2M di jam yang sama dari historis
                        same_hour = df[df["HR"] == next_time.hour]["T2M"].mean()
                        fv.append(float(same_hour))
                    else:
                        fv.append(float(last_row_dict.get(col, 0.0)))

                X_fut = np.array(fv, dtype=np.float32).reshape(1, -1)
                pred_xgb = (
                    float(xgb.predict(X_fut)[0]) if xgb is not None else float("nan")
                )
                if lo is not None and not np.isnan(pred_xgb):
                    pred_xgb = float(np.clip(pred_xgb, lo, hi))

                new_row = history_window.iloc[-1].copy()
                new_row["YEAR"] = int(next_time.year)
                new_row["MO"] = int(next_time.month)
                new_row["DY"] = int(next_time.day)
                new_row["HR"] = int(next_time.hour)
                new_row[var] = pred_xgb
                new_row["lag1"] = lag1
                new_row["lag2"] = lag2
                new_row["lag3"] = lag3
                new_row["lag24"] = lag24
                new_row["mean3"] = mean3
                new_row["mean24"] = mean24
                # ✅ Bug 4 fix — update sin/cos SEBELUM concat
                if var == "WD10M":
                    if "WD10M_sin" in new_row.index:
                        new_row["WD10M_sin"] = float(np.sin(np.deg2rad(pred_xgb)))
                    if "WD10M_cos" in new_row.index:
                        new_row["WD10M_cos"] = float(np.cos(np.deg2rad(pred_xgb)))

                if "T2M" in new_row.index:
                    same_hour = df[df["HR"] == next_time.hour]["T2M"].mean()
                    new_row["T2M"] = float(same_hour)

                history_window = pd.concat(
                    [history_window.iloc[1:], pd.DataFrame([new_row])],
                    ignore_index=True,
                )
                window_sc = scaler_X.transform(history_window[_dl_cols].values)
                seq_future = window_sc.reshape(1, STEP, window_sc.shape[1])

                # ✅ Bug 2 fix — pakai decode_dl
                pred_stacked = float(decode_dl(_lstm.predict(seq_future, verbose=0))[0])
                if lo is not None:
                    pred_stacked = float(np.clip(pred_stacked, lo, hi))

                target_series.append(pred_stacked)
                if var == "WD10M":
                    last_row_dict["WD10M_sin"] = float(np.sin(np.deg2rad(pred_stacked)))
                    last_row_dict["WD10M_cos"] = float(np.cos(np.deg2rad(pred_stacked)))

                future_rows.append(
                    {
                        "YEAR": int(next_time.year),
                        "MO": int(next_time.month),
                        "DY": int(next_time.day),
                        "HR": int(next_time.hour),
                        var: round(pred_stacked, 3),
                        stacked_col: round(pred_stacked, 3),
                        f"XGB_Base_{var}": round(pred_xgb, 3),
                    }
                )

            df_future = pd.DataFrame(future_rows)
            all_future_dfs.append(df_future)

            stats_per_var[var] = build_forecast_text(df_future.copy(), var)

            all_met = {**metrics_var, **metrics_dl_var}
            best_name_var = (
                min(
                    all_met,
                    key=lambda m: all_met[m].get(
                        "primary_value", all_met[m].get("sMAPE", 999)
                    ),
                )
                if all_met
                else stacking_name
            )
            best_per_var[var] = (stacking_name, stacking_metrics)

            pm = stacking_metrics.get("primary_metric", "sMAPE")
            pv = stacking_metrics.get(
                "primary_value", stacking_metrics.get("sMAPE", "?")
            )
            unit = "°" if pm == "CircularMAE" or pm == "CircularRMSE" else "%" if pm in ("sMAPE", "MAE_pct", "CircularMAE_pct") else ""
            stacking_info.append(
                f"{var} | Model: {stacking_name} | "
                f"MAE={stacking_metrics.get('MAE', 'N/A')} "
                f"RMSE={stacking_metrics.get('RMSE', 'N/A')} "
                f"{pm}={pv}{unit} "
                f"R2={stacking_metrics.get('R2', 'N/A')}"
            )

            import tensorflow as tf

            tf.keras.backend.clear_session()

        print("\n" + "=" * 50)
        print("📦 ENSEMBLE SUMMARY")
        print("=" * 50)
        import json

        print(json.dumps(ensemble_summary, indent=2))
        print("=" * 50 + "\n")

        if not all_future_dfs:
            raise ValueError("Tidak ada variabel yang berhasil diproses")

        base_hist_cols = ["YEAR", "MO", "DY", "HR"] + [
            v for v in TRAIN_VARS if v in df.columns
        ]
        df_hist = df[base_hist_cols].copy()

        for var, preds in hist_preds_per_var.items():
            stacked_col = preds["stacked_col"]
            stacked_preds = preds["stacked_preds"]
            xgb_preds = preds["xgb_preds"]

            if xgb_preds is not None:
                df_hist[f"XGB_Base_{var}"] = np.nan
                df_hist[f"XGB_Base_{var}"] = xgb_preds

            df_hist[stacked_col] = np.nan
            df_hist.loc[df_hist.index[STEP:], stacked_col] = stacked_preds

        df_future_combined = all_future_dfs[0][["YEAR", "MO", "DY", "HR"]].copy()
        for df_f in all_future_dfs:
            cols_to_add = [
                c for c in df_f.columns if c not in ["YEAR", "MO", "DY", "HR"]
            ]
            df_future_combined = df_future_combined.join(df_f[cols_to_add])

        df_combined = pd.concat([df_hist, df_future_combined], ignore_index=True)

        for col in ["YEAR", "MO", "DY", "HR"]:
            df_combined[col] = df_combined[col].astype(int)
        for col in df_combined.select_dtypes(include=[np.number]).columns:
            df_combined[col] = df_combined[col].round(3)
            df_combined[col] = (
                df_combined[col].astype(str).str.replace(".", ",", regex=False)
            )

        nlp_report = generate_nlp_report_best(stats_per_var, best_per_var)

        output_path = os.path.join(OUTPUT_FOLDER, f"{username}_hasil_prediksi_best.csv")
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            f.write("-BEGIN HEADER-\n")
            f.write(f"Dataset: {os.path.basename(dataset_path)}\n")
            f.write(f"Variabel: {', '.join(TRAIN_VARS)}\n")
            f.write(f"Mode: Best Stacking (XGB + Best DL) per variabel\n")
            for info in stacking_info:
                f.write(f"{info}\n")
            f.write(f"\nForecast Summary:\n{nlp_report}\n\n-END HEADER-\n\n")
            df_combined.to_csv(f, index=False, sep=";")

        with progress_lock:
            generate_progress[username].update(
                {
                    "running": False,
                    "done": True,
                    "nlp_report": nlp_report,
                    "last_mode": "best",
                    "ensemble_summary": ensemble_summary,
                    "error": None,
                }
            )

    except Exception as e:
        print(f"❌ Worker Best error: {traceback.format_exc()}")
        with progress_lock:
            generate_progress[username].update(
                {"running": False, "done": True, "nlp_report": None, "error": str(e)}
            )


# =========================
# GENERATE FULL
# =========================
@generate_bp.route("/generate_full", methods=["POST"])
def generate_full():

    username = session.get("username")
    dataset_path = get_active_dataset_path_for_user()
    selected_var = request.form.get("var", "WS10M")
    print(f"🔍 SELECTED VAR: {selected_var}")

    with progress_lock:
        if generate_progress.get(username, {}).get("running"):
            return jsonify({"status": "already_running"}), 409

        generate_progress[username] = {
            "running": True,
            "done": False,
            "day": 0,
            "total": 7,
            "mode": f"General [{selected_var}]",
            "start_time": time.time(),
            "error": None,
            "nlp_report": None,
            "cancel": False,
        }

    selected_model = request.form.get("model", "all")

    # ✅ Gunakan metrics per variabel untuk tentukan active_models
    metrics_var = load_metrics_for_var(selected_var, username=username)
    metrics_dl_var = load_dl_metrics_for_var(selected_var, username=username)
    all_models = list(metrics_var.keys()) + list(metrics_dl_var.keys())

    active_models = (
        get_best_ml_and_dl(metrics_var, metrics_dl_var)
        if selected_model == "best"
        else all_models
    )

    threading.Thread(
        target=_worker_generate_full,
        args=(username, selected_model, active_models, "general", selected_var, dataset_path),
        daemon=True,
    ).start()

    return jsonify({"status": "started"})


# =========================
# GENERATE BEST
# =========================
@generate_bp.route("/generate_best", methods=["POST"])
def generate_best():
    username = session.get("username")
    dataset_path = get_active_dataset_path_for_user()

    with progress_lock:
        if generate_progress.get(username, {}).get("running"):
            return jsonify({"status": "already_running"}), 409

        generate_progress[username] = {
            "running": True,
            "done": False,
            "day": 0,
            "total": 7 * len(TRAIN_VARS),  # ✅ 7 hari × 3 variabel
            "mode": "Best Stacking (All Variables)",
            "start_time": time.time(),
            "error": None,
            "nlp_report": None,
            "cancel": False,
        }

    # ✅ Validasi minimal satu variabel punya metrics
    any_ready = any(load_metrics_for_var(var, username=username) for var in TRAIN_VARS)
    if not any_ready:
        with progress_lock:
            generate_progress[username].update({"running": False, "done": True})
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Belum ada model terlatih — upload dan train dataset dulu",
                }
            ),
            400,
        )

    threading.Thread(
        target=_worker_generate_best,
        args=(username, dataset_path),  # ✅ tidak perlu selected_var
        daemon=True,
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
    return jsonify(
        {
            "nlp_report": session.get("nlp_report", ""),
            "generate_mode": session.get("last_generate_mode", "general"),
        }
    )
