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
    return {
        "MAE":  round(float(mean_absolute_error(yt, yp)), 3),
        "RMSE": round(float(np.sqrt(mean_squared_error(yt, yp))), 3),
        "MAPE": round(float(np.mean(np.abs((yt - yp) / yt)) * 100), 2),
        "R2":   round(float(r2_score(yt, yp)), 3)
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
    """Alias eksplisit untuk dipakai di worker generate."""
    ml, _ = load_metrics(var_name)
    return ml or {}

def load_dl_metrics_for_var(var_name: str):
    """Alias eksplisit untuk dipakai di worker generate."""
    _, dl = load_metrics(var_name)
    return dl or {}

def compute_metrics_fresh(
    ML_READY, DL_READY,
    gbr, xgb, knn, scaler, X, y,
    X_scaled, scaler_y, lstm, bilstm,
    var_name: str = "WS10M"   # ✅ tambah parameter ini
):
    if not ML_READY:
        return {}, {}
    
    ml = {}
    if gbr is not None:
        ml["GBR"] = get_metrics(y, gbr.predict(X))
    if xgb is not None:
        ml["XGB"] = get_metrics(y, xgb.predict(X))
    if knn is not None and scaler is not None:
        ml["KNN"] = get_metrics(y, knn.predict(scaler.transform(X)))
    
    dl = {}
    if DL_READY and X_scaled is not None:
        seqs = np.array([
            X_scaled[i-STEP:i]
            for i in range(STEP, len(X_scaled))
        ])
        y_dl          = y[STEP:].reshape(-1, 1)
        y_pred_lstm   = scaler_y.inverse_transform(lstm.predict(seqs,   verbose=0))
        y_pred_bilstm = scaler_y.inverse_transform(bilstm.predict(seqs, verbose=0))
        dl["LSTM"]   = get_metrics(y_dl, y_pred_lstm)
        dl["BiLSTM"] = get_metrics(y_dl, y_pred_bilstm)

    save_metrics(ml, dl, var_name)   # ✅ pakai var_name
    return ml, dl