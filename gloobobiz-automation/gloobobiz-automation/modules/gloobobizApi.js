/**
 * =====================================================================
 * modules/gloobobizApi.js
 * =====================================================================
 * Client API Gloobobiz.
 *
 * Punti importanti:
 * - WM_AddNumberScheduling usa DayList come giorno della settimana (1..7).
 * - L'app scrive il piano del giorno interessato e poi rilegge il numero
 *   virtuale con WM_GetListIncomingNumber per verificare che le fasce siano
 *   effettivamente presenti con le destinazioni attese.
 * - Gli ID operatori possono essere verificati contro WM_GetListVoipAccount
 *   e, quando disponibile, contro la lista numeri personali.
 * =====================================================================
 */

const axios = require('axios');
const config = require('../config/api.config');
const { leggiSettings, listOperatori } = require('./settingsStore');

function getApiKey() {
  return process.env.GLOOBOBIZ_API_KEY || '';
}

function requireApiKey() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API Key Gloobobiz non configurata. Imposta GLOOBOBIZ_API_KEY nel file .env.');
  return apiKey;
}

function extractApiError(data) {
  if (!data || typeof data !== 'object') return null;

  const candidates = [
    data.ErrorMessage,
    data.Error,
    data.error,
    data.message,
    data.Messaggio,
    data.messaggio,
  ].filter(Boolean);

  const errorCode = data.ErrorCode ?? data.errorCode ?? data.Code ?? data.code;
  if (errorCode !== undefined && errorCode !== null && String(errorCode) !== '0') {
    return candidates[0] || `Errore API Gloobobiz, codice ${errorCode}`;
  }

  if (data.ok === false || data.success === false || data.Success === false) {
    return candidates[0] || 'Errore API Gloobobiz.';
  }

  return null;
}

async function apiPost(payload, timeout = 15000) {
  const body = {
    ...payload,
    api_key: requireApiKey(),
  };

  const response = await axios.post(config.BASE_URL, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout,
  });

  const apiError = extractApiError(response.data);
  if (apiError) throw new Error(apiError);

  return response.data;
}

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
    ListId1: [Number(config.IVR_NOTTURNO)],
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

function getOperatore(nomeOperatore) {
  const operatoriMap = getOperatoriMap();
  const op = operatoriMap[nomeOperatore];

  if (!op) throw new Error(`Operatore non configurato: ${nomeOperatore}`);
  if (!op.idVoip) throw new Error(`ID VoIP mancante per l'operatore ${nomeOperatore}`);
  if (!op.idMobile) throw new Error(`ID Mobile/NPR mancante per l'operatore ${nomeOperatore}`);

  return {
    ...op,
    idVoip: Number(op.idVoip),
    idMobile: Number(op.idMobile),
  };
}

function creaDestinazioniOperatore(nomeOperatore) {
  const op = getOperatore(nomeOperatore);

  if (!Number.isFinite(op.idVoip)) throw new Error(`ID VoIP non numerico per l'operatore ${nomeOperatore}: ${op.idVoip}`);
  if (!Number.isFinite(op.idMobile)) throw new Error(`ID Mobile/NPR non numerico per l'operatore ${nomeOperatore}: ${op.idMobile}`);

  return {
    Destination1: {
      DestinationType1: 'ACV',
      ListId1: [op.idVoip],
      DestinationType2: '',
      ListId2: [],
      DestinationType3: '',
      ListId3: [],
      TimeOut: config.CALL_SETTINGS.TimeOutVoip,
    },
    Destination2: {
      DestinationType1: 'NPR',
      ListId1: [op.idMobile],
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

function validateWeekday(giornoSettimana) {
  if (!Number.isInteger(giornoSettimana) || giornoSettimana < 1 || giornoSettimana > 7) {
    throw new Error(`DayList Gloobobiz non valido: ${giornoSettimana}. Deve essere 1..7 (1 lunedì, 7 domenica).`);
  }
}

function buildRules(opDiurno, opSerale) {
  return [
    {
      nome: '00:00-09:00 IVR',
      fascia: config.FASCE.NOTTE_1,
      destinazioni: {
        Destination1: creaDestinazioneIVR(),
        Destination2: creaDestinazioneVuota(),
        Destination3: creaDestinazioneVuota(),
        Destination4: creaDestinazioneVuota(),
      },
    },
    {
      nome: '09:00-18:00 Operatore diurno',
      fascia: config.FASCE.DIURNA,
      destinazioni: creaDestinazioniOperatore(opDiurno),
    },
    {
      nome: '18:00-22:00 Reperibilità serale',
      fascia: config.FASCE.SERALE,
      destinazioni: creaDestinazioniOperatore(opSerale),
    },
    {
      nome: '22:00-23:59 IVR',
      fascia: config.FASCE.NOTTE_2,
      destinazioni: {
        Destination1: creaDestinazioneIVR(),
        Destination2: creaDestinazioneVuota(),
        Destination3: creaDestinazioneVuota(),
        Destination4: creaDestinazioneVuota(),
      },
    },
  ];
}

function toHourPayload(fascia) {
  return {
    StartHour: fascia.startHour,
    StartMinute: fascia.startMinute,
    EndHour: fascia.endHour,
    EndMinute: fascia.endMinute,
  };
}

async function addSchedulingRule(giornoSettimana, rule) {
  const payload = {
    op: config.OP_ADD_SCHEDULING,
    IdVirtualNumber: config.ID_VIRTUAL_NUMBER,
    CallAcceptanceRequest: config.CALL_SETTINGS.CallAcceptanceRequest,
    WaitingMusic: config.CALL_SETTINGS.WaitingMusic,
    CallOriginationMessage: config.CALL_SETTINGS.CallOriginationMessage,
    ...rule.destinazioni,
    Scheduling: {
      DayList: [giornoSettimana],
      HourList: [toHourPayload(rule.fascia)],
    },
  };

  const response = await apiPost(payload, 15000);
  return { nome: rule.nome, payload, response };
}

async function impostaGiornoSettimanale(giornoSettimana, opDiurno, opSerale, options = {}) {
  validateWeekday(giornoSettimana);

  const envVerify = String(process.env.VERIFY_AFTER_WRITE || 'true').toLowerCase() !== 'false';
  const verifyAfterWrite = options.verifyAfterWrite !== false && config.VERIFY_AFTER_WRITE !== false && envVerify;
  const rules = buildRules(opDiurno, opSerale);
  const responses = [];

  for (const rule of rules) {
    responses.push(await addSchedulingRule(giornoSettimana, rule));
  }

  let verifica = null;
  if (verifyAfterWrite) {
    verifica = await verificaPianoGiorno(giornoSettimana, opDiurno, opSerale);
    if (!verifica.ok) {
      const detail = verifica.errori && verifica.errori.length ? ` Dettagli: ${verifica.errori.join(' | ')}` : '';
      throw new Error(`Scrittura effettuata, ma verifica post-scrittura non riuscita.${detail}`);
    }
  }

  return { ok: true, responses, verifica };
}

// Alias mantenuto per compatibilità con eventuali import vecchi.
const impostaGiornoMensile = impostaGiornoSettimanale;

async function getIncomingNumber() {
  return apiPost({
    op: 'WM_GetListIncomingNumber',
    IdVirtualNumber: config.ID_VIRTUAL_NUMBER,
  }, 10000);
}

async function getVoipAccounts({ isOnline = false } = {}) {
  return apiPost({
    op: 'WM_GetListVoipAccount',
    IsOnLine: Boolean(isOnline),
  }, 10000);
}

async function getPersonalNumbers() {
  const op = config.PERSONAL_NUMBERS_LIST_OP || 'WM_GetListPersonalNumber';
  const data = await apiPost({
    op,
    // Usiamo false per mostrare anche eventuali numeri inseriti ma non
    // confermati: se un ID configurato risulta non confermato, la verifica lo
    // segnala come problema operativo.
    OnlyConfirmed: false,
  }, 10000);
  return { ok: true, op, data };
}

async function getIVRs() {
  const op = config.IVR_LIST_OP || 'WM_GetListIVR';
  const data = await apiPost({ op }, 10000);
  return { ok: true, op, data };
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (!data) return [];
  if (Array.isArray(data.Items)) return data.Items;
  if (Array.isArray(data.List)) return data.List;
  if (Array.isArray(data.Result)) return data.Result;
  if (Array.isArray(data.Data)) return data.Data;
  return [data];
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeListIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map(num).filter(v => v !== null).sort((a, b) => a - b);
}

function sameIds(a, b) {
  const aa = normalizeListIds(a);
  const bb = normalizeListIds(b);
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function sameHour(a = {}, b = {}) {
  return Number(a.StartHour) === Number(b.StartHour)
    && Number(a.StartMinute) === Number(b.StartMinute)
    && Number(a.EndHour) === Number(b.EndHour)
    && Number(a.EndMinute) === Number(b.EndMinute);
}

function destinationMatches(actual = {}, expected = {}) {
  return String(actual.DestinationType1 || '') === String(expected.DestinationType1 || '')
    && sameIds(actual.ListId1, expected.ListId1)
    && String(actual.DestinationType2 || '') === String(expected.DestinationType2 || '')
    && sameIds(actual.ListId2, expected.ListId2)
    && String(actual.DestinationType3 || '') === String(expected.DestinationType3 || '')
    && sameIds(actual.ListId3, expected.ListId3);
}

function getSchedulingArray(incomingData) {
  const first = Array.isArray(incomingData) ? incomingData[0] : incomingData;
  if (!first) return [];
  if (Array.isArray(first.Scheduling)) return first.Scheduling;
  if (Array.isArray(first.scheduling)) return first.scheduling;
  if (Array.isArray(incomingData?.Scheduling)) return incomingData.Scheduling;
  return [];
}

async function verificaPianoGiorno(giornoSettimana, opDiurno, opSerale) {
  validateWeekday(giornoSettimana);

  const incoming = await getIncomingNumber();
  const scheduling = getSchedulingArray(incoming);
  const rules = buildRules(opDiurno, opSerale);
  const errori = [];
  const dettagli = [];

  if (!Array.isArray(scheduling) || scheduling.length === 0) {
    return {
      ok: false,
      errori: ['La risposta di WM_GetListIncomingNumber non contiene Scheduling.'],
      dettagli: [],
    };
  }

  for (const rule of rules) {
    const expectedHour = toHourPayload(rule.fascia);
    const candidates = scheduling.filter(item => Number(item.Day) === giornoSettimana && sameHour(item.Hour || {}, expectedHour));

    if (candidates.length === 0) {
      errori.push(`Manca fascia ${rule.nome} per giorno settimana ${giornoSettimana}.`);
      dettagli.push({ nome: rule.nome, ok: false, motivo: 'fascia non trovata' });
      continue;
    }

    const match = candidates.find(item => {
      const destination1Ok = destinationMatches(item.Destination1 || {}, rule.destinazioni.Destination1 || {});

      // Gloobobiz può valorizzare fallback di servizio sulle destinazioni vuote
      // (es. segreteria). Per le fasce IVR/notturne verifichiamo quindi solo
      // Destination1, che è la destinazione operativa effettiva. Per le fasce
      // operatore, Destination2 è invece rilevante perché contiene l'NPR/mobile.
      const expectedDestination2 = rule.destinazioni.Destination2 || {};
      const shouldCheckDestination2 = Boolean(expectedDestination2.DestinationType1);
      const destination2Ok = shouldCheckDestination2
        ? destinationMatches(item.Destination2 || {}, expectedDestination2)
        : true;

      return destination1Ok && destination2Ok;
    });

    if (!match) {
      errori.push(`Destinazioni non coerenti per fascia ${rule.nome}.`);
      dettagli.push({ nome: rule.nome, ok: false, motivo: 'destinazioni non coerenti', trovate: candidates });
      continue;
    }

    dettagli.push({ nome: rule.nome, ok: true });
  }

  return { ok: errori.length === 0, errori, dettagli };
}

function getVoipId(item = {}) {
  return num(item.IdVoIPAccount ?? item.IdVoipAccount ?? item.IdVOIPAccount ?? item.IdVoip ?? item.Id);
}

function getVoipUsername(item = {}) {
  return String(item.UserName ?? item.Username ?? item.userName ?? item.username ?? '').trim();
}

function getPersonalId(item = {}) {
  return num(item.IdPersonalNumber ?? item.IdNumber ?? item.IdNumeroPersonale ?? item.ID ?? item.Id ?? item.id);
}

function getPersonalLabel(item = {}) {
  const cli = String(item.Cli ?? item.CLI ?? item.Number ?? item.PhoneNumber ?? item.MobileNumber ?? item.DDI ?? item.Phone ?? '').trim();
  const country = String(item.CountryName ?? item.Country ?? '').trim();
  const confirmed = item.Confirmed === undefined || item.Confirmed === null ? '' : `confermato: ${Boolean(item.Confirmed) ? 'sì' : 'no'}`;
  return [cli, country, confirmed].filter(Boolean).join(' · ');
}

function getIVRId(item = {}) {
  return num(item.IdIVR ?? item.IdIvr ?? item.Idivr ?? item.ID ?? item.Id ?? item.id);
}

function getIVRLabel(item = {}) {
  const name = String(item.Name ?? item.Description ?? '').trim();
  const plays = item.NumberOfFilePlays === undefined || item.NumberOfFilePlays === null ? '' : `riproduzioni: ${item.NumberOfFilePlays}`;
  return [name, plays].filter(Boolean).join(' · ');
}

async function verificaConfigurazioneOperatori() {
  const operatori = listOperatori();
  const result = {
    ok: true,
    voip: { ok: true, righe: [] },
    numeriPersonali: { ok: true, op: null, righe: [], avviso: null },
    ivr: { ok: true, op: null, righe: [], avviso: null },
  };

  const voipRaw = await getVoipAccounts({ isOnline: false });
  const voipAccounts = asArray(voipRaw);

  for (const op of operatori) {
    const expectedId = num(op.idVoip);
    const byUsername = voipAccounts.find(item => getVoipUsername(item).toLowerCase() === String(op.username || '').toLowerCase());
    const byId = voipAccounts.find(item => getVoipId(item) === expectedId);
    const ok = !!byUsername && getVoipId(byUsername) === expectedId;

    result.voip.righe.push({
      nome: op.nome,
      username: op.username,
      idConfigurato: expectedId,
      idDaUsername: byUsername ? getVoipId(byUsername) : null,
      usernameDaId: byId ? getVoipUsername(byId) : null,
      online: byUsername ? Boolean(byUsername.IsOnLine) : null,
      ok,
      errore: ok ? null : (!byUsername ? 'username non trovato' : 'ID VoIP non corrisponde allo username'),
    });
  }

  result.voip.ok = result.voip.righe.every(r => r.ok);
  if (!result.voip.ok) result.ok = false;

  let personal;
  try {
    personal = await getPersonalNumbers();
  } catch (err) {
    result.numeriPersonali.ok = false;
    result.numeriPersonali.op = config.PERSONAL_NUMBERS_LIST_OP || 'WM_GetListPersonalNumber';
    result.numeriPersonali.avviso = `Lista numeri personali non verificata: ${err.message}`;
    result.ok = false;
    personal = { data: [] };
  }

  result.numeriPersonali.op = personal.op || result.numeriPersonali.op;

  const personalNumbers = asArray(personal.data);
  for (const op of operatori) {
    const expectedId = num(op.idMobile);
    const byId = personalNumbers.find(item => getPersonalId(item) === expectedId);
    const confirmed = byId ? Boolean(byId.Confirmed) : null;
    const ok = !!byId && confirmed !== false;

    result.numeriPersonali.righe.push({
      nome: op.nome,
      idConfigurato: expectedId,
      trovato: ok,
      descrizione: byId ? getPersonalLabel(byId) : '',
      ok,
      errore: ok ? null : (!byId ? 'ID Mobile/NPR non trovato nella lista numeri personali' : 'Numero personale trovato ma non confermato'),
    });
  }

  result.numeriPersonali.ok = result.numeriPersonali.righe.every(r => r.ok);
  if (!result.numeriPersonali.ok) result.ok = false;

  let ivr;
  try {
    ivr = await getIVRs();
    result.ivr.op = ivr.op;
    const ivrs = asArray(ivr.data);
    const expectedIVR = Number(config.IVR_NOTTURNO);
    const byId = ivrs.find(item => getIVRId(item) === expectedIVR);
    const ok = !!byId;
    result.ivr.righe.push({
      nome: 'IVR notturno',
      idConfigurato: expectedIVR,
      trovato: ok,
      descrizione: byId ? getIVRLabel(byId) : '',
      ok,
      errore: ok ? null : 'ID IVR notturno non trovato nella lista IVR',
    });
    result.ivr.ok = ok;
    if (!ok) result.ok = false;
  } catch (err) {
    result.ivr.ok = false;
    result.ivr.op = config.IVR_LIST_OP || 'WM_GetListIVR';
    result.ivr.avviso = `Lista IVR non verificata: ${err.message}`;
    result.ok = false;
  }

  return result;
}

async function testConnessione() {
  try {
    const incoming = await getIncomingNumber();
    const items = asArray(incoming);
    const first = items[0] || {};
    const schedulingCount = Array.isArray(first.Scheduling) ? first.Scheduling.length : 0;

    return {
      ok: true,
      messaggio: `Connessione OK — numero virtuale ${first.DDI || config.ID_VIRTUAL_NUMBER} raggiunto. Regole Scheduling lette: ${schedulingCount}.`,
      numeroVirtuale: {
        id: first.IdVirtualNumber || config.ID_VIRTUAL_NUMBER,
        ddi: first.DDI || null,
        schedulingCount,
      },
    };
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message || 'Errore sconosciuto';
    return { ok: false, messaggio: `Errore connessione: ${errMsg}` };
  }
}

module.exports = {
  impostaGiornoSettimanale,
  impostaGiornoMensile,
  testConnessione,
  getIncomingNumber,
  getVoipAccounts,
  getPersonalNumbers,
  getIVRs,
  verificaPianoGiorno,
  verificaConfigurazioneOperatori,
};
