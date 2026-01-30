import { db } from './firebase.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, setDoc, updateDoc, getDoc 
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

// --- 2. SALI-LOGIIKKA ---
const gymForm = document.getElementById('gym-form');
const logsContainer = document.getElementById('logs-container');
const gymSection = document.getElementById('gym-section');
const actionDiv = document.getElementById('gym-action-bar');
const formTitle = document.getElementById('form-title');
const entryIdField = document.getElementById('entry-id');
const submitBtn = document.getElementById('submit-btn');
const datalist = document.getElementById('exercise-helpers');

const startBtn = document.createElement('button');
startBtn.textContent = '➕ ALOITA UUSI TREENI';
startBtn.className = 'btn-primary';

const saveBtn = document.createElement('button');
saveBtn.textContent = '✅ PÄÄTÄ TREENI';
saveBtn.className = 'btn-success';
saveBtn.style.display = 'none';

actionDiv.appendChild(startBtn);
actionDiv.appendChild(saveBtn);

let currentWorkoutId = null;

// Aloitus: Luo workout-dokumentin
startBtn.addEventListener('click', async () => {
    const workoutRef = doc(collection(db, "workouts"));
    currentWorkoutId = workoutRef.id;
    await setDoc(workoutRef, { startedAt: serverTimestamp(), status: 'ongoing' });
    gymSection.style.display = 'block';
    startBtn.style.display = 'none';
    saveBtn.style.display = 'block';
});

// Lopetus: Finalisoi
saveBtn.addEventListener('click', async () => {
    if(currentWorkoutId) {
        await updateDoc(doc(db, "workouts", currentWorkoutId), { status: 'completed', endedAt: serverTimestamp() });
    }
    currentWorkoutId = null;
    gymSection.style.display = 'none';
    saveBtn.style.display = 'none';
    startBtn.style.display = 'block';
    resetForm();
});

// TALLENNUS TAI PÄIVITYS
gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = entryIdField.value;
    const rawName = document.getElementById('exercise').value.trim();
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const sets = parseInt(document.getElementById('sets').value);
    const reps = parseInt(document.getElementById('reps').value);
    const weightsStr = document.getElementById('weights').value;
    const failure = document.getElementById('failure').checked;

    // Volyymin laskenta
    const wArr = weightsStr.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    const vol = wArr.length === 1 ? sets * reps * wArr[0] : reps * wArr.reduce((a,b) => a+b, 0);

    const entryData = {
        exercise: displayName,
        exerciseKey: rawName.toLowerCase(),
        sets, reps, weights: weightsStr, failure,
        volume: vol,
        updatedAt: serverTimestamp()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "gymEntries", id), entryData);
        } else {
            await addDoc(collection(db, "gymEntries"), {
                ...entryData,
                workoutId: currentWorkoutId,
                createdAt: serverTimestamp()
            });
        }
        resetForm();
    } catch (err) { console.error("Tallennusvirhe:", err); }
});

function resetForm() {
    gymForm.reset();
    entryIdField.value = '';
    formTitle.textContent = 'Kirjaa liike';
    submitBtn.textContent = 'Lisää liike treeniin';
}

// --- 3. REAALIAIKAINEN HISTORIA ---
onSnapshot(query(collection(db, "gymEntries"), orderBy("createdAt", "desc")), (snapshot) => {
    logsContainer.innerHTML = '';
    const workouts = {}; 

    snapshot.forEach((doc) => {
        const data = doc.data();
        const id = doc.id;
        const wId = data.workoutId || 'legacy';
        
        if (!workouts[wId]) {
            const dateObj = data.createdAt?.toDate() || new Date();
            workouts[wId] = {
                date: dateObj.toLocaleString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' }),
                time: dateObj.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }),
                entries: [],
                totalVol: 0
            };
        }
        workouts[wId].entries.push({ id, ...data });
        workouts[wId].totalVol += (data.volume || 0);
    });

    Object.keys(workouts).forEach(wId => {
        const w = workouts[wId];
        const card = document.createElement('div');
        card.className = 'workout-card';
        if (wId === currentWorkoutId) card.style.borderLeft = '4px solid var(--primary)';

        const entriesHtml = w.entries.map(e => `
            <div class="entry-row">
                <div class="entry-main">
                    <strong>${e.exercise}</strong> ${e.sets}x${e.reps} @ ${e.weights}kg
                    ${e.failure ? '<span class="fail-badge">FAIL</span>' : ''}
                    <div class="entry-vol">${e.volume} kg volyymi</div>
                </div>
                <div class="actions">
                    <button onclick="editEntry('${e.id}')" class="btn-edit">✏️</button>
                    <button onclick="deleteEntry('${e.id}')" class="btn-delete">❌</button>
                </div>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="workout-header">
                <div class="workout-title">${w.date} <span class="time-stamp">klo ${w.time}</span></div>
                <div class="workout-meta">${w.totalVol} kg</div>
            </div>
            <div class="workout-body">${entriesHtml}</div>
        `;
        logsContainer.appendChild(card);
    });

    // Autocomplete
    const exNames = [...new Set(snapshot.docs.map(d => d.data().exercise))];
    datalist.innerHTML = exNames.map(n => `<option value="${n}">`).join('');
});

// GLOBAALIT FUNKTIOT
window.deleteEntry = async (id) => {
    if(confirm("Poistetaanko tämä liike?")) await deleteDoc(doc(db, "gymEntries", id));
};

window.editEntry = async (id) => {
    const docSnap = await getDoc(doc(db, "gymEntries", id));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('exercise').value = data.exercise;
        document.getElementById('sets').value = data.sets;
        document.getElementById('reps').value = data.reps;
        document.getElementById('weights').value = data.weights;
        document.getElementById('failure').checked = data.failure;
        entryIdField.value = id;
        
        gymSection.style.display = 'block';
        formTitle.textContent = 'Muokkaa liikettä';
        submitBtn.textContent = 'Päivitä liike';
        gymSection.scrollIntoView({ behavior: 'smooth' });
    }
};