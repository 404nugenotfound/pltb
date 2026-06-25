from flask import *

import os
import numpy as np
import pandas as pd

from config import *

from utils.cache import *
from utils.dataset import (
    get_active_dataset_path_for_user,       # ← tambah
)

from training.nlp import *

main_bp = Blueprint(
    "main",
    __name__
)

# =========================
# FORECASTING DATA
# =========================
@main_bp.route("/forecasting_data")
def forecasting_data():
    from utils.user_helpers import load_user
    from utils.dataset import get_active_dataset_path_for_user
    from utils.registry import compute_file_hash
    from training.metrics import (
        load_metrics_for_var,
        load_dl_metrics_for_var,
        load_ensemble_components,
    )
    from config import TARGET

    username     = request.headers.get("X-Username") or session.get("username")
    selected_var = request.args.get("var", TARGET)

    # ✅ resolve file_hash dari dataset aktif user
    dataset_path = get_active_dataset_path_for_user(username=username)
    file_hash = compute_file_hash(dataset_path) if dataset_path and os.path.exists(dataset_path) else ""

    ml_metrics = load_metrics_for_var(selected_var, file_hash=file_hash, username=username)
    dl_metrics = load_dl_metrics_for_var(selected_var, file_hash=file_hash, username=username)
    all_metrics = {**ml_metrics, **dl_metrics}

    # ⚠️ Fallback ke _app.metrics/_app.metrics_dl DIHAPUS DENGAN SENGAJA.
    # Itu global state yang bisa kepunyaan user lain. Kalau metrics emang
    # belum ada buat dataset ini, biar all_metrics kosong — FE yang handle
    # tampilan "belum ada data, generate dulu".

    best_model_names = get_best_ml_and_dl(ml_metrics, dl_metrics)  # reuse, gak query 2x

    dataset_name = ""
    if username:
        user = load_user(username)
        if user:
            dataset_name = os.path.basename(user.get("active_dataset", ""))
    # Fallback ke dataset_path (DEFAULT_DATASET) DIHAPUS — kalau active_dataset
    # kosong, itu artinya user belum punya dataset aktif, dataset_name harus
    # tetap kosong supaya FE bisa nampilin "belum ada dataset, upload dulu"
    # alih-alih diam-diam nampilin nama file template.

    ensemble_components = load_ensemble_components(file_hash=file_hash, username=username)
    ensemble_summary = {}
    for var, components in ensemble_components.items():
        if len(components) >= 2:
            ml_name, dl_name = components[0], components[1]
            ensemble_summary[var] = {
                "ml":       ml_name,
                "dl":       dl_name,
                "ensemble": f"{ml_name} + {dl_name}",
            }

    return jsonify({
        "dataset_name":     dataset_name,
        "metrics":          all_metrics,
        "best_models":      best_model_names,
        "ensemble_summary": ensemble_summary,
    })
    
    
# =========================
# RESET NLP
# =========================
@main_bp.route(
    "/reset_nlp",
    methods=["POST"]
)
def reset_nlp():

    session.pop(
        "nlp_report",
        None
    )

    session.pop(
        "last_generate_mode",
        None
    )

    session.modified = True

    return jsonify({
        "status": "ok"
    })


# =========================
# RESET DATASET
# =========================
@main_bp.route("/reset_dataset", methods=["POST"])
def reset_dataset():
    from utils.reload_state import clear_user_state
    from utils.dataset import reset_dataset_for_user

    username = request.headers.get("X-Username") or session.get("username")
    if not username:
        return jsonify({"error": "Not logged in"}), 401

    result = reset_dataset_for_user(username)

    # Buang state in-memory user ini dari cache, biar /overview dkk reload fresh
    clear_user_state(username)

    session.pop("nlp_report", None)
    session.pop("last_generate_mode", None)
    session.modified = True

    return jsonify({
        "status": "ok" if result["success"] else "error",
        "message": result["message"],
        "file_deleted": result.get("file_deleted", False),
    })
    
# =========================
# OVERFIT METRICS
# =========================
@main_bp.route("/overfit_metrics")
def overfit_metrics():
    from training.metrics import load_metrics, load_ensemble_metrics, load_ensemble_components
    from utils.dataset import get_active_dataset_path_for_user
    from utils.registry import compute_file_hash
    from config import TRAIN_VARS

    username = request.headers.get("X-Username") or session.get("username")

    dataset_path = get_active_dataset_path_for_user(username=username)
    file_hash = compute_file_hash(dataset_path) if dataset_path and os.path.exists(dataset_path) else ""

    result = {}

    for var in TRAIN_VARS:
        ml, dl = load_metrics(var, file_hash=file_hash, username=username)
        ensemble = load_ensemble_metrics(var, file_hash=file_hash, username=username)
        combined = {**(ml or {}), **(dl or {}), **(ensemble or {})}

        var_result = {}
        for model, val in combined.items():
            if isinstance(val, dict) and "train" in val and "test" in val:
                var_result[model] = {"train": val["train"], "test": val["test"]}

        if var_result:
            result[var] = var_result

    if not result:
        return jsonify({"error": "Metrics belum tersedia. Silakan train model dulu."}), 404

    ensemble_components = load_ensemble_components(file_hash=file_hash, username=username)

    return jsonify({
        "metrics":             result,
        "ensemble_components": ensemble_components,
    })
    
# =========================
# EDA SUMMARY
# =========================
@main_bp.route("/eda_summary")
def eda_summary():
    try:
        username = request.headers.get("X-Username") or session.get("username")
        path = get_active_dataset_path_for_user(username=username)
        df = pd.read_csv(path)
        ...  # sisanya sama

        target_cols = [c for c in ["RH2M", "WS10M", "WD10M", "T2M", "PS"] if c in df.columns]

        stats = {}
        for col in target_cols:
            s = df[col]
            stats[col] = {
                "mean":    round(float(s.mean()), 3),
                "median":  round(float(s.median()), 3),
                "std":     round(float(s.std()), 3),
                "min":     round(float(s.min()), 3),
                "max":     round(float(s.max()), 3),
                "missing": int(s.isna().sum()),
                "total":   len(s),
            }

        # ← TAMBAH INI
        sample_idx = list(range(0, len(df), 50))
        trend = {
            col: [round(float(df[col].iloc[i]), 3) for i in sample_idx]
            for col in target_cols
        }

        # Cek kolom tanggal
        date_col = next((c for c in ["DATETIME", "DATE", "date", "datetime", "time", "TIME"] if c in df.columns), None)
        if date_col:
            trend_labels = [str(df[date_col].iloc[i]) for i in sample_idx]
        else:
            trend_labels = [str(i) for i in sample_idx]

        return jsonify({
            "stats":        stats,
            "rows":         len(df),
            "cols":         len(df.columns),
            "trend":        trend,         # ← tambah
            "trend_labels": trend_labels,  # ← tambah
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# =========================
# FORECAST RESULT
# =========================
@main_bp.route("/forecast_result")
def forecast_result():
    try:
        username = request.headers.get("X-Username") or session.get("username")
        mode     = request.args.get("mode", "general")
        var      = request.args.get("var", "WS10M")

        filename = (
            f"{username}_hasil_prediksi_best.csv"
            if mode == "best"
            else f"{username}_hasil_prediksi_general.csv"
        )
        filepath = os.path.join(OUTPUT_FOLDER, filename)

        if not os.path.exists(filepath):
            return jsonify({"error": "File belum ada, generate dulu"}), 404

        # Skip header custom (-BEGIN HEADER- sampai -END HEADER-)
        with open(filepath, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()

        data_start = 0
        for i, line in enumerate(lines):
            if "-END HEADER-" in line:
                data_start = i + 2  # skip baris kosong setelah header
                break

        from io import StringIO
        csv_content = "".join(lines[data_start:])
        df = pd.read_csv(StringIO(csv_content), sep=";")

        # Konversi koma ke titik untuk kolom numerik
        for col in df.columns:
            if col not in ["YEAR", "MO", "DY", "HR"]:
                df[col] = df[col].astype(str).str.replace(",", ".", regex=False)
                df[col] = pd.to_numeric(df[col], errors="coerce")

        # Buat label waktu
        df["label"] = (
            df["YEAR"].astype(str) + "-" +
            df["MO"].astype(str).str.zfill(2) + "-" +
            df["DY"].astype(str).str.zfill(2) + " " +
            df["HR"].astype(str).str.zfill(2) + ":00"
        )

        # Ambil 200 historis + 168 future (7 hari)
        future_rows = 24 * 7  # 168
        hist_rows   = 200
        total_rows  = len(df)
        future_start = total_rows - future_rows

        df_hist   = df.iloc[max(0, future_start - hist_rows):future_start]
        df_future = df.iloc[future_start:]
        df_show   = pd.concat([df_hist, df_future], ignore_index=True)

        # Kolom prediksi yang tersedia
        skip_cols   = {"YEAR", "MO", "DY", "HR", "label", var}
        pred_cols   = [c for c in df_show.columns if c not in skip_cols]

        # Filter pred_cols sesuai var kalau general
        actual_dict = {}  # ← definisiin di luar dulu
        if mode == "general":
            pred_cols = [c for c in ["GBR", "XGB", "KNN", "LSTM", "BiLSTM"] if c in df_show.columns]
        else:  # best
            all_vars = {"WS10M", "WD10M", "RH2M"}
            skip_cols = {"YEAR", "MO", "DY", "HR", "label"} | all_vars
            pred_cols = [
                c for c in df_show.columns
                if c not in skip_cols and "_Base_" not in c
            ]
            actual_dict = {
                v: df_show[v].tolist()
                for v in all_vars
                if v in df_show.columns
            }

        result = {
            "mode":               mode,
            "var":                var,
            "labels":             df_show["label"].tolist(),
            "actual":             df_show[var].tolist() if mode == "general" and var in df_show.columns else [],
            "actual_dict":        actual_dict if mode == "best" else {},
            "predictions":        {
                col: df_show[col].tolist()
                for col in pred_cols
                if col in df_show.columns
            },
            "future_start_index": len(df_hist),
        }

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@main_bp.route("/download_forecast")
def download_forecast():
    username = request.headers.get("X-Username") or session.get("username")
    mode = request.args.get("mode", "general")
    filename = (
        f"{username}_hasil_prediksi_best.csv"
        if mode == "best"
        else f"{username}_hasil_prediksi_general.csv"
    )
    filepath = os.path.join(OUTPUT_FOLDER, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "File belum ada"}), 404

    return send_file(filepath, as_attachment=True, download_name=filename)