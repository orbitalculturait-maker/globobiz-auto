# Gloobobiz Automation — Turni Reperibilità

Web app per automatizzare la configurazione giornaliera dei piani di inoltro/deviazione chiamate su Gloobobiz, basata su un file Excel con i turni di reperibilità.

## 🚀 Avvio rapido (locale)

```bash
npm install
npm start
# Apri http://localhost:3000
```

## 📁 Struttura progetto

```
├── config/api.config.js     ← ⚙️ UNICO file da modificare per API
├── modules/
│   ├── excelParser.js       ← Parsing file Excel
│   ├── gloobobizApi.js      ← Client API Gloobobiz
│   ├── scheduler.js         ← Cron job 00:01 giornaliero
│   ├── settingsStore.js     ← Persistenza impostazioni
│   └── logger.js            ← Storico operazioni
├── routes/
│   ├── api.js               ← Endpoint REST backend
│   └── upload.js            ← Upload file Excel
├── public/                  ← Frontend (HTML + CSS + JS)
├── data/                    ← File generati a runtime (gitignored)
├── .env                     ← API key (NON committare)
└── server.js                ← Entry point Express
```

## ⚙️ Configurazione

Crea un file `.env` nella root:
```
GLOOBOBIZ_API_KEY=4AB9556C-9456-4E0D-94DF-00D219EE6C35
PORT=3000
TZ=Europe/Rome
```

## 🌐 Deploy su Railway / Render

1. Crea account su [railway.app](https://railway.app) o [render.com](https://render.com)
2. Collega il repository GitHub
3. Aggiungi la variabile d'ambiente `GLOOBOBIZ_API_KEY`
4. Deploy automatico

## 📊 File Excel atteso

| Colonna | Contenuto |
|---|---|
| A | Data (DD/MM/YYYY) |
| B | Giorno della settimana |
| C | Operatore fascia 9-18 |
| D | Operatore reperibilità 18-22 |

Nomi accettati: `Alessandro`, `Gianandrea`, `Leonardo`, `Ale`, `ale`, `leonardo`
