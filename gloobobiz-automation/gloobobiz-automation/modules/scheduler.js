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
