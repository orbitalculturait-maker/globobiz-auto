/**
 * =====================================================================
 * server.js
 * =====================================================================
 * Modificato per disattivare l'avvio del cron.
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
  console.log(`   Modalità: Inserimento Mensile Manuale`);
  if (!process.env.GLOOBOBIZ_API_KEY) {
    console.warn('⚠️  ATTENZIONE: GLOOBOBIZ_API_KEY non trovata nel file .env!');
  }
});

module.exports = app;
