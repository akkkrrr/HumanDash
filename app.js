// --- TAB-HALLINTA ---
const navBtns = document.querySelectorAll('.nav-btn');
const tabs = document.querySelectorAll('.tab-content');

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;

        // Vaihda aktiivinen nappi
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Vaihda näkyvä osio
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.id === target) tab.classList.add('active');
        });
    });
});

// --- TÄSTÄ ALKAA AIEMPI GYM-LOG LOGIIKKA ---
// (Muista päivittää elementtien haku, jos muutit niiden ID:itä!)
// Esim. startBtn pitää nyt lisätä gym-action-bar diviin, ei headeriin.
const actionDiv = document.getElementById('gym-action-bar');
// ... loput koodista tähän ...
// Välilehtien vaihto-logiikka
const navLinks = document.querySelectorAll('.nav-link');
const tabs = document.querySelectorAll('.tab-content');

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        const target = link.dataset.target;

        // Vaihda aktiivinen nappi
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Vaihda näkyvä osio
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.id === target) tab.classList.add('active');
        });
    });
});
import { db } from './firebase.js';
import { 
    collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const gymForm = document.getElementById('gym-form');
const logsContainer = document.getElementById('logs-container');
const gymSection = document.getElementById('gym-section');
const datalist = document.getElementById('exercise-helpers');

// Hallintanapit
const header = document.querySelector('header');
const actionDiv = document.createElement('div');
actionDiv.className = 'action-bar';
header.appendChild(actionDiv);

const startBtn = document.createElement('button');
startBtn.textContent = '➕ Aloita kirjaus';
startBtn.className = 'btn-primary';

const saveBtn = document.createElement('button');
saveBtn.textContent = '💾 Tallenna treeni ja lopeta';
saveBtn.className = 'btn-success';
saveBtn.style.display = 'none';

actionDiv.appendChild(startBtn);
actionDiv.appendChild(saveBtn);

let currentWorkoutId = null;

// --- TAPAHTUMAT ---

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
    
    // Volyymin laskenta
    const wArr = weights.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    const volume = wArr.length === 1 ? sets * reps * wArr[0] : reps * wArr.reduce((a,b) => a+b, 0);

    await addDoc(collection(db, "gymEntries"), {
        workoutId: currentWorkoutId,
        exercise: exercise.toLowerCase(),
        sets, reps, weights, failure, volume,
        createdAt: serverTimestamp()
    });
    gymForm.reset();
    document.getElementById('exercise').focus();
});

// --- HISTORIAN NÄYTTÄMINEN RYHMITELTYNÄ ---

onSnapshot(query(collection(db, "gymEntries"), orderBy("createdAt", "desc")), (snapshot) => {
    logsContainer.innerHTML = '';
    const workouts = {}; // Tähän ryhmitellään data workoutId:n mukaan

    snapshot.forEach((doc) => {
        const data = doc.data();
        const id = doc.id;
        const wId = data.workoutId || 'legacy'; // Vanhat merkinnät ilman ID:tä
        
        if (!workouts[wId]) {
            workouts[wId] = {
                date: data.createdAt?.toDate().toLocaleString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'Hetki sitten',
                entries: []
            };
        }
        workouts[wId].entries.push({ id, ...data });
    });

    // Luodaan visuaaliset treenikortit
    for (const wId in workouts) {
        const workout = workouts[wId];
        const workoutCard = document.createElement('div');
        workoutCard.className = 'workout-card';
        
        let entriesHtml = workout.entries.map(entry => `
            <div class="entry-row">
                <div class="entry-main">
                    <strong>${entry.exercise}</strong>: ${entry.sets}x${entry.reps} @ ${entry.weights}kg 
                    ${entry.failure ? '<span class="fail-badge">FAIL</span>' : ''}
                </div>
                <div class="entry-actions">
                    <button onclick="deleteEntry('${entry.id}')" class="btn-delete">❌</button>
                </div>
            </div>
        `).join('');

        workoutCard.innerHTML = `
            <div class="workout-header">${workout.date}</div>
            <div class="workout-body">${entriesHtml}</div>
        `;
        logsContainer.appendChild(workoutCard);
    }
});

// Poistofunktio (globaali jotta onclick löytää sen)
window.deleteEntry = async (id) => {
    if(confirm("Poistetaanko tämä liike?")) {
        await deleteDoc(doc(db, "gymEntries", id));
    }
};