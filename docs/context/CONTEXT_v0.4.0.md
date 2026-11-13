# Contesto di sviluppo: Shoot Analyzer v0.4.0

> Incolla questo file all'inizio di una nuova chat per riprendere lo sviluppo da questo punto.
> Specifica di riferimento: `specifiche_target_analyzer.md` (nella root del repo), **revisione 2**.

## 1. Stato
- **Versione**: 0.4.0 (2026-11-13). Precedenti: 0.3.0 (spec rev. 2, solo HTML), 0.2.0 (lente, card multi-gruppo), 0.1.0 (Fasi 1-3).
- **Fasi completate**: 1 (layout + canvas), 2 (interazione + undo/redo), 3 (motore di calcolo). **Le Fasi 4 (wrapper Python) e 5 (build .exe) non esistono più**: cambio di specifica dell'utente, l'app è il solo `src/index.html` e gira su qualsiasi OS.
- **Novità 0.4.0** (da `feature-request.md` dell'utente, interpretazione concordata: entrambe le varianti): colonne Click ↕ / Click ↔ nella tabella punti per ogni foro + riga evidenziata «Centro gruppo».
- **Novità 0.3.0**: specifica rev. 2 (niente .exe/Python); salvataggio con File System Access API (`showSaveFilePicker`) e ripiego su download; rimosso il codice pywebview; timestamp dei file in ora locale.
- **Novità 0.2.0**: lente di ingrandimento; Result Card anche con tutti i gruppi; licenza MIT.
- **Collaudo**: Chrome (automatico), Firefox (utente, OK). Safari non collaudato.
- **In attesa**: feedback dell'utente; pubblicazione su GitHub.
- **Repo git**: `C:\Users\ammin\Documents\Claude_target_analyzer`, branch `main`, tag `v0.1.0` … `v0.4.0`. Autore commit: `rives <rivesone@outlook.com>`. Non ancora pubblicato su GitHub (nessun remote configurato).

## 2. Decisioni prese (con motivazione)
| # | Decisione | Motivo |
|---|---|---|
| D1 | Angoli calcolati in modo **esatto** (`2·atan(s/2D)` per le dimensioni, `atan(o/D)` per gli scostamenti), poi convertiti in MOA/MIL/IPHY | La formula della specifica `in/yd×100` dà IPHY e non MOA (errore ~4,7%) |
| D2 | Unità interne: **millimetri**; coordinate punti in **pixel immagine** (y verso il basso) | Un'unica conversione al bordo, nessuna perdita di precisione con lo zoom |
| D3 | **Più gruppi per immagine** (scelta dell'utente) | Rosate multiple su visuel diversi |
| D4 | Fori marcati al **centro** + **calibro**: si mostrano c-c (primario) e bordo-bordo (= c-c + calibro). Il calibro disegna anche il cerchio del foro | Scelta dell'utente; c-c è lo standard |
| D5 | Correzione **per asse**, arrotondata con `Math.round`, direzione opposta allo scostamento (gruppo basso → SU, a destra → SINISTRA) | Convenzione standard delle torrette |
| D6 | Unità click: MIL, MOA, IPHY (SMOA, "1/4 in @100yd") | Alcune ottiche usano click in pollici a 100 yd |
| D7 | Frontend in **un unico file** HTML (CSS e JS inline), **nessuna libreria esterna**, CSP `connect-src 'none'` | Requisito offline; niente Tailwind CDN |
| D8 | Undo/redo a **snapshot JSON** di `{calib, groups, activeGroupId}`; i parametri (distanza, calibro, click) NON sono nella storia | Semplice e robusto; i parametri si correggono a mano |
| D9 | Sessione JSON `format: 1` con immagine incorporata come dataURL (opzionale, checkbox) | Portabilità del singolo file di sessione |
| D10 | Livello `Storage` in JS: `saveBlob(filename, blob)` usa `window.showSaveFilePicker` (Edge/Chrome, funziona anche da `file://`) e ripiega su download (`<a download>`) se assente o in errore; restituisce `false` se l'utente annulla (`AbortError`). Lettura file sempre con `<input type=file>` / drag & drop | Unico file HTML, nessun wrapper |
| D11 | ~~Build .exe con GitHub Actions~~ → **nessuna build**: il rilascio è `src/index.html` (rev. 2 della specifica) | Cambio di specifica dell'utente: multipiattaforma |
| D12 | UI in italiano, unità metriche di default (100 m, calibro 7,62 mm, click 0,1 MIL), confermati dall'utente | Utente italiano |
| D13 | **Lente**: ×4 rispetto alla vista (min 1:1, max 6000%), raggio 85 px, in alto a destra del cursore (si ribalta ai bordi). In hover solo nelle modalità di inserimento (toggle 🔍 / `L`, default ON); sempre ON durante il drag di un punto e centrata sul punto. Overlay in stile `light` (solo contorno sottile dei fori) | Precisione nel trovare il centro del foro |
| D14 | **Result Card**: selettore `cardScope` = `active` (default) / `all`. `exportCard(scope)`; in `all` include solo i gruppi con fori, ritaglio sull'insieme dei punti, riepilogo compatto per gruppo | Richiesta utente |
| D15 | Licenza **MIT**, copyright "rives" | Richiesta utente |
| D17 | **Click nella tabella punti**: per ogni foro e per il centroide, `Calc.correction((p.x−mira.x)·k, (mira.y−p.y)·k, ctx)`; abbreviazioni SU/GIÙ/DX/SX, 0 in grigio, angolo esatto nel tooltip. Riga «⊕ Centro gruppo» (classe `centroid`) evidenziata, non selezionabile/eliminabile; nota che la correzione da applicare è quella del centro gruppo. Colonne vuote senza mira/scala, «–» senza distanza o valore click. La tabella si aggiorna al rilascio del drag (non durante) | Richiesta utente; un singolo foro contiene la dispersione casuale |
| D16 | Nomi dei file salvati: `<immagine>_AAAAMMGG_hhmm.json`, `<immagine>_<gruppo|tutti_i_gruppi>_card.png`, ora locale | Leggibilità |

## 3. Architettura di `src/index.html`
- `<script id="calc-engine">`: modulo puro `Calc` (nessun DOM), esportato anche come `module.exports` per i test Node.
  Funzioni: `dist, centroid, extremeSpread, meanRadius, extent, angleOfSize, angleOfOffset, fromRad, correction, scale, analyze`.
  `correction(dx, dy, ctx)` (dx + = destra, dy + = alto, mm) → `{unit, clickValue, hAng, vAng, hClicks, vClicks, hDir, vDir}` o `null`.
  `analyze(shots, poa, ctx)` con `ctx = {pxPerMm, distMm, caliberMm, clickValue, clickUnit}` restituisce
  `{n, calibrated, centroid, esIdx, px{es,mr,w,h}, mm{es,esEdge,mr,w,h}, ang{es,mr,w,h → {MOA,MIL,IPHY}}, offset{dx,dy,d}, correction{...}}`.
  `offset.dx > 0` = gruppo a destra; `offset.dy > 0` = gruppo in alto.
- `<script id="app-main">`:
  - `state = {image{name,w,h,dataUrl,bitmap}, calib{p1,p2}, groups[{id,name,color,poa,shots[{id,x,y}]}], activeGroupId, mode, selected, view{scale,ox,oy}}`
  - modalità: `pan | calib | poa | shot` (tasti 1–4).
  - rendering: immagine con trasformazione vista; overlay in pixel CSS (marcatori a dimensione costante). `drawOverlay()` è riusata dalla Result Card.
  - puntatore: clic vs trascinamento con soglia 4 px; hit-test 11 px, il gruppo attivo ha priorità; `Alt`+clic ignora i punti esistenti.
  - lente: `loupeActive()`, `drawLoupe(cc)`, `setLoupe(on)`; `state.loupe`, `state.hover`.
  - `drawOverlay(g, T, scl, cc, opts)` con `opts = {onlyGroupIds, noCalib, showNames, light}`.
  - `window.__SA`: hook per i test automatici.

## 4. Test
- `node tests/calc.test.js`: 33 verifiche (valori di riferimento: 1 MOA = 1,0472" @100yd, 1 MIL = 100 mm @100 m, 1 mrad = 3,43775 MOA, direzioni di correzione, c-c/bordo-bordo).
- Testato anche end-to-end in Chrome headless (Playwright): lente (hover e drag), card attiva e multi-gruppo, calibrazione, mira, fori, drag, undo/redo, tasto destro, zoom, multi-gruppo, round-trip della sessione, export della card. Nessuna richiesta di rete.
  Lo script Playwright non è nel repo (era temporaneo): da aggiungere se si vuole la CI dei test UI.

## 5. Limiti noti / da valutare
- Nessuna correzione prospettica: la foto deve essere perpendicolare al bersaglio.
- Nessuna rotazione dell'immagine: si assume che l'alto della foto sia l'alto del bersaglio.
- Lo zoom della lente è fisso (×4): eventuale regolazione da valutare.
- Safari non collaudato. Su Firefox/Safari i salvataggi vanno in Download (nessun dialog).
- Firefox/Safari: `navigator.clipboard` da `file://` può essere negato → ripiego automatico su file .txt.

## 6. Prossimi passi
1. Feedback dell'utente sulla 0.4.0.
2. Collaudo su Safari (facoltativo: il criterio della rev. 2 è già soddisfatto con Firefox).
3. Pubblicazione: creare il repo vuoto su GitHub, poi `git remote add origin https://github.com/<utente>/shoot-analyzer.git` e `git push -u origin main --tags`. Opzionale: GitHub Pages per avere anche un link web (l'app resta senza chiamate di rete).
4. Idee aperte (non richieste): zoom regolabile della lente, rotazione immagine, correzione prospettica a 4 punti, test UI Playwright nel repo.
