"""
Tomato Leaf Disease Detection Model Training
Uses the PlantVillage dataset (tomato classes)
Dataset: https://www.kaggle.com/datasets/emmarex/plantdisease

Classes detected:
  0 - Tomato_Bacterial_Spot
  1 - Tomato_Early_Blight
  2 - Tomato_Late_Blight
  3 - Tomato_Leaf_Mold
  4 - Tomato_Septoria_Leaf_Spot
  5 - Tomato_Spider_Mites
  6 - Tomato_Target_Spot
  7 - Tomato_Mosaic_Virus
  8 - Tomato_Yellow_Leaf_Curl_Virus
  9 - Tomato_Healthy
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
import json

# ── Configuration ──────────────────────────────────────────────────────────────
IMG_SIZE    = 224
BATCH_SIZE  = 32
EPOCHS      = 15

# Paths
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saved_model")
TFLITE_PATH = os.path.join(MODEL_DIR, "tomato_disease.tflite")

# Dataset: a clean subfolder containing ONLY the class folders
# We create this by symlinking / copying – here we just point to a staging dir
DATASET_DIR = os.path.join(BASE_DIR, "tomato_dataset")

# Actual class folder names
CLASS_NAMES = [
    "Tomato_Early_blight",
    "Tomato_Healthy",
    "Tomato_leaf_late_blight",
    "Tomato_leaf_yellow_curl_virus",
    "Tomato_mold_leaf",
    "Tomato_septora_leaf_spot",
]

os.makedirs(MODEL_DIR, exist_ok=True)

# ── Build a clean dataset folder with only the class subdirs ──────────────────
def prepare_dataset():
    """
    Creates tomato_dataset/ in the workspace root containing only the
    6 class folders. Uses junctions on Windows (no data copy, no admin needed).
    Falls back to copying if junctions fail.
    """
    import shutil, subprocess
    os.makedirs(DATASET_DIR, exist_ok=True)
    for cls in CLASS_NAMES:
        src = os.path.abspath(os.path.join(BASE_DIR, cls))
        dst = os.path.abspath(os.path.join(DATASET_DIR, cls))
        if os.path.exists(dst):
            continue
        if not os.path.isdir(src):
            print(f"  WARNING: source folder not found: {src}")
            continue
        # Try Windows junction first (no admin, no data copy)
        try:
            result = subprocess.run(
                ["cmd", "/c", "mklink", "/J", dst, src],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                print(f"  Linked  {cls}")
                continue
        except Exception:
            pass
        # Fallback: copy (slower but always works)
        print(f"  Copying {cls} (this may take a moment) …")
        shutil.copytree(src, dst)
    print(f"Dataset ready → {DATASET_DIR}")
    print(f"Dataset ready at: {DATASET_DIR}")


# ── Data generators ────────────────────────────────────────────────────────────
def build_generators():
    train_gen = ImageDataGenerator(
        rescale=1.0 / 255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.1,
        zoom_range=0.2,
        horizontal_flip=True,
        validation_split=0.2,
    )

    train_data = train_gen.flow_from_directory(
        DATASET_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        subset="training",
        shuffle=True,
    )

    val_data = train_gen.flow_from_directory(
        DATASET_DIR,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode="categorical",
        subset="validation",
        shuffle=False,
    )

    return train_data, val_data


# ── Model (MobileNetV2 transfer learning) ──────────────────────────────────────
def build_model(num_classes: int) -> tf.keras.Model:
    base = tf.keras.applications.MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = False          # freeze base initially

    model = models.Sequential([
        base,
        layers.GlobalAveragePooling2D(),
        layers.BatchNormalization(),
        layers.Dense(256, activation="relu"),
        layers.Dropout(0.4),
        layers.Dense(num_classes, activation="softmax"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


# ── Fine-tuning pass ───────────────────────────────────────────────────────────
def fine_tune(model: tf.keras.Model):
    """Unfreeze top layers of MobileNetV2 for fine-tuning."""
    base = model.layers[0]
    base.trainable = True
    # Freeze all layers except the last 30
    for layer in base.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


# ── Convert to TFLite ──────────────────────────────────────────────────────────
def convert_to_tflite(model: tf.keras.Model):
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]   # quantize for speed
    tflite_model = converter.convert()
    with open(TFLITE_PATH, "wb") as f:
        f.write(tflite_model)
    print(f"TFLite model saved → {TFLITE_PATH}")


# ── Save class labels ──────────────────────────────────────────────────────────
def save_labels(class_indices: dict):
    # Invert {name: index} → {index: name}
    idx_to_name = {str(v): k for k, v in class_indices.items()}
    path = os.path.join(MODEL_DIR, "labels.json")
    with open(path, "w") as f:
        json.dump(idx_to_name, f, indent=2)
    print(f"Labels saved → {path}")


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("Preparing dataset folder …")
    prepare_dataset()

    if not os.path.isdir(DATASET_DIR):
        print(f"Dataset folder '{DATASET_DIR}' could not be created.")
        return

    print("Building data generators …")
    train_data, val_data = build_generators()
    num_classes = len(train_data.class_indices)
    print(f"Found {num_classes} classes: {list(train_data.class_indices.keys())}")

    print("Building model …")
    checkpoint_path = os.path.join(MODEL_DIR, "best_model.h5")
    if os.path.exists(checkpoint_path):
        print(f"Resuming from checkpoint: {checkpoint_path}")
        model = tf.keras.models.load_model(checkpoint_path)
        # Re-compile with same settings
        model.compile(
            optimizer=tf.keras.optimizers.Adam(1e-3),
            loss="categorical_crossentropy",
            metrics=["accuracy"],
        )
    else:
        model = build_model(num_classes)
    model.summary()

    callbacks = [
        ModelCheckpoint(
            os.path.join(MODEL_DIR, "best_model.h5"),
            save_best_only=True,
            monitor="val_accuracy",
        ),
        EarlyStopping(patience=7, restore_best_weights=True, monitor="val_accuracy"),
        ReduceLROnPlateau(factor=0.3, patience=3, monitor="val_loss"),
    ]

    # Phase 1 – train head only
    print("\n=== Phase 1: Training head layers ===")
    model.fit(train_data, validation_data=val_data, epochs=EPOCHS, callbacks=callbacks)

    # Phase 2 – fine-tune
    print("\n=== Phase 2: Fine-tuning ===")
    model = fine_tune(model)
    model.fit(
        train_data,
        validation_data=val_data,
        epochs=10,
        callbacks=callbacks,
    )

    save_labels(train_data.class_indices)
    convert_to_tflite(model)
    print("\nTraining complete!")


if __name__ == "__main__":
    main()
