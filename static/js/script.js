"use strict";

// ── DOM ──────────────────────────────────────────────────────────
const videoEl          = document.getElementById("videoEl");
const annotatedImg     = document.getElementById("annotatedImg");
const camPlaceholder   = document.getElementById("camPlaceholder");
const startBtn         = document.getElementById("startBtn");
const stopBtn          = document.getElementById("stopBtn");
const clearBtn         = document.getElementById("clearBtn");
const addLetterBtn     = document.getElementById("addLetterBtn");
const addSpaceBtn      = document.getElementById("addSpaceBtn");
const backspaceBtn     = document.getElementById("backspaceBtn");
const speakBtn         = document.getElementById("speakBtn");
const predictionLetter = document.getElementById("predictionLetter");
const confidenceBar    = document.getElementById("confidenceBar");
const confidenceValue  = document.getElementById("confidenceValue");
const sentenceBox      = document.getElementById("sentenceBox");
const logList          = document.getElementById("logList");
const statusText       = document.getElementById("statusText");
const fpsDisplay       = document.getElementById("fpsDisplay");
const detectionDot     = document.getElementById("detectionDot");
const detectionText    = document.getElementById("detectionText");
const captureCanvas    = document.getElementById("captureCanvas");

// ── State ─────────────────────────────────────────────────────────
let mediaStream   = null;
let capturing     = false;
let sentence      = "";
let currentLetter = null;
let lastLogEntry  = "";
let frameCount    = 0;
let fpsInterval   = null;
let busy          = false;

// Stability — prevent multiple letters from one held sign
let lastDetected  = null;
let holdCount     = 0;
let lastAdded     = null;
let lastAddedTime = 0;
const HOLD_FRAMES = 5;
const COOLDOWN_MS = 1500;

// ── Start Camera ──────────────────────────────────────────────────
startBtn.addEventListener("click", async () => {
  try {
    setStatus("Requesting camera…");
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false
    });

    videoEl.srcObject            = mediaStream;
    camPlaceholder.style.display = "none";
    videoEl.style.display        = "block";
    annotatedImg.style.display   = "none";
    startBtn.disabled            = true;
    stopBtn.disabled             = false;

    videoEl.onloadedmetadata = () => {
      videoEl.play();
      setStatus("Camera active — show your hand.");
      startCapture();
      startFPS();
    };

  } catch (err) {
    setStatus("Camera error: " + err.message);
    console.error(err);
  }
});

// ── Stop Camera ───────────────────────────────────────────────────
stopBtn.addEventListener("click", () => {
  stopCapture();
  stopFPS();

  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  videoEl.style.display        = "none";
  annotatedImg.style.display   = "none";
  camPlaceholder.style.display = "flex";
  startBtn.disabled            = false;
  stopBtn.disabled             = true;

  setDetection(false);
  setStatus("Camera stopped.");
});

// ── Clear ─────────────────────────────────────────────────────────
clearBtn.addEventListener("click", () => {
  predictionLetter.textContent = "—";
  confidenceBar.style.width    = "0%";
  confidenceValue.textContent  = "0%";
  logList.innerHTML            = '<li class="log-empty">No predictions yet…</li>';
  currentLetter                = null;
  setStatus("Cleared.");
});

// ── Capture Loop ──────────────────────────────────────────────────
function startCapture() {
  capturing = true;
  loopStep();
}

function stopCapture() {
  capturing = false;
}

async function loopStep() {
  if (!capturing) return;

  if (!busy && videoEl.readyState >= 2) {
    busy = true;
    await sendFrame();
    busy = false;
  }

  setTimeout(loopStep, 200);
}

// ── Send Frame to Flask ───────────────────────────────────────────
async function sendFrame() {
  try {
    captureCanvas.width  = videoEl.videoWidth  || 640;
    captureCanvas.height = videoEl.videoHeight || 480;

    const ctx = captureCanvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, captureCanvas.width, captureCanvas.height);

    const imageData = captureCanvas.toDataURL("image/jpeg", 0.75);

    const res = await fetch("/predict", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ image: imageData })
    });

    if (!res.ok) return;

    const data = await res.json();
    frameCount++;

    // Show annotated frame from server
    if (data.annotated_frame) {
      annotatedImg.onload = () => {
        annotatedImg.style.display = "block";
        videoEl.style.display      = "none";
      };
      annotatedImg.src = data.annotated_frame;
    }

    if (data.prediction) {
      // Update letter + confidence display
      predictionLetter.textContent = data.prediction;
      predictionLetter.style.color = "var(--accent)";

      const conf = data.confidence || 0;
      confidenceBar.style.width   = conf + "%";
      confidenceValue.textContent = conf + "%";

      currentLetter = data.prediction;
      setDetection(true, data.prediction);

      // Stability check — must hold same letter for HOLD_FRAMES
      if (data.prediction === lastDetected) {
        holdCount++;
      } else {
        holdCount    = 1;
        lastDetected = data.prediction;
      }

      const now       = Date.now();
      const sameLetter = data.prediction === lastAdded;
      const cooldownOk = (now - lastAddedTime) > COOLDOWN_MS;

      if (holdCount >= HOLD_FRAMES && (!sameLetter || cooldownOk)) {
        lastAdded     = data.prediction;
        lastAddedTime = now;
        holdCount     = 0;
        addLog(data.prediction, conf);
        setStatus("Detected: <strong>" + data.prediction + "</strong> (" + conf + "%)");
      } else {
        setStatus("Holding: <strong>" + data.prediction + "</strong> (" + holdCount + "/" + HOLD_FRAMES + ")");
      }

    } else {
      holdCount    = 0;
      lastDetected = null;
      setDetection(false);
      setStatus(data.message || "No hand in frame");
    }

  } catch (err) {
    console.error("Frame error:", err);
  }
}

// ── Sentence Builder ──────────────────────────────────────────────
addLetterBtn.addEventListener("click", () => {
  if (!currentLetter) { setStatus("No letter detected yet."); return; }
  sentence += currentLetter;
  renderSentence();
  setStatus("Added: " + currentLetter);
});

addSpaceBtn.addEventListener("click", () => {
  sentence += " ";
  renderSentence();
});

backspaceBtn.addEventListener("click", () => {
  sentence = sentence.slice(0, -1);
  renderSentence();
});

speakBtn.addEventListener("click", () => {
  const text = sentence.trim();
  if (!text) { setStatus("Nothing to speak."); return; }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate  = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  setStatus("Speaking: \"" + text + "\"");
});

function renderSentence() {
  sentenceBox.innerHTML = sentence
    ? sentence + '<span class="sentence-cursor">_</span>'
    : '<span class="sentence-cursor">_</span>';
}

// ── Log ───────────────────────────────────────────────────────────
function addLog(letter, confidence) {
  const entry = letter + " @ " + confidence + "%";
  if (entry === lastLogEntry) return;
  lastLogEntry = entry;

  const empty = logList.querySelector(".log-empty");
  if (empty) empty.remove();

  const now = new Date().toLocaleTimeString();
  const li  = document.createElement("li");
  li.textContent = "[" + now + "]  " + entry;
  li.classList.add("new-entry");
  logList.prepend(li);
  setTimeout(() => li.classList.remove("new-entry"), 1500);

  const all = logList.querySelectorAll("li");
  if (all.length > 50) all[all.length - 1].remove();
}

// ── Detection Badge ───────────────────────────────────────────────
function setDetection(active, letter) {
  detectionDot.className    = active ? "dot active" : "dot inactive";
  detectionText.textContent = active ? "Hand · " + (letter || "") : "No hand";
}

// ── Status ────────────────────────────────────────────────────────
function setStatus(msg) {
  statusText.innerHTML = msg;
}

// ── FPS ───────────────────────────────────────────────────────────
function startFPS() {
  frameCount  = 0;
  fpsInterval = setInterval(() => {
    fpsDisplay.textContent = frameCount + " FPS";
    frameCount = 0;
  }, 1000);
}

function stopFPS() {
  clearInterval(fpsInterval);
  fpsDisplay.textContent = "0 FPS";
}