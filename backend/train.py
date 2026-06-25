"""
Retinal Disease Classifier — Training Script
=============================================
Dataset folder structure expected:
    dataset/
    ├── Normal Retina/
    ├── Diabetic Retinopathy/
    ├── Glaucoma/
    ├── Cataract/
    └── Age-related Macular Degeneration/

Output: backend/weights/retina_model.h5
"""

import os
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import EfficientNetB0
from tensorflow.keras.applications.efficientnet import preprocess_input
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import (
    ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
)

# ─── CONFIG ────────────────────────────────────────────────────────────────────
# Adjust DATASET_DIR to wherever your images are
DATASET_DIR  = os.path.join(os.path.dirname(__file__), "dataset")
WEIGHTS_DIR  = os.path.join(os.path.dirname(__file__), "weights")
OUTPUT_MODEL = os.path.join(WEIGHTS_DIR, "retina_model.h5")

CLASSES   = [
    "Normal Retina",
    "Diabetic Retinopathy",
    "Glaucoma",
    "Cataract",
]
IMG_SIZE    = (224, 224)
BATCH_SIZE  = 32
EPOCHS      = 30
FINE_TUNE_EPOCHS = 20
LEARNING_RATE    = 1e-3
FINE_TUNE_LR     = 1e-5

# ─── SETUP ─────────────────────────────────────────────────────────────────────
os.makedirs(WEIGHTS_DIR, exist_ok=True)

print(f"TensorFlow version : {tf.__version__}")
print(f"Dataset directory  : {DATASET_DIR}")
print(f"Output model path  : {OUTPUT_MODEL}")

# Verify dataset folders exist
missing = [c for c in CLASSES if not os.path.isdir(os.path.join(DATASET_DIR, c))]
if missing:
    print("\n⚠️  Missing class folders in dataset/:")
    for m in missing:
        print(f"   • {m}")
    print("\nExpected structure:")
    print("  dataset/")
    for c in CLASSES:
        print(f"    ├── {c}/")
    raise SystemExit("Fix the dataset structure and re-run.")

# ─── DATA GENERATORS ───────────────────────────────────────────────────────────
train_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    rotation_range=20,
    width_shift_range=0.15,
    height_shift_range=0.15,
    shear_range=0.1,
    zoom_range=0.2,
    horizontal_flip=True,
    vertical_flip=False,
    brightness_range=[0.8, 1.2],
    fill_mode="nearest",
    validation_split=0.2,
)

val_datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    validation_split=0.2,
)

train_gen = train_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    classes=CLASSES,
    class_mode="categorical",
    subset="training",
    shuffle=True,
    seed=42,
)

val_gen = val_datagen.flow_from_directory(
    DATASET_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    classes=CLASSES,
    class_mode="categorical",
    subset="validation",
    shuffle=False,
    seed=42,
)

print(f"\nTraining samples   : {train_gen.samples}")
print(f"Validation samples : {val_gen.samples}")
print(f"Classes found      : {train_gen.class_indices}")

# ─── MODEL ─────────────────────────────────────────────────────────────────────
def build_model(num_classes: int, trainable_base: bool = False) -> Model:
    base = EfficientNetB0(
        include_top=False,
        weights="imagenet",
        input_shape=(*IMG_SIZE, 3),
    )
    base.trainable = trainable_base

    inputs  = base.input
    x       = base.output                                   # (7,7,1280)
    x       = layers.GlobalAveragePooling2D()(x)
    x       = layers.BatchNormalization()(x)
    x       = layers.Dropout(0.4)(x)
    x       = layers.Dense(256, activation="relu")(x)
    x       = layers.BatchNormalization()(x)
    x       = layers.Dropout(0.3)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)

    return Model(inputs, outputs)


model = build_model(num_classes=len(CLASSES), trainable_base=False)
model.summary()

# ─── PHASE 1 — Train head only ─────────────────────────────────────────────────
print("\n" + "="*60)
print("PHASE 1 — Training classification head (base frozen)")
print("="*60)

model.compile(
    optimizer=tf.keras.optimizers.Adam(LEARNING_RATE),
    loss="categorical_crossentropy",
    metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
)

callbacks_phase1 = [
    ModelCheckpoint(
        OUTPUT_MODEL,
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1,
    ),
    EarlyStopping(
        monitor="val_accuracy",
        patience=7,
        restore_best_weights=True,
        verbose=1,
    ),
    ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.5,
        patience=3,
        min_lr=1e-7,
        verbose=1,
    ),
]

history1 = model.fit(
    train_gen,
    epochs=EPOCHS,
    validation_data=val_gen,
    callbacks=callbacks_phase1,
    verbose=1,
)

# ─── PHASE 2 — Fine-tune top layers ────────────────────────────────────────────
print("\n" + "="*60)
print("PHASE 2 — Fine-tuning top layers of EfficientNetB0")
print("="*60)

# Unfreeze top 30 layers of the base
base_model = model.layers[1] if hasattr(model.layers[1], 'layers') else None
if base_model is None:
    # Find EfficientNetB0 layer
    for layer in model.layers:
        if isinstance(layer, tf.keras.Model):
            base_model = layer
            break

if base_model:
    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False
    print(f"Unfroze top 30 layers of {base_model.name}")
else:
    print("Could not find base model layers for fine-tuning, skipping phase 2")

model.compile(
    optimizer=tf.keras.optimizers.Adam(FINE_TUNE_LR),
    loss="categorical_crossentropy",
    metrics=["accuracy", tf.keras.metrics.AUC(name="auc")],
)

callbacks_phase2 = [
    ModelCheckpoint(
        OUTPUT_MODEL,
        monitor="val_accuracy",
        save_best_only=True,
        verbose=1,
    ),
    EarlyStopping(
        monitor="val_accuracy",
        patience=10,
        restore_best_weights=True,
        verbose=1,
    ),
    ReduceLROnPlateau(
        monitor="val_loss",
        factor=0.3,
        patience=4,
        min_lr=1e-8,
        verbose=1,
    ),
]

history2 = model.fit(
    train_gen,
    epochs=FINE_TUNE_EPOCHS,
    validation_data=val_gen,
    callbacks=callbacks_phase2,
    verbose=1,
)

# ─── FINAL EVALUATION ──────────────────────────────────────────────────────────
print("\n" + "="*60)
print("FINAL EVALUATION")
print("="*60)

loss, accuracy, auc = model.evaluate(val_gen, verbose=1)
print(f"\n✅ Validation Accuracy : {accuracy*100:.2f}%")
print(f"✅ Validation AUC      : {auc:.4f}")
print(f"✅ Validation Loss     : {loss:.4f}")
print(f"\n✅ Model saved to: {OUTPUT_MODEL}")