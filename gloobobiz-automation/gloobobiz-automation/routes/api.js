const express = require('express');
const router  = express.Router();

const { parseExcel }          = require('../modules/excelParser');
const { testConnessione }     = require('../modules/gloobobizApi');
const { configuraMeseCompleto } = require('../modules/scheduler');
const { leggiStorico }        = require('../modules/logger');
const { leggiSettings }       = require('../modules/settingsStore');
const config                  = require('../config/api.config');

router.get('/status', (req, res) => {
  const settings = leggiSettings();
  let mesiDisponibili = [];
  let erroreExcel = null;

  if (settings.excelFilePath) {
    try {
      const { turni } = parseExcel(settings.excelFilePath);
      const mesiSet = new Set();
      Object.keys(turni).forEach(dataIso => mesiSet.add(dataIso.substring(0, 7)));
      mesiDisponibili = Array.from(mesiSet).sort();
    } catch (err) {
      erroreExcel = err.message;
    }
  }

  res.json({ ok: true, excelCaricato: !!settings.excelFilePath, mesiDisponibili, erroreExcel });
});

router.post('/run-month', async (req, res) => {
  const { mese } = req.body;
  if (!mese) return res.status(400).json({ ok: false, errore: 'Mese non specificato' });
  try {
    const risultato = await configuraMeseCompleto(mese);
    res.json(risultato);
  } catch (err) {
    res.status(500).json({ ok: false, errore: err.message });
  }
});

router.get('/schedule', (req, res) => {
  const settings = leggiSettings();
  if (!settings.excelFilePath) return res.json({ ok: false, turni: {} });
  try {
    const { turni, errori } = parseExcel(settings.excelFilePath);
    res.json({ ok: true, turni, errori });
  } catch (err) {
    res.status(500).json({ ok: false, errore: err.message });
  }
});

router.get('/settings', (req, res) => {
  const settings = leggiSettings();
  const operatori = Object.values(config.OPERATORI).map(op => ({
    nome: Object.keys(config.OPERATORI).find(key => config.OPERATORI[key] === op),
    username: op.username,
    idVoip: op.idVoip,
    idMobile: op.idMobile
  }));
  res.json({ 
    ok: true, 
    settings, 
    operatori, 
    virtualNumber: { id: config.ID_VIRTUAL_NUMBER, ddi: '+390550622913' },
    ivr: config.IVR_NOTTURNO
  });
});

router.get('/history', (req, res) => res.json({ ok: true, storico: leggiStorico() }));

router.post('/test-api', async (req, res) => res.json(await testConnessione()));

module.exports = router;
