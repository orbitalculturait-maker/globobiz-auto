/**
 * =====================================================================
 * modules/gloobobizApi.js
 * =====================================================================
 * Client API Gloobobiz con operatori caricati dinamicamente dalle
 * impostazioni salvate dalla web app.
 * =====================================================================
 */

const axios = require('axios');
const config = require('../config/api.config');
const { leggiSettings } = require('./settingsStore');

const API_KEY = process.env.GLOOBOBIZ_API_KEY;
const API_TIMEOUT = 20000; // 20 secondi per richieste API

function creaDestinazioneVuota() {
  return {
    DestinationType1: '',
    ListId1: [],
    DestinationType2: '',
    ListId2: [],
    DestinationType3: '',
    ListId3: [],
    TimeOut: 0,
  };
}

function creaDestinazioneIVR() {
  return {
    DestinationType1: 'IVR',
    ListId1: [config.IVR_NOTTURNO],
    DestinationType2: '',
    ListId2: [],
    DestinationType3: '',
    ListId3: [],
    TimeOut: 0,
  };
}

function getOperatoriMap() {
  const settings = leggiSettings();
  return settings.operatoriMap || {};
}

function creaDestinazioniOperatore(nomeOperatore) {
  const operatoriMap = getOperatoriMap();
  const op = operatoriMap[nomeOperatore];

  if (!op) throw new Error(`Operatore non configurato: ${nomeOperatore}`);
  if (!op.idVoip) throw new Error(`ID VoIP mancante per l'operatore ${nomeOperatore}`);
  if (!op.idMobile) throw new Error(`ID Mobile mancante per l'operatore ${nomeOperatore}`);

  return {
    Destination1: {
      DestinationType1: 'ACV',
      ListId1: [Number(op.idVoip)],
      DestinationType2: '',
      ListId2: [],
      DestinationType3: '',
      ListId3: [],
      TimeOut: config.CALL_SETTINGS.TimeOutVoip,
    },
    Destination2: {
      DestinationType1: 'NPR',
      ListId1: [Number(op.idMobile)],
      DestinationType2: '',
      ListId2: [],
      DestinationType3: '',
      ListId3: [],
      TimeOut: config.CALL_SETTINGS.TimeOutMobile,
    },
    Destination3: creaDestinazioneVuota(),
    Destination4: creaDestinazioneVuota(),
  };
}

async function impostaGiornoMensile(giornoMese, opDiurno, opSerale) {
  const rules = [
    {
      fascia: config.FASCE.NOTTE_1,
      destinazioni: {
        Destination1: creaDestinazioneIVR(),
        Destination2: creaDestinazioneVuota(),
        Destination3: creaDestinazioneVuota(),
        Destination4: creaDestinazioneVuota(),
      },
    },
    {
      fascia: config.FASCE.DIURNA,
      destinazioni: creaDestinazioniOperatore(opDiurno),
    },
    {
      fascia: config.FASCE.SERALE,
      destinazioni: creaDestinazioniOperatore(opSerale),
    },
    {
      fascia: config.FASCE.NOTTE_2,
      destinazioni: {
        Destination1: creaDestinazioneIVR(),
        Destination2: creaDestinazioneVuota(),
        Destination3: creaDestinazioneVuota(),
        Destination4: creaDestinazioneVuota(),
      },
    },
  ];

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
        HourList: [
          {
            StartHour: rule.fascia.startHour,
            StartMinute: rule.fascia.startMinute,
            EndHour: rule.fascia.endHour,
            EndMinute: rule.fascia.endMinute,
          },
        ],
      },
    };

    await axios.post(config.BASE_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: API_TIMEOUT,
    });
  }
}

async function testConnessione() {
  try {
    if (!API_KEY) {
      return { ok: false, messaggio: 'Errore: API Key non configurata in .env' };
    }

    const risposta = await axios.post(
      config.BASE_URL,
      {
        op: 'WM_GetListIncomingNumber',
        api_key: API_KEY,
        IdVirtualNumber: config.ID_VIRTUAL_NUMBER,
      },
      { timeout: API_TIMEOUT }
    );

    if (risposta.data && risposta.data.Count !== undefined) {
      return {
        ok: true,
        messaggio: `Connessione OK — ${risposta.data.Count} numero/i virtuale/i trovato/i`,
      };
    }

    return {
      ok: true,
      messaggio: 'Connessione OK — Risposta ricevuta dal server Gloobobiz',
    };
  } catch (err) {
    let errMsg = 'Errore sconosciuto';
    
    if (err.code === 'ECONNABORTED') {
      errMsg = 'Timeout: il server Gloobobiz non ha risposto entro 20 secondi';
    } else if (err.code === 'ECONNREFUSED') {
      errMsg = 'Connessione rifiutata: verifica l\'URL del server Gloobobiz';
    } else if (err.response?.status === 401) {
      errMsg = 'Errore di autenticazione: API Key non valida';
    } else if (err.response?.status === 403) {
      errMsg = 'Accesso negato: verifica i permessi della API Key';
    } else if (err.response?.data?.message) {
      errMsg = err.response.data.message;
    } else if (err.message) {
      errMsg = err.message;
    }
    
    return { ok: false, messaggio: `Errore connessione: ${errMsg}` };
  }
}

module.exports = { impostaGiornoMensile, testConnessione };
