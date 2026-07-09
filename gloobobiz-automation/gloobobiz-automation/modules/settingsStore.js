/**
 * =====================================================================
 * modules/settingsStore.js
 * =====================================================================
 * Gestisce la persistenza delle impostazioni su file JSON:
 *  - Percorso del file Excel caricato
 *  - Dati aggiuntivi (espandibile)
 *
 * Nota: i numeri di telefono degli operatori sono gestiti direttamente
 * da api.config.js (ID Account VoIP Gloobobiz). Questo store gestisce
 * le impostazioni configurabili dall'utente via UI.
 * =====================================================================
 */

const fs   = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

// Valori di default (usati se il file non esiste ancora)
const DEFAULT_SETTINGS = {
  excelFilePath:   null,    // Percorso assoluto al file Excel caricato
  ultimoUpload:    null,    // Timestamp dell'ultimo upload
  cronAttivo:      true,    // Il job giornaliero è abilitato?
  note:            '',      // Note libere dell'utente
};

/**
 * Legge le impostazioni dal file JSON.
 * @returns {Object} - Impostazioni attuali
 */
function leggiSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Salva le impostazioni aggiornate su file.
 * Fa un merge con i valori esistenti (non sovrascrive tutto).
 *
 * @param {Object} nuovi - Oggetto parziale con i campi da aggiornare
 * @returns {Object} - Impostazioni complete dopo il salvataggio
 */
function salvaSettings(nuovi) {
  const correnti  = leggiSettings();
  const aggiornate = { ...correnti, ...nuovi };

  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(aggiornate, null, 2), 'utf8');
  return aggiornate;
}

module.exports = { leggiSettings, salvaSettings };
