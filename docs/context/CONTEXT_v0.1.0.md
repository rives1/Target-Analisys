# Contesto di sviluppo: Shoot Analyzer v0.1.0

> Incolla questo file all'inizio di una nuova chat per riprendere lo sviluppo da questo punto.
> Specifica di riferimento: `specifiche_target_analyzer.md` (nella root del repo).

## 1. Stato
- **Versione**: 0.1.0 (2026-11-13)
- **Fasi completate**: 1 (layout + canvas), 2 (interazione + undo/redo), 3 (motore di calcolo).
- **In attesa**: conferma dell'utente dopo il test di `src/index.html`, prima di iniziare la **Fase 4** (wrapper Python pywebview).
- **Repo git**: `C:\Users\ammin\Documents\Claude_target_analyzer`, branch `main`. Non ancora pubblicato su GitHub.

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
| D10 | Livello `Storage` in JS: usa `window.pywebview.api.save_file / save_binary` se presenti, altrimenti download dal browser | Pronto per la Fase 4 senza riscrivere il frontend |
| D11 | Build futura: **GitHub Actions su runner Windows** (PyInstaller non fa cross-compilazione) | Scelta dell'utente |
| D12 | UI in italiano, unità metriche di default (m, mm, MIL 0,1) | Utente italiano |

## 3. Architettura di `src/index.html`
- `<script id="calc-engine">`: modulo puro `Calc` (nessun DOM), esportato anche come `module.exports` per i test Node.
  Funzioni: `dist, centroid, extremeSpread, meanRadius, extent, angleOfSize, angleOfOffset, fromRad, scale, analyze`.
  `analyze(shots, poa, ctx)` con `ctx = {pxPerMm, distMm, caliberMm, clickValue, clickUnit}` restituisce
  `{n, calibrated, centroid, esIdx, px{es,mr,w,h}, mm{es,esEdge,mr,w,h}, ang{es,mr,w,h → {MOA,MIL,IPHY}}, offset{dx,dy,d}, correction{...}}`.
  `offset.dx > 0` = gruppo a destra; `offset.dy > 0` = gruppo in alto.
- `<script id="app-main">`:
  - `state = {image{name,w,h,dataUrl,bitmap}, calib{p1,p2}, groups[{id,name,color,poa,shots[{id,x,y}]}], activeGroupId, mode, selected, view{scale,ox,oy}}`
  - modalità: `pan | calib | poa | shot` (tasti 1–4).
  - rendering: immagine con trasformazione vista; overlay in pixel CSS (marcatori a dimensione costante). `drawOverlay()` è riusata dalla Result Card.
  - puntatore: clic vs trascinamento con soglia 4 px; hit-test 11 px, il gruppo attivo ha priorità; `Alt`+clic ignora i punti esistenti.
  - `window.__SA`: hook per i test automatici.

## 4. Test
- `node tests/calc.test.js`: 29 verifiche (valori di riferimento: 1 MOA = 1,0472" @100yd, 1 MIL = 100 mm @100 m, 1 mrad = 3,43775 MOA, direzioni di correzione, c-c/bordo-bordo).
- Testato anche end-to-end in Chrome headless (Playwright): calibrazione, mira, fori, drag, undo/redo, tasto destro, zoom, multi-gruppo, round-trip della sessione, export della card. Nessuna richiesta di rete.
  Lo script Playwright non è nel repo (era temporaneo): da aggiungere se si vuole la CI dei test UI.

## 5. Limiti noti / da valutare
- Nessuna correzione prospettica: la foto deve essere perpendicolare al bersaglio.
- Nessuna rotazione dell'immagine: si assume che l'alto della foto sia l'alto del bersaglio.
- Nessuna lente di ingrandimento durante il trascinamento: per la precisione si usa lo zoom.
- La Result Card esporta solo il gruppo attivo.
- Valori arbitrari di default: calibro 7,62 mm, 100 m, 0,1 MIL.
- Identità git del commit: placeholder locale, da sostituire con quella GitHub dell'utente prima di pubblicare.
- Licenza non ancora scelta.

## 6. Prossimi passi
1. L'utente testa `src/index.html` e conferma o chiede modifiche.
2. **Fase 4**: `main.py` con `webview.create_window(...)` che carica `src/index.html`; classe `Api` esposta con `save_file(filename, text)`, `save_binary(filename, dataUrl)`, e `open_file()` (dialog nativi di pywebview). Nel JS sostituire gli `<input type=file>` con `open_file` se `window.pywebview` è presente.
3. **Fase 5**: `.github/workflows/build.yml` su `windows-latest`, PyInstaller (`--onefile` oppure `--onedir`, da decidere: `--onefile` ha avvio più lento e più falsi positivi antivirus), artifact `.exe` allegato alla release.
