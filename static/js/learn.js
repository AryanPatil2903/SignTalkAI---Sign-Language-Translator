"use strict";

const searchInput = document.getElementById("searchInput");
const signsGrid   = document.getElementById("signsGrid");
const noResults   = document.getElementById("noResults");
const tabs        = document.querySelectorAll(".tab");
const modalOverlay= document.getElementById("modalOverlay");
const modalClose  = document.getElementById("modalClose");
const modalSymbol = document.getElementById("modalSymbol");
const modalTitle  = document.getElementById("modalTitle");
const modalType   = document.getElementById("modalType");
const modalDesc   = document.getElementById("modalDesc");

const DESCS = {
  "A":"Fist with thumb on side — first letter of alphabet.",
  "B":"Four fingers up, thumb tucked in.",
  "C":"Curved hand making a C shape.",
  "D":"Index finger up, others curve to touch thumb.",
  "E":"Fingers bent down, thumb tucked under.",
  "F":"Index and thumb touch, other fingers up.",
  "G":"Index finger and thumb pointing sideways.",
  "H":"Two fingers pointing sideways.",
  "I":"Pinky finger raised.",
  "J":"Pinky raised then curved downward.",
  "K":"Index up, middle up, thumb between them.",
  "L":"Index up, thumb out — L shape.",
  "M":"Three fingers folded over thumb.",
  "N":"Two fingers folded over thumb.",
  "O":"All fingers curved to form an O.",
  "P":"Index and thumb pointing down.",
  "Q":"Index and thumb pointing down and out.",
  "R":"Index and middle fingers crossed.",
  "S":"Fist with thumb over fingers.",
  "T":"Thumb between index and middle fingers.",
  "U":"Index and middle fingers together pointing up.",
  "V":"Index and middle fingers spread — peace sign.",
  "W":"Three fingers spread pointing up.",
  "X":"Index finger hooked.",
  "Y":"Thumb and pinky extended.",
  "Z":"Index finger traces a Z in the air.",
  "Hello":"Open hand wave near forehead.",
  "Thank You":"Flat hand from chin moving forward.",
  "Please":"Flat hand circular motion on chest.",
  "Sorry":"Fist circular motion on chest.",
  "Yes":"Fist nodding up and down.",
  "No":"Index and middle tap thumb twice.",
  "Good":"Flat hand from chin forward.",
  "Bad":"Flat hand flick down from chin.",
  "Help":"Fist on palm, both hands move up.",
  "Stop":"Flat hand chops down on open palm.",
};

let currentFilter = "all";
let cards         = Array.from(document.querySelectorAll(".sign-card"));

// ── Search ─────────────────────────────────────────────────────────
searchInput.addEventListener("input", filterCards);

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === "Escape") closeModal();
});

// ── Filter tabs ────────────────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    filterCards();
  });
});

function filterCards() {
  const q = searchInput.value.toLowerCase().trim();
  let visible = 0;

  cards.forEach(card => {
    const sign   = card.dataset.sign.toLowerCase();
    const type   = card.dataset.type;
    const matchQ = !q || sign.includes(q);
    const matchF = currentFilter === "all" || type === currentFilter;

    if (matchQ && matchF) {
      card.style.display = "";
      visible++;
    } else {
      card.style.display = "none";
    }
  });

  noResults.style.display = visible === 0 ? "block" : "none";
}

// ── Modal ───────────────────────────────────────────────────────────
cards.forEach(card => {
  card.addEventListener("click", () => {
    const sign = card.dataset.sign;
    const type = card.dataset.type;

    modalSymbol.textContent = sign.length === 1 ? sign : sign[0];
    modalTitle.textContent  = sign;
    modalType.textContent   = type === "letters" ? "ASL LETTER" : "ASL WORD";
    modalDesc.textContent   = DESCS[sign] || "Practice this sign in front of the camera.";
    modalOverlay.classList.add("open");
  });
});

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closeModal();
});
function closeModal() { modalOverlay.classList.remove("open"); }