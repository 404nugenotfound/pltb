from utils.user_helpers import load_user, save_user

DEFAULT_SETTING = {
    "model_cache": True,
    "metrics_cache": True
}


def get_cache_settings(username: str) -> dict:
    user = load_user(username)
    if not user:
        return DEFAULT_SETTING.copy()
    return user.get("cache_settings", DEFAULT_SETTING.copy())


def save_cache_settings(settings: dict, username: str) -> None:
    user = load_user(username)
    if not user:
        return
    user["cache_settings"] = settings
    save_user(user)