# metrics.py

import os
import json
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from config import MODEL_FOLDER, STEP

METRICS_PATH = f"{MODEL_FOLDER}/metrics.json"

def get_metrics(y_true, y_pred):
    yt = np.array(y_true).flatten()
    yp = np.array(y_pred).flatten()

    # ✅ sMAPE — lebih stabil dari MAPE waktu nilai aktual kecil
    denom = (np.abs(yt) + np.abs(yp)) / 2
    mask = denom != 0
    if mask.sum() > 0:
        smape = round(float(np.mean(np.abs(yt[mask] - yp[mask]) / denom[mask]) * 100), 2)
    else:
        smape = float("nan")

    return {
        "MAE":   round(float(mean_absolute_error(yt, yp)), 3),
        "RMSE":  round(float(np.sqrt(mean_squared_error(yt, yp))), 3),
        "sMAPE": smape,
        "R2":    round(float(r2_score(yt, yp)), 3)
    }

def save_metrics(ml, dl, var_name: str = "WS10M"):
    """Simpan metrics ke JSON per variabel — tidak overwrite variabel lain."""
    os.makedirs(MODEL_FOLDER, exist_ok=True)

    # Load existing dulu biar variabel lain tidak hilang
    existing = {}
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, "r") as f:
            existing = json.load(f)

    # Update hanya variabel yang baru di-train
    existing[var_name] = {"ml": ml, "dl": dl}

    with open(METRICS_PATH, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"✅ Metrics [{var_name}] disimpan ke {METRICS_PATH}")

def load_metrics(var_name: str = "WS10M"):
    """Load metrics untuk variabel tertentu."""
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, "r") as f:
            data = json.load(f)

        # Support format lama (flat) maupun format baru (per-var)
        if var_name in data:
            print(f"✅ Metrics [{var_name}] di-load dari cache")
            return data[var_name].get("ml", {}), data[var_name].get("dl", {})
        
        # Fallback: format lama tanpa var_name
        if "ml" in data or "dl" in data:
            print(f"⚠️ Metrics format lama ditemukan, diasumsikan WS10M")
            return data.get("ml", {}), data.get("dl", {})

    return None, None

def load_metrics_for_var(var_name: str):
    """Load metrics untuk forecasting — ambil test metrics saja."""
    ml, _ = load_metrics(var_name)
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

def load_dl_metrics_for_var(var_name: str):
    """Load DL metrics untuk forecasting — ambil test metrics saja."""
    _, dl = load_metrics(var_name)
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
    ML_READY, DL_READY,
    gbr, xgb, knn, scaler, X, y,
    X_scaled, scaler_y, lstm, bilstm,
    var_name: str = "WS10M"   # ✅ tambah parameter ini
):
    if not ML_READY:
        return {}, {}
    
    # ← tambah split 90/10
    split_train = int(len(X) * 0.8)
    split_val   = int(len(X) * 0.9)

    X_train = X[:split_train]
    X_test  = X[split_val:]   # ← 10% terakhir, tidak tersentuh training
    y_train = y[:split_train]
    y_test  = y[split_val:]
    
    ml = {}
    if gbr is not None:
        ml["GBR"] = {"train": get_metrics(y_train, gbr.predict(X_train)), "test": get_metrics(y_test, gbr.predict(X_test))}
    if xgb is not None:
        ml["XGB"] = {"train": get_metrics(y_train, xgb.predict(X_train)), "test": get_metrics(y_test, xgb.predict(X_test))}
    if knn is not None and scaler is not None:
        ml["KNN"] = {"train": get_metrics(y_train, knn.predict(scaler.transform(X_train))), "test": get_metrics(y_test, knn.predict(scaler.transform(X_test)))}
    
    dl = {}
    if DL_READY and X_scaled is not None:
        split_train_dl = int(len(X_scaled) * 0.8)
        split_val_dl   = int(len(X_scaled) * 0.9)

        seqs_train = np.array([X_scaled[i-STEP:i] for i in range(STEP, split_train_dl)])
        y_dl_train = y[STEP:split_train_dl].reshape(-1, 1)

        seqs_test  = np.array([X_scaled[i-STEP:i] for i in range(split_val_dl, len(X_scaled))])
        y_dl_test  = y[split_val_dl:].reshape(-1, 1)

        for name, model in [("LSTM", lstm), ("BiLSTM", bilstm)]:
            pred_train = scaler_y.inverse_transform(model.predict(seqs_train, verbose=0))
            pred_test  = scaler_y.inverse_transform(model.predict(seqs_test,  verbose=0))
            dl[name] = {
                "train": get_metrics(y_dl_train, pred_train),
                "test":  get_metrics(y_dl_test,  pred_test)
            }
            
    save_metrics(ml, dl, var_name)   # ✅ pakai var_name
    return ml, dl