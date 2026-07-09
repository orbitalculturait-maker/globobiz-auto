/**
 * =====================================================================
 * server.js
 * =====================================================================
 * Avvio Express e cron opzionale per applicare ogni giorno il turno della
 * data corrente al piano settimanale Gloobobiz.
 * =====================================================================
 */
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');

const apiRoutes    = require('./routes/api');
const uploadRoutes = require('./routes/upload');
const { configuraOggi } = require('./modules/scheduler');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);
app.use('/api/upload', uploadRoutes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Gloobobiz Automation avviato su porta ${PORT}`);
  console.log(`   Modalità: Calendario mensile con applicazione giornaliera su piano settimanale Gloobobiz`);
  if (!process.env.GLOOBOBIZ_API_KEY) {
    console.warn('⚠️  ATTENZIONE: GLOOBOBIZ_API_KEY non trovata nel file .env!');
  }
});

if (String(process.env.AUTO_APPLY_DAILY || '').toLowerCase() === 'true') {
  cron.schedule('5 0 * * *', async () => {
    try {
      const result = await configuraOggi();
      console.log(`[CRON] ${result.messaggio}`);
    } catch (err) {
      console.error(`[CRON] Errore applicazione turno odierno: ${err.message}`);
    }
  }, { timezone: 'Europe/Rome' });

  console.log('   Cron attivo: applicazione turno odierno ogni giorno alle 00:05 Europe/Rome');
}

module.exports = app;
