import { db } from './firebase.js';
import { 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// DOM-elementit
const gymForm = document.getElementById('gym-form');
const logsContainer = document.getElementById('logs-container');
const datalist = document.getElementById('exercise-helpers');
const startBtn = document.createElement('button'); // Luodaan aloitusnappi dynaamisesti

// Sovelluksen tila
let currentWorkoutId = null;

// --- ALOITUSNÄKYMÄN HALLINTA ---
const setupHeader = () => {
    const header = document.querySelector('header');
    startBtn.textContent = '➕ Aloita uusi treeni';
    startBtn.id = 'start-workout-btn';
    startBtn.style.backgroundColor = '#10b981'; // Vihreä väri aloitukselle
    header.appendChild(startBtn);
    
    // Piilotetaan lomake aluksi
    gymForm.parentElement.style.display = 'none';
};
setupHeader();

startBtn.addEventListener('click', () => {
    currentWorkoutId = 'workout-' + Date.now(); // Luodaan uniikki ID aikaleimasta
    gymForm.parentElement.style.display = 'block';
    startBtn.style.display = 'none';
    alert("Treeni aloitettu! Voit nyt lisätä liikkeitä.");
});

// --- VOLYYMIN LASKENTA ---
function calculateVolume(sets, reps, weightsStr) {
    const weights = weightsStr.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    if (weights.length === 1) return sets * reps * weights[0];
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    return reps * totalWeight;
}

// --- DATAN TALLENNUS ---
gymForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const exercise = document.getElementById('exercise').value;
    const sets = parseInt(document.getElementById('sets').value);
    const reps = parseInt(document.getElementById('reps').value);
    const weights = document.getElementById('weights').value;
    const failure = document.getElementById('failure').checked;

    const volume = calculateVolume(sets, reps, weights);

    try {
        await addDoc(collection(db, "gymEntries"), {
            workoutId: currentWorkoutId, // TÄRKEÄ: sitoo liikkeen tiettyyn treeniin
            exercise: exercise.toLowerCase(),
            sets,
            reps,
            weights,
            failure,
            volume,
            createdAt: serverTimestamp()
        });
        gymForm.reset();
        document.getElementById('exercise').focus(); // Helpottaa seuraavan liikkeen lisäystä
    } catch (error) {
        console.error("Virhe: ", error);
    }
});

// --- REAALIAIKAINEN LUKU ---
const q = query(collection(db, "gymEntries"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
    logsContainer.innerHTML = '';
    const exerciseNames = new Set();
    
    // Ryhmitellään liikkeet treenien mukaan (Yksinkertaistettu listaus)
    snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.exercise) exerciseNames.add(data.exercise);

        const date = data.createdAt?.toDate() ? data.createdAt.toDate().toLocaleString('fi-FI', { 
            weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' 
        }) : 'Tallennetaan...';
        
        const logHtml = `
            <div class="log-item" style="border-left: 4px solid ${data.workoutId === currentWorkoutId ? '#38bdf8' : '#334155'}">
                <div class="log-info">
                    <h4>${data.exercise} ${data.failure ? '<br><span style="color:#ef4444; font-size:0.7rem;">⚠️ SARJA TEHTY FAILUREEN</span>' : ''}</h4>
                    <div class="log-details">${data.sets} x ${data.reps} (${data.weights} kg) • ${date}</div>
                </div>
                <div class="log-volume">${data.volume} kg</div>
            </div>
        `;
        logsContainer.innerHTML += logHtml;
    });

    // Päivitetään autocomplete
    datalist.innerHTML = '';
    exerciseNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name.charAt(0).toUpperCase() + name.slice(1);
        datalist.appendChild(option);
    });
});