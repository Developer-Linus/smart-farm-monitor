"""
Central configuration for the Smart Farm backend.
Edit thresholds and paths here without touching app logic.
"""

import os

# ── Server ─────────────────────────────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 5000
DEBUG = False

# ── Sensor thresholds ──────────────────────────────────────────────────────────
SOIL_MOISTURE_LOW   = 30    # % – irrigate when below this
SOIL_MOISTURE_HIGH  = 60    # % – "sufficient" when above this
TEMP_ALERT_HIGH     = 35    # °C – warn farmer
HUMIDITY_ALERT_LOW  = 40    # % – warn farmer

# ── Irrigation ─────────────────────────────────────────────────────────────────
IRRIGATION_DURATION_SECONDS = 30   # how long to run pump per cycle

# ── Auth ───────────────────────────────────────────────────────────────────────
SECRET_KEY    = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(__file__)
DATABASE_PATH = os.path.join(BASE_DIR, "farm.db")
MODEL_PATH    = os.path.join(BASE_DIR, "..", "model", "saved_model", "tomato_disease.tflite")
LABELS_PATH   = os.path.join(BASE_DIR, "..", "model", "saved_model", "labels.json")
IMG_SIZE      = 224

# ── Data retention ─────────────────────────────────────────────────────────────
MAX_HISTORY_RECORDS = 200   # keep last N sensor readings in memory

# ── Disease advice (matches your dataset class names) ──────────────────────────
DISEASE_ADVICE = {
    "Tomato_Early_blight":           "Apply fungicide (chlorothalonil or mancozeb). Remove lower infected leaves.",
    "Tomato_Healthy":                "Your tomato plants look healthy! Keep up the good work.",
    "Tomato_leaf_late_blight":       "Apply fungicide immediately. Remove and destroy infected plants. Improve air circulation.",
    "Tomato_leaf_yellow_curl_virus": "Control whiteflies. Remove infected plants. Use resistant varieties.",
    "Tomato_mold_leaf":              "Improve ventilation. Apply fungicide. Reduce humidity.",
    "Tomato_septora_leaf_spot":      "Apply fungicide. Remove infected leaves. Avoid wetting foliage.",
}
