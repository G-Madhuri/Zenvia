---
title: Zenvia
emoji: 👗
colorFrom: purple
colorTo: yellow
sdk: docker
pinned: false
app_port: 7860
---

# Zenvia: An Integrated System for Personalized Sizing, Color Recommendations, Virtual Wardrobe Management, and Fashion Assistance

Zenvia is a full-stack, state-of-the-art fashion intelligence platform that unifies computer vision, deep learning, web scraping, and generative AI into a cohesive style ecosystem. Built using a robust Flask backend and an interactive React frontend, Zenvia provides automated size estimation, skin-tone based seasonal color matching, live product search, a virtual wardrobe planner, and an AI-driven personal shopper.

---

## Core Modules & Features

### 1. Computer Vision-Based Size Estimation
* **Technology:** OpenCV, MediaPipe Pose tracking, and rule-based decision trees.
* **Mechanism:** Tracks critical body landmarks via a real-time webcam feed. Calculates pixel distance ratios (calibrated by inter-pupillary distance) to estimate torso height and shoulder width.
* **Outcome:** Maps body dimensions against standard sizing profiles (XS to XXXL) to output the user's best clothing fit without manual measurements.

### 2. Personal Color Analysis
* **Technology:** 5-fold cross-validated ResNet-50 Convolutional Neural Network (CNN) Ensemble.
* **Dataset:** Trained on Roboflow's "Eyes, Skin, and Hair Colors" dataset containing 6,770 curated images.
* **Classification:** Classifies the user's skin undertone into one of four seasons:
  * **Invierno (Winter):** Cool, clear undertones. Recommended palettes: Royal Blue, Emerald, Pure White, Fuchsia, Black.
  * **Otoño (Autumn):** Warm, muted undertones. Recommended palettes: Olive Green, Mustard, Terracotta, Rust, Forest Green.
  * **Primavera (Spring):** Warm, bright undertones. Recommended palettes: Coral, Peach, Butter Yellow, Aqua.
  * **Verano (Summer):** Cool, soft undertones. Recommended palettes: Lavender, Powder Blue, Dusty Rose, Soft Pink, Mauve.

### 3. Smart Product Discovery (Web Scraping)
* **Technology:** SerpAPI Google Shopping search engine.
* **Mechanism:** Converts sizing and color suggestions directly into parameterized search queries. Retrieves real-time results from top Indian retailers (Amazon, AJIO, Flipkart, Myntra), extracting price, rating, thumbnail, and purchase links.

### 4. Interactive Virtual Wardrobe Manager
* **Technology:** Cloudinary (Unsigned upload preset), LocalStorage, Chart.js.
* **Features:**
  * **Uploads:** Direct image upload to Cloudinary with drag-and-drop interface support.
  * **Outfit Builder:** Drag-and-drop upper and lower clothing items onto a canvas to preview look matches.
  * **Weather Assistant:** Leverages the OpenWeather API to display current conditions and suggest appropriate outfits (e.g. breathable fabrics for hot weather or waterproof jackets for rain).
  * **Statistics:** Tracks inventory characteristics (e.g., number of favorites, item usage count) and displays visual distribution charts.

### 5. Multi-Stage Outfit Scheduler & Reminders
* **Technology:** EmailJS SDK client-side, requests-based REST API on Flask backend, python background threads.
* **Dual-Email Flow:**
  1. **Immediate Email:** When a user schedules an outfit, the frontend triggers EmailJS to send a formatted HTML email confirming the schedule.
  2. **Morning-of Reminder:** A background thread running on the Flask server scans scheduled outfits periodically. If it detects an outfit scheduled for "today" (in Indian Standard Time UTC+5:30) between 6:00 AM and 12:00 PM, it calls the EmailJS REST API to send a second morning reminder email. Thread locks ensure safe file read/writes to `scheduled_outfits.json`.

### 6. Conversational AI Fashion Stylist (FashionBot)
* **Technology:** Mistral-7B LLM (routed via HTTP).
* **Mechanism:** Context-aware styling advisor that responds to queries about seasonal fashion tips, trend guidelines, and customized clothing coordination.

---

## Technology Stack

* **Backend:** Python 3.10+, Flask, PyTorch (TorchVision), MediaPipe, OpenCV, Pandas, Numpy, Requests.
* **Frontend:** React 18, Vite, Chart.js, Tailwind CSS (Vite Inject & CDN).
* **Storage:** Cloudinary (garment images), JSON database (schedules), LocalStorage (wardrobe state).
* **Deployment:** Hugging Face Spaces (Docker-based runtime).

---

##  Project Directory Structure

```
zenvia/
├── backend/
│   ├── app.py                  # Main Flask API containing routing & color-analysis classification
│   ├── fashionbot.py           # FashionBot blueprint integrating Mistral LLM
│   ├── virtual_wardrobe.py     # Virtual wardrobe blueprint + background reminder thread scheduler
│   ├── scheduled_outfits.json  # Database file for scheduled garments & reminder states
│   ├── sizes.csv               # Shoulder & torso mapping size rules chart
│   ├── requirements.txt        # Backend python packages
│   └── models/                 # Fold weights (1-5) for the ResNet-50 color analysis ensemble
│
├── frontend/
│   ├── index.html              # Frontend entry document (loads Tailwind CSS and scripts)
│   ├── package.json            # Node.js project configuration
│   ├── vite.config.js          # Vite compilation settings
│   └── src/
│       ├── main.jsx            # React root script
│       ├── index.css           # Global stylesheet containing animations and glassmorphism styling
│       ├── components/         # Reusable widgets (Custom Modal overlay)
│       └── pages/              # Application views:
│           ├── Home.jsx        # Landing dashboard page with styled hero sections
│           ├── Camera.jsx      # MediaPipe size estimation interface
│           ├── ColorAnalysis.jsx # ResNet-50 skin-tone capture pipeline
│           ├── Result.jsx      # Classification output and Google Shopping results view
│           ├── Chatbot.jsx     # AI Stylist chat log interface
│           └── Wardrobe.jsx    # Interactive drag-and-drop wardrobe calendar & schedule form
```

---

##  Environment Variables & Secrets Configuration

To run successfully, the backend requires a `.env` file (or Repository Secrets in Hugging Face). 

```ini
# Backend Environment Settings (.env)
MISTRAL_API_KEY=your_mistral_api_key
SERPAPI_API_KEY=your_serpapi_shopping_api_key
OPENWEATHER_API_KEY=your_openweathermap_api_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset_name
EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key
```

*Note: Frontend environment variables (`VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_PRESET`, `VITE_WEATHER_API_KEY`) are no longer required! The React app fetches all configurations dynamically at runtime via the backend `/api/config` endpoint.*

---

##  Local Installation & Setup

### 1. Backend Server Setup
Navigate to the `backend` folder, set up a python virtual environment, install packages, and start the app:
```bash
cd backend
python -m venv venv

# Activate Virtual Environment:
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install Dependencies:
pip install -r requirements.txt

# Start Backend API Server:
python app.py
```
*The Flask server runs on `http://localhost:5000`.*

### 2. Frontend Development Server Setup
Navigate to the `frontend` folder, install npm packages, and spin up Vite:
```bash
cd frontend
npm install
npm run dev
```
*The React app runs on `http://localhost:5173`.*

---

## 🏗️ Production Build & Single-Port Server Execution
To serve the complete full-stack project under a single port (ideal for deployments):

1. Compile the React build assets inside the `frontend` directory:
   ```bash
   cd frontend
   npm run build
   ```
   This outputs build distribution scripts inside `frontend/dist/`.
2. Start only the Flask backend:
   ```bash
   cd backend
   python app.py
   ```
   Flask automatically catches all client-side routes and serves the static HTML/JS assets from `frontend/dist/` under port `5000`. You can visit the full platform at `http://localhost:5000`.

---

##  Deploying to Hugging Face Spaces

Zenvia can be deployed directly to Hugging Face Spaces using the provided `Dockerfile`.

### 1. Build & Run Mechanism
The container is built as a multi-stage environment:
1. Node.js compiles the production React bundle.
2. A Python stage pulls base packages, installs Pytorch (CPU edition to fit space resource limitations), sets up system-level packages for OpenCV (`libGL.so`), and launches the Gunicorn production WSGI server.
3. The environment variable `PYTHONUNBUFFERED=1` is configured to output Flask logs to the Space build log stream in real time.

### 2. Space Setup Steps
1. Create a new **Docker** Space on Hugging Face.
2. Push your project code to the Space repository.
3. Add the required values (e.g. `MISTRAL_API_KEY`, `EMAILJS_SERVICE_ID`, etc.) under the Space's **Settings -> Repository Secrets**.
4. Hugging Face will automatically trigger compilation and launch the space.

---

##  EmailJS Template Customization
For the outfit scheduling and morning reminder templates to format correctly, create a template in EmailJS (default ID: `template_f56nu7k`) with the following settings:
* **To Email Field:** `{{to_email}}`
* **Subject Field:** `{{subject}}`
* **Template Body (switch to HTML editor `<>`):**
  ```html
  {{{html_body}}}
  ```
  *(Triple braces `{{{ }}}` allow EmailJS to render raw unescaped HTML content generated dynamically by the application).*

---

##  Authors

* **Title:** Zenvia: An Integrated System for Personalized Sizing, Color Recommendations, Virtual Wardrobe Management and Fashion Assistance
* **Authors:** 
  1. Madhuri Gottumukkala 
  2. Peesari Sathvik Reddy
  3. Prachi Dusa 
* **Institution:** Department of AI & ML, Chaitanya Bharathi Institute of Technology (CBIT), Hyderabad, India.

---

## ⚖️ License & Usage
This platform is intended for academic research and presentation. All rights reserved by the authors.
