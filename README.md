# Gloobobiz Automation — Programmazione mensile completa

## Punto chiave corretto

Il pannello Gloobobiz mostra due modalità distinte:

- **Aggiungi configurazione settimanale**
- **Aggiungi configurazione Mensile**

Per il caso Orbital Cultura l'app deve usare la logica **mensile**, cioè i giorni `1..31` del mese, non i giorni della settimana.

La versione precedente aveva introdotto un errore logico: convertiva le date in lunedì/domenica e quindi scriveva nel piano settimanale. Questa versione torna alla logica corretta: genera un piano mensile completo e lo invia come configurazione mensile.

## Flusso corretto

1. Carichi il file Excel/CSV del mese.
2. Controlli e correggi la tabella in **Piano Turni**.
3. Salvi il mese nell'app.
4. Verifichi ID operatori, numeri personali/NPR e IVR.
5. Generi l'anteprima del piano mensile.
6. Fai backup del piano Gloobobiz.
7. Invii il mese completo a Gloobobiz.
8. L'app rilegge `WM_GetListIncomingNumber` e prova a verificare le fasce scritte.

## Fasce generate

Per ogni giorno del mese vengono coperte queste fasce:

| Fascia | Destinazione |
|---|---|
| 00:00 - 09:00 | IVR notturno/albero |
| 09:00 - 18:00 | Operatore diurno, Leonardo di default |
| 18:00 - 22:00 | Operatore reperibilità da file |
| 22:00 - 23:59 | IVR notturno/albero |

L'invio viene raggruppato in sequenze mensili, per esempio:

- giorni 1-31, 00:00-09:00 → IVR
- giorni 1-31, 09:00-18:00 → Leonardo
- giorni con Alessandro, 18:00-22:00 → Alessandro
- giorni con Gianandrea, 18:00-22:00 → Gianandrea
- giorni 1-31, 22:00-23:59 → IVR

## Sicurezza

Per default le scritture sono bloccate:

```env
ALLOW_GLOOBOBIZ_WRITES=false
```

Quando hai fatto backup e verifiche, abilita:

```env
ALLOW_GLOOBOBIZ_WRITES=true
```

La variabile blocca solo le chiamate `WM_AddNumberScheduling`; letture, backup e verifiche restano disponibili.

## Variabili ambiente

Crea `.env`:

```env
GLOOBOBIZ_API_KEY=...
PORT=3000
TZ=Europe/Rome
ALLOW_GLOOBOBIZ_WRITES=false
VERIFY_AFTER_WRITE=true
```

## Avvio locale

```bash
npm install
npm start
```

Apri `http://localhost:3000`.

## Verifiche disponibili

- `WM_GetListVoipAccount` per verificare `IdVoIPAccount`.
- `WM_GetListPersonalNumber` per verificare `IdPersonalNumber` usato come NPR/mobile.
- `WM_GetListIVR` per verificare l'IVR notturno.
- `WM_GetListIncomingNumber` per backup e verifica del piano.

## File Excel/CSV atteso

| Colonna | Contenuto |
|---|---|
| A | Data |
| B | Giorno |
| C | Orario lavorativo 9-18 |
| D | Reperibilità 18-22 |

La fascia 9-18 usa Leonardo come default se il file non la valorizza.
