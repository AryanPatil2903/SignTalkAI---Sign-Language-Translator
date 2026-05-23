# src/backbone.py — Model backbone for sign language classification
# Loads a trained Keras (.h5) or scikit-learn (.pkl) model
# and exposes a unified predict() interface.

import os
import numpy as np

# ── Label map: index → ASL letter ──────────────────────────────────────────
# Covers A–Z (26 classes). Extend for words/phrases as needed.
LABEL_MAP = {i: chr(65 + i) for i in range(26)}
# Add custom word labels beyond 26 if your model supports them:
# LABEL_MAP[26] = "Hello"
# LABEL_MAP[27] = "Thank You"


class SignLanguageModel:
    """
    Wrapper around the trained classification model.
    Supports Keras (.h5) and scikit-learn (.pkl) formats.
    Falls back to a DEMO random predictor if no model file is found.
    """

    def __init__(self, model_path: str = "models/sign_model.h5"):
        self.model = None
        self.model_type = None  # "keras" | "sklearn" | "demo"
        self._load_model(model_path)

    def _load_model(self, path: str):
        """Attempt to load a model file; fall back to demo mode."""
        if os.path.exists(path):
            ext = os.path.splitext(path)[1].lower()
            try:
                if ext == ".h5":
                    from tensorflow.keras.models import load_model
                    self.model = load_model(path)
                    self.model_type = "keras"
                    print(f"[backbone] Keras model loaded from {path}")

                elif ext == ".pkl":
                    import pickle
                    with open(path, "rb") as f:
                        self.model = pickle.load(f)
                    self.model_type = "sklearn"
                    print(f"[backbone] Sklearn model loaded from {path}")

            except Exception as e:
                print(f"[backbone] Model load failed: {e}. Falling back to demo mode.")
                self.model_type = "demo"
        else:
            print("[backbone] No model file found. Running in DEMO mode.")
            self.model_type = "demo"

    def predict(self, landmarks: np.ndarray):
        """
        Run inference on extracted landmarks.

        Parameters
        ----------
        landmarks : np.ndarray
            Flattened array of shape (63,) — 21 hand keypoints × (x, y, z).

        Returns
        -------
        label : str
            Predicted ASL letter or word.
        confidence : float
            Confidence score in range [0, 1].
        """
        input_data = landmarks.reshape(1, -1)  # shape: (1, 63)

        if self.model_type == "keras":
            probs = self.model.predict(input_data, verbose=0)[0]
            idx = int(np.argmax(probs))
            confidence = float(probs[idx])

        elif self.model_type == "sklearn":
            probs = self.model.predict_proba(input_data)[0]
            idx = int(np.argmax(probs))
            confidence = float(probs[idx])

        else:
            # DEMO: return a random prediction for UI testing
            idx = np.random.randint(0, 26)
            confidence = np.random.uniform(0.6, 0.99)

        label = LABEL_MAP.get(idx, "?")
        return label, confidence

    def is_loaded(self) -> bool:
        """Return True if a real model (not demo) is loaded."""
        return self.model_type in ("keras", "sklearn")