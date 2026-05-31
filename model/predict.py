"""
Standalone prediction script – test the TFLite model on a single image.

Usage:
  python predict.py path/to/leaf.jpg
"""

import sys
import json
import os
import numpy as np
from PIL import Image

MODEL_PATH  = "saved_model/tomato_disease.tflite"
LABELS_PATH = "saved_model/labels.json"
IMG_SIZE    = 224

def load_interpreter():
    try:
        import tflite_runtime.interpreter as tflite
        return tflite.Interpreter(model_path=MODEL_PATH)
    except ImportError:
        import tensorflow as tf
        return tf.lite.Interpreter(model_path=MODEL_PATH)

def predict(image_path: str):
    if not os.path.exists(MODEL_PATH):
        print(f"Model not found: {MODEL_PATH}\nRun train.py first.")
        return

    with open(LABELS_PATH) as f:
        labels = json.load(f)

    interpreter = load_interpreter()
    interpreter.allocate_tensors()
    inp = interpreter.get_input_details()
    out = interpreter.get_output_details()

    img = Image.open(image_path).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = np.expand_dims(arr, axis=0)

    interpreter.set_tensor(inp[0]["index"], arr)
    interpreter.invoke()
    preds = interpreter.get_tensor(out[0]["index"])[0]

    results = sorted(
        [(labels.get(str(i), str(i)), float(p) * 100) for i, p in enumerate(preds)],
        key=lambda x: -x[1],
    )

    print(f"\nPrediction for: {image_path}")
    print("-" * 40)
    for name, score in results[:5]:
        bar = "█" * int(score / 5)
        print(f"  {name:<35} {score:5.1f}%  {bar}")
    print(f"\n→ Diagnosis: {results[0][0]} ({results[0][1]:.1f}% confidence)")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict.py <image_path>")
        sys.exit(1)
    predict(sys.argv[1])
