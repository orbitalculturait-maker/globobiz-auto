/**
 * =====================================================================
 * modules/logger.js
 * =====================================================================
 * Gestisce lo storico delle operazioni su file JSON.
 * Ogni operazione (riuscita o fallita) viene salvata con timestamp,
 * operatore, fascia oraria ed esito.
 * =====================================================================
 */

const fs   = require('fs');
const path = require('path');

// Percorso al file di storico (nella cartella /data)
const HISTORY_FILE = path.join(__dirname, '..', 'data', 'history.json');
// Numero massimo di voci da conservare nello storico
const MAX_ENTRIES = 200;

/**
 * Legge lo storico dal file JSON.
 * @returns {Array} - Array di voci storiche
 */
function leggiStorico() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(raw) || [];
  } catch (_) {
    return [];
  }
}

/**
 * Aggiunge una voce allo storico e salva su file.
 *
 * @param {Object} voce - Dati dell'operazione
 * @param {string} voce.tipo       - 'AUTOMATICO' | 'MANUALE'
 * @param {string} voce.data       - Data operazione (YYYY-MM-DD)
 * @param {string} voce.fascia     - 'DIURNA' | 'SERALE'
 * @param {string} voce.operatore  - Nome operatore impostato
 * @param {boolean} voce.successo  - true se API ha risposto OK
 * @param {string} voce.messaggio  - Messaggio esito o errore
 */
function aggiungiVoce(voce) {
  const storico = leggiStorico();

  storico.unshift({
    ...voce,
    timestamp: new Date().toISOString(),
  });

  // Tronca se supera il limite
  const storicoPotato = storico.slice(0, MAX_ENTRIES);

  // Crea la cartella /data se non esiste
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(storicoPotato, null, 2), 'utf8');
}

/**
 * Registra un'operazione completata con successo.
 */
function logSuccesso(tipo, data, fascia, operatore, dettaglio) {
  console.log(`[LOG ✅] ${tipo} | ${data} | ${fascia} → ${operatore}`);
  aggiungiVoce({
    tipo,
    data,
    fascia,
    operatore,
    successo: true,
    messaggio: dettaglio || `Deviazione impostata correttamente`,
  });
}

/**
 * Registra un'operazione fallita con il messaggio di errore.
 */
function logErrore(tipo, data, fascia, operatore, errore) {
  console.error(`[LOG ❌] ${tipo} | ${data} | ${fascia} → ${operatore} | ${errore}`);
  aggiungiVoce({
    tipo,
    data,
    fascia,
    operatore: operatore || 'N/D',
    successo: false,
    messaggio: errore,
  });
}

module.exports = { leggiStorico, logSuccesso, logErrore };
