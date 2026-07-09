/**
 * =====================================================================
 * modules/scheduler.js
 * =====================================================================
 * Contiene la logica di invio massivo mensile.
 * Disabilita il cron giornaliero.
 * =====================================================================
 */

const { parseExcel }               = require('./excelParser');
const { impostaGiornoMensile }     = require('./gloobobizApi');
const { logSuccesso, logErrore }   = require('./logger');
const { leggiSettings }            = require('./settingsStore');

// Non usiamo più il node-cron, eseguiamo manualmente

async function configuraMeseCompleto(meseScelto) {
  const settings = leggiSettings();
  if (!settings.excelFilePath) throw new Error('Nessun file Excel caricato.');

  const { turni, errori } = parseExcel(settings.excelFilePath);
  
  // Filtriamo i turni per il mese richiesto (es "2026-07")
  const giorniMese = Object.entries(turni).filter(([data]) => data.startsWith(meseScelto));
  
  if (giorniMese.length === 0) {
    throw new Error(`Nessun turno trovato per il mese ${meseScelto}.`);
  }

  // Verifica che tutti i giorni abbiano dati validi
  const giorniIncompleti = giorniMese.filter(([_, t]) => !t.diurna || !t.serale);
  if (giorniIncompleti.length > 0) {
    throw new Error(`Trovati ${giorniIncompleti.length} giorni incompleti nel file Excel. Sistema le fasce prima di inviare.`);
  }

  const risultati = [];
  console.log(`[INVIO MENSILE] Inizio caricamento per ${meseScelto} (${giorniMese.length} giorni)`);

  for (const [dataIso, turno] of giorniMese) {
    // dataIso è YYYY-MM-DD
    const giornoMese = parseInt(dataIso.split('-')[2], 10); // 1-31
    
    try {
      await impostaGiornoMensile(giornoMese, turno.diurna, turno.serale);
      logSuccesso('MANUALE_MESE', dataIso, 'GIORNATA COMPLETA', `${turno.diurna}/${turno.serale}`);
      risultati.push({ data: dataIso, ok: true });
    } catch (err) {
      logErrore('MANUALE_MESE', dataIso, 'GIORNATA COMPLETA', `${turno.diurna}/${turno.serale}`, err.message);
      risultati.push({ data: dataIso, ok: false, errore: err.message });
      // Se si vuole fermare tutto in caso di errore, de-commentare:
      // throw new Error(`Errore il giorno ${dataIso}: ${err.message}`);
    }
  }

  const falliti = risultati.filter(r => !r.ok).length;
  if (falliti > 0) {
    return { ok: false, messaggio: `Inviati con successo ${risultati.length - falliti} giorni. Falliti: ${falliti}. Controlla lo storico.` };
  }

  return { ok: true, messaggio: `Configurazione completata con successo per ${giorniMese.length} giorni.` };
}

module.exports = { configuraMeseCompleto };
