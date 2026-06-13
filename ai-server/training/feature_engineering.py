import pandas as pd
from config import TARGET
import numpy as np

# =========================
# LOAD & FEATURE ENGINEERING
# =========================
def load_and_engineer(path: str, target_var: str = None) -> pd.DataFrame:
    df = pd.read_csv(path)
    var = target_var if target_var else TARGET

    ALL_VARS = ["T2M", "RH2M", "PS", "WS10M", "WD10M"]

    # =========================
    # OUTLIER DETECTION — IQR
    # =========================
    Q1  = df[var].quantile(0.25)
    Q3  = df[var].quantile(0.75)
    IQR = Q3 - Q1
    df[var] = df[var].clip(lower=Q1 - 1.5*IQR, upper=Q3 + 1.5*IQR)

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
    df["std24"]  = df[var].rolling(24).std()

    # # =========================
    # # CROSS-VARIABLE FEATURES
    # # — hanya kolom lain selain target
    # # =========================
    # cross_vars = [v for v in ALL_VARS if v != var and v in df.columns]
    # for v in cross_vars:
    #     df[f"{v}_lag1"]   = df[v].shift(1)
    #     df[f"{v}_mean24"] = df[v].rolling(24).mean()

    # =========================
    # CYCLICAL ENCODING JAM
    # =========================
    if "HR" in df.columns:
        df["hour_sin"] = np.sin(2 * np.pi * df["HR"] / 24)
        df["hour_cos"] = np.cos(2 * np.pi * df["HR"] / 24)

    # ← ini hilang, tambah lagi:
    if var == "WD10M" and "WD10M" in df.columns:
        df["WD10M_sin"] = np.sin(np.deg2rad(df["WD10M"]))
        df["WD10M_cos"] = np.cos(np.deg2rad(df["WD10M"]))
        print("✅ WD10M sin/cos features ditambahkan")

    return df.dropna().reset_index(drop=True)