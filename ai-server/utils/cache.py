from training.metrics import compute_metrics_fresh

def _flatten_to_test(metrics_dict: dict) -> dict:
    result = {}
    for model, val in metrics_dict.items():
        if isinstance(val, dict) and "test" in val:
            result[model] = val["test"]
        else:
            result[model] = val
    return result

def load_or_compute_metrics(
    ML_READY, DL_READY,
    gbr, xgb, knn, scaler,
    X, y, X_scaled, scaler_y,
    lstm, bilstm,
    var_name: str = None,
    username: str = ""
):
    from config import TARGET
    from utils.cache_settings import get_cache_settings
    from training.metrics import load_metrics

    if var_name is None:
        var_name = TARGET

    if not ML_READY:
        print("⚠️ Skip load metrics — model belum tersedia")
        return {}, {}

    settings = get_cache_settings()

    if not settings["metrics_cache"]:
        print("⚠️ Metrics cache disabled")
        return compute_metrics_fresh(
            ML_READY, DL_READY,
            gbr, xgb, knn, scaler,
            X, y, X_scaled, scaler_y,
            lstm, bilstm,
            var_name=var_name,
            username=username
        )

    # =========================
    # LOAD DARI user JSON
    # =========================
    ml_raw, dl_raw = load_metrics(var_name, username=username)
    if ml_raw:
        print(f"⚡ Load metrics [{var_name}] dari user {username}")
        if DL_READY and not dl_raw:
            print(f"🔄 Cache [{var_name}] tidak ada DL, hitung ulang...")
        else:
            return _flatten_to_test(ml_raw), _flatten_to_test(dl_raw or {})

    # =========================
    # COMPUTE BARU
    # =========================
    print(f"🆕 Hitung metrics [{var_name}] pertama kali...")
    ml, dl = compute_metrics_fresh(
        ML_READY, DL_READY,
        gbr, xgb, knn, scaler,
        X, y, X_scaled, scaler_y,
        lstm, bilstm,
        var_name=var_name,
        username=username
    )
    return ml, dl