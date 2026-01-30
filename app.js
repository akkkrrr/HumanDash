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

// Treenin aloitus
startBtn.addEventListener('click', async () => {
    const workoutRef = doc(collection(db, "workouts"));
    currentWorkoutId = workoutRef.id;
    await setDoc(workoutRef, { startedAt: serverTimestamp(), status: 'ongoing', totalVolume: 0 });
    gymSection.style.display = 'block';
    finishBtn.style.display = 'block';
    startBtn.style.display = 'none';
});

// Treenin lopetuslomake auki
finishBtn.addEventListener('click', () => {
    summaryCard.style.display = 'block';
    gymSection.style.display = 'none';
    finishBtn.style.display = 'none';
    summaryCard.scrollIntoView({ behavior: 'smooth' });
});

// Lopullinen tallennus
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

// Liikkeen tallennus/päivitys
gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('entry-id').value;
    const rawName = document.getElementById('exercise').value.trim();
    const sets = parseInt(document.getElementById('sets').value);
    const reps = parseInt(document.getElementById('reps').value);
    const weightsStr = document.getElementById('weights').value;

    const weightsArray = weightsStr.replace(/,/g, '.').split(';').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    let vol = weightsArray.length === 1 ? sets * reps * weightsArray[0] : reps * weightsArray.reduce((a, b) => a + b, 0);

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

// --- 3. HISTORIA JA LAJITTELU ---

function loadLogs(order = 'desc') {
    if (unsubscribeLogs) unsubscribeLogs();

    const q = query(collection(db, "gymEntries"), orderBy("createdAt", order));
    
    unsubscribeLogs = onSnapshot(q, async (snapshot) => {
        const workoutGroups = {};
        
        snapshot.forEach(doc => {
            const d = doc.data();
            const wId = d.workoutId || 'legacy';
            if (!workoutGroups[wId]) {
                const dateObj = d.createdAt?.toDate() || new Date();
                workoutGroups[wId] = { entries: [], totalVol: 0, date: dateObj, notes: '' };
            }
            workoutGroups[wId].entries.push({ id: doc.id, ...d });
            workoutGroups[wId].totalVol += (d.volume || 0);
        });

        logsContainer.innerHTML = '';

        // Lajitellaan kortit (workoutGroups) aikaleiman mukaan
        const sortedIds = Object.keys(workoutGroups).sort((a, b) => {
            return order === 'desc' ? workoutGroups[b].date - workoutGroups[a].date : workoutGroups[a].date - workoutGroups[b].date;
        });

        for (const wId of sortedIds) {
            const g = workoutGroups[wId];
            
            if (wId !== 'legacy') {
                const wDoc = await getDoc(doc(db, "workouts", wId));
                if(wDoc.exists()) g.notes = wDoc.data().notes || '';
            }

            const card = document.createElement('div');
            card.className = 'workout-card';
            if(wId === currentWorkoutId) card.classList.add('active-workout-card');

            const header = document.createElement('div');
            header.className = 'workout-header';
            header.innerHTML = `
                <div class="workout-title">
                    ${g.date.toLocaleDateString('fi-FI')} <span class="time-stamp">klo ${g.date.toLocaleTimeString('fi-FI', {hour:'2-digit', minute:'2-digit'})}</span>
                    ${wId === currentWorkoutId ? '<span class="ongoing-badge">ONGOING</span>' : ''}
                </div>
                <div class="workout-meta">${g.totalVol} kg</div>
            `;
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'workout-body';

            g.entries.forEach(e => {
                const row = document.createElement('div');
                row.className = 'entry-row';
                
                const info = document.createElement('div');
                info.className = 'entry-main';
                const name = document.createElement('strong'); name.textContent = e.exercise;
                const det = document.createElement('span'); det.textContent = ` ${e.sets}x${e.reps} @ ${e.weights}kg`;
                info.appendChild(name); info.appendChild(det);

                if(e.failure) {
                    const f = document.createElement('span'); f.className = 'fail-badge'; f.textContent = 'FAIL';
                    info.appendChild(f);
                }

                const v = document.createElement('div'); v.className = 'entry-vol'; v.textContent = `${e.volume} kg volyymi`;
                info.appendChild(v);

                const acts = document.createElement('div');
                acts.className = 'actions';
                acts.innerHTML = `<button class="btn-edit">✏️</button><button class="btn-delete">❌</button>`;
                acts.querySelector('.btn-edit').onclick = () => editEntry(e.id);
                acts.querySelector('.btn-delete').onclick = () => deleteEntry(e.id);

                row.appendChild(info); row.appendChild(acts);
                body.appendChild(row);
            });

            card.appendChild(body);
            if(g.notes) {
                const n = document.createElement('div'); n.className = 'workout-notes-display';
                n.textContent = `Huom: ${g.notes}`;
                card.appendChild(n);
            }
            logsContainer.appendChild(card);
        }
    });
}

sortSelect.addEventListener('change', (e) => loadLogs(e.target.value));
loadLogs('desc'); // Aloitus oletuksena uusin ensin

// GLOBAALIT
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