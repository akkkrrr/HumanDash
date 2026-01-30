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
const summaryCard = document.getElementById('workout-summary-card');
const notesInput = document.getElementById('workout-notes');
const finalSaveBtn = document.getElementById('final-save-btn');
const datalist = document.getElementById('exercise-helpers');

let currentWorkoutId = null;

const startBtn = document.createElement('button');
startBtn.textContent = '➕ ALOITA UUSI TREENI';
startBtn.className = 'btn-primary';

const finishBtn = document.createElement('button');
finishBtn.textContent = '🏁 LOPETA TREENI';
finishBtn.className = 'btn-success';
finishBtn.style.display = 'none';

actionDiv.appendChild(startBtn);
actionDiv.appendChild(finishBtn);

// Aloita treeni
startBtn.addEventListener('click', async () => {
    const workoutRef = doc(collection(db, "workouts"));
    currentWorkoutId = workoutRef.id;
    await setDoc(workoutRef, { startedAt: serverTimestamp(), status: 'ongoing', totalVolume: 0 });
    gymSection.style.display = 'block';
    finishBtn.style.display = 'block';
    startBtn.style.display = 'none';
});

// Lopeta treeni - Avaa muistiinpanot
finishBtn.addEventListener('click', () => {
    summaryCard.style.display = 'block';
    gymSection.style.display = 'none';
    finishBtn.style.display = 'none';
    summaryCard.scrollIntoView({ behavior: 'smooth' });
});

// Tallenna muistiinpanot ja sulje workout
finalSaveBtn.addEventListener('click', async () => {
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
});

// Liikkeen tallennus (Sisältää puolipiste-logiikan)
gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('entry-id').value;
    const rawName = document.getElementById('exercise').value.trim();
    const sets = parseInt(document.getElementById('sets').value);
    const reps = parseInt(document.getElementById('reps').value);
    const weightsStr = document.getElementById('weights').value;

    // Puolipiste-logiikka & pilkku desimaaliksi
    const weightsArray = weightsStr.replace(/,/g, '.').split(';').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    
    let vol = 0;
    if (weightsArray.length === 1) {
        vol = sets * reps * weightsArray[0];
    } else {
        vol = reps * weightsArray.reduce((a, b) => a + b, 0);
    }

    const data = {
        exercise: rawName.charAt(0).toUpperCase() + rawName.slice(1),
        sets, reps, weights: weightsStr,
        volume: vol,
        failure: document.getElementById('failure').checked,
        updatedAt: serverTimestamp()
    };

    try {
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
        document.getElementById('exercise').focus();
    } catch (err) { console.error(err); }
});

function resetForm() {
    gymForm.reset();
    document.getElementById('entry-id').value = '';
    document.getElementById('form-title').textContent = 'Kirjaa liike';
    document.getElementById('submit-btn').textContent = 'Lisää liike';
}

// --- 3. RENDEROINTI (XSS-suojattu) ---
onSnapshot(query(collection(db, "gymEntries"), orderBy("createdAt", "desc")), async (snapshot) => {
    // Haetaan samalla workout-dokumentit muistiinpanoja varten
    const workoutGroups = {};
    
    snapshot.forEach(doc => {
        const d = doc.data();
        const wId = d.workoutId || 'legacy';
        if (!workoutGroups[wId]) {
            workoutGroups[wId] = { 
                entries: [], 
                totalVol: 0, 
                date: d.createdAt?.toDate(),
                notes: '' 
            };
        }
        workoutGroups[wId].entries.push({ id: doc.id, ...d });
        workoutGroups[wId].totalVol += (d.volume || 0);
    });

    logsContainer.innerHTML = '';

    for (const wId of Object.keys(workoutGroups)) {
        const group = workoutGroups[wId];
        
        // Haetaan muistiinpanot kerran per workout
        if (wId !== 'legacy') {
            const wDoc = await getDoc(doc(db, "workouts", wId));
            if(wDoc.exists()) group.notes = wDoc.data().notes || '';
        }

        const card = document.createElement('div');
        card.className = 'workout-card';
        if(wId === currentWorkoutId) card.classList.add('active-workout-card');

        // Header
        const header = document.createElement('div');
        header.className = 'workout-header';
        header.innerHTML = `
            <div class="workout-title">
                ${group.date ? group.date.toLocaleDateString('fi-FI') : 'Hetki sitten'}
                ${wId === currentWorkoutId ? '<span class="ongoing-badge">ONGOING</span>' : ''}
            </div>
            <div class="workout-meta">${group.totalVol} kg</div>
        `;
        card.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'workout-body';

        group.entries.forEach(e => {
            const row = document.createElement('div');
            row.className = 'entry-row';
            
            const info = document.createElement('div');
            info.className = 'entry-main';
            
            const name = document.createElement('strong');
            name.textContent = e.exercise;
            
            const details = document.createElement('span');
            details.textContent = ` ${e.sets}x${e.reps} @ ${e.weights}kg`;
            
            info.appendChild(name);
            info.appendChild(details);

            if(e.failure) {
                const badge = document.createElement('span');
                badge.className = 'fail-badge';
                badge.textContent = 'FAIL';
                info.appendChild(badge);
            }

            const volDiv = document.createElement('div');
            volDiv.className = 'entry-vol';
            volDiv.textContent = `${e.volume} kg volyymi`;
            info.appendChild(volDiv);

            const actions = document.createElement('div');
            actions.className = 'actions';
            actions.innerHTML = `<button class="btn-edit">✏️</button><button class="btn-delete">❌</button>`;
            
            actions.querySelector('.btn-edit').onclick = () => editEntry(e.id);
            actions.querySelector('.btn-delete').onclick = () => deleteEntry(e.id);

            row.appendChild(info);
            row.appendChild(actions);
            body.appendChild(row);
        });

        card.appendChild(body);
        
        // Muistiinpanot
        if (group.notes) {
            const notesDiv = document.createElement('div');
            notesDiv.className = 'workout-notes-display';
            notesDiv.textContent = `Note: ${group.notes}`;
            card.appendChild(notesDiv);
        }

        logsContainer.appendChild(card);
    }
});

// Globaalit
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
        document.getElementById('form-title').textContent = 'Muokkaa liikettä';
        document.getElementById('submit-btn').textContent = 'Päivitä liike';
        gymSection.scrollIntoView({ behavior: 'smooth' });
    }
};

window.deleteEntry = async (id) => { if(confirm("Poistetaanko?")) await deleteDoc(doc(db, "gymEntries", id)); };