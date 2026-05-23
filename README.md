# 🤟 SignBridge — Sign Language Translator

A real-time American Sign Language (ASL) letter translator
built with Flask, OpenCV, and MediaPipe. Detects hand landmarks
from a webcam stream, classifies the gesture, and builds a
sentence with text-to-speech output.
---

## ✨ Features

- Real-time hand landmark detection via MediaPipe Hands
- ASL A–Z letter recognition (26 classes)
- Confidence score bar per prediction
- Sentence builder with backspace and space support
- Browser Text-to-Speech for built sentences
- Detection log with timestamps
- Dark industrial UI (no external UI library needed)
- Supports Keras (.h5) and scikit-learn (.pkl) models
- Demo mode (random predictions) when no model is loaded

---

## 📁 Project Structure
sign-language-translator/
├── src/
│   ├── backbone.py       # Model loading + inference
│   └── extractor.py      # MediaPipe hand extraction
├── templates/
│   └── index.html        # Frontend UI
├── static/
│   ├── css/style.css     # Styles
│   └── js/script.js      # Client logic
├── models/               # Put your .h5 or .pkl model here
├── app.py                # Flask app + /predict endpoint
├── run.bat               # Windows launcher
├── run.sh                # Linux/macOS launcher
├── requirements.txt
├── .env.example
└── README.md

---

## ⚙️ Setup

### 1. Clone & enter the project
```bash
git clone https://github.com/your-username/sign-language-translator.git
cd sign-language-translator
```

### 2. Create a virtual environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Add your model (optional)
Place a trained `sign_model.h5` (Keras) or `sign_model.pkl`
(scikit-learn) inside the `models/` folder.

> If no model is present, the app runs in **DEMO mode**
> (random predictions) so you can test the full UI.

### 5. Configure environment
```bash
cp .env.example .env
# Edit .env if needed
```

---

## ▶️ How to Run

**Windows:**
```bat
run.bat
```

**Linux / macOS:**
```bash
chmod +x run.sh
./run.sh
```

**Or directly:**
```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 🧠 Training Your Own Model

1. Collect landmark data using `extractor.py` (21 keypoints × 3 = 63 features per sample).
2. Label each sample with the ASL letter (0–25).
3. Train a Keras Dense network or sklearn RandomForestClassifier.
4. Save as `models/sign_model.h5` or `models/sign_model.pkl`.
5. Restart the Flask server.

---

## 📡 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET    | `/`         | Main UI          |
| POST   | `/predict`  | Accepts base64 frame, returns prediction |
| GET    | `/health`   | Server + model status |

---

## 🛠 Tech Stack

- **Flask** — Web server
- **OpenCV** — Image decoding
- **MediaPipe** — Hand landmark detection
- **TensorFlow / Keras** — Deep learning inference
- **scikit-learn** — Alternative ML backend
- **Web Speech API** — Text-to-speech in browser

---

## 📜 License

MIT License. Free to use and modify.
