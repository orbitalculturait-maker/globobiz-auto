/**
 * =====================================================================
 * modules/scheduler.js
 * =====================================================================
 * Invio massivo mensile basato sulla pianificazione unificata
 * (Excel/CSV + modifiche manuali da UI).
 * =====================================================================
 */

const { impostaGiornoMensile } = require('./gloobobizApi');
const { logSuccesso, logErrore } = require('./logger');
const { getMonthRows } = require('./scheduleStore');
const { leggiSettings } = require('./settingsStore');

async function configuraMeseCompleto(meseScelto) {
  const { rows } = getMonthRows(meseScelto);

  if (!rows || rows.length === 0) {
    throw new Error(`Nessun turno trovato per il mese ${meseScelto}.`);
  }

  const giorniIncompleti = rows.filter(row => !row.diurna || !row.serale);
  if (giorniIncompleti.length > 0) {
    throw new Error(
      `Trovati ${giorniIncompleti.length} giorni incompleti nel mese ${meseScelto}. ` +
      `Completa la tabella prima di inviare a Gloobobiz.`
    );
  }

  // Valida che tutti gli operatori siano configurati correttamente
  const settings = leggiSettings();
  const operatoriUsati = new Set();
  for (const row of rows) {
    operatoriUsati.add(row.diurna);
    operatoriUsati.add(row.serale);
  }

  for (const nome of operatoriUsati) {
    const op = settings.operatoriMap[nome];
    if (!op) {
      throw new Error(`Operatore "${nome}" non configurato. Aggiungi l'operatore in Impostazioni.`);
    }
    if (!op.idVoip || !Number.isInteger(op.idVoip)) {
      throw new Error(`ID VoIP mancante o non valido per "${nome}".`);
    }
    if (!op.idMobile || !Number.isInteger(op.idMobile)) {
      throw new Error(`ID Mobile mancante o non valido per "${nome}".`);
    }
  }

  const risultati = [];
  console.log(`[INVIO MENSILE] Inizio caricamento per ${meseScelto} (${rows.length} giorni)`);

  for (const row of rows) {
    const giornoMese = Number(row.data.split('-')[2]);

    try {
      await impostaGiornoMensile(giornoMese, row.diurna, row.serale);
      logSuccesso('MANUALE_MESE', row.data, 'GIORNATA COMPLETA', `${row.diurna}/${row.serale}`);
      risultati.push({ data: row.data, ok: true });
    } catch (err) {
      logErrore('MANUALE_MESE', row.data, 'GIORNATA COMPLETA', `${row.diurna}/${row.serale}`, err.message);
      risultati.push({ data: row.data, ok: false, errore: err.message });
    }
  }

  const falliti = risultati.filter(r => !r.ok).length;
  if (falliti > 0) {
    return {
      ok: false,
      messaggio: `Inviati con successo ${risultati.length - falliti} giorni. Falliti: ${falliti}. Controlla lo storico.`,
      dettagli: risultati,
    };
  }

  return {
    ok: true,
    messaggio: `Configurazione completata con successo per ${rows.length} giorni del mese ${meseScelto}.`,
    dettagli: risultati,
  };
}

module.exports = { configuraMeseCompleto };
