/**
 * =====================================================================
 * routes/upload.js — Upload Excel/CSV
 * =====================================================================
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { leggiSettings, salvaSettings } = require('../modules/settingsStore');
const { parseExcel } = require('../modules/excelParser');
const { listMonths } = require('../modules/scheduleStore');

const uploadDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, 'turni' + path.extname(file.originalname).toLowerCase()),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Formato non supportato. Usa .xlsx, .xls o .csv'));
  },
});

router.post('/upload', upload.single('excel'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, errore: 'Nessun file ricevuto' });

  try {
    const settings = leggiSettings();
    const parsed = parseExcel(req.file.path, { operatoriMap: settings.operatoriMap });
    const count = Object.keys(parsed.turni).length;
    
    if (count === 0) {
      return res.status(400).json({ ok: false, errore: 'Il file non contiene dati validi. Verifica il formato.' });
    }

    salvaSettings({
      excelFilePath: req.file.path,
      ultimoUpload: new Date().toISOString(),
    });

    const mesiDisponibili = listMonths();

    res.json({
      ok: true,
      messaggio: `File caricato con successo (${count} giorni letti).`,
      warningCount: parsed.errori.length,
      warnings: parsed.errori.slice(0, 20),
      mesiDisponibili,
    });
  } catch (err) {
    res.status(500).json({ ok: false, errore: err.message });
  }
});

module.exports = router;
