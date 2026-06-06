import joblib
import numpy as np
from config import MODEL_FOLDER, TARGET, TRAIN_VARS

def load_ml_models(suffix=""):
    try:
        gbr    = joblib.load(f"{MODEL_FOLDER}/gbr{suffix}.pkl")
        xgb    = joblib.load(f"{MODEL_FOLDER}/xgb{suffix}.pkl")
        knn    = joblib.load(f"{MODEL_FOLDER}/knn{suffix}.pkl")
        scaler = joblib.load(f"{MODEL_FOLDER}/scaler{suffix}.pkl")
        feats  = joblib.load(f"{MODEL_FOLDER}/features{suffix}.pkl")
        return gbr, xgb, knn, scaler, feats
    except Exception as e:
        print(f"⚠️ Model ML{suffix} tidak tersedia: {e}")
        return None, None, None, None, []

def init_ml_state(df):
    # ✅ FIX: suffix dipakai, bukan dibuat lalu diabaikan
    suffix = f"_{TARGET}"
    gbr, xgb, knn, scaler, FEATURES = load_ml_models(suffix)

    # Fallback ke model tanpa suffix kalau belum ada
    if gbr is None:
        print(f"⚠️ Model {suffix} tidak ada, fallback ke default")
        gbr, xgb, knn, scaler, FEATURES = load_ml_models("")

    ML_READY = all([
        gbr is not None,
        xgb is not None,
        knn is not None,
        scaler is not None,
        len(FEATURES) > 0
    ])

    if ML_READY:
        X       = np.array(df[FEATURES].values)
        y       = np.array(df[TARGET].values)
        data_ml = X[-1].reshape(1, -1)
        print(f"✅ ML models loaded [{TARGET}]")
    else:
        print("⚠️ ML models belum ada — upload dataset untuk training")
        X       = np.array([])
        y       = np.array([])
        data_ml = None

    return {
        "gbr": gbr, "xgb": xgb, "knn": knn,
        "scaler": scaler, "FEATURES": FEATURES,
        "ML_READY": ML_READY,
        "X": X, "y": y, "data_ml": data_ml,
    }

def load_ml_for_var(var: str):
    """Load model ML untuk variabel tertentu saat generate."""
    suffix = f"_{var}"
    gbr, xgb, knn, scaler, feats = load_ml_models(suffix)

    if gbr is None:
        print(f"⚠️ Model untuk {var} tidak ada, fallback ke default")
        gbr, xgb, knn, scaler, feats = load_ml_models("")

    return gbr, xgb, knn, scaler, feats