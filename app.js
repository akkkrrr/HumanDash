import { db } from './firebase.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. NAVIGOINTI ---
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

// --- 2. GYM-LOG LOGIIKKA ---
const gymForm = document.getElementById('gym-form');
const logsContainer = document.getElementById('logs-container');
const gymSection = document.getElementById('gym-section');
const datalist = document.getElementById('exercise-helpers');
const actionDiv = document.getElementById('gym-action-bar');

const startBtn = document.createElement('button');
startBtn.textContent = '➕ ALOITA KIRJAUS';
startBtn.className = 'btn-primary';

const saveBtn = document.createElement('button');
saveBtn.textContent = '💾 TALLENNA JA LOPETA';
saveBtn.className = 'btn-success';
saveBtn.style.display = 'none';

actionDiv.appendChild(startBtn);
actionDiv.appendChild(saveBtn);

let currentWorkoutId = null;

startBtn.addEventListener('click', () => {
    currentWorkoutId = 'workout-' + Date.now();
    gymSection.style.display = 'block';
    startBtn.style.display = 'none';
    saveBtn.style.display = 'block';
});

saveBtn.addEventListener('click', () => {
    currentWorkoutId = null;
    gymSection.style.display = 'none';
    saveBtn.style.display = 'none';
    startBtn.style.display = 'block';
});

gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const exercise = document.getElementById('exercise').value.trim();
    const sets = parseInt(document.getElementById('sets').value);
    const reps = parseInt(document.getElementById('reps').value);
    const weights = document.getElementById('weights').value;
    const failure = document.getElementById('failure').checked;
    
    const wArr = weights.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    const volume = wArr.length === 1 ? sets * reps * wArr[0] : reps * wArr.reduce((a,b) => a+b, 0);

    try {
        await addDoc(collection(db, "gymEntries"), {
            workoutId: currentWorkoutId,
            exercise: exercise.toLowerCase(),
            sets, reps, weights, failure, volume,
            createdAt: serverTimestamp()
        });
        gymForm.reset();
        document.getElementById('exercise').focus();
    } catch (err) { console.error(err); }
});

// --- 3. HISTORIA ---
onSnapshot(query(collection(db, "gymEntries"), orderBy("createdAt", "desc")), (snapshot) => {
    logsContainer.innerHTML = '';
    const workouts = {}; 

    snapshot.forEach((doc) => {
        const data = doc.data();
        const id = doc.id;
        const wId = data.workoutId || 'legacy';
        if (!workouts[wId]) {
            workouts[wId] = {
                date: data.createdAt?.toDate().toLocaleString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) || '...',
                entries: []
            };
        }
        workouts[wId].entries.push({ id, ...data });
    });

    Object.keys(workouts).forEach(wId => {
        const workout = workouts[wId];
        const card = document.createElement('div');
        card.className = 'workout-card';
        if (wId === currentWorkoutId) card.style.borderLeft = '4px solid var(--primary)';

        const entriesHtml = workout.entries.map(entry => `
            <div class="entry-row">
                <div class="entry-main">
                    <strong>${entry.exercise}</strong> ${entry.sets}x${entry.reps} @ ${entry.weights}kg 
                    ${entry.failure ? '<span class="fail-badge">FAIL</span>' : ''}
                </div>
                <button onclick="deleteEntry('${entry.id}')" class="btn-delete">❌</button>
            </div>
        `).join('');

        card.innerHTML = `<div class="workout-header">${workout.date}</div><div class="workout-body">${entriesHtml}</div>`;
        logsContainer.appendChild(card);
    });

    const exNames = [...new Set(snapshot.docs.map(d => d.data().exercise))];
    datalist.innerHTML = exNames.map(n => `<option value="${n.charAt(0).toUpperCase() + n.slice(1)}">`).join('');
});

window.deleteEntry = async (id) => {
    if(confirm("Poistetaanko?")) await deleteDoc(doc(db, "gymEntries", id));
};