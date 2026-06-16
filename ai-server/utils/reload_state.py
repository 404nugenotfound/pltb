import numpy as np
from config import *
from training.feature_engineering import load_and_engineer
from training.load_ml import init_ml_state
from training.load_dl import init_dl_models
from utils.cache import load_or_compute_metrics


def reload_all_globals(dataset_path, username: str = ""):  # ← tambah username
    # ✅ target_var=TARGET eksplisit
    df = load_and_engineer(dataset_path, target_var=TARGET)

    # =========================
    # INIT ML
    # =========================
    ml_state = init_ml_state(
        df,
        username=username
    )

    # =========================
    # INIT DL
    # =========================
    dl_state = init_dl_models(
        df,
        target_var=TARGET,
        username=username
    )

    # ✅ var_name=TARGET eksplisit
    metrics_ml, metrics_dl = load_or_compute_metrics(
        ml_state["ML_READY"],
        dl_state["DL_READY"],
        ml_state["gbr"],
        ml_state["xgb"],
        ml_state["knn"],
        ml_state["scaler"],
        ml_state["X"],
        ml_state["y"],
        dl_state["X_scaled"],
        dl_state["scaler_y"],
        dl_state["lstm"],
        dl_state["bilstm"],
        var_name=TARGET,
        username=username,  # ← pakai parameter, bukan session
    )

    # ✅ Update app globals — tanpa ini reload tidak efek apapun
    import app as _app

    _app.df = df
    _app.gbr = ml_state["gbr"]
    _app.xgb = ml_state["xgb"]
    _app.knn = ml_state["knn"]
    _app.scaler = ml_state["scaler"]
    _app.FEATURES = ml_state["FEATURES"]
    _app.ML_READY = ml_state["ML_READY"]
    _app.X = ml_state["X"]
    _app.y = ml_state["y"]
    _app.data_ml = ml_state["data_ml"]
    _app.lstm = dl_state["lstm"]
    _app.bilstm = dl_state["bilstm"]
    _app.scaler_X = dl_state["scaler_X"]
    _app.scaler_y = dl_state["scaler_y"]
    _app.X_scaled = dl_state["X_scaled"]
    _app.data_seq = dl_state["data_seq"]
    _app.DL_INPUT_COLS = dl_state["DL_INPUT_COLS"]
    _app.DL_READY = dl_state["DL_READY"]
    _app.is_circular = dl_state.get("is_circular", False)  # ← tambah ini
    _app.metrics = metrics_ml
    _app.metrics_dl = metrics_dl

    print(
        f"♻️ Globals reloaded — "
        f"ML: {list(metrics_ml.keys())} | "
        f"DL: {list(metrics_dl.keys())}"
    )

    return {
        "df": df,
        "ml_state": ml_state,
        "dl_state": dl_state,
        "metrics_ml": metrics_ml,
        "metrics_dl": metrics_dl,
    }
