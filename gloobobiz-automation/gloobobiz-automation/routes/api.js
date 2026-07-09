const express = require('express');
const router = express.Router();

const { configuraOggi, configuraGiorno, configuraSettimanaDaMese } = require('../modules/scheduler');
const { leggiStorico } = require('../modules/logger');
const { leggiSettings, salvaSettings, listOperatori, normalizeOperatoriMap } = require('../modules/settingsStore');
const { testConnessione, verificaConfigurazioneOperatori } = require('../modules/gloobobizApi');
const { getCurrentMonth, getMonthRows, listMonths, resetMonthRows, saveMonthRows } = require('../modules/scheduleStore');
const config = require('../config/api.config');

router.get('/status', (req, res) => {
  const settings = leggiSettings();
  const currentMonth = getCurrentMonth();
  let erroreExcel = null;

  try {
    getMonthRows(currentMonth);
  } catch (err) {
    erroreExcel = err.message;
  }

  res.json({
    ok: true,
    excelCaricato: !!settings.excelFilePath,
    mesiDisponibili: listMonths(),
    erroreExcel,
    currentMonth,
    ultimoUpload: settings.ultimoUpload,
  });
});

router.post('/run-month', async (req, res) => {
  const mese = req.body?.mese || getCurrentMonth();

  try {
    const risultato = await configuraSettimanaDaMese(mese);
    res.json(risultato);
  } catch (err) {
    res.status(500).json({ ok: false, errore: err.message });
  }
});

router.post('/run-today', async (req, res) => {
  try {
    const risultato = await configuraOggi();
    res.json(risultato);
  } catch (err) {
    res.status(500).json({ ok: false, errore: err.message });
  }
});

router.post('/run-day', async (req, res) => {
  try {
    const dataISO = req.body?.data;
    const risultato = await configuraGiorno(dataISO);
    res.json(risultato);
  } catch (err) {
    res.status(500).json({ ok: false, errore: err.message });
  }
});

router.get('/schedule', (req, res) => {
  const currentMonth = getCurrentMonth();
  const month = req.query.month || currentMonth;

  try {
    const { rows, errori } = getMonthRows(month);
    res.json({
      ok: true,
      month,
      currentMonth,
      months: listMonths(),
      rows,
      errori,
      operatorNames: listOperatori().map(op => op.nome),
    });
  } catch (err) {
    res.status(500).json({ ok: false, errore: err.message });
  }
});

router.post('/schedule/save', (req, res) => {
  try {
    const month = req.body?.month || getCurrentMonth();
    const saved = saveMonthRows(month, req.body?.rows || []);
    res.json({ ok: true, messaggio: `Pianificazione del mese ${month} salvata.`, ...saved, month });
  } catch (err) {
    res.status(400).json({ ok: false, errore: err.message });
  }
});

router.post('/schedule/reset-month', (req, res) => {
  try {
    const month = req.body?.month || getCurrentMonth();
    const result = resetMonthRows(month);
    res.json({ ok: true, messaggio: `Override manuali rimossi per ${month}.`, ...result, month });
  } catch (err) {
    res.status(400).json({ ok: false, errore: err.message });
  }
});

router.get('/settings', (req, res) => {
  const settings = leggiSettings();
  res.json({
    ok: true,
    settings,
    operatori: listOperatori(settings),
    virtualNumber: { id: config.ID_VIRTUAL_NUMBER, ddi: '+390550622913' },
    ivr: config.IVR_NOTTURNO,
  });
});

router.post('/settings/operators', (req, res) => {
  try {
    const rows = Array.isArray(req.body?.operatori) ? req.body.operatori : [];
    if (rows.length === 0) throw new Error('Inserisci almeno un operatore.');

    const operatoriMap = {};
    for (const row of rows) {
      const nome = String(row?.nome || '').trim();
      if (!nome) throw new Error('Ogni operatore deve avere un nome.');
      if (operatoriMap[nome]) throw new Error(`Nome duplicato: ${nome}`);
      if (row?.idVoip && !/^\d+$/.test(String(row.idVoip).trim())) throw new Error(`ID VoIP non numerico per ${nome}.`);
      if (row?.idMobile && !/^\d+$/.test(String(row.idMobile).trim())) throw new Error(`ID Mobile/NPR non numerico per ${nome}.`);

      operatoriMap[nome] = {
        username: String(row?.username || '').trim(),
        idVoip: String(row?.idVoip || '').trim(),
        idMobile: String(row?.idMobile || '').trim(),
        aliases: String(row?.aliases || '')
          .split(',')
          .map(v => v.trim())
          .filter(Boolean),
      };
    }

    const updated = salvaSettings({ operatoriMap: normalizeOperatoriMap(operatoriMap) });
    res.json({ ok: true, messaggio: 'Operatori aggiornati con successo.', operatori: listOperatori(updated) });
  } catch (err) {
    res.status(400).json({ ok: false, errore: err.message });
  }
});

router.get('/history', (req, res) => res.json({ ok: true, storico: leggiStorico() }));
router.post('/test-api', async (req, res) => res.json(await testConnessione()));
router.post('/verify-ids', async (req, res) => {
  try {
    const verifica = await verificaConfigurazioneOperatori();
    res.json({ ok: true, verifica });
  } catch (err) {
    res.status(500).json({ ok: false, errore: err.message });
  }
});

module.exports = router;
