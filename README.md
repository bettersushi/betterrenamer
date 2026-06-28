# BetterRenamer

Batch rename tool per Google Drive con OAuth 2.0 e 2FA.

## Setup

### 1. Variabili d'ambiente su Netlify

Nel dashboard di Netlify, vai a **Site settings → Build & deploy → Environment** e aggiungi le variabili necessarie per OAuth.

### 2. Configurazione Google Cloud Console

Assicurati che i redirect URI nella Console Google siano corretti per il tuo dominio Netlify.

### 3. Deploy

Il deploy avviene automaticamente quando fai push su GitHub.

### 4. Test locale

```bash
npm install
npm run dev
```

L'app sarà disponibile su `http://localhost:3000`

## Struttura del progetto
heredoc> ```
heredoc> betterrenamer/
heredoc> ├── src/
heredoc> │   ├── pages/
heredoc> │   ├── auth.js
heredoc> │   ├── drive.js
heredoc> │   ├── App.jsx
heredoc> │   └── index.css
heredoc> ├── netlify/
heredoc> │   └── functions/
heredoc> ├── vite.config.js
heredoc> ├── netlify.toml
heredoc> └── package.json
heredoc> ```
heredoc> 
heredoc> ## Flusso di autenticazione
heredoc> 
heredoc> 1. Login con Google OAuth
heredoc> 2. Configurazione 2FA (TOTP)
heredoc> 3. Accesso al dashboard
heredoc> 4. Batch rename dei file
heredoc> 
heredoc> ## Sicurezza
heredoc> 
heredoc> - ✅ OAuth 2.0 con Google
heredoc> - ✅ Autenticazione a due fattori (TOTP)
heredoc> - ✅ Token storage lato client
heredoc> EOF
cd /Users/housedadasnc/Webapp/BR
git add README.md
git commit -m "Fix: remove secrets from README"
git push
exit
exit
