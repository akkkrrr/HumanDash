import { db } from './firebase.js';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------------------------
   Utils
---------------------------- */

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeExerciseName(name) {
  const cleaned = String(name || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  // Pidä käyttäjän tyyli, mutta tee eka kirjain isoksi (kuten sulla oli)
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function normalizeWeightsInput(raw) {
  // Tukee: "80; 85" sekä "80;85" ja muuntaa desimaalipilkut pisteiksi
  return String(raw || "")
    .replace(/\s+/g, "")     // poista välit
    .replaceAll(",", ".");   // desimaalipilkku -> piste
}

function parseWeightsArray(weightsStr) {
  // Erotin on ; (kuten sun UI:ssa)
  const parts = String(weightsStr || "")
    .split(";")
    .map(w => w.trim())
    .filter(Boolean);

  const nums = parts
    .map(x => Number(x))
    .filter(n => Number.isFinite(n) && n > 0);

  return nums;
}

function calcVolumeKg({ sets, reps, weightsArray }) {
  if (!weightsArray.length) return 0;
  if (weightsArray.length === 1) {
    return sets * reps * weightsArray[0];
  }
  // Useita painoja => tulkitaan "per setti"
  const sum = weightsArray.reduce((a, b) => a + b, 0);
  return reps * sum;
}

function formatKg(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  // Pyöristä järkevästi, ettei tule 123.0000004
  const rounded = Math.round(num * 10) / 10;
  return String(rounded);
}

/* ---------------------------
   NAVIGAATIO
---------------------------- */

const navBtns = document.querySelectorAll('.nav-btn');
const tabs = document.querySelectorAll('.tab-content');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;

    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    tabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.id === target) tab.classList.add('active');
    });
  });
});

/* ---------------------------
   GYM ELEMENTIT
---------------------------- */

const gymForm = document.getElementById('gym-form');
const logsContainer = document.getElementById('logs-container');
const gymSection = document.getElementById('gym-section');
const actionDiv = document.getElementById('gym-action-bar');
const summaryCard = document.getElementById('workout-summary-card');

const notesInput = document.getElementById('workout-notes');
const finalSaveBtn = document.getElementById('final-save-btn');
const discardWorkoutBtn = document.getElementById('discard-workout-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const sortSelect = document.getElementById('sort-order');

const formTitleEl = document.getElementById('form-title');
const submitBtn = document.getElementById('submit-btn');

const entryIdInput = document.getElementById('entry-id');
const exerciseInput = document.getElementById('exercise');
const setsInput = document.getElementById('sets');
const repsInput = document.getElementById('reps');
const weightsInput = document.getElementById('weights');
const failureInput = document.getElementById('failure');

let currentWorkoutId = null;
let unsubscribeLogs = null;

/* ---------------------------
   Action buttons (Start / Finish)
---------------------------- */

const startBtn = document.createElement('button');
startBtn.textContent = '➕ ALOITA UUSI TREENI';
startBtn.className = 'btn-primary';

const finishBtn = document.createElement('button');
finishBtn.textContent = '🏁 LOPETA TREENI';
finishBtn.className = 'btn-success';
finishBtn.style.display = 'none';

actionDiv.appendChild(startBtn);
actionDiv.appendChild(finishBtn);

/* ---------------------------
   TREENIN HALLINTA
---------------------------- */

startBtn.onclick = async () => {
  const workoutRef = doc(collection(db, "workouts"));
  currentWorkoutId = workoutRef.id;

  await setDoc(workoutRef, {
    startedAt: serverTimestamp(),
    status: 'ongoing'
  });

  gymSection.style.display = 'block';
  finishBtn.style.display = 'block';
  startBtn.style.display = 'none';

  // Varmista että lomake on "lisäystilassa"
  resetForm();
};

finishBtn.onclick = () => {
  summaryCard.style.display = 'block';
  gymSection.style.display = 'none';
  finishBtn.style.display = 'none';
};

function closeWorkoutSession() {
  currentWorkoutId = null;
  summaryCard.style.display = 'none';
  startBtn.style.display = 'block';
  notesInput.value = '';
  resetForm();
}

finalSaveBtn.onclick = async () => {
  if (currentWorkoutId) {
    const q = query(collection(db, "gymEntries"), where("workoutId", "==", currentWorkoutId));
    const snap = await getDocs(q);

    if (snap.empty) {
      const ok = confirm("Treeni on tyhjä. Tallennetaanko silti?");
      if (!ok) return;
    }

    await updateDoc(doc(db, "workouts", currentWorkoutId), {
      status: 'completed',
      endedAt: serverTimestamp(),
      notes: notesInput.value.trim()
    });
  }

  closeWorkoutSession();
};

discardWorkoutBtn.onclick = async () => {
  if (!currentWorkoutId) return;
  if (!confirm("Poistetaanko tämä tyhjä sessio?")) return;

  await deleteDoc(doc(db, "workouts", currentWorkoutId));
  closeWorkoutSession();
};

/* ---------------------------
   LOMAKKEEN HALLINTA
---------------------------- */

function setEditMode(isEditing) {
  if (isEditing) {
    formTitleEl.textContent = 'MUOKKAUSTILA';
    submitBtn.textContent = 'Tallenna muutokset';
    cancelEditBtn.style.display = 'inline-block';
  } else {
    formTitleEl.textContent = 'Kirjaa liike';
    submitBtn.textContent = 'Lisää liike';
    cancelEditBtn.style.display = 'none';
  }
}

function resetForm() {
  gymForm.reset();
  entryIdInput.value = '';
  setEditMode(false);
}

cancelEditBtn.onclick = () => resetForm();

gymForm.onsubmit = async (e) => {
  e.preventDefault();

  // Jos ei ole käynnissä treenisessiota, estä tallennus
  // (näin et saa "legacy/orpoja" vahingossa)
  if (!currentWorkoutId) {
    alert("Aloita ensin treeni (ALOITA UUSI TREENI).");
    return;
  }

  const id = entryIdInput.value;
  const exercise = normalizeExerciseName(exerciseInput.value);

  const sets = Number.parseInt(setsInput.value, 10);
  const reps = Number.parseInt(repsInput.value, 10);

  const weightsClean = normalizeWeightsInput(weightsInput.value);
  const wArray = parseWeightsArray(weightsClean);

  if (!exercise) { alert("Syötä liikkeen nimi."); return; }
  if (!Number.isFinite(sets) || sets <= 0) { alert("Syötä sarjat oikein."); return; }
  if (!Number.isFinite(reps) || reps <= 0) { alert("Syötä toistot oikein."); return; }
  if (wArray.length === 0) { alert("Syötä painot oikein! Käytä erotinta ;"); return; }

  // (Valinnainen) jos käyttäjä syötti useita painoja mutta määrä ei täsmää sarjoihin, ei estetä,
  // mutta tämä kannattaa pitää mielessä tulevassa dashboardissa.
  const volume = calcVolumeKg({ sets, reps, weightsArray: wArray });

  const data = {
    exercise,
    sets,
    reps,
    weights: weightsClean,
    volume,
    failure: !!failureInput.checked,
    updatedAt: serverTimestamp()
  };

  if (id) {
    await updateDoc(doc(db, "gymEntries", id), data);
  } else {
    await addDoc(collection(db, "gymEntries"), {
      ...data,
      workoutId: currentWorkoutId,
      createdAt: serverTimestamp()
    });
  }

  resetForm();
};

/* ---------------------------
   HISTORIAN LATAUS (realtime)
---------------------------- */

function renderWorkoutCard({ date, totalVol, entries, isActive }) {
  const card = document.createElement('div');
  card.className = 'workout-card';
  if (isActive) card.classList.add('active-workout-card');

  const header = document.createElement('div');
  header.className = 'workout-header';

  const left = document.createElement('div');
  // Pidä sama tyyli kuin aiemmin: päivä + volyymi
  left.innerHTML = `${escapeHtml(date.toLocaleDateString('fi-FI'))} <small>v${escapeHtml(formatKg(totalVol))}kg</small>`;
  header.appendChild(left);

  const body = document.createElement('div');
  body.className = 'workout-body';

  entries.forEach(e => {
    const row = document.createElement('div');
    row.className = 'entry-row';

    const info = document.createElement('div');
    info.className = 'entry-info';

    const title = document.createElement('strong');
    title.textContent = e.exercise || "";
    info.appendChild(title);
    info.appendChild(document.createElement('br'));

    const meta = document.createElement('small');
    meta.textContent = `${e.sets}x${e.reps} @ ${e.weights}kg (${formatKg(e.volume)}kg)`;
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => window.editEntry(e.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon';
    delBtn.textContent = '❌';
    delBtn.addEventListener('click', () => window.deleteEntry(e.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(info);
    row.appendChild(actions);

    body.appendChild(row);
  });

  card.appendChild(header);
  card.appendChild(body);

  return card;
}

function loadLogs(order = 'desc') {
  if (unsubscribeLogs) unsubscribeLogs();

  const q = query(collection(db, "gymEntries"), orderBy("createdAt", order));

  unsubscribeLogs = onSnapshot(q, (snapshot) => {
    const groups = {};

    snapshot.forEach(d => {
      const data = d.data();
      const wId = data.workoutId || 'legacy';

      if (!groups[wId]) {
        groups[wId] = {
          entries: [],
          vol: 0,
          date: data.createdAt?.toDate?.() || new Date()
        };
      }

      groups[wId].entries.push({ id: d.id, ...data });
      groups[wId].vol += Number(data.volume || 0);
    });

    logsContainer.innerHTML = '';

    const sortedIds = Object.keys(groups).sort((a, b) => {
      return order === 'desc'
        ? groups[b].date - groups[a].date
        : groups[a].date - groups[b].date;
    });

    sortedIds.forEach(wId => {
      const g = groups[wId];
      const card = renderWorkoutCard({
        date: g.date,
        totalVol: g.vol,
        entries: g.entries,
        isActive: (wId === currentWorkoutId)
      });
      logsContainer.appendChild(card);
    });
  });
}

/* ---------------------------
   Edit / Delete (global for inline usage)
---------------------------- */

window.editEntry = async (id) => {
  const s = await getDoc(doc(db, "gymEntries", id));
  if (!s.exists()) return;

  const d = s.data();

  // Avaa lomake näkyviin
  gymSection.style.display = 'block';
  summaryCard.style.display = 'none';

  // Jos käyttäjä muokkaa, varmista että treeni on käynnissä.
  // (Jos entry on vanha legacy/workoutId puuttuu, ei yritetä vaihtaa sessiota automaattisesti.)
  // Tässä pidetään logiikka yksinkertaisena ja turvallisena.
  exerciseInput.value = d.exercise || "";
  setsInput.value = d.sets ?? "";
  repsInput.value = d.reps ?? "";
  weightsInput.value = d.weights || "";
  failureInput.checked = !!d.failure;

  entryIdInput.value = id;
  setEditMode(true);

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteEntry = async (id) => {
  if (!confirm("Poistetaanko liike?")) return;
  await deleteDoc(doc(db, "gymEntries", id));
};

/* ---------------------------
   Init
---------------------------- */

sortSelect.onchange = (e) => loadLogs(e.target.value);
loadLogs('desc');
