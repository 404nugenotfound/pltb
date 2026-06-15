# metrics.py

import os
import json
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from config import STEP


def get_metrics(y_true, y_pred):
    yt = np.array(y_true).flatten()
    yp = np.array(y_pred).flatten()

    # ✅ sMAPE — lebih stabil dari MAPE waktu nilai aktual kecil
    denom = (np.abs(yt) + np.abs(yp)) / 2
    mask = denom != 0
    if mask.sum() > 0:
        smape = round(
            float(np.mean(np.abs(yt[mask] - yp[mask]) / denom[mask]) * 100), 2
        )
    else:
        smape = float("nan")

    return {
        "MAE": round(float(mean_absolute_error(yt, yp)), 3),
        "RMSE": round(float(np.sqrt(mean_squared_error(yt, yp))), 3),
        "sMAPE": smape,
        "R2": round(float(r2_score(yt, yp)), 3),
    }


def get_metrics_for_var(y_true, y_pred, var_name: str = "WS10M"):
    """Pilih primary metric berdasarkan variabel."""
    yt = np.array(y_true).flatten()
    yp = np.array(y_pred).flatten()

    base = {
        "MAE": round(float(mean_absolute_error(yt, yp)), 3),
        "RMSE": round(float(np.sqrt(mean_squared_error(yt, yp))), 3),
        "R2": round(float(r2_score(yt, yp)), 3),
    }

    if var_name == "WS10M":
        denom = (np.abs(yt) + np.abs(yp)) / 2
        mask = denom != 0
        base["sMAPE"] = (
            round(float(np.mean(np.abs(yt[mask] - yp[mask]) / denom[mask]) * 100), 2)
            if mask.sum() > 0
            else float("nan")
        )
        base["primary_metric"] = "sMAPE"
        base["primary_value"] = base["sMAPE"]

    elif var_name == "RH2M":
        denom = (np.abs(yt) + np.abs(yp)) / 2
        mask = denom != 0
        base["sMAPE"] = (
            round(float(np.mean(np.abs(yt[mask] - yp[mask]) / denom[mask]) * 100), 2)
            if mask.sum() > 0
            else float("nan")
        )
        base["MAE_pct"] = round((base["MAE"] / 100) * 100, 2)
        base["primary_metric"] = "MAE"
        base["primary_value"] = round(float(base["MAE"]), 2)

    elif var_name == "WD10M":
        diff = np.abs(yt - yp) % 360
        diff = np.where(diff > 180, 360 - diff, diff)

        # Circular MAE
        circular_mae = round(float(np.mean(diff)), 3)

        # Circular RMSE
        circular_rmse = round(float(np.sqrt(np.mean(diff**2))), 3)

        # Circular Correlation
        sin_t, cos_t = np.sin(np.deg2rad(yt)), np.cos(np.deg2rad(yt))
        sin_p, cos_p = np.sin(np.deg2rad(yp)), np.cos(np.deg2rad(yp))
        circ_corr = round(
            float(
                (np.mean(sin_t * sin_p) + np.mean(cos_t * cos_p))
                / (
                    np.sqrt(np.mean(sin_t**2) + np.mean(cos_t**2))
                    * np.sqrt(np.mean(sin_p**2) + np.mean(cos_p**2))
                )
            ),
            3,
        )

        # Accuracy ±15°
        acc15 = round(float(np.mean(diff <= 15) * 100), 2)

        base["CircularMAE"] = circular_mae
        base["CircularRMSE"] = circular_rmse
        base["CircularCorr"] = circ_corr
        base["Acc15"] = acc15
        base["primary_metric"] = "CircularMAE"
        base["primary_value"] = circular_mae

        # hapus MAE & RMSE linear — tidak relevan untuk data siklikal
        del base["MAE"]
        del base["RMSE"]
        del base["R2"]

    elif var_name == "T2M":
        denom = (np.abs(yt) + np.abs(yp)) / 2
        mask = denom != 0
        base["sMAPE"] = (
            round(float(np.mean(np.abs(yt[mask] - yp[mask]) / denom[mask]) * 100), 2)
            if mask.sum() > 0
            else float("nan")
        )
        base["primary_metric"] = "sMAPE"
        base["primary_value"] = base["sMAPE"]

    elif var_name == "PS":
        from sklearn.metrics import explained_variance_score

        evs = round(float(explained_variance_score(yt, yp)), 3)
        base["EVS"] = evs
        base["primary_metric"] = "MAE"
        base["primary_value"] = round(float(base["MAE"]), 3)

    else:
        # fallback: pakai sMAPE
        denom = (np.abs(yt) + np.abs(yp)) / 2
        mask = denom != 0
        base["sMAPE"] = (
            round(float(np.mean(np.abs(yt[mask] - yp[mask]) / denom[mask]) * 100), 2)
            if mask.sum() > 0
            else float("nan")
        )
        base["primary_metric"] = "sMAPE"
        base["primary_value"] = base["sMAPE"]

    return base


def save_metrics(ml, dl, var_name: str = "WS10M", username: str = ""):
    from utils.user_helpers import load_user, save_user

    if not username:
        return
    user = load_user(username)
    if not user:
        return
    if "metrics" not in user:
        user["metrics"] = {}
    user["metrics"][var_name] = {"ml": ml, "dl": dl}
    save_user(user)
    print(f"✅ Metrics [{var_name}] disimpan ke user {username}")


def load_metrics(var_name: str = "WS10M", username: str = ""):
    from utils.user_helpers import load_user
    if not username:
        return None, None
    user = load_user(username)
    if not user:
        return None, None
    metrics = user.get("metrics", {})
    if var_name in metrics:
        print(f"✅ Metrics [{var_name}] di-load dari user {username}")
        return metrics[var_name].get("ml", {}), metrics[var_name].get("dl", {})
    return None, None


def load_metrics_for_var(var_name: str, username: str = ""):
    """Load metrics untuk forecasting — ambil test metrics saja."""
    ml, _ = load_metrics(var_name, username=username)
    if not ml:
        return {}
    # ← flatten: ambil test metrics untuk ditampilkan di dashboard
    result = {}
    for model, val in ml.items():
        if isinstance(val, dict) and "test" in val:
            result[model] = val["test"]
        else:
            result[model] = val  # fallback format lama
    return result


def load_dl_metrics_for_var(var_name: str, username: str = ""):
    """Load DL metrics untuk forecasting — ambil test metrics saja."""
    _, dl = load_metrics(var_name, username=username)
    if not dl:
        return {}
    result = {}
    for model, val in dl.items():
        if isinstance(val, dict) and "test" in val:
            result[model] = val["test"]
        else:
            result[model] = val
    return result


def compute_metrics_fresh(
    ML_READY,
    DL_READY,
    gbr,
    xgb,
    knn,
    scaler,
    X,
    y,
    X_scaled,
    scaler_y,
    lstm,
    bilstm,
    var_name: str = "WS10M",
    username: str = "",
):

    def decode_dl(raw):
        if var_name == "WD10M":
            return np.rad2deg(np.arctan2(raw[:, 0], raw[:, 1])) % 360
        else:
            return scaler_y.inverse_transform(raw).flatten()

    if not ML_READY:
        return {}, {}

    split_train = int(len(X) * 0.8)
    split_val = int(len(X) * 0.9)

    X_train = X[:split_train]
    X_test = X[split_val:]
    y_train = y[:split_train]
    y_test = y[split_val:]

    ml = {}
    if gbr is not None:
        ml["GBR"] = {
            "train": get_metrics_for_var(y_train, gbr.predict(X_train), var_name),
            "test": get_metrics_for_var(y_test, gbr.predict(X_test), var_name),
        }
    if xgb is not None:
        ml["XGB"] = {
            "train": get_metrics_for_var(y_train, xgb.predict(X_train), var_name),
            "test": get_metrics_for_var(y_test, xgb.predict(X_test), var_name),
        }
    if knn is not None and scaler is not None:
        ml["KNN"] = {
            "train": get_metrics_for_var(
                y_train, knn.predict(scaler.transform(X_train)), var_name
            ),
            "test": get_metrics_for_var(
                y_test, knn.predict(scaler.transform(X_test)), var_name
            ),
        }

    dl = {}
    if DL_READY and X_scaled is not None:
        split_train_dl = int(len(X_scaled) * 0.8)
        split_val_dl = int(len(X_scaled) * 0.9)

        seqs_train = np.array(
            [X_scaled[i - STEP : i] for i in range(STEP, split_train_dl)]
        )
        y_dl_train = y[STEP:split_train_dl] if var_name == "WD10M" else y[STEP:split_train_dl].reshape(-1, 1)

        seqs_test = np.array(
            [X_scaled[i - STEP : i] for i in range(split_val_dl, len(X_scaled))]
        )
        y_dl_test  = y[split_val_dl:] if var_name == "WD10M" else y[split_val_dl:].reshape(-1, 1)

        for name, model in [("LSTM", lstm), ("BiLSTM", bilstm)]:
            pred_train = decode_dl(model.predict(seqs_train, verbose=0))
            pred_test  = decode_dl(model.predict(seqs_test,  verbose=0))
            dl[name] = {
                "train": get_metrics_for_var(y_dl_train, pred_train, var_name),
                "test":  get_metrics_for_var(y_dl_test,  pred_test,  var_name),
            }

    save_metrics(ml, dl, var_name, username=username)
    return ml, dl


def save_ensemble_metrics(
    var_name: str, ml_name: str, dl_name: str, train_metrics: dict, test_metrics: dict, username: str = ""
):
    from utils.user_helpers import load_user, save_user

    if not username:
        return
    user = load_user(username)
    if not user:
        return
    if "metrics" not in user:
        user["metrics"] = {}
    if var_name not in user["metrics"]:
        user["metrics"][var_name] = {}
    user["metrics"][var_name]["ensemble"] = {
        "ml_name": ml_name,
        "dl_name": dl_name,
        "components": [ml_name, dl_name],
        f"{ml_name}+{dl_name}": {"train": train_metrics, "test": test_metrics}
    }
    save_user(user)
    
    print(f"✅ Ensemble metrics [{var_name}] disimpan ke user {username}")


def load_ensemble_metrics(var_name: str, username: str = ""):
    from utils.user_helpers import load_user

    if not username:
        return {}
    user = load_user(username)
    if not user:
        return {}
    ensemble = user.get("metrics", {}).get(var_name, {}).get("ensemble", {})
    if not ensemble:
        return {}
    ml_name = ensemble.get("ml_name", "")
    dl_name = ensemble.get("dl_name", "")
    key = f"{ml_name}+{dl_name}"
    return {key: ensemble.get(key, {})}


def load_ensemble_components(username: str = ""):
    from utils.user_helpers import load_user

    if not username:
        return {}
    user = load_user(username)
    if not user:
        return {}
    result = {}
    for var, val in user.get("metrics", {}).items():
        components = val.get("ensemble", {}).get("components", [])
        if components:
            result[var] = components
    return result
