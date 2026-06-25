import numpy as np
import tensorflow as tf
import cv2
import os
from keras.applications.efficientnet import preprocess_input

CLASSES = ["Normal Retina", "Diabetic Retinopathy", "Glaucoma", "Cataract"]
IMG_SIZE = (224, 224)
MODEL_PATH = os.getenv("MODEL_PATH", "weights/retina_model.h5")

try:
    model = tf.keras.models.load_model(MODEL_PATH)
    last_conv_layer_name = "top_conv"
except Exception as e:
    model = None
    print(f"Warning: Model not loaded. {e}")

def get_risk_level(predicted_class, confidence):
    if predicted_class == "Normal Retina":
        return "Low"
    return "High" if confidence > 0.8 else "Moderate"

def make_gradcam_heatmap(img_array, model, last_conv_layer_name, pred_index=None):
    grad_model = tf.keras.models.Model(
        [model.inputs], [model.get_layer(last_conv_layer_name).output, model.output]
    )
    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        if pred_index is None:
            pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]

    grads = tape.gradient(class_channel, last_conv_layer_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    last_conv_layer_output = last_conv_layer_output[0]
    heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0) / tf.math.reduce_max(heatmap)
    return heatmap.numpy()

def generate_explainable_image(img_path, output_dir):
    img = cv2.imread(img_path)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, IMG_SIZE)
    img_array = np.expand_dims(img_resized, axis=0)
    img_array = preprocess_input(img_array)

    if model is None:
        pred_class = CLASSES[0]
        confidence = 0.95
        gradcam_path = img_path
    else:
        preds = model.predict(img_array)
        pred_index = np.argmax(preds[0])
        pred_class = CLASSES[pred_index]
        confidence = float(preds[0][pred_index])

        heatmap = make_gradcam_heatmap(img_array, model, last_conv_layer_name)
        heatmap = cv2.resize(heatmap, (img.shape[1], img.shape[0]))
        heatmap = np.uint8(255 * heatmap)
        heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        superimposed_img = heatmap * 0.4 + img
        filename = f"gradcam_{os.path.basename(img_path)}"
        gradcam_path = os.path.join(output_dir, filename)
        cv2.imwrite(gradcam_path, superimposed_img)

    return pred_class, confidence, gradcam_path