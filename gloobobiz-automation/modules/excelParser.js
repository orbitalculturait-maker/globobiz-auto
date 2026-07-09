/**
 * =====================================================================
 * modules/excelParser.js
 * =====================================================================
 * Legge tutti i fogli del file Excel dei turni di reperibilità e
 * restituisce una mappa indicizzata per data: { "2026-06-01": { diurna, serale } }
 *
 * Gestisce:
 *  - Nomi abbreviati (Ale → Alessandro, leonardo → Leonardo)
 *  - Fogli multipli che coprono periodi diversi
 *  - Righe di riepilogo da ignorare (non contengono date valide)
 *  - Celle vuote → lancia errore descrittivo
 * =====================================================================
 */

const XLSX = require('xlsx');
const path = require('path');

// -----------------------------------------------------------------------
// Mappa di normalizzazione nomi: varianti → nome canonico
// -----------------------------------------------------------------------
const NOME_CANONICO = {
  'ale':        'Alessandro',
  'alessandro': 'Alessandro',
  'gianandrea': 'Gianandrea',
  'leonardo':   'Leonardo',
  'leo':        'Leonardo',
};

/**
 * Normalizza un nome reperibile in modo case-insensitive.
 * @param {string} raw - Valore grezzo dalla cella Excel
 * @returns {string|null} - Nome canonico oppure null se non riconosciuto
 */
function normalizzaNome(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const pulito = raw.trim().toLowerCase();
  // Cerca corrispondenza esatta o parziale (es. "Tutti tranne..." → null)
  return NOME_CANONICO[pulito] || null;
}

/**
 * Converte una data in formato DD/MM/YYYY o serial Excel in stringa ISO YYYY-MM-DD.
 * @param {string|number} valore - Valore della cella Data
 * @returns {string|null} - Data in formato YYYY-MM-DD oppure null
 */
function parseData(valore) {
  if (!valore) return null;

  // Caso 1: stringa nel formato DD/MM/YYYY
  if (typeof valore === 'string') {
    const match = valore.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, giorno, mese, anno] = match;
      return `${anno}-${mese.padStart(2,'0')}-${giorno.padStart(2,'0')}`;
    }
    return null;
  }

  // Caso 2: numero seriale Excel (es. 46049 = 01/06/2026)
  if (typeof valore === 'number') {
    try {
      const jsDate = XLSX.SSF.parse_date_code(valore);
      if (jsDate) {
        const anno = jsDate.y;
        const mese = String(jsDate.m).padStart(2, '0');
        const giorno = String(jsDate.d).padStart(2, '0');
        return `${anno}-${mese}-${giorno}`;
      }
    } catch (_) {}
    return null;
  }

  return null;
}

/**
 * Legge il file Excel e restituisce la mappa completa dei turni.
 *
 * @param {string} filePath - Percorso assoluto al file .xlsx
 * @returns {{ turni: Object, errori: string[] }}
 *   - turni: { "YYYY-MM-DD": { diurna: "Alessandro"|null, serale: "Gianandrea"|null } }
 *   - errori: array di stringhe descrittive per celle vuote o dati anomali
 */
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const turni = {};    // mappa data → { diurna, serale }
  const errori = [];   // lista warning/errori da mostrare in UI

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    // Legge il foglio come array di array (raw values), riga 0 = intestazioni
    const righe = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    for (let i = 1; i < righe.length; i++) {
      const riga = righe[i];

      // Colonna A: data
      const dataRaw  = riga[0];
      // Colonna C: orario lavorativo 9-18 (chi risponde di giorno)
      const diurnaRaw = riga[2];
      // Colonna D: reperibilità 18-22 (chi risponde di sera)
      const seraleRaw = riga[3];

      // Ignora righe senza data valida (riepilogo, righe vuote, ecc.)
      const dataISO = parseData(dataRaw);
      if (!dataISO) continue;

      // Normalizza i nomi degli operatori
      const diurna = normalizzaNome(diurnaRaw);
      const serale  = normalizzaNome(seraleRaw);

      // Raccoglie errori per celle mancanti (solo se la data è >= oggi)
      const oggi = new Date().toISOString().split('T')[0];
      if (dataISO >= oggi) {
        if (!diurna) {
          errori.push(
            `⚠️ Fascia 9-18 mancante o non riconosciuta per il ${dataISO} ` +
            `(foglio: "${sheetName}", valore cella: "${diurnaRaw}")`
          );
        }
        if (!serale) {
          errori.push(
            `⚠️ Reperibilità 18-22 mancante o non riconosciuta per il ${dataISO} ` +
            `(foglio: "${sheetName}", valore cella: "${seraleRaw}")`
          );
        }
      }

      turni[dataISO] = { diurna, serale };
    }
  }

  return { turni, errori };
}

/**
 * Recupera il turno per la data odierna.
 * Lancia un errore se mancano dati essenziali (celle vuote).
 *
 * @param {Object} turni - Mappa restituita da parseExcel()
 * @returns {{ diurna: string, serale: string }} - Nomi degli operatori per oggi
 */
function getTurnoOggi(turni) {
  const oggi = new Date().toISOString().split('T')[0];
  const turno = turni[oggi];

  if (!turno) {
    throw new Error(`Nessun turno trovato nel file Excel per la data odierna (${oggi}).`);
  }
  if (!turno.diurna) {
    throw new Error(
      `Il file Excel non contiene un operatore valido per la fascia 9-18 del ${oggi}. ` +
      `Correggi il file e ricaricalo prima di procedere.`
    );
  }
  if (!turno.serale) {
    throw new Error(
      `Il file Excel non contiene un operatore valido per la reperibilità 18-22 del ${oggi}. ` +
      `Correggi il file e ricaricalo prima di procedere.`
    );
  }

  return turno;
}

module.exports = { parseExcel, getTurnoOggi, normalizzaNome, parseData };
