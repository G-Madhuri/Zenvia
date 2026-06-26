import os
import time
import math
import base64
import threading

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import torch
import torch.nn as nn

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from PIL import Image
from torchvision import transforms, models
from serpapi import GoogleSearch
from dotenv import load_dotenv

from fashionbot import fashionbot_bp
from virtual_wardrobe import vir_bp

load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app)

app.register_blueprint(fashionbot_bp)
app.register_blueprint(vir_bp)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Seasonal colour palettes ──────────────────────────────────────────────────
seasonal_palettes = {
    "Invierno": [
        {"name": "Royal Blue",  "hex": "#4169E1"},
        {"name": "Emerald",     "hex": "#50C878"},
        {"name": "Pure White",  "hex": "#FFFFFF"},
        {"name": "Cherry Red",  "hex": "#FF1C00"},
        {"name": "Black",       "hex": "#000000"},
        {"name": "Fuchsia",     "hex": "#FF00FF"},
        {"name": "Cool Gray",   "hex": "#8C92AC"},
        {"name": "Icy Pink",    "hex": "#FFD1DC"},
    ],
    "Otoño": [
        {"name": "Olive Green",     "hex": "#808000"},
        {"name": "Mustard",         "hex": "#FFDB58"},
        {"name": "Terracotta",      "hex": "#E2725B"},
        {"name": "Burnt Orange",    "hex": "#CC5500"},
        {"name": "Warm Taupe",      "hex": "#D2B48C"},
        {"name": "Rust",            "hex": "#B7410E"},
        {"name": "Forest Green",    "hex": "#228B22"},
        {"name": "Gold",            "hex": "#FFD700"},
        {"name": "Chocolate Brown", "hex": "#7B3F00"},
    ],
    "Primavera": [
        {"name": "Coral",             "hex": "#FF7F50"},
        {"name": "Peach",             "hex": "#FFE5B4"},
        {"name": "Light Gold",        "hex": "#FFD700"},
        {"name": "Warm Aqua",         "hex": "#00FFFF"},
        {"name": "Butter Yellow",     "hex": "#FFFACD"},
        {"name": "Bright Leaf Green", "hex": "#66FF66"},
        {"name": "Sky Blue",          "hex": "#87CEEB"},
        {"name": "Warm Pink",         "hex": "#FF6F91"},
    ],
    "Verano": [
        {"name": "Lavender",     "hex": "#E6E6FA"},
        {"name": "Powder Blue",  "hex": "#B0E0E6"},
        {"name": "Dusty Rose",   "hex": "#DCAE96"},
        {"name": "Soft Navy",    "hex": "#5072A7"},
        {"name": "Pastel Lilac", "hex": "#C8A2C8"},
        {"name": "Slate Gray",   "hex": "#708090"},
        {"name": "Soft Pink",    "hex": "#FFB7B2"},
        {"name": "Mauve",        "hex": "#E0B0FF"},
    ],
}

# ── ResNet-50 ensemble ────────────────────────────────────────────────────────
classes         = ["Invierno", "Otono", "Primavera", "Verano"]
num_classes     = 4
model_dir       = "models"
model_paths     = [os.path.join(model_dir, f"fold{i}_best.pth") for i in range(1, 6)]
fold_accuracies = [0.9378, 0.9527, 0.9482, 0.9347, 0.9355]

tta_transforms = [
    transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]),
]

models_list = []
for path in model_paths:
    m = models.resnet50(weights=None)
    m.fc = nn.Sequential(
        nn.Linear(m.fc.in_features, 512),
        nn.ReLU(),
        nn.Dropout(0.5),
        nn.Linear(512, num_classes),
    )
    m.load_state_dict(torch.load(path, map_location=device))
    m = m.to(device)
    m.eval()
    models_list.append(m)


def ensemble_predict(img):
    weighted_probs = torch.zeros(num_classes).to(device)
    for tform in tta_transforms:
        img_tensor = tform(img).unsqueeze(0).to(device)
        for model, weight in zip(models_list, fold_accuracies):
            with torch.no_grad():
                outputs = model(img_tensor)
                probs   = torch.softmax(outputs, dim=1).squeeze(0)
                weighted_probs += weight * probs
    weighted_probs /= sum(fold_accuracies)
    pred_class = torch.argmax(weighted_probs).item()
    return classes[pred_class], weighted_probs.cpu().numpy()


# ── Size estimation ───────────────────────────────────────────────────────────
try:
    sizes_df = pd.read_csv("sizes.csv")
    print("[sizes.csv] Loaded OK, columns:", sizes_df.columns.tolist())
    print("[sizes.csv] First row:", sizes_df.iloc[0].to_dict())
except Exception as e:
    print("Error loading sizes.csv:", e)
    sizes_df = pd.DataFrame()

mp_pose    = mp.solutions.pose
pose_model = mp_pose.Pose()

F              = 500
REAL_EYE_DIST  = 6.3
SCALING_FACTOR = 1.43

frame_state = {
    "stable":         False,
    "final_size":     None,
    "final_shoulder": None,
    "final_torso":    None,
    "measurements":   [],
    "last_move_time": 0,
}


def is_stable(measurements, tolerance=8.0):
    if len(measurements) < 15:
        return False
    return np.array(measurements[-15:]).std() < tolerance


def reset_frame_state():
    frame_state["stable"]         = False
    frame_state["final_size"]     = None
    frame_state["final_shoulder"] = None
    frame_state["final_torso"]    = None
    frame_state["measurements"]   = []
    frame_state["last_move_time"] = time.time()


def estimate_size(shoulder, torso, tolerance=8.0):
    best_match, best_dist = None, float("inf")
    for _, row in sizes_df.iterrows():
        s_mid = (row["Shoulder_Min_cm"] + row["Shoulder_Max_cm"]) / 2
        t_mid = (row["Torso_Min_cm"]    + row["Torso_Max_cm"])    / 2
        if (
            row["Shoulder_Min_cm"] - tolerance <= shoulder <= row["Shoulder_Max_cm"] + tolerance
            and row["Torso_Min_cm"] - tolerance <= torso   <= row["Torso_Max_cm"]    + tolerance
        ):
            dist = math.dist([shoulder, torso], [s_mid, t_mid])
            if dist < best_dist:
                best_dist  = dist
                best_match = row["Size"]
    return best_match or "Unknown"


# ── SerpAPI ───────────────────────────────────────────────────────────────────
def search_google_shopping(query, max_retries=3):
    api_key = os.getenv("SERPAPI_API_KEY")
    if not api_key:
        raise ValueError("SERPAPI_API_KEY not set")
    params = {
        "engine": "google_shopping",
        "q": query, "gl": "in", "hl": "en", "num": 20,
        "api_key": api_key,
    }
    for attempt in range(max_retries):
        try:
            results = GoogleSearch(params).get_dict()
            shopping_results = results.get("shopping_results", []) or results.get("organic_results", [])
            seen, products = set(), []
            for item in shopping_results:
                pid = item.get("product_id") or item.get("link")
                if pid in seen:
                    continue
                seen.add(pid)
                products.append({
                    "title":  item.get("title"),
                    "price":  item.get("price"),
                    "rating": item.get("rating"),
                    "image":  item.get("thumbnail") or item.get("image"),
                    "link":   item.get("link"),
                    "source": item.get("source", "Google Shopping"),
                })
            return products
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise e
    return []


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/color-analysis", methods=["POST"])
def color_analysis():
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "No image uploaded"}), 400
    filename  = secure_filename(file.filename)
    save_path = os.path.join("static", "uploads", filename)
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    file.save(save_path)
    img = Image.open(save_path).convert("RGB")
    pred_class, _ = ensemble_predict(img)
    palette  = seasonal_palettes.get(pred_class, [])
    img_path = "/" + save_path.replace("\\", "/").lstrip("/")
    return jsonify({"pred_class": pred_class, "img_path": img_path, "palette": palette})


@app.route("/static/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(
        os.path.join(os.getcwd(), "static", "uploads"), filename
    )


@app.route("/api/process-frame", methods=["POST"])
def process_frame():
    data = request.get_json()
    if not data or "frame" not in data:
        return jsonify({"error": "No frame provided"}), 400

    try:
        img_bytes = base64.b64decode(data["frame"])
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img       = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Invalid image"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    if frame_state["stable"] and frame_state["final_size"]:
        return jsonify({
            "stable":   True,
            "size":     frame_state["final_size"],
            "shoulder": round(frame_state["final_shoulder"], 1),
            "torso":    round(frame_state["final_torso"], 1),
        })

    h, w, _  = img.shape
    img_rgb  = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results  = pose_model.process(img_rgb)

    if not results.pose_landmarks:
        return jsonify({"warning": "No pose detected — make sure full body is visible"})

    lm = results.pose_landmarks.landmark
    left_eye       = (int(lm[2].x * w), int(lm[2].y * h))
    right_eye      = (int(lm[5].x * w), int(lm[5].y * h))
    pixel_eye_dist = math.dist(left_eye, right_eye)
    if pixel_eye_dist == 0:
        return jsonify({"warning": "Face not clearly visible"})

    d       = (REAL_EYE_DIST * F) / pixel_eye_dist
    ls, rs  = lm[11], lm[12]
    lh, rh  = lm[23], lm[24]

    if ls.visibility < 0.3 or rs.visibility < 0.3 or lh.visibility < 0.3 or rh.visibility < 0.3:
        return jsonify({"warning": "Move back — full body needed (head to hips)"})

    px_shoulder    = math.dist(
        (int(ls.x * w), int(ls.y * h)),
        (int(rs.x * w), int(rs.y * h))
    ) * SCALING_FACTOR
    shoulder_width = (px_shoulder * d) / F

    s_mid        = ((ls.x + rs.x) / 2 * w, (ls.y + rs.y) / 2 * h)
    h_mid        = ((lh.x + rh.x) / 2 * w, (lh.y + rh.y) / 2 * h)
    torso_height = (math.dist(s_mid, h_mid) * d) / F

    frame_state["measurements"].append(shoulder_width)
    temp_size = estimate_size(shoulder_width, torso_height)

    if is_stable(frame_state["measurements"]):
        if time.time() - frame_state["last_move_time"] > 3:
            frame_state["stable"]         = True
            frame_state["final_size"]     = temp_size
            frame_state["final_shoulder"] = shoulder_width
            frame_state["final_torso"]    = torso_height
            print(f"Locked: Shoulder={shoulder_width:.1f}, Torso={torso_height:.1f}, Size={temp_size}")
            return jsonify({
                "stable":    True,
                "size":      temp_size,
                "shoulder":  round(shoulder_width, 1),
                "torso":     round(torso_height, 1),
                "temp_size": temp_size,
            })
    else:
        frame_state["last_move_time"] = time.time()

    return jsonify({"stable": False, "temp_size": temp_size})


@app.route("/api/reset-capture", methods=["POST"])
def reset_capture():
    reset_frame_state()
    return jsonify({"status": "reset"})


@app.route("/api/get-products", methods=["POST"])
def get_products():
    data     = request.json
    gender   = data.get("gender", "")
    category = data.get("category", "")
    size     = data.get("size", "")
    prefix   = "men's" if gender.lower() == "men" else "women's"
    try:
        return jsonify(search_google_shopping(f"{prefix} {category} size {size}".strip()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/get-color-products", methods=["POST"])
def get_color_products():
    data     = request.json
    gender   = data.get("gender", "")
    category = data.get("category", "")
    color    = data.get("color", "")
    if not color:
        return jsonify({"error": "Color is required"}), 400
    prefix = "men's" if gender.lower() == "men" else "women's"
    try:
        return jsonify(search_google_shopping(f"{prefix} {color} {category}".strip()))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify({
        "CLOUDINARY_CLOUD_NAME": os.getenv("CLOUDINARY_CLOUD_NAME", ""),
        "CLOUDINARY_UPLOAD_PRESET": os.getenv("CLOUDINARY_UPLOAD_PRESET", "virtual_wardrobe"),
        "OPENWEATHER_API_KEY": os.getenv("OPENWEATHER_API_KEY", ""),
        "EMAILJS_SERVICE_ID": os.getenv("EMAILJS_SERVICE_ID", ""),
        "EMAILJS_TEMPLATE_ID": os.getenv("EMAILJS_TEMPLATE_ID", ""),
        "EMAILJS_PUBLIC_KEY": os.getenv("EMAILJS_PUBLIC_KEY", "")
    })


# ── Serve React in production ─────────────────────────────────────────────────
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
    if path and os.path.exists(os.path.join(dist, path)):
        return send_from_directory(dist, path)
    return send_from_directory(dist, "index.html")


if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False, threaded=True)