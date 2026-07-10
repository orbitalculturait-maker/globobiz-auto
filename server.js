/**
 * =====================================================================
 * server.js
 * =====================================================================
 * Avvio Express per programmazione mensile Gloobobiz.
 * Non esegue più automazioni giornaliere: l'app genera e invia il piano
 * mensile completo solo quando l'utente clicca "Invia mese a Gloobobiz".
 * =====================================================================
 */
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const apiRoutes    = require('./routes/api');
const uploadRoutes = require('./routes/upload');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);
app.use('/api/upload', uploadRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Gloobobiz Automation avviato su porta ${PORT}`);
  console.log('   Modalità: programmazione mensile completa Gloobobiz');
  if (!process.env.GLOOBOBIZ_API_KEY) {
    console.warn('⚠️  GLOOBOBIZ_API_KEY non trovata: letture/scritture API non funzioneranno.');
  }
  if (String(process.env.ALLOW_GLOOBOBIZ_WRITES || '').toLowerCase() !== 'true') {
    console.warn('🛡️  SAFE MODE: scritture WM_AddNumberScheduling bloccate. Imposta ALLOW_GLOOBOBIZ_WRITES=true solo quando sei pronto.');
  }
});

module.exports = app;
