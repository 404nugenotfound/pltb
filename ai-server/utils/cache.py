import os
import json
from config import MODEL_FOLDER
from utils.dataset import get_active_dataset_path
from training.metrics import compute_metrics_fresh

def _flatten_to_test(metrics_dict: dict) -> dict:
    """Ambil test metrics saja dari format train/test."""
    result = {}
    for model, val in metrics_dict.items():
        if isinstance(val, dict) and "test" in val:
            result[model] = val["test"]
        else:
            result[model] = val  # fallback format lama
    return result

def get_metrics_cache_path():
    return os.path.join(MODEL_FOLDER, "cache.json")

def get_model_cache_dir(dataset_path: str = ""):
    if not dataset_path:
        dataset_path = get_active_dataset_path()
    name = os.path.basename(dataset_path).replace(".csv", "")
    return os.path.join(MODEL_FOLDER, f"models_{name}")

def load_or_compute_metrics(
    ML_READY, DL_READY,
    gbr, xgb, knn, scaler,
    X, y, X_scaled, scaler_y,
    lstm, bilstm,
    var_name: str = None          # ✅ tambah parameter ini
):
    from config import TARGET
    if var_name is None:
        var_name = TARGET         # fallback ke TARGET default

    if not ML_READY:
        print("⚠️ Skip load metrics — model belum tersedia")
        return {}, {}

    cache_path = get_metrics_cache_path()

    from utils.cache_settings import get_cache_settings
    settings = get_cache_settings()

    if not settings["metrics_cache"]:
        print("⚠️ Metrics cache disabled")
        return compute_metrics_fresh(
            ML_READY, DL_READY,
            gbr, xgb, knn, scaler,
            X, y, X_scaled, scaler_y,
            lstm, bilstm,
            var_name=var_name     # ✅
        )

    # =========================
    # LOAD CACHE
    # =========================
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                cache = json.load(f)

            # ✅ Support format baru per-variabel
            if var_name in cache:
                var_cache = cache[var_name]
                print(f"⚡ Load metrics [{var_name}] dari cache")
                if DL_READY and not var_cache.get("dl"):
                    print(f"🔄 Cache [{var_name}] tidak ada DL, hitung ulang...")
                    # Hapus hanya entry variabel ini, bukan seluruh cache
                    del cache[var_name]
                    with open(cache_path, "w") as f:
                        json.dump(cache, f, indent=2)
                else:
                    ml_raw = var_cache["ml"]
                    dl_raw = var_cache.get("dl", {})
                    return _flatten_to_test(ml_raw), _flatten_to_test(dl_raw)

            # Fallback: format lama flat (ml/dl langsung)
            elif "ml" in cache:
                print(f"⚠️ Cache format lama ditemukan, diasumsikan {var_name}")
                if DL_READY and not cache.get("dl"):
                    print("🔄 Cache tidak ada DL metrics, hitung ulang...")
                    os.remove(cache_path)
                else:
                   return _flatten_to_test(cache["ml"]), _flatten_to_test(cache.get("dl", {}))

        except Exception as e:
            print(f"❌ Cache rusak: {e}")
            if os.path.exists(cache_path):
                os.remove(cache_path)

    # =========================
    # COMPUTE BARU
    # =========================
    print(f"🆕 Hitung metrics [{var_name}] pertama kali...")
    ml, dl = compute_metrics_fresh(
        ML_READY, DL_READY,
        gbr, xgb, knn, scaler,
        X, y, X_scaled, scaler_y,
        lstm, bilstm,
        var_name=var_name         # ✅
    )

    # ✅ Simpan per-variabel, tidak overwrite variabel lain
    existing_cache = {}
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r") as f:
                existing_cache = json.load(f)
        except Exception:
            existing_cache = {}

    existing_cache[var_name] = {"ml": ml, "dl": dl}

    with open(cache_path, "w") as f:
        json.dump(existing_cache, f, indent=2)

    print(f"✅ Cache [{var_name}] disimpan: {os.path.basename(cache_path)}")
    return ml, dl


