from training.metrics import compute_metrics_fresh, load_metrics


def load_or_compute_metrics(
    ML_READY, DL_READY,
    gbr, xgb, knn, scaler,
    X, y, X_scaled, scaler_y,
    lstm, bilstm,
    var_name: str = None,
    file_hash: str = "",
    username: str = ""
):
    from config import TARGET
    from utils.cache_settings import get_cache_settings

    if var_name is None:
        var_name = TARGET

    if not ML_READY:
        print("⚠️ Skip load metrics — model belum tersedia")
        return {}, {}

    settings = get_cache_settings(username)

    if not settings["metrics_cache"]:
        print("⚠️ Metrics cache disabled")
        return compute_metrics_fresh(
            ML_READY, DL_READY,
            gbr, xgb, knn, scaler,
            X, y, X_scaled, scaler_y,
            lstm, bilstm,
            var_name=var_name,
            file_hash=file_hash,
            username=username
        )

    # =========================
    # LOAD DARI user JSON
    # =========================
    ml_raw, dl_raw = load_metrics(var_name, file_hash=file_hash, username=username)
    # SESUDAH
    if ml_raw:
        print(f"⚡ Load metrics [{var_name}] (hash={file_hash[:8]}) dari user {username}")
        if DL_READY and not dl_raw and X_scaled is not None:
            print(f"🔄 Cache [{var_name}] tidak ada DL, hitung ulang...")
        else:
            return ml_raw, dl_raw or {}

    # =========================
    # COMPUTE BARU
    # =========================
    print(f"🆕 Hitung metrics [{var_name}] (hash={file_hash[:8]}) pertama kali...")
    ml, dl = compute_metrics_fresh(
        ML_READY, DL_READY,
        gbr, xgb, knn, scaler,
        X, y, X_scaled, scaler_y,
        lstm, bilstm,
        var_name=var_name,
        file_hash=file_hash,
        username=username
    )
    return ml, dl