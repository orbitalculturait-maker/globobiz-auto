/**
 * =====================================================================
 * modules/gloobobizApi.js
 * =====================================================================
 * =====================================================================
 */

const axios  = require('axios');
const config = require('../config/api.config');

const API_KEY = process.env.GLOOBOBIZ_API_KEY;

function creaDestinazioneVuota() {
  return {
    DestinationType1: '', ListId1: [], DestinationType2: '', ListId2: [], DestinationType3: '', ListId3: [], TimeOut: 0
  };
}

function creaDestinazioneIVR() {
  return {
    DestinationType1: 'IVR', ListId1: [config.IVR_NOTTURNO], 
    DestinationType2: '', ListId2: [], DestinationType3: '', ListId3: [], TimeOut: 0
  };
}

function creaDestinazioniOperatore(nomeOperatore) {
  const op = config.OPERATORI[nomeOperatore];
  if (!op) throw new Error(`Operatore non trovato: ${nomeOperatore}`);

  return {
    Destination1: {
      DestinationType1: 'ACV', ListId1: [op.idVoip],
      DestinationType2: '', ListId2: [], DestinationType3: '', ListId3: [], 
      TimeOut: config.CALL_SETTINGS.TimeOutVoip
    },
    Destination2: {
      DestinationType1: 'NPR', ListId1: [op.idMobile],
      DestinationType2: '', ListId2: [], DestinationType3: '', ListId3: [], 
      TimeOut: config.CALL_SETTINGS.TimeOutMobile
    },
    Destination3: creaDestinazioneVuota(),
    Destination4: creaDestinazioneVuota()
  };
}

/**
 * Applica la configurazione di un intero giorno su Gloobobiz.
 * @param {number} giornoMese - 1..31
 * @param {string} opDiurno - Nome operatore 9-18
 * @param {string} opSerale - Nome operatore 18-22
 */
async function impostaGiornoMensile(giornoMese, opDiurno, opSerale) {
  // L'API di Gloobobiz prende un array DayList e sostituisce o appende le regole.
  // Dobbiamo configurare 4 fasce per questo giorno.
  
  const rules = [
    // 00:00 - 09:00 -> IVR
    {
      fascia: config.FASCE.NOTTE_1,
      destinazioni: {
        Destination1: creaDestinazioneIVR(), Destination2: creaDestinazioneVuota(), Destination3: creaDestinazioneVuota(), Destination4: creaDestinazioneVuota()
      }
    },
    // 09:00 - 18:00 -> Operatore Diurno
    {
      fascia: config.FASCE.DIURNA,
      destinazioni: creaDestinazioniOperatore(opDiurno)
    },
    // 18:00 - 22:00 -> Operatore Serale
    {
      fascia: config.FASCE.SERALE,
      destinazioni: creaDestinazioniOperatore(opSerale)
    },
    // 22:00 - 23:59 -> IVR
    {
      fascia: config.FASCE.NOTTE_2,
      destinazioni: {
        Destination1: creaDestinazioneIVR(), Destination2: creaDestinazioneVuota(), Destination3: creaDestinazioneVuota(), Destination4: creaDestinazioneVuota()
      }
    }
  ];

  // Inviamo 4 chiamate separate, una per ogni fascia oraria, dato che WM_AddNumberScheduling
  // si aspetta una singola regola alla volta nell'esempio fornito.
  
  for (const rule of rules) {
    const payload = {
      op: config.OP_ADD_SCHEDULING,
      api_key: API_KEY,
      IdVirtualNumber: config.ID_VIRTUAL_NUMBER,
      CallAcceptanceRequest: config.CALL_SETTINGS.CallAcceptanceRequest,
      WaitingMusic: config.CALL_SETTINGS.WaitingMusic,
      CallOriginationMessage: config.CALL_SETTINGS.CallOriginationMessage,
      ...rule.destinazioni,
      Scheduling: {
        DayList: [giornoMese],
        HourList: [{
          StartHour: rule.fascia.startHour, StartMinute: rule.fascia.startMinute,
          EndHour: rule.fascia.endHour, EndMinute: rule.fascia.endMinute
        }]
      }
    };

    await axios.post(config.BASE_URL, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
  }
}

async function testConnessione() {
  try {
    const risposta = await axios.post(config.BASE_URL, {
      op: 'WM_GetListIncomingNumber', api_key: API_KEY, IdVirtualNumber: 0,
    }, { timeout: 10000 });
    return { ok: true, messaggio: `Connessione OK — ${risposta.data.Count} numero/i virtuale/i trovato/i` };
  } catch (err) {
    return { ok: false, messaggio: `Errore: ${err.message}` };
  }
}

module.exports = { impostaGiornoMensile, testConnessione };
