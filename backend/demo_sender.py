"""
Demo script - simulates ESP32 sensor readings and leaf images.

Usage:
  python demo_sender.py                  # normal cycling simulation
  python demo_sender.py --scenario hot   # high temperature alert
  python demo_sender.py --scenario dry   # low soil moisture, triggers irrigation
  python demo_sender.py --scenario humid # low humidity alert
  python demo_sender.py --scenario all   # all alerts at once
  python demo_sender.py --scenario healthy   # healthy leaf scan
  python demo_sender.py --scenario disease   # diseased leaf scan
"""

import io
import sys
import math
import time
import random
import argparse
import requests
from PIL import Image, ImageDraw, ImageFilter

SERVER = "http://localhost:5000"
LEAF_INTERVAL = 30   # send a leaf image every N seconds


# ---- leaf image generation -----------------------------------------------

def _make_leaf_image(diseased: bool) -> bytes:
    """Generate a synthetic 224x224 leaf JPEG for testing the ML pipeline."""
    size = 224
    img = Image.new("RGB", (size, size), (20, 10, 5))
    draw = ImageDraw.Draw(img)

    # Background soil colour
    draw.ellipse([10, 10, size - 10, size - 10], fill=(30, 80, 20))

    # Main leaf shape
    cx, cy = size // 2, size // 2
    draw.ellipse([30, 40, size - 30, size - 40], fill=(45, 130, 35))

    # Vein
    draw.line([(cx, 40), (cx, size - 40)], fill=(35, 110, 25), width=3)
    for i in range(5):
        y = 55 + i * 24
        draw.line([(cx, y), (cx - 40 + i * 5, y + 20)], fill=(35, 110, 25), width=2)
        draw.line([(cx, y), (cx + 40 - i * 5, y + 20)], fill=(35, 110, 25), width=2)

    if diseased:
        # Brown/yellow lesion spots
        for _ in range(random.randint(8, 16)):
            x = random.randint(40, size - 40)
            y = random.randint(50, size - 50)
            r = random.randint(6, 18)
            colour = random.choice([
                (160, 100, 20),   # brown blight
                (200, 180, 40),   # yellow curl
                (120, 60, 10),    # dark blight
            ])
            draw.ellipse([x - r, y - r, x + r, y + r], fill=colour)

    img = img.filter(ImageFilter.GaussianBlur(radius=1))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def send_leaf(diseased: bool):
    label = "diseased" if diseased else "healthy"
    try:
        img_bytes = _make_leaf_image(diseased)
        r = requests.post(
            f"{SERVER}/api/leaf-image",
            data=img_bytes,
            headers={"Content-Type": "image/jpeg"},
            timeout=10,
        )
        result = r.json().get("result", {})
        print(f"  [LEAF] Sent {label} image  ->  {result.get('disease','?')}  "
              f"({result.get('confidence','?')}% confidence)")
    except Exception as e:
        print(f"  [LEAF] Error: {e}")


# ---- sensor sending -------------------------------------------------------

def send_sensors(temp, hum, soil):
    try:
        r = requests.post(f"{SERVER}/api/sensors", json={
            "temperature":   round(temp, 1),
            "humidity":      round(hum, 1),
            "soil_moisture": round(soil, 1),
        }, timeout=5)
        resp = r.json()
        irrigate = resp.get("irrigate", False)
        tag = "[IRRIGATING]" if irrigate else ""
        print(f"T={temp:.1f}C  H={hum:.1f}%  Soil={soil:.0f}%  {tag}")
        for alert in resp.get("alerts", []):
            print(f"  ALERT: {alert}")
    except Exception as e:
        print(f"[SENSOR] Error: {e}")


# ---- scenario generators --------------------------------------------------

def scenario_normal(t):
    temp = 26 + 7 * math.sin(t / 60) + random.uniform(-0.5, 0.5)
    hum  = 62 + 18 * math.cos(t / 80) + random.uniform(-1, 1)
    soil = max(10, min(100, 55 - (t % 120) * 0.35 + random.uniform(-2, 2)))
    return temp, hum, soil

def scenario_hot(t):
    temp = 37 + random.uniform(0, 2)
    hum  = 55 + random.uniform(-3, 3)
    soil = 45 + random.uniform(-5, 5)
    return temp, hum, soil

def scenario_dry(t):
    temp = 29 + random.uniform(-1, 1)
    hum  = 50 + random.uniform(-3, 3)
    soil = max(5, 28 - t * 0.05 + random.uniform(-2, 2))
    return temp, hum, soil

def scenario_humid(t):
    temp = 25 + random.uniform(-1, 1)
    hum  = 32 + random.uniform(-3, 3)
    soil = 50 + random.uniform(-5, 5)
    return temp, hum, soil

def scenario_all(t):
    temp = 38 + random.uniform(0, 1)
    hum  = 30 + random.uniform(-2, 2)
    soil = max(5, 20 - t * 0.03 + random.uniform(-2, 2))
    return temp, hum, soil


SCENARIOS = {
    "normal":  (scenario_normal,  False),
    "hot":     (scenario_hot,     False),
    "dry":     (scenario_dry,     False),
    "humid":   (scenario_humid,   False),
    "all":     (scenario_all,     True),
    "healthy": (scenario_normal,  False),   # leaf image forced healthy
    "disease": (scenario_normal,  True),    # leaf image forced diseased
}


# ---- main -----------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Smart Farm demo data sender")
    parser.add_argument("--scenario", default="normal",
                        choices=list(SCENARIOS.keys()),
                        help="Simulation scenario (default: normal)")
    args = parser.parse_args()

    gen, force_diseased = SCENARIOS[args.scenario]

    if args.scenario in ("healthy", "disease"):
        force_diseased = args.scenario == "disease"

    print(f"Demo sender started  [scenario: {args.scenario}]")
    print(f"Server: {SERVER}")
    print(f"Leaf image every {LEAF_INTERVAL}s\n")
    print("Press Ctrl+C to stop.\n")

    t = 0
    last_leaf = -LEAF_INTERVAL   # send first leaf immediately

    while True:
        temp, hum, soil = gen(t)
        send_sensors(temp, hum, soil)

        if t - last_leaf >= LEAF_INTERVAL:
            diseased = force_diseased if args.scenario in ("healthy", "disease", "all") \
                       else random.random() < 0.4
            send_leaf(diseased)
            last_leaf = t

        time.sleep(3)
        t += 3


if __name__ == "__main__":
    main()
