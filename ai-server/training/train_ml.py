import os
import joblib
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.neighbors import KNeighborsRegressor
from sklearn.model_selection import cross_val_score
import xgboost as xgb_lib
from config import USER_FOLDER


def train_ml_models(X, y, features, suffix="", username=""):

    # =========================
    # PATH SETUP
    # =========================
    user_model_dir = os.path.join(USER_FOLDER, username)
    os.makedirs(user_model_dir, exist_ok=True)

    def save_path(filename):
        return os.path.join(user_model_dir, filename)

    # =========================
    # SPLIT
    # =========================
    split_train = int(len(X) * 0.8)
    split_val   = int(len(X) * 0.9)

    X_train, X_val = X[:split_train], X[split_train:split_val]
    y_train, y_val = y[:split_train], y[split_train:split_val]

    # =========================
    # GBR
    # =========================
    gbr = GradientBoostingRegressor(
        n_estimators=100,
        learning_rate=0.05,
        max_depth=3,
        subsample=0.8,
        random_state=42,
        n_iter_no_change=10,
        tol=1e-4,
    )
    gbr.fit(X_train, y_train)
    joblib.dump(gbr, save_path(f"gbr{suffix}.pkl"))

    # =========================
    # XGB
    # =========================
    xgb = xgb_lib.XGBRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        subsample=0.8,
        colsample_bytree=0.8,
        n_jobs=-1,
        random_state=42,
        verbosity=0,
        early_stopping_rounds=10,
    )
    xgb.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )
    joblib.dump(xgb, save_path(f"xgb{suffix}.pkl"))

    # =========================
    # KNN — CARI BEST K
    # =========================
    scaler = MinMaxScaler()
    X_knn_train = scaler.fit_transform(X_train)

    sample_size = min(15000, len(X_knn_train))
    idx      = np.random.choice(len(X_knn_train), sample_size, replace=False)
    X_sample = X_knn_train[idx]
    y_sample = y_train[idx]

    best_k     = 101
    best_score = -np.inf

    for k in [51, 71, 101, 151, 201]:
        try:
            knn_candidate = KNeighborsRegressor(
                n_neighbors=k,
                metric="euclidean",
                algorithm="ball_tree",
                weights="uniform",
                n_jobs=-1,
            )
            scores = cross_val_score(
                knn_candidate, X_sample, y_sample,
                cv=3, scoring="r2", n_jobs=-1,
            )
            mean_score = scores.mean()
            print(f"  KNN k={k} → R2={mean_score:.4f}")
            if mean_score > best_score:
                best_score = mean_score
                best_k     = k
        except Exception as e:
            print(f"  KNN k={k} gagal: {e}")

    knn = KNeighborsRegressor(
        n_neighbors=best_k,
        metric="euclidean",
        algorithm="ball_tree",
        weights="uniform",
        n_jobs=-1,
    )
    knn.fit(X_knn_train, y_train)

    joblib.dump(knn,      save_path(f"knn{suffix}.pkl"))
    joblib.dump(scaler,   save_path(f"scaler{suffix}.pkl"))
    joblib.dump(features, save_path(f"features{suffix}.pkl"))

    return gbr, xgb, knn, scaler