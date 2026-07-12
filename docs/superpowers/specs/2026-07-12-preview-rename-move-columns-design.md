# Preview rename: colonne dedicate rename/spostamento + conteggio coda corretto

## Problema

Nella dashboard di BetterRenamer, la tabella di preview del rename (`DashboardPage.jsx`, ~righe 897-949) ha oggi 3 colonne: Cartella, Originale, e una terza colonna che mostra *o* il nuovo nome *o* la destinazione di spostamento (`→ cartella`), mai entrambe insieme. Questo rende poco leggibile il caso in cui un file viene sia rinominato sia spostato (modalità `organizeMedia`).

Inoltre, quando si aggiunge la preview alla coda (`handleAddToQueue`, `DashboardPage.jsx:355-370`), il totale del job (`progress.total`) viene calcolato filtrando solo sugli item che necessitano di **rename** (`!p.skip`). In modalità `moveOnly`, `skip` è sempre `false` per ogni file media (`DashboardPage.jsx:578`), quindi il totale della coda include anche file che sono già nella cartella di destinazione corretta e per cui, in fase di esecuzione, non verrà eseguita alcuna azione — il numero mostrato in coda risulta quindi incoerente con il numero di file effettivamente elaborati.

## Obiettivo

1. La tabella preview mostra colonne separate **Rename** e **Spostamento** quando la modalità attiva può generare spostamenti (moveOnly o organizeMedia); altrimenti resta a 3 colonne come oggi (senza colonna Spostamento).
2. Il totale mostrato/usato nella **coda** riflette solo i file che verranno effettivamente elaborati (almeno una tra rename o move necessaria) — non tutti i file controllati in preview.
3. L'header "Preview (N)" e il bottone "Aggiungi alla coda" in dashboard restano invariati: continuano a mostrare il numero totale di file controllati in preview, per dare contesto su quanti sono stati scansionati.

## Design

### 1. Helper condiviso `needsMove` (`src/renameQueueEngine.js`)

Nuova funzione pura che replica la logica di "già in posizione" oggi duplicata solo a runtime in `RenameQueueContext.jsx:145` (`alreadyInPlace`):

```js
// { folderName, oldName/newName, mimeType } -> bool
function needsMove(item, isVideo) {
  const suffix = isVideo ? 'Vid' : 'Gif'
  const targetFolder = `${baseFolderName(item.folderName)} ${suffix}`
  return item.folderName !== targetFolder
}
```

Riusa `baseFolderName()` già esistente (`renameQueueEngine.js:35-37`). Esportata accanto alle altre utility del modulo.

### 2. Preview item: nuovo campo `needsMove`

Nei tre punti che costruiscono gli item di preview:
- `DashboardPage.jsx:97` (rename con pattern custom)
- `DashboardPage.jsx:578` (modalità `moveOnly`)
- `renameQueueEngine.js:75` (`buildLegacyPreview`)

Per ogni item media, quando `moveOnly` o `organizeMedia` è attivo, calcolare `needsMove: needsMove(item, isVideoFile(...))` usando l'helper del punto 1. Per item non-media o quando lo spostamento non è applicabile alla modalità corrente, `needsMove` resta `false`/non impostato.

Il campo `skip` esistente continua a rappresentare solo "non serve rename" (comportamento invariato).

### 3. Tabella preview (`DashboardPage.jsx` ~897-949)

- Se la modalità attiva può generare spostamenti (`moveOnly || organizeMedia`): la tabella ha 4 colonne — Cartella, Originale, Rename, Spostamento.
  - Cella **Rename**: `item.skip ? 'già ok ✓' : item.newName` (testo attenuato quando "già ok").
  - Cella **Spostamento**: `item.needsMove ? '→ ' + targetFolderLabel : 'già ok ✓'` (testo attenuato quando "già ok").
- Altrimenti (rename semplice, nessuno spostamento possibile): tabella a 3 colonne come oggi, nessuna colonna Spostamento.

### 4. Conteggio coda (`handleAddToQueue`, `DashboardPage.jsx:355-370`)

Il filtro che determina quali item vengono effettivamente accodati e il totale del job passa da:
```js
preview.filter(p => !p.skip)
```
a:
```js
preview.filter(p => !p.skip || p.needsMove)
```
cioè un item è escluso dalla coda/dal totale solo se **non** serve né rename né move (entrambi "già ok"). Questo si applica sia a `preview:` che a `progress.total` nello stesso punto, così il numero mostrato nel pannello coda (`RenameQueuePanel.jsx`) riflette esattamente i file che verranno processati.

L'header "Preview (N)" (`DashboardPage.jsx:901`) e il bottone "Aggiungi alla coda (N file)" (`DashboardPage.jsx:947`) restano invariati: continuano a usare `preview.length` non filtrato.

## Fuori scope

- Non si tocca la logica di esecuzione in `RenameQueueContext.jsx` (fase di rename/move durante `processJob`), che già gestisce correttamente `alreadyInPlace` a runtime.
- Non si introduce alcuna colonna/campo per lo stato "in esecuzione" (quello resta gestito dai job status esistenti).
- Nessun cambiamento alla "coda interrotta" (interrupted jobs section, ~riga 980+) al di fuori del riuso naturale dei campi `skip`/`needsMove` già presenti sugli item.

## Verifica

1. Avviare l'app, generare una preview in modalità rename semplice (no organizeMedia/moveOnly): la tabella deve avere 3 colonne come oggi (nessuna regressione).
2. Generare una preview in modalità `moveOnly` con almeno un file già nella cartella corretta e uno da spostare: verificare che la colonna Spostamento distingua correttamente i due casi, e che il bottone "Aggiungi alla coda" mostri comunque il totale di tutti i file controllati.
3. Aggiungere quella preview alla coda: verificare che il totale nel pannello coda (`RenameQueuePanel.jsx`) conti solo i file che necessitano di move (escludendo quelli già in posizione).
4. Ripetere con `organizeMedia` attivo insieme a rename custom: verificare che entrambe le colonne Rename/Spostamento siano popolate correttamente per lo stesso file, e che il totale in coda conti un file una sola volta se necessita di entrambe le azioni.
