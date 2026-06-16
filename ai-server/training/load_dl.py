import os
import traceback
import joblib
import numpy as np
from config import MODEL_FOLDER, TARGET, STEP, USER_FOLDER


def init_dl_models(df_ref, target_var: str = None, username=""):
    if target_var is None:
        target_var = TARGET

    suffix = f"_{target_var}"

    # =========================
    # PATH SETUP
    # =========================
    user_model_dir = os.path.join(USER_FOLDER, username) if username else MODEL_FOLDER

    try:
        from tensorflow.keras.models import load_model
        print(f"📦 Load DL model untuk {target_var} | user={username}")

        lstm_path    = os.path.join(user_model_dir, f"lstm{suffix}.h5")
        bilstm_path  = os.path.join(user_model_dir, f"bilstm{suffix}.h5")
        scalerX_path = os.path.join(user_model_dir, f"scaler_X{suffix}.pkl")
        scalery_path = os.path.join(user_model_dir, f"scaler_y{suffix}.pkl")
        dlcols_path  = os.path.join(user_model_dir, f"dl_cols{suffix}.pkl")

        # Fallback ke model tanpa suffix
        if not os.path.exists(lstm_path):
            lstm_path    = os.path.join(user_model_dir, "lstm.h5")
            bilstm_path  = os.path.join(user_model_dir, "bilstm.h5")
            scalerX_path = os.path.join(user_model_dir, "scaler_X.pkl")
            scalery_path = os.path.join(user_model_dir, "scaler_y.pkl")
            dlcols_path  = None
            print(f"⚠️ Model {target_var} tidak ada, fallback ke default")

        lstm     = load_model(lstm_path)
        bilstm   = load_model(bilstm_path)
        scaler_X = joblib.load(scalerX_path)

        circular_path = os.path.join(user_model_dir, f"is_circular{suffix}.pkl")
        is_circular   = joblib.load(circular_path) if os.path.exists(circular_path) else False

        if is_circular:
            scaler_y = None
        else:
            scaler_y = joblib.load(scalery_path) if os.path.exists(scalery_path) else None

        if dlcols_path and os.path.exists(dlcols_path):
            dl_cols = joblib.load(dlcols_path)
        elif hasattr(scaler_X, "feature_names_in_"):
            dl_cols = list(scaler_X.feature_names_in_)
        else:
            dl_cols = [c for c in df_ref.columns if c != target_var]

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
            "is_circular": is_circular,
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
            "is_circular": False,
            "X_scaled": None,
            "data_seq": None,
            "DL_INPUT_COLS": [],
            "DL_READY": False
        }


def load_dl_for_var(df_ref, var: str, username=""):
    """Load DL models untuk variabel tertentu saat generate."""
    return init_dl_models(df_ref, target_var=var, username=username)