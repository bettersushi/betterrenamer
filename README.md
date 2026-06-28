# BetterRenamer

Batch rename tool per Google Drive con OAuth 2.0 e 2FA.

## Setup

### 1. Variabili d'ambiente su Netlify

Nel dashboard di Netlify, vai a **Site settings → Build & deploy → Environment** e aggiungi:

```
GOOGLE_CLIENT_ID=368176202917-k9bt652cgo9ihbbdm2f8i261j7dnj8sq.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
REDIRECT_URI=https://courageous-stroopwafel-87ddee.netlify.app/callback
```

**Inoltre**, aggiungi nella sezione "Build environment variables":

```
VITE_GOOGLE_CLIENT_ID=368176202917-k9bt652cgo9ihbbdm2f8i261j7dnj8sq.apps.googleusercontent.com
VITE_REDIRECT_URI=https://courageous-stroopwafel-87ddee.netlify.app/callback
```

### 2. Configurazione Google Cloud Console

Assicurati che i redirect URI nella Console Google includano:
- `https://courageous-stroopwafel-87ddee.netlify.app/callback`
- `http://localhost:3000/callback` (per sviluppo locale)

### 3. Deploy

Il deploy avviene automaticamente quando fai push su GitHub. Netlify Build:
- Installa le dipendenze (`npm install`)
- Compila il progetto (`npm run build`)
- Copia i file in `dist/`
- Deploy delle funzioni serverless

### 4. Test locale

```bash
npm install
npm run dev
```

L'app sarà disponibile su `http://localhost:3000`

## Struttura del progetto

```
betterrenamer/
├── src/
│   ├── pages/           # Pagine React (Login, Callback, 2FA, Dashboard)
│   ├── auth.js         # Funzioni di autenticazione OAuth
│   ├── drive.js        # API Google Drive
│   ├── App.jsx         # Routing principale
│   └── index.css       # Stili globali
├── netlify/
│   └── functions/      # Funzioni serverless (token exchange, 2FA)
├── vite.config.js      # Configurazione Vite
├── netlify.toml        # Configurazione Netlify
└── package.json        # Dipendenze
```

## Flusso di autenticazione

1. L'utente clicca "Accedi con Google"
2. Viene reindirizzato al page di Google OAuth
3. Dopo l'autorizzazione, torna a `/callback` con un code
4. La funzione serverless `exchange-token` scambia il code per i token
5. Viene richiesto di configurare il 2FA (TOTP)
6. L'utente scansiona il QR code con un'app (Google Authenticator, Authy, ecc)
7. Verifica il codice 6 cifre
8. Accesso al dashboard

## Sicurezza

- ✅ OAuth 2.0 con Google
- ✅ Autenticazione a due fattori (TOTP)
- ✅ Token storage solo in localStorage (lato client)
- ✅ Client Secret mai esposto (resta sul server Netlify)
- ✅ Solo l'utente autenticato può fare modifiche a Google Drive

## Note importanti

- I token vengono salvati in `localStorage` lato client
- Il `refreshToken` è necessario per rinnovare l'accesso
- Il 2FA viene configurato solo al primo login
- Per resetare il 2FA, dovrai eliminare i dati da localStorage e fare il login di nuovo
