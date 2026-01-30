import { db } from './firebase.js';
import { 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const gymForm = document.getElementById('gym-form');
const logsContainer = document.getElementById('logs-container');
const datalist = document.getElementById('exercise-helpers');

// --- 1. VOLYYMIN LASKENTA ---
function calculateVolume(sets, reps, weightsStr) {
    const weights = weightsStr.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    
    if (weights.length === 1) {
        return sets * reps * weights[0];
    } else {
        // Jos annettu useita painoja, summataan ne ja kerrotaan toistoilla
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        return reps * totalWeight;
    }
}

// --- 2. DATAN TALLENNUS ---
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
            exercise: exercise.toLowerCase(),
            sets,
            reps,
            weights,
            failure,
            volume,
            createdAt: serverTimestamp()
        });
        gymForm.reset();
    } catch (error) {
        console.error("Virhe tallennuksessa: ", error);
        alert("Tallennus epäonnistui.");
    }
});

// --- 3. REAALIAIKAINEN LUKU & AUTOCOMPLETE ---
const q = query(collection(db, "gymEntries"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
    const entries = [];
    const exerciseNames = new Set();
    logsContainer.innerHTML = '';

    snapshot.forEach((doc) => {
        const data = doc.data();
        entries.push(data);
        if (data.exercise) exerciseNames.add(data.exercise);

        // Luodaan HTML-elementti jokaiselle riville
        const date = data.createdAt?.toDate().toLocaleDateString('fi-FI') || 'Juuri nyt';
        
        const logHtml = `
            <div class="log-item">
                <div class="log-info">
                    <h4>${data.exercise} ${data.failure ? '<span class="failure-tag">! Fail</span>' : ''}</h4>
                    <div class="log-details">${data.sets} x ${data.reps} (${data.weights} kg) • ${date}</div>
                </div>
                <div class="log-volume">${data.volume} kg <br><small>volyymi</small></div>
            </div>
        `;
        logsContainer.innerHTML += logHtml;
    });

    // Päivitetään autocomplete-ehdotukset
    datalist.innerHTML = '';
    exerciseNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name.charAt(0).toUpperCase() + name.slice(1);
        datalist.appendChild(option);
    });
});