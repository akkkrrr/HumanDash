import { db } from './firebase.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, setDoc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- NAVIGAATIO ---
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

// --- SALI-LOGIIKKA ---
const gymForm = document.getElementById('gym-form');
const logsContainer = document.getElementById('logs-container');
const gymSection = document.getElementById('gym-section');
const actionDiv = document.getElementById('gym-action-bar');
const summaryCard = document.getElementById('workout-summary-card');
const notesInput = document.getElementById('workout-notes');
const finalSaveBtn = document.getElementById('final-save-btn');
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

finalSaveBtn.onclick = async () => {
    if(currentWorkoutId) {
        await updateDoc(doc(db, "workouts", currentWorkoutId), {
            status: 'completed',
            endedAt: serverTimestamp(),
            notes: notesInput.value.trim()
        });
    }
    currentWorkoutId = null;
    summaryCard.style.display = 'none';
    startBtn.style.display = 'block';
    notesInput.value = '';
    gymForm.reset();
};

gymForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('entry-id').value;
    const name = document.getElementById('exercise').value.trim();
    const sets = parseInt(document.getElementById('sets').value);
    const reps = parseInt(document.getElementById('reps').value);
    const weightsStr = document.getElementById('weights').value;

    const wArray = weightsStr.replace(/,/g, '.').split(';').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    let vol = wArray.length === 1 ? sets * reps * wArray[0] : reps * wArray.reduce((a, b) => a + b, 0);

    const data = {
        exercise: name.charAt(0).toUpperCase() + name.slice(1),
        sets, reps, weights: weightsStr, volume: vol,
        failure: document.getElementById('failure').checked,
        updatedAt: serverTimestamp()
    };

    if (id) {
        await updateDoc(doc(db, "gymEntries", id), data);
    } else {
        await addDoc(collection(db, "gymEntries"), { ...data, workoutId: currentWorkoutId, createdAt: serverTimestamp() });
    }
    gymForm.reset();
    document.getElementById('entry-id').value = '';
};

// --- HISTORIA ---
function loadLogs(order = 'desc') {
    if (unsubscribeLogs) unsubscribeLogs();
    const q = query(collection(db, "gymEntries"), orderBy("createdAt", order));
    
    unsubscribeLogs = onSnapshot(q, async (snapshot) => {
        const groups = {};
        snapshot.forEach(doc => {
            const d = doc.data();
            const wId = d.workoutId || 'legacy';
            if (!groups[wId]) groups[wId] = { entries: [], vol: 0, date: d.createdAt?.toDate() || new Date() };
            groups[wId].entries.push({ id: doc.id, ...d });
            groups[wId].vol += d.volume;
        });

        logsContainer.innerHTML = '';
        const sortedIds = Object.keys(groups).sort((a,b) => order === 'desc' ? groups[b].date - groups[a].date : groups[a].date - groups[b].date);

        for (const wId of sortedIds) {
            const g = groups[wId];
            const card = document.createElement('div');
            card.className = 'workout-card';
            if(wId === currentWorkoutId) card.classList.add('active-workout-card');

            card.innerHTML = `
                <div class="workout-header">
                    <div class="workout-title">${g.date.toLocaleDateString('fi-FI')}</div>
                    <div class="workout-meta">${g.vol} kg</div>
                </div>
                <div class="workout-body"></div>
            `;
            
            const body = card.querySelector('.workout-body');
            g.entries.forEach(e => {
                const row = document.createElement('div');
                row.className = 'entry-row';
                row.innerHTML = `
                    <div><strong>${e.exercise}</strong> ${e.sets}x${e.reps} @ ${e.weights}</div>
                    <div class="entry-vol">${e.volume} kg</div>
                `;
                body.appendChild(row);
            });
            logsContainer.appendChild(card);
        }
    });
}

sortSelect.onchange = (e) => loadLogs(e.target.value);
loadLogs('desc');