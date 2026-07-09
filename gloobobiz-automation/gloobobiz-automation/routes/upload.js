/**
 * =====================================================================
 * routes/upload.js
 * =====================================================================
 * Gestisce l'upload del file Excel tramite multer.
 * Il file viene salvato nella cartella /data con un nome fisso
 * (sovrascrive il precedente) e il percorso viene salvato nelle settings.
 * =====================================================================
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const { parseExcel }          = require('../modules/excelParser');
const { salvaSettings }       = require('../modules/settingsStore');

// Cartella di destinazione per i file caricati
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');

// Configurazione multer: salva su disco con nome fisso
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Crea la cartella se non esiste
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Salva sempre con lo stesso nome (sovrascrive il precedente)
    // Aggiunge il timestamp nel nome per versioning leggibile
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const nomeFile  = `turni_${timestamp}.xlsx`;
    cb(null, nomeFile);
  },
});

// Filtro: accetta solo file .xlsx o .xls
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') {
    cb(null, true);
  } else {
    cb(new Error('Solo file Excel (.xlsx, .xls) sono accettati.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10 MB
});

// -----------------------------------------------------------------------
// POST /api/upload
// Carica un nuovo file Excel, lo valida e aggiorna le impostazioni
// -----------------------------------------------------------------------
router.post('/', upload.single('excel'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, errore: 'Nessun file ricevuto o formato non valido.' });
  }

  const filePath = req.file.path;

  // Parsing immediato per validare il file e raccogliere eventuali errori
  let turni, errori;
  try {
    const risultato = parseExcel(filePath);
    turni  = risultato.turni;
    errori = risultato.errori;
  } catch (err) {
    // File non leggibile: rimuovilo e restituisci errore
    fs.unlinkSync(filePath);
    return res.status(422).json({
      ok:    false,
      errore: `File Excel non valido: ${err.message}`,
    });
  }

  // Salva il percorso del file nelle impostazioni
  salvaSettings({
    excelFilePath: filePath,
    ultimoUpload:  new Date().toISOString(),
  });

  const totaleGiorni = Object.keys(turni).length;
  const haErrori     = errori.length > 0;

  res.json({
    ok:          true,
    messaggio:   haErrori
      ? `File caricato con ${errori.length} avvisi — controlla i dettagli`
      : `File caricato con successo — ${totaleGiorni} giorni trovati`,
    totaleGiorni,
    errori,           // array di warning (celle vuote per date future)
    nomeFile:    req.file.filename,
  });
});

module.exports = router;
