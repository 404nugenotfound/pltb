import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsRegressor
from sklearn.ensemble import GradientBoostingRegressor
import xgboost as xgb
import joblib

df = pd.read_csv("Dataset/NASA Bawean Hourly Full.csv")

# =========================
# FEATURE ENGINEERING
# =========================
for lag in [1,2,3,24]:
    df[f"lag{lag}"] = df["WS10M"].shift(lag)

df["mean3"] = df["WS10M"].rolling(3).mean()
df["mean24"] = df["WS10M"].rolling(24).mean()

df = df.dropna()

# =========================
# SPLIT
# =========================
FEATURES = ["lag1","lag2","lag3","lag24","mean3","mean24"]
X = df[FEATURES]
y = df["WS10M"]

# 🔥 simpan fitur
FEATURES = X.columns.tolist()
joblib.dump(FEATURES, "models/features.pkl")

split = int(len(X) * 0.8)

X_train, X_test = X[:split], X[split:]
y_train, y_test = y[:split], y[split:]

# =========================
# GBR
# =========================
gbr = GradientBoostingRegressor(n_estimators=300)
gbr.fit(X_train, y_train)
joblib.dump(gbr, "models/gbr.pkl")

# =========================
# XGB
# =========================
xg = xgb.XGBRegressor(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=5,
    random_state=42
)
xg.fit(X_train, y_train)
joblib.dump(xg, "models/xgb.pkl")

# =========================
# KNN
# =========================
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)

knn = KNeighborsRegressor(n_neighbors=5)
knn.fit(X_train_scaled, y_train)

joblib.dump(knn, "models/knn.pkl")
joblib.dump(scaler, "models/scaler.pkl")