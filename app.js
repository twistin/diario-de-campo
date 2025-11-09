
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, addDoc, serverTimestamp, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';


// --- Configuración de Firebase y Variables Globales ---
const appId = 'field-diary-app'; // Un ID estático para la app

// Variables de Firebase declaradas con 'let' en el ámbito del módulo.
let app, db, auth;
let userId = null;
let dbCollectionRef = null;

if (Object.keys(firebaseConfig).length === 0 || !firebaseConfig.apiKey) {
    console.error("Firebase config no está disponible. La aplicación no funcionará.");
    const loadingEntriesEl = document.getElementById('loading-entries');
    if(loadingEntriesEl) {
        loadingEntriesEl.textContent = "ERROR: La configuración de Firebase no se ha encontrado en firebase-config.js. Por favor, sigue las instrucciones para configurarla.";
    }
} else {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

// Elementos del DOM
const userInfoEl = document.getElementById('user-info');
const entriesListEl = document.getElementById('entries-list');
const formEl = document.getElementById('entry-form');
const saveButton = document.getElementById('save-button');
const loadingSpinner = document.getElementById('loading-spinner');
const filterInput = document.getElementById('filter-input');
const getLocationButton = document.getElementById('get-location-button');
const locationInput = document.getElementById('geolocation');
const locationStatusEl = document.getElementById('location-status');

// Elementos del Log de Actividades
const addActivityButton = document.getElementById('add-activity-button');
const activityLogContainer = document.getElementById('activity-log-container');
const activityLogJsonInput = document.getElementById('activity_log_json');
const emptyLogMessage = document.getElementById('empty-log-message');

// Elementos del Log de Entrevistas
const addInterviewButton = document.getElementById('add-interview-button');
const interviewLogContainer = document.getElementById('interview-log-container');
const interviewLogJsonInput = document.getElementById('interview_log_json');
const emptyInterviewLogMessage = document.getElementById('empty-interview-log-message');

// Elementos de Clasificación
const moodClassificationEl = document.getElementById('mood_classification');
const themeClassificationEl = document.getElementById('theme_classification');


let allEntries = [];

// --- Lógica de Log de Actividades ---

/**
 * Añade una actividad al log temporal y actualiza el campo JSON.
 */
function addActivityLog() {
    const time = document.getElementById('activity_time').value;
    const type = document.getElementById('activity_type').value;
    const description = document.getElementById('activity_description').value.trim();

    if (!time || !description) {
        showTemporaryMessage("¡ERROR! Hora y descripción de la actividad son requeridas.", 'red');
        return;
    }

    const newActivity = { time, type, description };

    let activityLog = JSON.parse(activityLogJsonInput.value || '[]');
    activityLog.push(newActivity);
    activityLogJsonInput.value = JSON.stringify(activityLog);

    // Limpiar inputs del log
    document.getElementById('activity_time').value = '';
    document.getElementById('activity_description').value = '';

    updateActivityLogDisplay(activityLog);
}

/**
 * Actualiza la lista visible de actividades y el mensaje de log vacío.
 */
function updateActivityLogDisplay(activityLog) {
    activityLogContainer.innerHTML = '';

    if (activityLog.length === 0) {
        emptyLogMessage.classList.remove('hidden');
        activityLogContainer.appendChild(emptyLogMessage);
        return;
    }
    emptyLogMessage.classList.add('hidden');

    activityLog.forEach((activity, index) => {
        const item = document.createElement('div');
        item.className = 'activity-item text-xs';
        item.innerHTML = `
        <div class="flex-shrink-0 w-1/5 font-semibold text-gray-700">${activity.time}</div>
        <div class="flex-shrink-0 w-1/5 text-indigo-700 font-medium">${activity.type}</div>
        <div class="flex-grow text-gray-600 px-2 truncate">${activity.description}</div>
        <button type="button" data-index="${index}" data-log-type="activity" class="remove-log-button flex-shrink-0 text-red-500 hover:text-red-700 ml-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd" />
            </svg>
        </button>
    `;
        activityLogContainer.appendChild(item);
    });

    document.querySelectorAll('.remove-log-button').forEach(button => {
        button.addEventListener('click', removeLogItem);
    });
}


// --- Lógica de Log de Entrevistas ---

/**
 * Añade una conversación/entrevista al log temporal.
 */
function addInterviewLog() {
    const time = document.getElementById('interview_time').value;
    const type = document.getElementById('interview_type').value;
    const role = document.getElementById('interview_informant_role').value.trim();
    const age = document.getElementById('interview_age').value.trim();
    const profession = document.getElementById('interview_profession').value.trim();
    const region = document.getElementById('interview_region').value.trim();
    const quote = document.getElementById('interview_quote').value.trim();

    if (!time || !role || !quote) {
        showTemporaryMessage("¡ERROR! Hora, Rol y Cita son requeridos para la interacción.", 'red');
        return;
    }

    const newInterview = { time, type, role, age, profession, region, quote };

    let interviewLog = JSON.parse(interviewLogJsonInput.value || '[]');
    interviewLog.push(newInterview);
    interviewLogJsonInput.value = JSON.stringify(interviewLog);

    // Limpiar inputs del log
    document.getElementById('interview_time').value = '';
    document.getElementById('interview_informant_role').value = '';
    document.getElementById('interview_age').value = '';
    document.getElementById('interview_profession').value = '';
    document.getElementById('interview_region').value = '';
    document.getElementById('interview_quote').value = '';

    updateInterviewLogDisplay(interviewLog);
}

/**
 * Actualiza la lista visible de interacciones y el mensaje de log vacío.
 */
function updateInterviewLogDisplay(interviewLog) {
    interviewLogContainer.innerHTML = '';

    if (interviewLog.length === 0) {
        emptyInterviewLogMessage.classList.remove('hidden');
        interviewLogContainer.appendChild(emptyInterviewLogMessage);
        return;
    }
    emptyInterviewLogMessage.classList.add('hidden');

    interviewLog.forEach((interview, index) => {
        const item = document.createElement('div');
        const typeClass = interview.type === 'Formal' ? 'interview-formal' : 'interview-informal';
        const typeColor = interview.type === 'Formal' ? 'text-red-600' : 'text-green-600';

        const profile = [
            interview.age ? `${interview.age} años` : null,
            interview.profession || null,
            interview.region || null
        ].filter(Boolean).join(' | ');

        item.className = `interview-item text-xs ${typeClass}`;
        item.innerHTML = `
        <div class="flex-shrink-0 w-1/12 font-semibold text-gray-700">${interview.time}</div>
        <div class="flex-shrink-0 w-2/12 font-bold ${typeColor}">${interview.type}</div>
        <div class="flex-grow w-3/12 text-gray-700 font-medium truncate" title="Rol: ${interview.role}">${interview.role}</div>
        <div class="flex-grow text-gray-600 px-2 truncate italic" title="${interview.quote}">"${interview.quote}"</div>
        <div class="flex-shrink-0 w-4/12 text-gray-500 truncate text-right ml-4" title="Perfil: ${profile}">
            <span class="font-normal">${profile}</span>
        </div>
        <button type="button" data-index="${index}" data-log-type="interview" class="remove-log-button flex-shrink-0 text-red-500 hover:text-red-700 ml-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 10-2 0v6a1 1 0 102 0V8z" clip-rule="evenodd" />
            </svg>
        </button>
    `;
        interviewLogContainer.appendChild(item);
    });

    document.querySelectorAll('.remove-log-button').forEach(button => {
        button.addEventListener('click', removeLogItem);
    });
}

/**
 * Elimina un elemento de cualquiera de los logs temporales.
 */
function removeLogItem(event) {
    const indexToRemove = parseInt(event.currentTarget.getAttribute('data-index'));
    const logType = event.currentTarget.getAttribute('data-log-type');

    if (logType === 'activity') {
        let activityLog = JSON.parse(activityLogJsonInput.value);
        activityLog = activityLog.filter((_, index) => index !== indexToRemove);
        activityLogJsonInput.value = JSON.stringify(activityLog);
        updateActivityLogDisplay(activityLog);
    } else if (logType === 'interview') {
        let interviewLog = JSON.parse(interviewLogJsonInput.value);
        interviewLog = interviewLog.filter((_, index) => index !== indexToRemove);
        interviewLogJsonInput.value = JSON.stringify(interviewLog);
        updateInterviewLogDisplay(interviewLog);
    }
}


// --- Lógica de Geolocalización ---

/**
 * Obtiene las coordenadas geográficas del usuario.
 */
function getCurrentLocation() {
    if (!navigator.geolocation) {
        locationStatusEl.textContent = 'ERROR: La geolocalización no es soportada por este navegador.';
        locationStatusEl.classList.add('text-red-500');
        return;
    }

    locationStatusEl.textContent = 'Buscando ubicación...';
    locationStatusEl.classList.remove('text-red-500', 'text-green-500', 'text-gray-500');
    locationStatusEl.classList.add('text-indigo-500');
    getLocationButton.disabled = true;

    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lon = position.coords.longitude.toFixed(6);
        locationInput.value = `${lat}, ${lon}`;
        locationStatusEl.textContent = `Ubicación registrada: ${lat}, ${lon}`;
        locationStatusEl.classList.remove('text-indigo-500');
        locationStatusEl.classList.add('text-green-500');
        getLocationButton.disabled = false;
    }, (error) => {
        let message = 'Error de geolocalización. ';
        if (error.code === error.PERMISSION_DENIED) {
            message += 'Permiso denegado.'
        } else if (error.code === error.POSITION_UNAVAILABLE) {
            message += 'Posición no disponible.'
        } else if (error.code === error.TIMEOUT) {
            message += 'Tiempo de espera agotado.'
        }
        locationStatusEl.textContent = message;
        locationStatusEl.classList.remove('text-indigo-500', 'text-green-500');
        locationStatusEl.classList.add('text-red-500');
        locationInput.value = '';
        getLocationButton.disabled = false;
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    });
}

// --- Lógica de Pestañas (Tabs) ---
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const activateTab = (targetTab) => {
        tabContents.forEach(content => content.classList.add('hidden'));
        tabButtons.forEach(btn => {
            btn.classList.remove('border-indigo-600', 'text-indigo-600');
            btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
        });

        document.getElementById(`tab-${targetTab}`).classList.remove('hidden');
        const activeButton = document.querySelector(`[data-tab="${targetTab}"]`);
        activeButton.classList.add('border-indigo-600', 'text-indigo-600');
        activeButton.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    };

    activateTab('context');

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-tab');
            activateTab(targetTab);
        });
    });
}

// --- Lógica de Autenticación ---

/**
 * Autentica al usuario y establece el contexto de Firestore.
 */
async function setupAuthAndFirestore() {
    if (!auth) {
        console.error("Firebase Auth no está inicializado. No se puede proceder con la autenticación.");
        return;
    }

    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInAnonymously(auth);
    } catch (error) {
        console.error("Error durante la autenticación anónima de Firebase:", error);
        userInfoEl.textContent = 'Error de autenticación.'
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            userInfoEl.textContent = `Usuario (ID): ${userId.substring(0, 8)}...`;
            dbCollectionRef = collection(db, 'artifacts', appId, 'users', userId, 'field_entries');
            startRealtimeListener();
        } else {
            userId = null;
            userInfoEl.textContent = 'Usuario no autenticado.'
            entriesListEl.innerHTML = '<p class="text-center text-red-500">Necesitas iniciar sesión para ver tus entradas.</p>';
        }
    });
}

// --- Lógica de CRUD (Crear y Leer) ---

/**
 * Inicia el listener en tiempo real para obtener y renderizar las entradas.
 */
function startRealtimeListener() {
    if (!dbCollectionRef) return;

    const q = query(dbCollectionRef, orderBy('timestamp', 'desc'));

    onSnapshot(q, (snapshot) => {
        const loadingEl = document.getElementById('loading-entries');
        if (loadingEl) {
            loadingEl.remove();
        }

        allEntries = [];
        snapshot.forEach(doc => {
            allEntries.push({ id: doc.id, ...doc.data() });
        });

        renderEntries(allEntries);

    }, (error) => {
        console.error("Error al escuchar las entradas:", error);
        entriesListEl.innerHTML = `<p class="text-center text-red-500">Error al cargar las entradas: ${error.message}</p>`;
    });
}

/**
 * Guarda una nueva entrada en Firestore.
 */
async function saveEntry(event) {
    event.preventDefault();
    if (!userId) {
        showTemporaryMessage("Usuario no autenticado. No se puede guardar.", 'red');
        return;
    }

    saveButton.disabled = true;
    loadingSpinner.style.display = 'block';

    const title = document.getElementById('title').value.trim();
    const location = document.getElementById('location').value.trim();
    const geolocation = locationInput.value.trim();
    const tags = document.getElementById('tags').value.trim().split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    const moodClassification = moodClassificationEl.value;
    const themeClassification = themeClassificationEl.value;

    const data = {
        context_spatial: document.getElementById('context_spatial').value.trim(),
        context_demography: document.getElementById('context_demography').value.trim(),
        context_social: document.getElementById('context_social').value.trim(),
        etno_repertoire: document.getElementById('etno_repertoire').value.trim(),
        etno_analysis: document.getElementById('etno_analysis').value.trim(),
        etno_function: document.getElementById('etno_function').value.trim(),
        interview_log: JSON.parse(interviewLogJsonInput.value || '[]'),
        social_reflection: document.getElementById('social_reflection').value.trim(),
        activity_log: JSON.parse(activityLogJsonInput.value || '[]'),
        notes_personal: document.getElementById('notes_personal').value.trim(),
        notes_media: document.getElementById('notes_media').value.trim(),
    };

    const newEntry = {
        title,
        location,
        geolocation,
        tags,
        mood: moodClassification,
        theme: themeClassification,
        type: 'Estructurada',
        data: data,
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(dbCollectionRef, newEntry);
        formEl.reset();
        setupTabs();
        locationInput.value = '';
        locationStatusEl.textContent = 'Haga clic en \'Obtener\' para registrar la ubicación actual.'
        locationStatusEl.className = 'text-xs mt-1 text-gray-500';
        activityLogJsonInput.value = '[]';
        updateActivityLogDisplay([]);
        interviewLogJsonInput.value = '[]';
        updateInterviewLogDisplay([]);
        moodClassificationEl.value = moodClassificationEl.options[0].value;
        themeClassificationEl.value = themeClassificationEl.options[0].value;
        showTemporaryMessage("¡Observación guardada con éxito!", 'green');
    } catch (e) {
        console.error("Error al añadir documento: ", e);
        showTemporaryMessage("¡Error al guardar! Revisa la consola.", 'red');
    } finally {
        saveButton.disabled = false;
        loadingSpinner.style.display = 'none';
    }
}

/**
 * Renderiza la lista de entradas en el DOM.
 */
function renderEntries(entriesToRender) {
    entriesListEl.innerHTML = '';

    if (entriesToRender.length === 0) {
        entriesListEl.innerHTML = '<p class="text-center text-gray-500 p-4">No hay entradas. ¡Crea una nueva!</p>';
        return;
    }

    entriesToRender.forEach(entry => {
        const isStructured = entry.type === 'Estructurada' && entry.data;
        const date = entry.timestamp?.toDate ? new Date(entry.timestamp.toDate()).toLocaleString('es-ES', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Guardando...';

        const tagHtml = (entry.tags || []).map(tag =>
            `<span class="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">${tag}</span>`
        ).join(' ');

        const classificationHtml = `
        <div class="mt-2 text-xs font-medium text-gray-600 space-y-1">
            <p>Tono: <span class="text-gray-800 font-semibold">${entry.mood || 'N/A'}</span></p>
            <p>Tema: <span class="text-gray-800 font-semibold">${entry.theme || 'N/A'}</span></p>
        </div>`;

        const geolocationText = entry.geolocation ? `<span class="text-xs text-gray-500 block mt-1">Coords: ${entry.geolocation}</span>` : '';

        let notesSummary = '';
        if (isStructured) {
            notesSummary = [
                entry.data.context_spatial,
                entry.data.etno_repertoire,
                entry.data.social_reflection,
                entry.data.notes_personal,
            ].filter(Boolean).join(' ');

            if (entry.data.activity_log?.length > 0) {
                notesSummary += ` [Log Act: ${entry.data.activity_log.length}]`;
            }
            if (entry.data.interview_log?.length > 0) {
                notesSummary += ` [Log Int: ${entry.data.interview_log.length}]`;
            }
        }

        notesSummary = notesSummary.replace(/\s+/g, ' ').trim().substring(0, 200) + (notesSummary.length > 200 ? '...' : '');

        const entryCard = `
        <div class="border border-gray-200 rounded-xl p-4 transition duration-300 ease-in-out hover:shadow-md hover:border-indigo-300">
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-lg font-bold text-gray-800">${entry.title}</h3>
                <span class="text-xs font-semibold text-white px-3 py-1 rounded-full ${getTypeColor(entry.type)}">${entry.type}</span>
            </div>
            
            <div class="md:flex justify-between md:space-x-4">
                <div class="flex-grow">
                    <p class="text-sm text-gray-500 mb-1">
                        <span class="font-medium">Ubicación:</span> ${entry.location} | <span class="font-medium">Fecha:</span> ${date}
                        ${geolocationText}
                    </p>
                    <div class="text-gray-700 text-sm whitespace-pre-wrap mt-2 mb-3 max-h-32 overflow-y-hidden border-l-4 border-gray-100 pl-3">
                        ${notesSummary || 'No hay resumen disponible.'}
                    </div>
                </div>
                <div class="flex-shrink-0 w-full md:w-1/3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                   ${classificationHtml}
                </div>
            </div>
            
            <div class="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                ${tagHtml}
            </div>
        </div>`;
        entriesListEl.insertAdjacentHTML('beforeend', entryCard);
    });
}

function getTypeColor(type) {
    switch (type) {
        case 'Estructurada': return 'bg-indigo-600';
        default: return 'bg-gray-600';
    }
}

// --- Lógica de Filtrado ---

window.filterEntries = function () {
    const filterText = filterInput.value.toLowerCase();
    const filtered = allEntries.filter(entry => {
        const isStructured = entry.type === 'Estructurada' && entry.data;
        const matchesTitle = entry.title.toLowerCase().includes(filterText);
        const matchesLocation = entry.location.toLowerCase().includes(filterText);
        const matchesTags = (entry.tags || []).some(tag => tag.toLowerCase().includes(filterText));
        const matchesGeolocation = (entry.geolocation || '').toLowerCase().includes(filterText);
        const matchesMood = (entry.mood || '').toLowerCase().includes(filterText);
        const matchesTheme = (entry.theme || '').toLowerCase().includes(filterText);

        let matchesNotes = false;
        if (isStructured) {
            matchesNotes = Object.values(entry.data).some(value =>
                typeof value === 'string' && value.toLowerCase().includes(filterText)
            );
            if (entry.data.activity_log) {
                matchesNotes = matchesNotes || entry.data.activity_log.some(activity =>
                    activity.description.toLowerCase().includes(filterText) || activity.type.toLowerCase().includes(filterText)
                );
            }
            if (entry.data.interview_log) {
                matchesNotes = matchesNotes || entry.data.interview_log.some(interview =>
                    Object.values(interview).some(val => val.toLowerCase().includes(filterText))
                );
            }
        }

        return matchesTitle || matchesLocation || matchesTags || matchesNotes || matchesGeolocation || matchesMood || matchesTheme;
    });
    renderEntries(filtered);
}

function showTemporaryMessage(message, color) {
    const originalText = saveButton.textContent;
    const originalBg = saveButton.className;

    saveButton.textContent = message;
    let colorClass = color === 'red' ? 'bg-red-500' : 'bg-green-500';
    saveButton.className = `w-full inline-flex justify-center items-center py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white ${colorClass} transition duration-150 ease-in-out mt-6`;

    setTimeout(() => {
        saveButton.textContent = originalText;
        saveButton.className = originalBg;
    }, 3000);
}

// --- Inicialización ---
window.addEventListener('load', () => {
    if (auth) {
        setupTabs();
        setupAuthAndFirestore();
        formEl.addEventListener('submit', saveEntry);
        getLocationButton.addEventListener('click', getCurrentLocation);
        addActivityButton.addEventListener('click', addActivityLog);
        addInterviewButton.addEventListener('click', addInterviewLog);
        filterInput.addEventListener('input', window.filterEntries);
    }
});
