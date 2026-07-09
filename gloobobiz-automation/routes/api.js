/**
 * =====================================================================
 * routes/api.js
 * =====================================================================
 */
const express = require('express');
const router  = express.Router();
const path    = require('path');

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
      // Raccoglie tutti i mesi unici presenti nel file (es. "2026-07", "2026-08")
      const mesiSet = new Set();
      Object.keys(turni).forEach(dataIso => {
        mesiSet.add(dataIso.substring(0, 7)); // "YYYY-MM"
      });
      mesiDisponibili = Array.from(mesiSet).sort();
    } catch (err) {
      erroreExcel = err.message;
    }
  }

  res.json({
    ok: true,
    excelCaricato: !!settings.excelFilePath,
    mesiDisponibili,
    erroreExcel
  });
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

// Le altre rotte rimangono simili, per brevità ometto modifiche drastiche
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
  res.json({ ok: true, settings });
});

router.get('/history', (req, res) => res.json({ ok: true, storico: leggiStorico() }));

router.post('/test-api', async (req, res) => res.json(await testConnessione()));

module.exports = router;
