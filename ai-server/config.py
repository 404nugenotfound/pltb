import os

SECRET_KEY = "ventara-secret-key-2024"
UPLOAD_FOLDER  = "uploads"
MODEL_FOLDER   = "models"
ARCHIVE_FOLDER = "uploads/archive"

ALLOWED_EXTENSIONS = {"csv"}

TARGET = "WS10M"
TRAIN_VARS = ["WS10M", "WD10M", "RH2M", "T2M", "PS"]


DEFAULT_DATASET = "Dataset/NASA Bawean Hourly.csv"
ACTIVE_DATASET_FILE = os.path.join(
    UPLOAD_FOLDER,
    "active_dataset.txt"
)

REQUIRED_COLUMNS = [
    "YEAR",
    "MO",
    "DY",
    "HR",
    "WS10M",
    "WD10M",
    "RH2M",
    "T2M",
    "PS"
]

STEP = 48

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER  = os.path.join(BASE_DIR, "uploads")
MODEL_FOLDER   = os.path.join(BASE_DIR, "models")
ARCHIVE_FOLDER = os.path.join(BASE_DIR, "uploads", "archive")
OUTPUT_FOLDER  = os.path.join(BASE_DIR, "outputs")
USER_FOLDER    = os.path.join(BASE_DIR, "users") 

os.makedirs(UPLOAD_FOLDER,  exist_ok=True)
os.makedirs(MODEL_FOLDER,   exist_ok=True)
os.makedirs(ARCHIVE_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER,  exist_ok=True)
os.makedirs(USER_FOLDER,    exist_ok=True)