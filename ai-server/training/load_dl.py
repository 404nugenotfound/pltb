import os
import traceback
import joblib
import numpy as np

from config import (
    MODEL_FOLDER,
    TARGET,
    STEP
)


def init_dl_models(df_ref, target_var: str = None):

    if target_var is None:
        target_var = TARGET

    suffix = f"_{target_var}"

    try:
        from tensorflow.keras.models import load_model

        print(f"📦 Load DL model untuk {target_var}...")

        # coba load dengan suffix dulu, fallback ke tanpa suffix
        lstm_path   = os.path.join(MODEL_FOLDER, f"lstm{suffix}.h5")
        bilstm_path = os.path.join(MODEL_FOLDER, f"bilstm{suffix}.h5")
        scalerX_path = os.path.join(MODEL_FOLDER, f"scaler_X{suffix}.pkl")
        scalery_path = os.path.join(MODEL_FOLDER, f"scaler_y{suffix}.pkl")
        dlcols_path  = os.path.join(MODEL_FOLDER, f"dl_cols{suffix}.pkl")

        # fallback ke model lama tanpa suffix
        if not os.path.exists(lstm_path):
            lstm_path   = os.path.join(MODEL_FOLDER, "lstm.h5")
            bilstm_path = os.path.join(MODEL_FOLDER, "bilstm.h5")
            scalerX_path = os.path.join(MODEL_FOLDER, "scaler_X.pkl")
            scalery_path = os.path.join(MODEL_FOLDER, "scaler_y.pkl")
            dlcols_path  = None
            print(f"⚠️ Model {target_var} tidak ada, fallback ke default")

        lstm   = load_model(lstm_path)
        bilstm = load_model(bilstm_path)

        scaler_X = joblib.load(scalerX_path)
        scaler_y = joblib.load(scalery_path)

        # load dl_cols
        if dlcols_path and os.path.exists(dlcols_path):
            dl_cols = joblib.load(dlcols_path)
        elif hasattr(scaler_X, "feature_names_in_"):
            dl_cols = list(scaler_X.feature_names_in_)
        else:
            dl_cols = [c for c in df_ref.columns if c != target_var]
            
        # Tambahkan ini ↓
        DEFAULT_FILL = {"PS": 101.325}
        for col, val in DEFAULT_FILL.items():
            if col not in df_ref.columns:
                df_ref = df_ref.copy()
                df_ref[col] = val
                print(f"⚠️ Kolom '{col}' tidak ada di df, diisi default {val}")


        missing = [c for c in dl_cols if c not in df_ref.columns]
        if missing:
            raise ValueError(f"Kolom DL tidak ada: {missing}")

        X_scaled = np.array(
            scaler_X.transform(df_ref[dl_cols].copy()),
            dtype=np.float32
        )

        if len(X_scaled) < STEP:
            raise ValueError(f"Data kurang dari STEP ({STEP})")

        data_seq = X_scaled[-STEP:].reshape(1, STEP, X_scaled.shape[1])

        print(f"✅ DL siap untuk {target_var} | shape={X_scaled.shape}")

        return {
            "lstm": lstm,
            "bilstm": bilstm,
            "scaler_X": scaler_X,
            "scaler_y": scaler_y,
            "X_scaled": X_scaled,
            "data_seq": data_seq,
            "DL_INPUT_COLS": dl_cols,
            "DL_READY": True
        }

    except Exception as e:
        print(f"⚠️ DL tidak tersedia untuk {target_var}: {e}")
        traceback.print_exc()
        return {
            "lstm": None,
            "bilstm": None,
            "scaler_X": None,
            "scaler_y": None,
            "X_scaled": None,
            "data_seq": None,
            "DL_INPUT_COLS": [],
            "DL_READY": False
        }


def load_dl_for_var(df_ref, var: str):
    """Load DL models untuk variabel tertentu saat generate."""
    return init_dl_models(df_ref, target_var=var)