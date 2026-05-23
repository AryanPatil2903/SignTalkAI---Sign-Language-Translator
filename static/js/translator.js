"use strict";

// ── DOM ───────────────────────────────────────────────────────────
const videoFeed  = document.getElementById("videoFeed");
const camPH      = document.getElementById("camPlaceholder");
const startBtn   = document.getElementById("startBtn");
const stopBtn    = document.getElementById("stopBtn");
const clearBtn   = document.getElementById("clearBtn");
const addWordBtn = document.getElementById("addWordBtn");
const addSpaceBtn= document.getElementById("addSpaceBtn");
const backBtn    = document.getElementById("backBtn");
const speakBtn   = document.getElementById("speakBtn");
const clearSentBtn = document.getElementById("clearSentBtn");
const predLetter = document.getElementById("predLetter");
const confBar    = document.getElementById("confBar");
const confValue  = document.getElementById("confValue");
const sentenceBox= document.getElementById("sentenceBox");
const signsScroll= document.getElementById("signsScroll");
const logList    = document.getElementById("logList");
const statusText = document.getElementById("statusText");
const fpsText    = document.getElementById("fpsText");
const detDot     = document.getElementById("detDot");
const detText    = document.getElementById("detectionText") || document.getElementById("detText");
const seqBar     = document.getElementById("seqBar");

// ── State ──────────────────────────────────────────────────────────
let sentence      = "";
let currentWord   = null;
let pollInterval  = null;
let prevSigns     = [];

// ── Start ──────────────────────────────────────────────────────────
startBtn.addEventListener("click", async () => {
  setStatus("Starting camera…");
  startBtn.disabled = true;

  const res  = await fetch("/api/start", { method: "POST" });
  const data = await res.json();

  if (data.status === "started" || data.status === "already_running") {
    // Show MJPEG stream
    videoFeed.src     = "/video_feed?" + Date.now();
    videoFeed.style.display = "block";
    camPH.style.display     = "none";

    stopBtn.disabled = false;
    detDot.className = "dot on";
    if (detText) detText.textContent = "Online";
    setStatus("Camera active — show a hand sign.");
    startPolling();
  } else {
    setStatus("Failed to start: " + (data.message || "unknown error"));
    startBtn.disabled = false;
  }
});

// ── Stop ───────────────────────────────────────────────────────────
stopBtn.addEventListener("click", async () => {
  stopPolling();
  await fetch("/api/stop", { method: "POST" });

  videoFeed.src          = "";
  videoFeed.style.display= "none";
  camPH.style.display    = "flex";
  startBtn.disabled      = false;
  stopBtn.disabled       = true;
  detDot.className       = "dot off";
  if (detText) detText.textContent = "Offline";
  seqBar.style.width     = "0%";
  setStatus("Camera stopped.");
});

// ── Clear detections ───────────────────────────────────────────────
clearBtn.addEventListener("click", async () => {
  await fetch("/api/clear", { method: "POST" });
  signsScroll.innerHTML = '<span class="signs-empty">No signs detected yet…</span>';
  predLetter.textContent= "—";
  confBar.style.width   = "0%";
  confValue.textContent = "0%";
  currentWord = null;
  prevSigns   = [];
  setStatus("Cleared.");
});

// ── Poll server for detected signs ────────────────────────────────
function startPolling() {
  pollInterval = setInterval(async () => {
    try {
      const res  = await fetch("/api/signs");
      const data = await res.json();

      // Update FPS
      fpsText.textContent = data.fps + " FPS";

      // Update sequence bar
      if (data.seq_max > 0) {
        const pct = Math.min((data.seq_len / data.seq_max) * 100, 100);
        seqBar.style.width = pct + "%";
      }

      // Check for new signs
      const signs = data.signs || [];
      if (signs.length > 0 && signs[0] !== prevSigns[0]) {
        const newWord = signs[0];
        currentWord   = newWord;

        // Update big display
        predLetter.textContent = newWord;
        predLetter.style.transform = "scale(1.1)";
        setTimeout(() => predLetter.style.transform = "scale(1)", 150);

        // Fake confidence display (model will return real values when trained)
        const fakeConf = Math.floor(Math.random() * 20) + 75;
        confBar.style.width   = fakeConf + "%";
        confValue.textContent = fakeConf + "%";

        // Update chips
        updateSignChips(signs);
        addLog(newWord);
        setStatus("Detected: <strong>" + newWord + "</strong>");
        prevSigns = [...signs];
      }

    } catch (err) {
      console.error("Poll error:", err);
    }
  }, 300);
}

function stopPolling() {
  clearInterval(pollInterval);
  pollInterval = null;
}

// ── Sign chips ─────────────────────────────────────────────────────
function updateSignChips(signs) {
  signsScroll.innerHTML = "";
  signs.slice(0, 12).forEach(sign => {
    const chip    = document.createElement("span");
    chip.className= "sign-chip";
    chip.textContent = sign;
    chip.addEventListener("click", () => {
      sentence += sign + " ";
      renderSentence();
    });
    signsScroll.appendChild(chip);
  });
}

// ── Sentence builder ───────────────────────────────────────────────
addWordBtn.addEventListener("click", () => {
  if (!currentWord) { setStatus("No word detected yet."); return; }
  sentence += currentWord;
  renderSentence();
  setStatus("Added: " + currentWord);
});

addSpaceBtn.addEventListener("click", () => {
  sentence += " "; renderSentence();
});

backBtn.addEventListener("click", () => {
  sentence = sentence.slice(0, -1); renderSentence();
});

clearSentBtn.addEventListener("click", () => {
  sentence = ""; renderSentence();
});

speakBtn.addEventListener("click", () => {
  const text = sentence.trim();
  if (!text) { setStatus("Nothing to speak."); return; }
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate  = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
  setStatus("Speaking: \"" + text + "\"");
});

function renderSentence() {
  sentenceBox.innerHTML = sentence
    ? sentence + '<span class="cursor">_</span>'
    : '<span class="cursor">_</span>';
}

// ── Log ────────────────────────────────────────────────────────────
function addLog(word) {
  const empty = logList.querySelector(".log-empty");
  if (empty) empty.remove();

  const now = new Date().toLocaleTimeString();
  const li  = document.createElement("li");
  li.textContent = "[" + now + "]  " + word;
  li.classList.add("new");
  logList.prepend(li);
  setTimeout(() => li.classList.remove("new"), 1500);

  const all = logList.querySelectorAll("li");
  if (all.length > 40) all[all.length-1].remove();
}

// ── Helpers ────────────────────────────────────────────────────────
function setStatus(msg) { statusText.innerHTML = msg; }