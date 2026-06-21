import os
import numpy as np
from config import *
from training.feature_engineering import load_and_engineer
from training.load_ml import init_ml_state
from training.load_dl import init_dl_models
from training.metrics import load_metrics_for_var, load_dl_metrics_for_var
from utils.cache import load_or_compute_metrics
from utils.registry import compute_file_hash

ALL_VARS = ["WS10M", "WD10M", "T2M", "RH2M", "PS"]


def reload_all_globals(dataset_path, username: str = "", registry: dict = None):
    df_target = load_and_engineer(dataset_path, target_var=TARGET)
    file_hash = compute_file_hash(dataset_path) if dataset_path and os.path.exists(dataset_path) else ""

    ml_state = init_ml_state(df_target, username=username)

    dl_states = {}
    for var in ALL_VARS:
        df_var = load_and_engineer(dataset_path, target_var=var)
        dl_states[var] = init_dl_models(df_var, target_var=var, username=username)

    all_metrics_ml = {}
    all_metrics_dl = {}

    if registry and registry.get("metrics"):
        for var in ALL_VARS:
            all_metrics_ml[var] = load_metrics_for_var(var, file_hash="", username=username)
            all_metrics_dl[var] = load_dl_metrics_for_var(var, file_hash="", username=username)
        print(f"♻️ Metrics direstore dari snapshot registry (skip recompute) — user={username}")
    else:
        # Training baru / nggak ada snapshot — compute seperti biasa
        for var in ALL_VARS:
            dl = dl_states[var]
            ml, dl_met = load_or_compute_metrics(
                ml_state["ML_READY"], dl["DL_READY"],
                ml_state["gbr"], ml_state["xgb"], ml_state["knn"], ml_state["scaler"],
                ml_state["X"], ml_state["y"],
                dl["X_scaled"], dl["scaler_y"],
                ml_state["lstm"] if hasattr(ml_state, "lstm") else dl["lstm"], dl["bilstm"],
                var_name=var, file_hash=file_hash, username=username,
            )
            all_metrics_ml[var] = ml
            all_metrics_dl[var] = dl_met

    dl_target = dl_states[TARGET]

    print(
        f"♻️ Globals reloaded — "
        f"ML: {list(all_metrics_ml[TARGET].keys())} | "
        f"DL: {list(all_metrics_dl[TARGET].keys())}"
    )

    return {
        "df": df_target,
        "ml_state": ml_state,
        "dl_state": dl_target,
        "metrics_ml": all_metrics_ml[TARGET],
        "metrics_dl": all_metrics_dl[TARGET],
    }


def clear_user_state(username: str):
    pass