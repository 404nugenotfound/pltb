import os
import shutil
import traceback
import pandas as pd
import numpy as np

from config import *

from training.train_ml import *
from training.train_dl import *
from training.feature_engineering import load_and_engineer

from utils.registry import *
from utils.reload_state import reload_all_globals
from utils.cache import load_or_compute_metrics


def worker_retrain(username, dataset_path, train_progress, train_lock):
    def log(msg):
        print(msg)
        with train_lock:
            if username in train_progress:
                train_progress[username]["step"] = msg
                train_progress[username]["log"].append(msg)

    def is_cancelled():
        with train_lock:
            return train_progress.get(username, {}).get("cancel", False)

    def get_skip_snapshot():
        with train_lock:
            return train_progress.get(username, {}).get("skip_snapshot", False)

    try:
        # =========================
        # LOAD DATASET RAW
        # =========================
        log("📂 Load dataset...")
        if is_cancelled():
            raise InterruptedError("Training dibatalkan user")

        df_raw = pd.read_csv(dataset_path)

        missing_cols = [c for c in REQUIRED_COLUMNS if c not in df_raw.columns]
        if missing_cols:
            raise ValueError(f"Kolom wajib tidak ditemukan: {missing_cols}")

        # =========================
        # TRAIN ML — PER VARIABEL
        # =========================
        lag_cols = ["lag1", "lag2", "lag3", "lag24"]
        roll_cols = ["mean3", "mean24"]
        time_cols = ["HR", "DY", "MO", "YEAR"]

        for var in TRAIN_VARS:
            if is_cancelled():
                raise InterruptedError("Training dibatalkan user")

            if var not in df_raw.columns:
                log(f"⚠️ Kolom {var} tidak ada, skip ML")
                continue

            log(f"🔧 Feature engineering untuk {var}...")

            df_var = load_and_engineer(dataset_path, target_var=var)

            extra_cols = [
                c
                for c in df_var.columns
                if c not in ([var] + lag_cols + roll_cols + time_cols)
                and pd.api.types.is_numeric_dtype(df_var[c])
            ]
            features = [
                f
                for f in (time_cols + extra_cols + lag_cols + roll_cols)
                if f in df_var.columns
            ]

            X_var = np.array(df_var[features].values)
            y_var = np.array(df_var[var].values)

            log(f"🔧 Training ML untuk {var} | features={features}...")
            train_ml_models(X_var, y_var, features, suffix=f"_{var}", username=username)

            if is_cancelled():
                raise InterruptedError("Training dibatalkan user")

            log(f"✅ ML {var} selesai")

        # =========================
        # TRAIN DL — PER VARIABEL
        # =========================
        for var in TRAIN_VARS:
            if is_cancelled():
                raise InterruptedError("Training dibatalkan user")

            if var not in df_raw.columns:
                log(f"⚠️ Kolom {var} tidak ada, skip DL")
                continue

            log(f"🔧 Training DL untuk {var}...")

            df_var = load_and_engineer(dataset_path, target_var=var)

            dl_ok = train_dl_models(df_var, target_var=var, cancel_check=is_cancelled, username=username)

            if is_cancelled():
                raise InterruptedError("Training dibatalkan user")

            log(f"✅ DL {var} selesai" if dl_ok else f"⚠️ DL {var} gagal")

        # =========================
        # HITUNG METRICS — PER VARIABEL
        # =========================
        log("📊 Hitung metrics per variabel...")

        from training.load_ml import load_ml_models
        from training.load_dl import init_dl_models

        all_metrics = {}  # ← kumpulin metrics semua var buat disimpan ke snapshot

        for var in TRAIN_VARS:
            if var not in df_raw.columns:
                log(f"⚠️ Skip metrics {var} — kolom tidak ada")
                continue

            try:
                df_var = load_and_engineer(dataset_path, target_var=var)

                gbr_v, xgb_v, knn_v, scaler_v, feats_v = load_ml_models(f"_{var}", username=username)
                ML_READY_V = all(
                    [
                        gbr_v is not None,
                        xgb_v is not None,
                        knn_v is not None,
                        scaler_v is not None,
                        len(feats_v) > 0,
                    ]
                )

                X_v = np.array(df_var[feats_v].values) if ML_READY_V else np.array([])
                y_v = np.array(df_var[var].values)

                dl_state_v = init_dl_models(df_var, target_var=var, username=username)
                DL_READY_V = dl_state_v["DL_READY"]
                X_scaled_v = dl_state_v["X_scaled"]
                scaler_y_v = dl_state_v["scaler_y"]
                lstm_v     = dl_state_v["lstm"]
                bilstm_v   = dl_state_v["bilstm"]

                ml_v, dl_v = load_or_compute_metrics(
                    ML_READY_V,
                    DL_READY_V,
                    gbr_v,
                    xgb_v,
                    knn_v,
                    scaler_v,
                    X_v,
                    y_v,
                    X_scaled_v,
                    scaler_y_v,
                    lstm_v,
                    bilstm_v,
                    var_name=var,
                    username=username,
                )

                all_metrics[var] = {"ml": ml_v, "dl": dl_v}  # ← simpan per var
                log(f"✅ Metrics [{var}] ML={list(ml_v.keys())} DL={list(dl_v.keys())}")

            except Exception as e_metrics:
                log(f"⚠️ Metrics [{var}] gagal: {e_metrics}")
                print(traceback.format_exc())

        # =========================
        # SIMPAN REGISTRY + SNAPSHOT
        # =========================
        if is_cancelled():
            raise InterruptedError("Training dibatalkan user")

        log("💾 Simpan registry...")

        file_hash = compute_file_hash(dataset_path)
        skip_snapshot = get_skip_snapshot()

        save_model_registry(username, file_hash, dataset_path)

        if not skip_snapshot:
            log("📸 Simpan snapshot...")

            # Cek apakah hash ini sudah punya snapshot (overwrite) atau baru
            quota = check_snapshot_quota(username, file_hash)
            existing_id = quota.get("existing_id")  # None kalau slot baru

            snap_id = save_snapshot(
                username=username,
                file_hash=file_hash,
                dataset_path=dataset_path,
                metrics=all_metrics,
                existing_id=existing_id,
            )

            log(f"✅ Snapshot disimpan: {snap_id}")
        else:
            log("⚠️ Skip snapshot (user pilih lanjut tanpa snapshot)")

        log("✅ Registry disimpan")

        # =========================
        # RELOAD GLOBALS
        # =========================
        if is_cancelled():
            raise InterruptedError("Training dibatalkan user")

        log("♻️ Reload globals...")
        reload_all_globals(dataset_path, username=username)
        log("✅ Reload selesai")

        # =========================
        # FINISH
        # =========================
        with train_lock:
            if username in train_progress:
                train_progress[username].update(
                    {
                        "running": False,
                        "done": True,
                        "cancelled": False,
                        "error": None,
                        "step": "Selesai",
                    }
                )

    except InterruptedError:
        with train_lock:
            if username in train_progress:
                train_progress[username].update(
                    {
                        "running": False,
                        "done": True,
                        "cancelled": True,
                        "error": None,
                        "step": "Training dibatalkan",
                    }
                )

    except Exception as e:
        print(traceback.format_exc())
        with train_lock:
            if username in train_progress:
                train_progress[username].update(
                    {
                        "running": False,
                        "done": True,
                        "cancelled": False,
                        "error": str(e),
                        "step": "Error",
                    }
                )