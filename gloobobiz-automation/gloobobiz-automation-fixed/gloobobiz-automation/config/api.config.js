/**
 * =====================================================================
 * config/api.config.js
 * =====================================================================
 * Configurazione API Gloobobiz aggiornata per pianificazione mensile.
 * =====================================================================
 */

module.exports = {
  BASE_URL: 'https://www.gloobobiz.com/it/WebService/CallApi',
  ID_VIRTUAL_NUMBER: 15526,

  // Operatori: Primo inoltro (ACV) e Secondo inoltro (NPR)
  OPERATORI: {
    'Alessandro': { 
      idVoip: 18544, 
      idMobile: 39235, 
      username: 'alessandro.botticelli' 
    },
    'Gianandrea': { 
      idVoip: 18543, 
      idMobile: 35597, 
      username: 'gianandrea.pieraccini' 
    },
    'Leonardo':   { 
      idVoip: 18545, 
      idMobile: 39236, 
      username: 'leonardo.becchi'       
    },
  },

  // ID IVR per fasce notturne (Orbital Cultura)
  IVR_NOTTURNO: 4383,

  // Fasce orarie della giornata come da screenshot
  FASCE: {
    NOTTE_1: { startHour: 0,  startMinute: 0, endHour: 9,  endMinute: 0 },
    DIURNA:  { startHour: 9,  startMinute: 0, endHour: 18, endMinute: 0 },
    SERALE:  { startHour: 18, startMinute: 0, endHour: 22, endMinute: 0 },
    NOTTE_2: { startHour: 22, startMinute: 0, endHour: 23, endMinute: 59 },
  },

  CALL_SETTINGS: {
    CallAcceptanceRequest: false,
    WaitingMusic:          false,
    CallOriginationMessage: false,
    TimeOutVoip:           100, // 100 secondi
    TimeOutMobile:         60,  // 60 secondi
  },

  OP_ADD_SCHEDULING: 'WM_AddNumberScheduling',
};
