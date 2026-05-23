# app.py — Sign Language Translator | Improved Version
# Features: MJPEG streaming, 3 pages, sequence prediction, learning hub

import cv2
import json
import time
import threading
import traceback
import numpy as np
from queue import Queue
from collections import deque
from flask import Flask, render_template, jsonify, request, Response

from src.extractor import HandExtractor
from src.backbone import SignLanguageModel

app = Flask(__name__)

# ── Initialize models ─────────────────────────────────────────────
extractor = HandExtractor()
model     = SignLanguageModel()

# ── ASL Signs list A-Z + common words ─────────────────────────────
SIGNS_LIST = [
    "A","B","C","D","E","F","G","H","I","J","K","L","M",
    "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
    "Hello","Thank You","Please","Sorry","Yes","No",
    "Good","Bad","Help","Stop","Go","Come","Wait",
    "Eat","Drink","Sleep","Home","School","Work",
    "Friend","Family","Love","Name","What","Where",
    "How","When","Why","More","Less","Good Morning",
    "Good Night","Bathroom","Water","Food","Pain"
]

# ── Video Stream Handler ──────────────────────────────────────────
class VideoStreamHandler:
    def __init__(self):
        self.frame_queue   = Queue(maxsize=3)
        self.detected_signs= deque(maxlen=20)
        self.sequence_data = []
        self.cap           = None
        self.is_running    = False
        self.lock          = threading.Lock()
        self.fps           = 0
        self.frame_count   = 0
        self.last_time     = time.time()
        self.camera_thread = None
        self.SEQ_LEN       = 20    # frames per prediction window
        self.THRESHOLD     = 0.5   # min confidence to accept

    def camera_thread_fn(self):
        try:
            print("[camera] Starting...")
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                print("[camera] Cannot open camera.")
                self.is_running = False
                return

            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.cap.set(cv2.CAP_PROP_FPS, 30)
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            print("[camera] Ready.")

            while self.is_running:
                ret, frame = self.cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue

                # Extract landmarks
                landmarks, annotated = extractor.extract(frame)

                if landmarks is not None:
                    self.sequence_data.append(landmarks)

                    # Predict when we have enough frames
                    if len(self.sequence_data) >= self.SEQ_LEN:
                        seq = np.array(
                            self.sequence_data[-self.SEQ_LEN:],
                            dtype=np.float32
                        )
                        sign, confidence = model.predict_sequence(seq)

                        if sign and confidence >= self.THRESHOLD:
                            last = self.detected_signs[0] if self.detected_signs else None
                            if sign != last:
                                with self.lock:
                                    self.detected_signs.appendleft(sign)
                                print(f"[detect] {sign} ({confidence*100:.1f}%)")

                        # Slide window by half
                        self.sequence_data = self.sequence_data[self.SEQ_LEN//2:]

                else:
                    # Reset sequence if no hand
                    self.sequence_data = []

                # Flip for selfie view
                display = cv2.flip(annotated, 1)

                # Overlay: sequence progress bar
                seq_pct = min(len(self.sequence_data) / self.SEQ_LEN, 1.0)
                bar_w   = int(640 * seq_pct)
                cv2.rectangle(display, (0, 470), (bar_w, 480), (0, 229, 255), -1)

                # Overlay: FPS
                self.frame_count += 1
                now = time.time()
                if now - self.last_time >= 1.0:
                    self.fps        = self.frame_count
                    self.frame_count= 0
                    self.last_time  = now

                cv2.putText(display, f"FPS:{self.fps}", (5, 25),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,229,255), 2)

                # Overlay: last detected sign
                with self.lock:
                    last_sign = self.detected_signs[0] if self.detected_signs else ""
                if last_sign:
                    cv2.putText(display, last_sign, (5, 460),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (57,255,144), 2)

                # Encode JPEG
                ret2, buf = cv2.imencode(
                    ".jpg", display, [cv2.IMWRITE_JPEG_QUALITY, 65]
                )
                if ret2:
                    try:
                        self.frame_queue.put_nowait(buf.tobytes())
                    except:
                        pass  # queue full, drop frame

                time.sleep(0.001)

        except Exception as e:
            print(f"[camera] Fatal: {e}")
            traceback.print_exc()
        finally:
            if self.cap:
                self.cap.release()
            self.is_running = False
            print("[camera] Stopped.")

    def generate_frames(self):
        """MJPEG frame generator for Flask Response."""
        while self.is_running:
            try:
                frame_bytes = self.frame_queue.get(timeout=2)
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" +
                    frame_bytes + b"\r\n"
                )
            except:
                continue

    def start(self):
        if not self.is_running:
            self.is_running    = True
            self.sequence_data = []
            self.detected_signs.clear()
            self.camera_thread = threading.Thread(
                target=self.camera_thread_fn, daemon=True
            )
            self.camera_thread.start()
            time.sleep(1.5)  # allow camera init

    def stop(self):
        self.is_running = False
        if self.camera_thread and self.camera_thread.is_alive():
            self.camera_thread.join(timeout=4)

    def get_signs(self):
        with self.lock:
            return list(self.detected_signs)

    def clear_signs(self):
        with self.lock:
            self.detected_signs.clear()


video_handler = VideoStreamHandler()


# ── Routes ────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/translator")
def translator():
    return render_template("translator.html")

@app.route("/learn")
def learn():
    return render_template("learn.html", signs=SIGNS_LIST)


# ── Video stream ──────────────────────────────────────────────────

@app.route("/video_feed")
def video_feed():
    resp = Response(
        video_handler.generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )
    resp.headers["Cache-Control"] = "no-cache"
    return resp


# ── API ───────────────────────────────────────────────────────────

@app.route("/api/start", methods=["POST"])
def api_start():
    video_handler.start()
    return jsonify({"status": "started"})

@app.route("/api/stop", methods=["POST"])
def api_stop():
    video_handler.stop()
    return jsonify({"status": "stopped"})

@app.route("/api/signs", methods=["GET"])
def api_signs():
    signs = video_handler.get_signs()
    return jsonify({
        "signs":   signs,
        "fps":     video_handler.fps,
        "running": video_handler.is_running,
        "seq_len": len(video_handler.sequence_data),
        "seq_max": video_handler.SEQ_LEN,
    })

@app.route("/api/clear", methods=["POST"])
def api_clear():
    video_handler.clear_signs()
    return jsonify({"status": "cleared"})

@app.route("/api/all_signs", methods=["GET"])
def api_all_signs():
    return jsonify(SIGNS_LIST)

@app.route("/api/search", methods=["POST"])
def api_search():
    q = request.json.get("query", "").lower()
    if not q:
        return jsonify(SIGNS_LIST)
    results = [s for s in SIGNS_LIST if q in s.lower()]
    return jsonify(results)

@app.route("/health")
def health():
    return jsonify({
        "status":  "ok",
        "running": video_handler.is_running,
        "fps":     video_handler.fps,
        "model":   model.model_type,
        "signs":   len(SIGNS_LIST),
    })


@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


if __name__ == "__main__":
    print("=" * 55)
    print("🤟  SignBridge — Sign Language Translator")
    print("=" * 55)
    print(f"   Signs loaded : {len(SIGNS_LIST)}")
    print(f"   Model status : {model.model_type}")
    print(f"   Server       : http://127.0.0.1:5000")
    print("=" * 55)
    app.run(debug=False, host="0.0.0.0", port=5000,
            threaded=True, use_reloader=False)