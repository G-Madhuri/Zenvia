# ─────────────────────────────────────────────────────────────────────────────
# Zenvia — Hugging Face Docker Space
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.10-slim

# ── System packages ───────────────────────────────────────────────────────────
# libgl / libglib are required by OpenCV and MediaPipe on headless Linux.
# Node.js 18 is needed to build the React frontend inside the container.
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender-dev \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
# Use the PyTorch CPU-only index so we download ~220 MB instead of ~2 GB.
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir \
        --extra-index-url https://download.pytorch.org/whl/cpu \
        -r requirements.txt

# ── React build ───────────────────────────────────────────────────────────────
# Copy lock files first for better layer caching.
COPY frontend/package.json frontend/package-lock.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

COPY frontend/ ./

# Vite bakes these into the JS bundle at build time.
# Set them as Build-time variables in the HF Space settings UI.
ARG VITE_CLOUDINARY_CLOUD_NAME=""
ARG VITE_CLOUDINARY_PRESET="virtual_wardrobe"
ARG VITE_WEATHER_API_KEY=""
ENV VITE_CLOUDINARY_CLOUD_NAME=$VITE_CLOUDINARY_CLOUD_NAME
ENV VITE_CLOUDINARY_PRESET=$VITE_CLOUDINARY_PRESET
ENV VITE_WEATHER_API_KEY=$VITE_WEATHER_API_KEY

RUN npm run build

# ── Backend ───────────────────────────────────────────────────────────────────
WORKDIR /app
COPY backend/ ./backend/

# Ensure the uploads directory exists (Flask writes colour-analysis images here).
RUN mkdir -p /app/backend/static/uploads

# ── Download ResNet-50 model weights from HF Model Hub ────────────────────────
# IMPORTANT: Replace YOUR_HF_USERNAME/zenvia-models with your actual HF repo ID
# before pushing. Keep the model repo PUBLIC so no token is needed.
RUN python -c "\
import os, sys; \
from huggingface_hub import hf_hub_download; \
repo = 'G-Madhuri/zenvia-models'; \
os.makedirs('/app/backend/models', exist_ok=True); \
[hf_hub_download(repo_id=repo, filename=f'fold{i}_best.pth', local_dir='/app/backend/models') or print(f'Downloaded fold{i}_best.pth', flush=True) for i in range(1, 6)]"

# ── Expose port and start ─────────────────────────────────────────────────────
# Hugging Face Spaces REQUIRES the app to listen on port 7860.
EXPOSE 7860

WORKDIR /app/backend

CMD ["gunicorn", \
     "--bind", "0.0.0.0:7860", \
     "--workers", "1", \
     "--threads", "2", \
     "--timeout", "300", \
     "app:app"]
