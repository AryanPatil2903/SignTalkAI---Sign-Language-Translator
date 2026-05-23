# src/extractor.py — Hand landmark extraction (mediapipe 0.10.30+)

import os
import cv2
import numpy as np
import urllib.request
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

MODEL_PATH = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")
MODEL_URL  = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)

if not os.path.exists(MODEL_PATH):
    print("[extractor] Downloading hand_landmarker.task (~5MB)...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("[extractor] Downloaded.")

HAND_CONNECTIONS = [
    (0,1),(1,2),(2,3),(3,4),
    (0,5),(5,6),(6,7),(7,8),
    (5,9),(9,10),(10,11),(11,12),
    (9,13),(13,14),(14,15),(15,16),
    (13,17),(17,18),(18,19),(19,20),
    (0,17)
]


class HandExtractor:
    def __init__(self, max_num_hands=1,
                 min_detection_confidence=0.6,
                 min_tracking_confidence=0.5):

        base = mp_python.BaseOptions(model_asset_path=MODEL_PATH)
        opts = mp_vision.HandLandmarkerOptions(
            base_options=base,
            num_hands=max_num_hands,
            min_hand_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
            running_mode=mp_vision.RunningMode.IMAGE,
        )
        self.landmarker = mp_vision.HandLandmarker.create_from_options(opts)
        print("[extractor] Ready.")

    def extract(self, frame: np.ndarray):
        """
        Returns
        -------
        landmarks : np.ndarray (63,) normalized — or None
        annotated : np.ndarray frame with skeleton
        """
        annotated = frame.copy()
        h, w = frame.shape[:2]

        rgb      = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result   = self.landmarker.detect(mp_image)

        if not result.hand_landmarks:
            cv2.putText(annotated, "No hand", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
            return None, annotated

        lm_list = result.hand_landmarks[0]

        # Draw connections
        for s, e in HAND_CONNECTIONS:
            x1,y1 = int(lm_list[s].x*w), int(lm_list[s].y*h)
            x2,y2 = int(lm_list[e].x*w), int(lm_list[e].y*h)
            cv2.line(annotated, (x1,y1), (x2,y2), (0,229,255), 2)

        # Draw keypoints
        for lm in lm_list:
            cx,cy = int(lm.x*w), int(lm.y*h)
            cv2.circle(annotated, (cx,cy), 5, (57,255,144), -1)

        # Extract + normalize landmarks
        raw = []
        for lm in lm_list:
            raw.extend([lm.x, lm.y, lm.z])

        landmarks = np.array(raw, dtype=np.float32)
        wrist = landmarks[:3].copy()
        for i in range(0, len(landmarks), 3):
            landmarks[i]   -= wrist[0]
            landmarks[i+1] -= wrist[1]
            landmarks[i+2] -= wrist[2]

        return landmarks, annotated

    def __del__(self):
        if hasattr(self, "landmarker"):
            self.landmarker.close()