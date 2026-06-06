from threading import Lock

# =========================
# GENERATE PROGRESS
# =========================
generate_progress = {}

# =========================
# TRAIN PROGRESS
# =========================
train_progress = {}

progress_lock = Lock()

train_lock = Lock()