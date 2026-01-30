import { db } from './firebase.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, setDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. NAVIGOINTI (Pysyy samana) ---
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

// --- 2. SALI-LOGIIKKA (Uudistettu data-malli) ---
const gymForm = document.getElementById('gym-form');
const logsContainer = document.getElementById('logs-container');
const gymSection = document.getElementById('gym-section');
const actionDiv = document.getElementById('gym-action-bar');

const startBtn = document.createElement('button');
startBtn.textContent = '➕ ALOITA UUSI TREENI';
startBtn.className = 'btn-primary';

const saveBtn = document.createElement('button');
saveBtn.textContent = '✅ PÄÄTÄ TREENI JA TALLENNA';
saveBtn.className = 'btn-success';
saveBtn.style.display = 'none';

actionDiv.appendChild(startBtn);
actionDiv.appendChild(saveBtn);

let currentWorkoutId = null;

// ALOITA TREENI: Luodaan uusi workout-dokumentti
startBtn.addEventListener('click', async () => {
    const workoutRef = doc(collection(db, "workouts"));
    currentWorkoutId = workoutRef.id;

    await setDoc(workoutRef, {
        startedAt: serverTimestamp(),
        status: 'ongoing',
        totalVolume: 0
    });

    gymSection.style.display = 'block';
    startBtn.style.display = 'none';
    saveBtn.style.display = 'block';
});

// PÄÄTÄ TREENI: Finalisoidaan workout-dokumentti
saveBtn.addEventListener('click', async () => {
    if(currentWorkoutId) {
        const workoutRef = doc(db, "workouts", currentWorkoutId);
        await updateDoc(workoutRef, {
            status: 'completed',
            endedAt: serverTimestamp()
        });
    }
    currentWorkoutId = null;
    gymSection.style.display = 'none';
    saveBtn.style.display = 'none';
    startBtn.style.display = 'block';
});

// LISÄÄ LIIKE: Lasketaan volyymi ja tallennetaan siisti nimi
gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const rawName = document.getElementById('exercise').value.trim();
    // Siisti nimi (Esim. "penkki" -> "Penkki")
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    
    const sets = parseInt(document.getElementById('sets').value);
    const reps = parseInt(document.getElementById('reps').value);
    const weightsStr = document.getElementById('weights').value;
    const failure = document.getElementById('failure').checked;

    // VOLYYMIN LASKENTA (Kohta 1)
    const weightsArray = weightsStr.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    let calculatedVolume = 0;

    if (weightsArray.length === 1) {
        calculatedVolume = sets * reps * weightsArray[0];
    } else {
        // Jos painoja on annettu lista, lasketaan ne yhteen ja kerrotaan toistoilla
        const weightsSum = weightsArray.reduce((a, b) => a + b, 0);
        calculatedVolume = reps * weightsSum;
        
        // Validointi (Kohta 1)
        if(weightsArray.length !== sets) {
            console.warn("Sarjojen määrä ja annettujen painojen määrä ei täsmää.");
        }
    }

    try {
        await addDoc(collection(db, "gymEntries"), {
            workoutId: currentWorkoutId,
            exercise: displayName, // Tallenna siisti nimi (Kohta 2)
            exerciseKey: rawName.toLowerCase(), // Hakua varten (Kohta 2)
            sets, reps, weights: weightsStr, failure,
            volume: calculatedVolume, // Tallenna volyymi heti (Kohta 1)
            createdAt: serverTimestamp()
        });
        
        gymForm.reset();
        document.getElementById('exercise').focus();
    } catch (err) { console.error(err); }
});

// --- 3. HISTORIAN NÄYTTÄMINEN (Sama ryhmittely, mutta volyymi mukana) ---
onSnapshot(query(collection(db, "gymEntries"), orderBy("createdAt", "desc")), (snapshot) => {
    logsContainer.innerHTML = '';
    const workouts = {}; 

    snapshot.forEach((doc) => {
        const data = doc.data();
        const id = doc.id;
        const wId = data.workoutId || 'legacy';
        
        if (!workouts[wId]) {
            workouts[wId] = {
                date: data.createdAt?.toDate().toLocaleString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' }) || '...',
                entries: [],
                totalVol: 0
            };
        }
        workouts[wId].entries.push({ id, ...data });
        workouts[wId].totalVol += (data.volume || 0);
    });

    Object.keys(workouts).forEach(wId => {
        const workout = workouts[wId];
        const card = document.createElement('div');
        card.className = 'workout-card';
        if (wId === currentWorkoutId) card.classList.add('active-workout');

        const entriesHtml = workout.entries.map(entry => `
            <div class="entry-row">
                <div class="entry-main">
                    <strong>${entry.exercise}</strong> ${entry.sets}x${entry.reps} @ ${entry.weights}kg 
                    ${entry.failure ? '<span class="fail-badge">FAIL</span>' : ''}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted)">${entry.volume} kg vol.</div>
                <button onclick="deleteEntry('${entry.id}')" class="btn-delete">❌</button>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="workout-header">
                <span>${workout.date}</span>
                <span style="float: right;">Yhteensä: ${workout.totalVol} kg</span>
            </div>
            <div class="workout-body">${entriesHtml}</div>
        `;
        logsContainer.appendChild(card);
    });
});

window.deleteEntry = async (id) => {
    if(confirm("Poistetaanko liike?")) await deleteDoc(doc(db, "gymEntries", id));
};