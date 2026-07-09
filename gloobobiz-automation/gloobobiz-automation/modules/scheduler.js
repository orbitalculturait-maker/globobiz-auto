/**
 * =====================================================================
 * modules/scheduler.js
 * =====================================================================
 * Gloobobiz espone un piano orario SETTIMANALE: DayList accetta 1..7
 * (1 = lunedì, 7 = domenica). Per usare un file calendario mensile senza
 * perdere la logica per data, l'app applica a Gloobobiz il turno della
 * singola data interessata, convertendola nel relativo giorno settimana.
 *
 * Esempio: 2026-07-10 (venerdì) => DayList [5].
 * =====================================================================
 */

const { impostaGiornoSettimanale } = require('./gloobobizApi');
const { logSuccesso, logErrore } = require('./logger');
const { getMonthRows } = require('./scheduleStore');

function getRomeDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function isoToGloobobizWeekday(dataISO) {
  const jsDay = new Date(`${dataISO}T12:00:00`).getDay(); // 0 domenica, 1 lunedì...
  return jsDay === 0 ? 7 : jsDay;
}

function getRowByDate(dataISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataISO || ''))) {
    throw new Error(`Data non valida: ${dataISO || 'N/D'}. Usa formato YYYY-MM-DD.`);
  }

  const month = dataISO.slice(0, 7);
  const { rows } = getMonthRows(month);
  const row = rows.find(item => item.data === dataISO);

  if (!row) throw new Error(`Nessun turno trovato per ${dataISO}.`);
  if (!row.diurna || !row.serale) {
    throw new Error(`Turno incompleto per ${dataISO}. Completa fascia 9-18 e 18-22 prima dell'invio.`);
  }

  return row;
}

async function configuraGiorno(dataISO) {
  const row = getRowByDate(dataISO);
  const giornoSettimana = isoToGloobobizWeekday(dataISO);

  try {
    const scrittura = await impostaGiornoSettimanale(giornoSettimana, row.diurna, row.serale);
    logSuccesso('GIORNO_DA_CALENDARIO', dataISO, `GIORNO SETTIMANA ${giornoSettimana}`, `${row.diurna}/${row.serale}`);

    return {
      ok: true,
      messaggio: `Turno del ${dataISO} applicato a Gloobobiz sul giorno settimana ${giornoSettimana}.`,
      data: dataISO,
      giornoSettimana,
      diurna: row.diurna,
      serale: row.serale,
      verifica: scrittura.verifica || null,
    };
  } catch (err) {
    logErrore('GIORNO_DA_CALENDARIO', dataISO, `GIORNO SETTIMANA ${giornoSettimana}`, `${row.diurna}/${row.serale}`, err.message);
    throw err;
  }
}

async function configuraOggi() {
  return configuraGiorno(getRomeDateISO());
}

function groupRowsByWeekday(rows) {
  const grouped = new Map();

  for (const row of rows || []) {
    if (!row.diurna || !row.serale) continue;
    const weekday = isoToGloobobizWeekday(row.data);
    if (!grouped.has(weekday)) grouped.set(weekday, []);
    grouped.get(weekday).push(row);
  }

  return grouped;
}

function assertNoWeeklyConflicts(rows) {
  const grouped = groupRowsByWeekday(rows);
  const conflitti = [];
  const weeklyRows = [];

  for (const [weekday, items] of grouped.entries()) {
    const signatures = new Set(items.map(row => `${row.diurna}|||${row.serale}`));

    if (signatures.size > 1) {
      const dettagli = items
        .map(row => `${row.data}: ${row.diurna}/${row.serale}`)
        .join(' | ');
      conflitti.push(`Giorno settimana ${weekday}: ${dettagli}`);
      continue;
    }

    weeklyRows.push({ weekday, ...items[0] });
  }

  if (conflitti.length > 0) {
    throw new Error(
      'Il mese contiene turni diversi per lo stesso giorno della settimana. ' +
      'Gloobobiz supporta un piano settimanale ricorrente, quindi non posso inviare tutto il mese in un unico piano. ' +
      `Conflitti: ${conflitti.slice(0, 5).join(' || ')}`
    );
  }

  return weeklyRows.sort((a, b) => a.weekday - b.weekday);
}

async function configuraSettimanaDaMese(meseScelto) {
  const { rows } = getMonthRows(meseScelto);

  if (!rows || rows.length === 0) {
    throw new Error(`Nessun turno trovato per il mese ${meseScelto}.`);
  }

  const giorniIncompleti = rows.filter(row => !row.diurna || !row.serale);
  if (giorniIncompleti.length > 0) {
    throw new Error(
      `Trovati ${giorniIncompleti.length} giorni incompleti nel mese ${meseScelto}. ` +
      'Completa la tabella prima di inviare a Gloobobiz.'
    );
  }

  const weeklyRows = assertNoWeeklyConflicts(rows);
  const risultati = [];

  for (const row of weeklyRows) {
    try {
      const scrittura = await impostaGiornoSettimanale(row.weekday, row.diurna, row.serale);
      logSuccesso('SETTIMANA_DA_MESE', row.data, `GIORNO SETTIMANA ${row.weekday}`, `${row.diurna}/${row.serale}`);
      risultati.push({ weekday: row.weekday, dataEsempio: row.data, ok: true, verifica: scrittura.verifica || null });
    } catch (err) {
      logErrore('SETTIMANA_DA_MESE', row.data, `GIORNO SETTIMANA ${row.weekday}`, `${row.diurna}/${row.serale}`, err.message);
      risultati.push({ weekday: row.weekday, dataEsempio: row.data, ok: false, errore: err.message });
    }
  }

  const falliti = risultati.filter(r => !r.ok).length;
  return {
    ok: falliti === 0,
    messaggio: falliti === 0
      ? `Piano settimanale applicato con successo partendo dal mese ${meseScelto}.`
      : `Piano settimanale applicato parzialmente. Falliti: ${falliti}.`,
    dettagli: risultati,
  };
}

module.exports = {
  configuraOggi,
  configuraGiorno,
  configuraSettimanaDaMese,
  getRomeDateISO,
  isoToGloobobizWeekday,
};
