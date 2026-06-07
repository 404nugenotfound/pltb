from flask import *

import os
import numpy as np
import pandas as pd

from config import *

from utils.cache import *
from utils.dataset import (
    get_active_dataset_path,
    set_active_dataset_path,
    get_active_dataset_path_for_user,      # ← tambah
    set_active_dataset_path_for_user,      # ← tambah
    allowed_file
)

from training.nlp import *

main_bp = Blueprint(
    "main",
    __name__
)

# =========================
# OVERVIEW
# =========================
@main_bp.route(
    "/overview",
    methods=["GET", "POST"]
)
def overview():

    from app import (
        metrics,
        metrics_dl,
        y,
        X,
        ML_READY,
        gbr,
        xgb,
        knn,
        scaler
    )

    selected_model = session.get(
        "selected_model",
        "all"
    )

    nlp_report = session.get(
        "nlp_report",
        None
    )

    all_metrics = {
        **metrics,
        **metrics_dl
    }

    best_model_names = get_best_ml_and_dl(
        metrics,
        metrics_dl
    )

    all_keys = (
        list(metrics.keys())
        + list(metrics_dl.keys())
    )

    labels = [
        f"{i}:00"
        for i in range(24)
    ]

    actual_data = y[-24:].tolist()

    gbr_data = (
        gbr.predict(X[-24:]).tolist()
        if ML_READY and gbr is not None
        else []
    )

    xgb_data = (
        xgb.predict(X[-24:]).tolist()
        if ML_READY and xgb is not None
        else []
    )

    knn_data = (
        knn.predict(
            scaler.transform(X[-24:])
        ).tolist()

        if ML_READY
        and knn is not None
        and scaler is not None

        else []
    )

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
# FORECASTING DATA
# =========================
@main_bp.route("/forecasting_data")
def forecasting_data():
    import app as _app
    from utils.user_helpers import load_user
    from training.metrics import load_metrics_for_var, load_dl_metrics_for_var
    from config import TARGET

    username = request.headers.get("X-Username") or session.get("username")

    # ✅ Baca langsung dari metrics.json per variabel — selalu fresh
    from config import TRAIN_VARS
    all_metrics = {}
    for var in TRAIN_VARS:
        ml_v  = load_metrics_for_var(var)
        dl_v  = load_dl_metrics_for_var(var)
        all_metrics.update(ml_v)
        all_metrics.update(dl_v)

    # Fallback ke app global kalau metrics.json kosong
    if not all_metrics:
        all_metrics = {**_app.metrics, **_app.metrics_dl}

    best_model_names = get_best_ml_and_dl(
        load_metrics_for_var(TARGET),
        load_dl_metrics_for_var(TARGET)
    )

    dataset_name = ""
    if username:
        user = load_user(username)
        if user:
            dataset_name = os.path.basename(user.get("active_dataset", ""))
    if not dataset_name:
        dataset_name = os.path.basename(get_active_dataset_path() or "")

    return jsonify({
        "dataset_name": dataset_name,
        "metrics":      all_metrics,
        "best_models":  best_model_names
    })
    
# =========================
# ANALITIK
# =========================
@main_bp.route("/analitik")
def analitik():

    return render_template(
        "analitik.html"
    )


# =========================
# UNDER MAINTENANCE
# =========================
@main_bp.route("/underMaintenance")
def underMaintenance():

    return render_template(
        "underMaintenance.html"
    )


# =========================
# DASHBOARD
# =========================
@main_bp.route("/dashboard")
def dashboard():

    return render_template(
        "dashboard.html"
    )


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
@main_bp.route(
    "/reset_dataset",
    methods=["POST"]
)
def reset_dataset():

    from app import (
        metrics,
        metrics_dl
    )

    if os.path.exists(
        ACTIVE_DATASET_FILE
    ):

        os.remove(
            ACTIVE_DATASET_FILE
        )

    session.pop(
        "nlp_report",
        None
    )

    session.pop(
        "last_generate_mode",
        None
    )

    session.modified = True

    metrics.clear()
    metrics_dl.clear()

    return jsonify({
        "status": "ok"
    })