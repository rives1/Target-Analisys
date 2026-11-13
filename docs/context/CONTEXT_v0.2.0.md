# Contesto di sviluppo: Shoot Analyzer v0.2.0

> Incolla questo file all'inizio di una nuova chat per riprendere lo sviluppo da questo punto.
> Specifica di riferimento: `specifiche_target_analyzer.md` (nella root del repo).

## 1. Stato
- **Versione**: 0.2.0 (2026-11-13). Precedente: 0.1.0 (Fasi 1-3).
- **Fasi completate**: 1 (layout + canvas), 2 (interazione + undo/redo), 3 (motore di calcolo).
- **Novità 0.2.0** (richieste dell'utente dopo il test della 0.1.0): lente di ingrandimento; Result Card esportabile anche con tutti i gruppi; licenza MIT; identità git definitiva.
- **In attesa**: conferma dell'utente per iniziare la **Fase 4** (wrapper Python pywebview).
- **Repo git**: `C:\Users\ammin\Documents\Claude_target_analyzer`, branch `main`, tag `v0.1.0` e `v0.2.0`. Autore commit: `rives <rivesone@outlook.com>`. Non ancora pubblicato su GitHub (nessun remote configurato).

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
| D12 | UI in italiano, unità metriche di default (100 m, calibro 7,62 mm, click 0,1 MIL), confermati dall'utente | Utente italiano |
| D13 | **Lente**: ×4 rispetto alla vista (min 1:1, max 6000%), raggio 85 px, in alto a destra del cursore (si ribalta ai bordi). In hover solo nelle modalità di inserimento (toggle 🔍 / `L`, default ON); sempre ON durante il drag di un punto e centrata sul punto. Overlay in stile `light` (solo contorno sottile dei fori) | Precisione nel trovare il centro del foro |
| D14 | **Result Card**: selettore `cardScope` = `active` (default) / `all`. `exportCard(scope)`; in `all` include solo i gruppi con fori, ritaglio sull'insieme dei punti, riepilogo compatto per gruppo | Richiesta utente |
| D15 | Licenza **MIT**, copyright "rives" | Richiesta utente |

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
  - lente: `loupeActive()`, `drawLoupe(cc)`, `setLoupe(on)`; `state.loupe`, `state.hover`.
  - `drawOverlay(g, T, scl, cc, opts)` con `opts = {onlyGroupIds, noCalib, showNames, light}`.
  - `window.__SA`: hook per i test automatici.

## 4. Test
- `node tests/calc.test.js`: 29 verifiche (valori di riferimento: 1 MOA = 1,0472" @100yd, 1 MIL = 100 mm @100 m, 1 mrad = 3,43775 MOA, direzioni di correzione, c-c/bordo-bordo).
- Testato anche end-to-end in Chrome headless (Playwright): lente (hover e drag), card attiva e multi-gruppo, calibrazione, mira, fori, drag, undo/redo, tasto destro, zoom, multi-gruppo, round-trip della sessione, export della card. Nessuna richiesta di rete.
  Lo script Playwright non è nel repo (era temporaneo): da aggiungere se si vuole la CI dei test UI.

## 5. Limiti noti / da valutare
- Nessuna correzione prospettica: la foto deve essere perpendicolare al bersaglio.
- Nessuna rotazione dell'immagine: si assume che l'alto della foto sia l'alto del bersaglio.
- Lo zoom della lente è fisso (×4): eventuale regolazione da valutare.

## 6. Prossimi passi
1. L'utente testa la 0.2.0 (lente e card multi-gruppo) e conferma l'avvio della Fase 4.
   Per pubblicare: creare il repo vuoto su GitHub, poi `git remote add origin https://github.com/<utente>/shoot-analyzer.git` e `git push -u origin main --tags`.
2. **Fase 4**: `main.py` con `webview.create_window(...)` che carica `src/index.html`; classe `Api` esposta con `save_file(filename, text)`, `save_binary(filename, dataUrl)`, e `open_file()` (dialog nativi di pywebview). Nel JS sostituire gli `<input type=file>` con `open_file` se `window.pywebview` è presente.
3. **Fase 5**: `.github/workflows/build.yml` su `windows-latest`, PyInstaller (`--onefile` oppure `--onedir`, da decidere: `--onefile` ha avvio più lento e più falsi positivi antivirus), artifact `.exe` allegato alla release.
