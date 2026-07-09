# Gloobobiz Automation — Turni Reperibilità

Web app per usare un file Excel/CSV come calendario operativo dei reperibili e applicare automaticamente il turno corretto al piano di inoltro chiamate Gloobobiz.

## Logica corretta con API Gloobobiz

La documentazione Gloobobiz indica che `WM_AddNumberScheduling` usa `DayList` come giorno della settimana:

- `1` = lunedì
- `2` = martedì
- `3` = mercoledì
- `4` = giovedì
- `5` = venerdì
- `6` = sabato
- `7` = domenica

Quindi l'app **non invia il giorno del mese**. Il file mensile resta il calendario umano; quando applichi una data, l'app converte quella data nel giorno settimana Gloobobiz.

Esempio: `2026-07-10` è venerdì, quindi viene inviato come `DayList: [5]`.

La modalità operativa sicura è:

1. carichi il calendario mensile;
2. correggi/salvi eventuali righe dal tab **Piano Turni**;
3. ogni giorno l'app prende il turno della data corrente;
4. lo applica al giorno settimana corrispondente su Gloobobiz;
5. rilegge `WM_GetListIncomingNumber` e verifica che le quattro fasce siano state salvate.

Questa logica è compatibile con un piano Gloobobiz settimanale ricorrente, evitando di usare `DayList` come giorno del mese.

## Cosa viene scritto su Gloobobiz

Per ogni data applicata vengono scritte quattro fasce sul giorno settimana corrispondente:

| Fascia | Destinazione |
|---|---|
| 00:00 - 09:00 | IVR notturno |
| 09:00 - 18:00 | Operatore diurno, default Leonardo |
| 18:00 - 22:00 | Reperibile serale da file/tabella |
| 22:00 - 23:59 | IVR notturno |

Per gli operatori la web app imposta:

- `Destination1` = `ACV`, cioè Account VoIP;
- `Destination2` = `NPR`, cioè Numero Personale/Mobile;
- `Destination3` e `Destination4` vuote.

## Verifiche aggiunte

Questa versione include:

- blocco dei valori `DayList` fuori da `1..7`;
- default Leonardo sulla fascia `9:00 - 18:00` anche se il file o l'override lasciano il campo vuoto;
- verifica post-scrittura tramite `WM_GetListIncomingNumber`;
- pulsante **Verifica ID operatori** per confrontare gli ID configurati con le API Gloobobiz;
- migliore contrasto dei menu a tendina;
- bottone per applicare una data specifica, utile per test controllati.

## Avvio rapido locale

```bash
npm install
cp .env.example .env
npm start
# Apri http://localhost:3000
```

Nel file `.env` imposta almeno:

```env
GLOOBOBIZ_API_KEY=INSERISCI_LA_TUA_API_KEY
PORT=3000
TZ=Europe/Rome
AUTO_APPLY_DAILY=false
VERIFY_AFTER_WRITE=true
```

Per attivare l'applicazione automatica ogni giorno alle 00:05 ora italiana:

```env
AUTO_APPLY_DAILY=true
```

## File Excel/CSV atteso

| Colonna | Contenuto |
|---|---|
| A | Data, es. `01/06/2026` |
| B | Giorno della settimana |
| C | Operatore fascia `9-18` |
| D | Operatore reperibilità `18-22` |

Il parser riconosce anche intestazioni come `Orario lavorativo 9-18` e `Reperibilità 18-22`.

Nomi/alias predefiniti: `Alessandro`, `Gianandrea`, `Leonardo`, `Ale`, `ale`, `leo`, `leonardo`.

## Verifica ID

Nel tab **Impostazioni** usa:

- **Testa connessione**: verifica API key e numero virtuale configurato;
- **Verifica ID operatori e IVR**: controlla gli ID VoIP contro `WM_GetListVoipAccount`, gli ID Mobile/NPR contro `WM_GetListPersonalNumber` e l'ID IVR notturno contro `WM_GetListIVR`.

La verifica dei numeri personali usa `OnlyConfirmed: false`, così segnala anche il caso in cui l'ID esista ma il numero non sia ancora confermato.

## Struttura progetto

```text
├── config/api.config.js
├── modules/
│   ├── excelParser.js
│   ├── gloobobizApi.js
│   ├── logger.js
│   ├── scheduleStore.js
│   ├── scheduler.js
│   └── settingsStore.js
├── routes/
│   ├── api.js
│   └── upload.js
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── data/
├── .env.example
└── server.js
```

## Nota di sicurezza

Il file `.env` non è incluso nel pacchetto e non va committato. La chiave API deve restare solo nell'ambiente di esecuzione.
