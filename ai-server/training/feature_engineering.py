import pandas as pd
from config import TARGET
import numpy as np

# =========================
# LOAD & FEATURE ENGINEERING
# =========================
def load_and_engineer(path: str, target_var: str = None) -> pd.DataFrame:
    df = pd.read_csv(path)
    var = target_var if target_var else TARGET

    # =========================
    # OUTLIER DETECTION — IQR
    # =========================
    Q1  = df[var].quantile(0.25)
    Q3  = df[var].quantile(0.75)
    IQR = Q3 - Q1
    lower = Q1 - 1.5 * IQR
    upper = Q3 + 1.5 * IQR
    df[var] = df[var].clip(lower=lower, upper=upper)

    # =========================
    # LAG FEATURES
    # =========================
    for lag in [1, 2, 3, 24]:
        df[f"lag{lag}"] = df[var].shift(lag)

    # =========================
    # ROLLING STATISTICS
    # =========================
    df["mean3"]  = df[var].rolling(3).mean()
    df["mean24"] = df[var].rolling(24).mean()
    df["std24"]  = df[var].rolling(24).std()   # ← tambah

    # =========================
    # CYCLICAL ENCODING JAM
    # =========================
    if "HR" in df.columns:
        df["hour_sin"] = np.sin(2 * np.pi * df["HR"] / 24)
        df["hour_cos"] = np.cos(2 * np.pi * df["HR"] / 24)

    return df.dropna().reset_index(drop=True)