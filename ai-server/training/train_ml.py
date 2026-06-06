import joblib
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.neighbors import KNeighborsRegressor
import xgboost as xgb_lib
from config import MODEL_FOLDER

def train_ml_models(X, y, features, suffix=""):

    # =========================
    # GBR
    # ✅ n_estimators turun 200→100, max_depth 4→3 — cukup untuk time series
    # =========================
    gbr = GradientBoostingRegressor(
        n_estimators=100,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.8,        # ✅ stochastic GBR — lebih cepat & less overfit
        random_state=42,
        n_iter_no_change=10,  # ✅ early stopping GBR
        tol=1e-4
    )
    gbr.fit(X, y)
    joblib.dump(gbr, f"{MODEL_FOLDER}/gbr{suffix}.pkl")

    # =========================
    # XGB
    # ✅ n_estimators turun 300→200, tambah early stopping & parallelism
    # =========================
    xgb = xgb_lib.XGBRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,          # ✅ turun dari 5→4
        subsample=0.8,        # ✅ hindari overfit
        colsample_bytree=0.8, # ✅ feature sampling per tree
        n_jobs=-1,            # ✅ pakai semua core CPU
        random_state=42,
        verbosity=0,
        early_stopping_rounds=10  # ✅ stop kalau tidak improve
    )

    # ✅ XGB butuh eval_set untuk early stopping
    split   = int(len(X) * 0.9)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    xgb.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    joblib.dump(xgb, f"{MODEL_FOLDER}/xgb{suffix}.pkl")

    # =========================
    # KNN
    # ✅ n_neighbors naik 5→7 — lebih robust untuk data cuaca
    # ✅ algorithm='ball_tree' — lebih cepat untuk data besar
    # =========================
    scaler = MinMaxScaler()
    X_knn  = scaler.fit_transform(X)
    knn    = KNeighborsRegressor(
        n_neighbors=7,
        metric="euclidean",
        algorithm="ball_tree",  # ✅ lebih cepat dari brute force
        n_jobs=-1               # ✅ pakai semua core CPU
    )
    knn.fit(X_knn, y)
    joblib.dump(knn,    f"{MODEL_FOLDER}/knn{suffix}.pkl")
    joblib.dump(scaler, f"{MODEL_FOLDER}/scaler{suffix}.pkl")
    joblib.dump(features, f"{MODEL_FOLDER}/features{suffix}.pkl")

    return gbr, xgb, knn, scaler