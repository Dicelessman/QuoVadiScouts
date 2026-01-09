import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    updateDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Initialize Firebase
const app = initializeApp(window.FirebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let allStructures = [];
let currentUser = null;
let currentTab = 'todo'; // 'todo' or 'done'
let currentEditingId = null;

// === COMPLETENESS ALGORITHM ===
function calculateCompleteness(s) {
    let score = 0;
    let missing = [];

    // 1. CRITICAL (40%)
    // Name (Base requirement, assumed present if record exists, but let's check)
    if (s.Struttura) score += 0; else missing.push('Nome'); // 0 points, purely mandatory

    // Location (15%)
    if (s.Luogo && s.Prov) score += 15; else missing.push('Luogo');

    // Coordinates/Address (15%)
    if ((s.coordinate_lat && s.coordinate_lng) || s.Indirizzo) {
        score += 15;
    } else {
        missing.push('Posizione');
    }

    // Contact (10%)
    if (s.Contatto || s.Email || s.Sito) {
        score += 10;
    } else {
        missing.push('Contatto');
    }

    // 2. IMPORTANT (40%)
    // Payment Info (15%)
    const hasPayment = s['A persona'] || s['A giornata'] || s['A notte'] || s.Offerta || s.Forfait || s['Altri costi'];
    if (hasPayment) score += 15; else missing.push('Costi');

    // Referente (10%)
    if (s.Referente) score += 10; else missing.push('Referente');

    // Info/Notes (15%)
    const hasInfo = s.Info || s.Note || s['Altre info'];
    if (hasInfo) score += 15; else missing.push('Info');

    // 3. BONUS (20%)
    // Features (15%)
    const hasFeatures = s.Letti || s.Spazi || s.Fuochi || s.Hike || s.Cucina || s.Riscaldamento;
    if (hasFeatures) score += 15;

    // Google Maps Link (5%)
    if (s.google_maps_link) score += 5;

    return {
        score: Math.min(100, score),
        missing: missing
    };
}

// === RENDER ===
function renderList() {
    const container = document.getElementById('revision-container');
    const showMyAssigned = document.getElementById('show-my-assigned').checked;

    container.innerHTML = '';

    const structuresWithScore = allStructures.map(s => ({
        ...s,
        ...calculateCompleteness(s)
    }));

    let filtered = structuresWithScore.filter(s => {
        const isReviewed = s.reviewStatus?.isReviewed === true;
        if (currentTab === 'todo') return !isReviewed;
        return isReviewed;
    });

    if (showMyAssigned && currentUser) {
        filtered = filtered.filter(s => s.reviewStatus?.assignedTo === currentUser.uid);
    }

    // Sort: Lowest score first for TODO (worst data first), Highest first for DONE (best data first)
    filtered.sort((a, b) => {
        if (currentTab === 'todo') return a.score - b.score;
        return b.score - a.score;
    });

    document.getElementById('list-counter').textContent = `${filtered.length} strutture`;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-message">Nessuna struttura trovata in questa lista.</div>`;
        return;
    }

    filtered.forEach(s => {
        const card = document.createElement('div');
        card.className = `revision-card ${s.score < 50 ? 'critical-missing' : ''}`;

        let scoreColor = '#dc2626'; // Red
        if (s.score >= 50) scoreColor = '#d97706'; // Orange
        if (s.score >= 80) scoreColor = '#16a34a'; // Green

        const missingTags = s.missing.map(m => `<span class="missing-badge">${m}</span>`).join('');

        card.innerHTML = `
            <div class="card-top">
                <div>
                    <div class="card-name">${s.Struttura || 'Senza Nome'}</div>
                    <div class="card-location">📍 ${s.Luogo || '?'}, ${s.Prov || '?'}</div>
                </div>
                ${s.reviewStatus?.isReviewed ? '<span class="status-badge reviewed">✓ Revisionata</span>' : ''}
            </div>
            
            <div class="score-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${s.score}%; background: ${scoreColor}"></div>
                </div>
                <div class="score-text" style="color: ${scoreColor}">${s.score}%</div>
            </div>

            ${s.missing.length > 0 ? `<div class="missing-fields">Mancanti: ${missingTags}</div>` : ''}

            <div class="card-actions">
                <div class="reviewer-info">
                   ${s.reviewStatus?.reviewerName ?
                `<i class="fas fa-check-circle"></i> Rev: ${s.reviewStatus.reviewerName}` :
                (s.reviewStatus?.assignedName ? `<i class="fas fa-user-clock"></i> Assegnata a: ${s.reviewStatus.assignedName}` : '')
            }
                </div>
                <button class="btn-primary" style="font-size: 0.85rem; padding: 6px 12px;" onclick="window.openRevisionModal('${s.id}')">
                    🔍 Revisiona
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

// === LOAD DATA ===
async function loadData() {
    try {
        const q = query(collection(db, "strutture"), orderBy("Struttura"));
        const snapshot = await getDocs(q);
        allStructures = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderList();
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Errore caricamento dati");
    }
}

// === EDIT MODAL LOGIC (Simplified version of script.js) ===
window.openRevisionModal = (id) => {
    currentEditingId = id;
    const s = allStructures.find(struct => struct.id === id);
    if (!s) return;

    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');

    // Populate simplified form (focusing on missing data)
    // In a real scenario, this would ideally import `modificaStruttura` from script.js,
    // but due to module structure complexity, we'll replicate the core fields here or 
    // we could try to just use the fields we defined as critical/important.

    const form = document.getElementById('editForm');
    form.innerHTML = `
        <div style="display: grid; gap: 10px;">
             <label>Nome: <input type="text" id="rev-name" value="${s.Struttura || ''}"></label>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <label>Luogo: <input type="text" id="rev-place" value="${s.Luogo || ''}"></label>
                <label>Prov: <input type="text" id="rev-prov" value="${s.Prov || ''}"></label>
             </div>
             <label>Indirizzo: <input type="text" id="rev-addr" value="${s.Indirizzo || ''}"></label>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <label>Lat: <input type="number" step="any" id="rev-lat" value="${s.coordinate_lat || ''}"></label>
                <label>Lng: <input type="number" step="any" id="rev-lng" value="${s.coordinate_lng || ''}"></label>
             </div>
             <label>Contatto: <input type="text" id="rev-contact" value="${s.Contatto || ''}"></label>
             <label>Email: <input type="email" id="rev-email" value="${s.Email || ''}"></label>
             <label>Costi/Offerta: <input type="text" id="rev-offer" value="${s.Offerta || s['A persona'] || ''}" placeholder="Inserisci info sui costi..."></label>
             <label>Referente: <input type="text" id="rev-ref" value="${s.Referente || ''}"></label>
             <label>Note/Info: <textarea id="rev-info" rows="3">${s.Info || s.Note || ''}</textarea></label>
             
             <div style="background: #f8fafc; padding: 10px; border-radius: 6px;">
                 <strong>Caratteristiche (Bonus):</strong><br>
                 <label><input type="checkbox" id="rev-kitchen" ${s.Cucina ? 'checked' : ''}> Cucina</label>
                 <label><input type="checkbox" id="rev-beds" ${s.Letti ? 'checked' : ''}> Letti</label>
                 <label><input type="checkbox" id="rev-heat" ${s.Riscaldamento ? 'checked' : ''}> Riscaldamento</label>
             </div>
        </div>
    `;

    // Reset Review Checkbox
    const revCheckbox = document.getElementById('mark-as-reviewed');
    revCheckbox.checked = s.reviewStatus?.isReviewed || false;
};

document.getElementById('saveBtn').addEventListener('click', async () => {
    if (!currentEditingId || !currentUser) {
        alert("Devi essere loggato per salvare.");
        return;
    }

    const s = allStructures.find(struct => struct.id === currentEditingId);

    // Construct update object
    const updates = {
        Struttura: document.getElementById('rev-name').value,
        Luogo: document.getElementById('rev-place').value,
        Prov: document.getElementById('rev-prov').value,
        Indirizzo: document.getElementById('rev-addr').value,
        coordinate_lat: parseFloat(document.getElementById('rev-lat').value) || null,
        coordinate_lng: parseFloat(document.getElementById('rev-lng').value) || null,
        Contatto: document.getElementById('rev-contact').value,
        Email: document.getElementById('rev-email').value,
        Offerta: document.getElementById('rev-offer').value, // Simplified mapping
        Referente: document.getElementById('rev-ref').value,
        Info: document.getElementById('rev-info').value,
        Cucina: document.getElementById('rev-kitchen').checked,
        Letti: document.getElementById('rev-beds').checked ? (s.Letti || 'Sì') : '', // Keep existing value if checked or default yes
        Riscaldamento: document.getElementById('rev-heat').checked,

        lastModified: new Date(),
        lastModifiedBy: currentUser.uid
    };

    // Review Status
    const isReviewed = document.getElementById('mark-as-reviewed').checked;
    if (isReviewed) {
        updates.reviewStatus = {
            isReviewed: true,
            lastReviewedDate: new Date(),
            lastReviewedBy: currentUser.uid,
            reviewerName: currentUser.displayName || currentUser.email
        };
    } else if (s.reviewStatus?.isReviewed) {
        // If unchecking, keep history but mark false
        updates.reviewStatus = { ...s.reviewStatus, isReviewed: false };
    }

    try {
        await updateDoc(doc(db, "strutture", currentEditingId), updates);

        // Update local state
        const idx = allStructures.findIndex(st => st.id === currentEditingId);
        if (idx !== -1) {
            allStructures[idx] = { ...allStructures[idx], ...updates };
        }

        document.getElementById('modal').classList.add('hidden');
        renderList();
    } catch (e) {
        console.error(e);
        alert("Errore salvataggio: " + e.message);
    }
});

document.getElementById('closeModal').onclick = () => document.getElementById('modal').classList.add('hidden');
document.getElementById('cancelBtn').onclick = () => document.getElementById('modal').classList.add('hidden');

// === EVENTS ===
document.querySelectorAll('.revision-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.revision-tab').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTab = e.target.dataset.tab;
        renderList();
    });
});

document.getElementById('show-my-assigned').addEventListener('change', renderList);

// === AUTH ===
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loadData();
    } else {
        document.getElementById('revision-container').innerHTML =
            '<div class="empty-message">Devi effettuare il login per accedere alla revisione. <a href="/">Torna alla home</a></div>';
    }
});
