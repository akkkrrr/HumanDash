import { db } from './firebase.js';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, setDoc, updateDoc, getDoc, getDocs, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- NAV ---
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

// --- GYM ---
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

let currentWorkoutId = null;
let unsubscribeLogs = null;

const startBtn = document.createElement('button');
startBtn.textContent = '➕ ALOITA UUSI TREENI';
startBtn.className = 'btn-primary';
const finishBtn = document.createElement('button');
finishBtn.textContent = '🏁 LOPETA TREENI';
finishBtn.className = 'btn-success';
finishBtn.style.display = 'none';
actionDiv.appendChild(startBtn);
actionDiv.appendChild(finishBtn);

startBtn.onclick = async () => {
    const workoutRef = doc(collection(db, "workouts"));
    currentWorkoutId = workoutRef.id;
    await setDoc(workoutRef, { startedAt: serverTimestamp(), status: 'ongoing' });
    gymSection.style.display = 'block';
    finishBtn.style.display = 'block';
    startBtn.style.display = 'none';
};

finishBtn.onclick = () => {
    summaryCard.style.display = 'block';
    gymSection.style.display = 'none';
    finishBtn.style.display = 'none';
};

const closeSession = () => {
    currentWorkoutId = null;
    summaryCard.style.display = 'none';
    startBtn.style.display = 'block';
    notesInput.value = '';
    resetForm();
};

finalSaveBtn.onclick = async () => {
    if(currentWorkoutId) {
        await updateDoc(doc(db, "workouts", currentWorkoutId), { status: 'completed', endedAt: serverTimestamp(), notes: notesInput.value.trim() });
    }
    closeSession();
};

discardWorkoutBtn.onclick = async () => {
    if(currentWorkoutId && confirm("Poistetaanko tyhjä treeni?")) {
        await deleteDoc(doc(db, "workouts", currentWorkoutId));
        closeSession();
    }
};

gymForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('entry-id').value;
    const name = document.getElementById('exercise').value.trim();
    const sets = parseInt(document.getElementById('sets').value);
    const reps = parseInt(document.getElementById('reps').value);
    const wStr = document.getElementById('weights').value;
    const wArray = wStr.split(';').map(w => parseFloat(w.replace(',', '.').trim())).filter(w => !isNaN(w));
    
    if (wArray.length === 0) return alert("Virhe painoissa!");
    let vol = wArray.length === 1 ? sets * reps * wArray[0] : reps * wArray.reduce((a, b) => a + b, 0);

    const data = { exercise: name, sets, reps, weights: wStr, volume: vol, failure: document.getElementById('failure').checked, updatedAt: serverTimestamp() };

    if (id) {
        await updateDoc(doc(db, "gymEntries", id), data);
    } else {
        await addDoc(collection(db, "gymEntries"), { ...data, workoutId: currentWorkoutId, createdAt: serverTimestamp() });
    }
    resetForm();
};

function resetForm() {
    gymForm.reset();
    document.getElementById('entry-id').value = '';
    document.getElementById('form-title').textContent = 'Kirjaa liike';
    document.getElementById('submit-btn').textContent = 'Lisää liike';
    cancelEditBtn.style.display = 'none';
}
cancelEditBtn.onclick = resetForm;

function loadLogs(order = 'desc') {
    if (unsubscribeLogs) unsubscribeLogs();
    unsubscribeLogs = onSnapshot(query(collection(db, "gymEntries"), orderBy("createdAt", order)), (snapshot) => {
        const groups = {};
        snapshot.forEach(doc => {
            const d = doc.data();
            const wId = d.workoutId || 'legacy';
            if (!groups[wId]) groups[wId] = { entries: [], vol: 0, date: d.createdAt?.toDate() || new Date() };
            groups[wId].entries.push({ id: doc.id, ...d });
            groups[wId].vol += (d.volume || 0);
        });
        logsContainer.innerHTML = '';
        Object.keys(groups).sort((a,b) => order === 'desc' ? groups[b].date - groups[a].date : groups[a].date - groups[b].date).forEach(wId => {
            const g = groups[wId];
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `<div class="workout-header">${g.date.toLocaleDateString('fi-FI')} <small>v${g.vol}kg</small></div><div class="workout-body"></div>`;
            const body = card.querySelector('.workout-body');
            g.entries.forEach(e => {
                const row = document.createElement('div');
                row.className = 'entry-row';
                row.innerHTML = `<div><strong>${e.exercise}</strong><br><small>${e.sets}x${e.reps} @ ${e.weights}</small></div>
                <div><button class="btn-icon" onclick="editEntry('${e.id}')">✏️</button>
                <button class="btn-icon" onclick="deleteEntry('${e.id}')">❌</button></div>`;
                body.appendChild(row);
            });
            logsContainer.appendChild(card);
        });
    });
}

window.editEntry = async (id) => {
    const s = await getDoc(doc(db, "gymEntries", id));
    if(s.exists()) {
        const d = s.data();
        document.getElementById('exercise').value = d.exercise;
        document.getElementById('sets').value = d.sets;
        document.getElementById('reps').value = d.reps;
        document.getElementById('weights').value = d.weights;
        document.getElementById('failure').checked = d.failure;
        document.getElementById('entry-id').value = id;
        gymSection.style.display = 'block';
        document.getElementById('form-title').textContent = 'MUOKATAAN LIIKETTA';
        document.getElementById('submit-btn').textContent = 'Tallenna';
        cancelEditBtn.style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};
window.deleteEntry = async (id) => { if(confirm("Poistetaanko?")) await deleteDoc(doc(db, "gymEntries", id)); };
sortSelect.onchange = (e) => loadLogs(e.target.value);
loadLogs('desc');