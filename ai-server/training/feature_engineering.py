import pandas as pd
from config import TARGET, TRAIN_VARS

# =========================
# LOAD & FEATURE ENGINEERING
# =========================
def load_and_engineer(path: str, target_var: str = None) -> pd.DataFrame:
    df = pd.read_csv(path)

    # Kalau target_var tidak dispesifikkan, pakai TARGET default
    var = target_var if target_var else TARGET

    for lag in [1, 2, 3, 24]:
        df[f"lag{lag}"] = df[var].shift(lag)

    df["mean3"]  = df[var].rolling(3).mean()
    df["mean24"] = df[var].rolling(24).mean()

    return df.dropna().reset_index(drop=True)