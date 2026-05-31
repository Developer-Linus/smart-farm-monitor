"""
Smart Farm Backend – Flask API
Endpoints:
  POST /api/sensors          – ESP32 posts sensor data
  POST /api/leaf-image       – ESP32 posts a JPEG for disease detection
  GET  /api/status           – dashboard polls current state
  GET  /api/history          – last N sensor readings
  GET  /api/irrigation/toggle – manual irrigation toggle (from dashboard)
  GET  /                     – serves the farmer dashboard
"""

import os
import json
import threading
from collections import deque
from datetime import datetime
from functools import wraps

import base64

import numpy as np
from flask import Flask, request, jsonify, send_from_directory, session, redirect
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from PIL import Image
import io

import config
import db

# ── Optional TFLite import ─────────────────────────────────────────────────────
try:
    import tflite_runtime.interpreter as tflite
    TFLite = tflite.Interpreter
except ImportError:
    try:
        import tensorflow as tf
        TFLite = tf.lite.Interpreter
    except ImportError:
        TFLite = None
        print("WARNING: No TFLite runtime found. Leaf detection disabled.")

# ── App setup ──────────────────────────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
app = Flask(__name__, static_folder=FRONTEND_DIR)
app.secret_key = config.SECRET_KEY
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

# ── Shared state (thread-safe via lock) ───────────────────────────────────────
state_lock = threading.Lock()
farm_state = {
    "temperature":    None,
    "humidity":       None,
    "soil_moisture":  None,
    "irrigation_on":  False,
    "irrigation_auto": True,
    "last_updated":   None,
    "leaf_result":    None,   # latest disease detection result
    "leaf_image_b64": None,
    "alerts":         [],
}
sensor_history = deque(maxlen=config.MAX_HISTORY_RECORDS)

# ── Initialise database and pre-load history ───────────────────────────────────
db.init_db()
for _row in db.get_sensor_history(config.MAX_HISTORY_RECORDS):
    sensor_history.append(_row)

# ── Load TFLite model ──────────────────────────────────────────────────────────
interpreter = None
labels = {}

def load_model():
    global interpreter, labels
    if TFLite is None:
        return
    if not os.path.exists(config.MODEL_PATH):
        print(f"Model not found at {config.MODEL_PATH}. Train the model first.")
        return
    interpreter = TFLite(model_path=config.MODEL_PATH)
    interpreter.allocate_tensors()
    if os.path.exists(config.LABELS_PATH):
        with open(config.LABELS_PATH) as f:
            labels = json.load(f)
    print("TFLite model loaded.")

load_model()


# ── Auth helpers ───────────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            if request.is_json or request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized"}), 401
            return redirect("/")
        return f(*args, **kwargs)
    return decorated


# ── Helpers ────────────────────────────────────────────────────────────────────
def run_inference(image_bytes: bytes) -> dict:
    """Run leaf disease inference on raw JPEG bytes."""
    if interpreter is None:
        return {"disease": "Model not loaded", "confidence": 0, "healthy": False}

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((config.IMG_SIZE, config.IMG_SIZE))
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = np.expand_dims(arr, axis=0)

    inp  = interpreter.get_input_details()
    out  = interpreter.get_output_details()
    interpreter.set_tensor(inp[0]["index"], arr)
    interpreter.invoke()
    preds = interpreter.get_tensor(out[0]["index"])[0]

    idx        = int(np.argmax(preds))
    confidence = float(preds[idx])
    label      = labels.get(str(idx), f"Class_{idx}")
    healthy    = "healthy" in label.lower()

    return {
        "disease":    label.replace("_", " "),
        "confidence": round(confidence * 100, 1),
        "healthy":    healthy,
        "all_scores": {labels.get(str(i), str(i)): round(float(p) * 100, 1)
                       for i, p in enumerate(preds)},
    }


def evaluate_sensors(temp, humidity, moisture) -> list:
    """Return list of alert strings based on current readings."""
    alerts = []
    if temp is not None and temp > config.TEMP_ALERT_HIGH:
        alerts.append(f"⚠️ High temperature: {temp}°C (above {config.TEMP_ALERT_HIGH}°C)")
    if humidity is not None and humidity < config.HUMIDITY_ALERT_LOW:
        alerts.append(f"⚠️ Low humidity: {humidity}% (below {config.HUMIDITY_ALERT_LOW}%)")
    if moisture is not None:
        if moisture < config.SOIL_MOISTURE_LOW:
            alerts.append(f"💧 Soil moisture low ({moisture}%) – irrigation activated")
        elif moisture >= config.SOIL_MOISTURE_HIGH:
            alerts.append(f"✅ Soil moisture sufficient ({moisture}%)")
    return alerts


def auto_irrigate(moisture):
    """Decide irrigation state based on soil moisture."""
    with state_lock:
        if not farm_state["irrigation_auto"]:
            return
        if moisture is not None:
            farm_state["irrigation_on"] = moisture < config.SOIL_MOISTURE_LOW


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path):
    if path and os.path.exists(os.path.join(FRONTEND_DIR, path)):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


# ── Auth routes ────────────────────────────────────────────────────────────────

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(force=True, silent=True) or {}
    name     = (data.get("name") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    if db.get_user_by_email(email):
        return jsonify({"error": "An account with that email already exists."}), 409

    db.create_user(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        created_at=datetime.now().isoformat(),
    )
    user = db.get_user_by_email(email)
    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    return jsonify({"status": "ok", "name": user["name"]}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(force=True, silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = db.get_user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Incorrect email or password."}), 401

    session["user_id"]   = user["id"]
    session["user_name"] = user["name"]
    return jsonify({"status": "ok", "name": user["name"]})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "ok"})


@app.route("/api/auth/me", methods=["GET"])
def me():
    if "user_id" not in session:
        resp = jsonify({"error": "Unauthorized"})
        resp.headers["Cache-Control"] = "no-store"
        return resp, 401
    resp = jsonify({"id": session["user_id"], "name": session.get("user_name")})
    resp.headers["Cache-Control"] = "no-store"
    return resp


@app.route("/api/sensors", methods=["POST"])
def receive_sensors():
    """
    ESP32 posts JSON:
    { "temperature": 28.5, "humidity": 65.2, "soil_moisture": 45 }
    soil_moisture is 0-100 % (map raw ADC in firmware)
    """
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    temp     = data.get("temperature")
    humidity = data.get("humidity")
    moisture = data.get("soil_moisture")
    ts       = datetime.now().isoformat()

    alerts = evaluate_sensors(temp, humidity, moisture)
    auto_irrigate(moisture)

    record = {
        "timestamp":    ts,
        "temperature":  temp,
        "humidity":     humidity,
        "soil_moisture": moisture,
    }

    db.add_sensor_reading(ts, temp, humidity, moisture)

    with state_lock:
        farm_state["temperature"]   = temp
        farm_state["humidity"]      = humidity
        farm_state["soil_moisture"] = moisture
        farm_state["last_updated"]  = ts
        farm_state["alerts"]        = alerts
        sensor_history.append(record)
        irrigation_cmd = farm_state["irrigation_on"]

    return jsonify({
        "status":       "ok",
        "irrigate":     irrigation_cmd,
        "alerts":       alerts,
    })


@app.route("/api/leaf-image", methods=["POST"])
def receive_leaf_image():
    """
    ESP32 posts raw JPEG bytes (Content-Type: image/jpeg)
    or multipart form-data with field 'image'.
    """
    if request.content_type and "multipart" in request.content_type:
        file = request.files.get("image")
        if not file:
            return jsonify({"error": "No image field"}), 400
        image_bytes = file.read()
    else:
        image_bytes = request.data

    if not image_bytes:
        return jsonify({"error": "Empty image"}), 400

    result = run_inference(image_bytes)
    b64    = base64.b64encode(image_bytes).decode("utf-8")
    ts     = datetime.now().isoformat()

    db.add_leaf_scan(
        timestamp=ts,
        disease=result.get("disease"),
        confidence=result.get("confidence"),
        healthy=result.get("healthy", False),
        all_scores=result.get("all_scores", {}),
        image_b64=b64,
    )

    with state_lock:
        farm_state["leaf_result"]    = result
        farm_state["leaf_image_b64"] = b64

    return jsonify({"status": "ok", "result": result})


@app.route("/api/status", methods=["GET"])
@login_required
def get_status():
    """Dashboard polls this every few seconds."""
    with state_lock:
        return jsonify(dict(farm_state))


@app.route("/api/history", methods=["GET"])
@login_required
def get_history():
    with state_lock:
        return jsonify(list(sensor_history))


@app.route("/api/irrigation/toggle", methods=["POST"])
@login_required
def toggle_irrigation():
    """Manual override from dashboard."""
    data = request.get_json(force=True, silent=True) or {}
    with state_lock:
        if "auto" in data:
            farm_state["irrigation_auto"] = bool(data["auto"])
        if "on" in data:
            farm_state["irrigation_on"]   = bool(data["on"])
            farm_state["irrigation_auto"] = False   # manual overrides auto
        return jsonify({
            "irrigation_on":   farm_state["irrigation_on"],
            "irrigation_auto": farm_state["irrigation_auto"],
        })


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
