# Shoot Analyzer

Analisi della dispersione dei colpi da una foto del bersaglio: group size, raggio medio, statistiche, forma del gruppo,
correzione in click del mirino, confronto tra gruppi e sessioni.

**Un unico file HTML**: nessuna installazione, nessuna dipendenza, funziona su Windows, macOS e Linux.
**100% offline**: la pagina non effettua connessioni di rete; immagini e dati restano sul tuo dispositivo.

**Versione 1.4.0** · **Online: https://rives1.github.io/Target-Analisys/**

## Come usarla

- **Online**: apri https://rives1.github.io/Target-Analisys/
- **Offline**: scarica `src/index.html` e aprilo con doppio clic. Il file è l'intera applicazione: si può copiare su una chiavetta o inviare per email.

| Browser | Stato |
|---|---|
| Edge / Chrome (Windows, macOS, Linux) | riferimento, collaudato · salvataggio con «Salva con nome» |
| Firefox | collaudato · i file salvati vanno nella cartella Download |
| Safari | collaudato · i file salvati vanno nella cartella Download |

### In breve

1. **Carica la foto** (pulsante o trascinamento). Se è storta, **📐 Raddrizza**: clicca due punti su una linea del bersaglio. Se è di sbieco, **⬚ Prospettiva**: clicca i 4 angoli di un rettangolo di dimensioni note (es. il foglio A4): la foto viene appiattita e la scala è già impostata.
2. **Scala**: clicca due punti a distanza nota, il più lontani possibile, e inserisci il valore.
3. **Mira**: clicca il punto mirato. **Foro**: clicca il centro di ogni foro (la lente 🔍 aiuta).
4. Imposta distanza di tiro, calibro (elenco o valore libero) e valore del click del mirino.
5. Leggi risultati e correzione; apri **📊 Grafici e confronto tra gruppi** (in fondo al pannello) per i grafici e il confronto; esporta la **Result Card** (PNG) o copia i risultati come testo; salva la sessione (JSON).

Più rosate sulla stessa foto: **＋ Nuovo gruppo**. Per confrontare sessioni diverse nel tempo: **Importa sessioni nello storico**.

### Funzioni

- **Misure**: group size centro-centro e bordo-bordo, raggio medio, H-spread, V-spread, FOM, in mm, pollici, MOA e MIL.
- **Statistiche** (modello normale circolare): SD delle distanze dal centro, SD radiale √(σx²+σy²), CEP, R95, R99, con **intervalli di confidenza** (90/95/99%).
- **Forma del gruppo**: angolo dell'asse maggiore, rapporto d'aspetto, **ellisse di dispersione** (50–99%).
- **Probabilità di colpire** un cerchio o un rettangolo, anche a un'altra distanza: probabilità per colpo e «colpi su 100» con intervallo di confidenza, con la correzione applicata e con la taratura attuale.
- **Correzione**: click per asse dal centro gruppo al punto di mira, con intervallo di confidenza; click anche per ogni foro nella tabella punti.
- **Flyer**: segnalati automaticamente (⚠, da 5 fori) ed escludibili dal calcolo.
- **Tabella punti**: coordinate, distanza da mira e da centro, direzione (gradi e sigla cardinale), click.
- **Ricarica e condizioni** per gruppo: data, bossolo, polvere e carica, palla, innesco, meteo, temperatura, umidità, pressione, vento, colpi sparati, scaldacanna, note.
- **Orientamento**: rotazione della foto (raddrizza con 2 punti, angolo libero, ±90°); punti e direzioni seguono il bersaglio raddrizzato.
- **Correzione prospettica** a 4 punti (omografia) per le foto di sbieco, con scala automatica dal rettangolo di riferimento.
- **Grafici** (vista a schermo intero): dispersione senza immagine, istogramma delle distanze dal centro, orologio delle direzioni.
- **Confronto tra gruppi**: tabella affiancata, differenza rispetto al precedente, andamento nel tempo con media mobile, storico da altre sessioni.
- **Qualità dei dati**: incertezza della scala, inquadratura improbabile (errori di unità), risoluzione del foro, avviso sotto i 3 e i 5 colpi.
- **Help tecnico** integrato: significato e formula di ogni termine, lettura dei grafici, guida alla correzione ed esempi svolti calcolati dall'app.
- **Export**: Result Card PNG, testo, **CSV fori** e **CSV gruppi** per Excel/LibreOffice (`;` e virgola decimale), sessione JSON.
- **Strumenti**: griglia angolare MIL/MOA, lente di ingrandimento (×2–×12), undo/redo, tema chiaro/scuro, pannello ridimensionabile.

### Mouse e tastiera

Trascina un punto per spostarlo · tasto destro su un punto = elimina · `Alt`+clic = foro sopra un punto esistente ·
rotella = zoom · `Shift`+rotella = ingrandimento della lente · trascina lo sfondo o tasto centrale = pan.
`1`–`6` strumenti (`5` = raddrizza, `6` = prospettiva, `Esc` annulla) · `Ctrl+Z` / `Ctrl+Y` undo/redo · `Canc` elimina il punto selezionato · `Backspace` elimina l'ultimo ·
`X` escludi/includi il foro selezionato · `F` adatta · `L` lente · `G` griglia · `T` tema · `A` grafici e confronto · `H` help tecnico · `Ctrl+S` salva · `Ctrl+O` apri foto.

### Limiti

- La correzione prospettica richiede un rettangolo reale di dimensioni note nella foto e un bersaglio piano: non corregge la distorsione dell'obiettivo (grandangoli, «effetto barile») né un foglio piegato o ondulato.
- Con meno di 5 colpi le statistiche (CEP, ellisse, rapporto d'aspetto, flyer) sono indicative; gli intervalli di confidenza lo mostrano.
- Il group size (ES) non ha un intervallo di confidenza esatto e non viene stimato.
- Il riconoscimento dei flyer usa la distanza dal centro: in gruppi molto allungati può segnalare i fori alle estremità.

## Calcoli

| Grandezza | Definizione |
|---|---|
| Fattore di scala | `S = d_px / d_reale` (px/mm) |
| Centroide | media delle coordinate dei fori |
| Group size (c-c) | massima distanza tra due fori qualsiasi (centro-centro) |
| Bordo-bordo esterno | c-c + calibro |
| Raggio medio | media delle distanze dei fori dal centroide |
| Angolo di una dimensione | `2·atan(s / 2D)` (esatto) |
| Angolo di uno scostamento | `atan(o / D)` (esatto) |
| MOA / MIL / IPHY | `rad·(180/π)·60` / `rad·1000` / `tan(rad)·3600` |
| Click | `round(angolo_scostamento / valore_click)`, per asse |
| H-spread, V-spread | estensione orizzontale e verticale del gruppo (c-c) |
| FOM | (H-spread + V-spread) / 2 |
| SD distanze dal centro | deviazione standard campionaria delle distanze dal centroide |
| SD radiale | √(σx² + σy²), σ campionarie per asse |
| CEP / R95 / R99 | σ̂·√(−2 ln(1−p)) con σ̂ = √((σx²+σy²)/2) / c(ν=2(n−1)): 1,1774 / 2,4477 / 3,0349 σ̂ |
| Flyer | leave-one-out: (d − media) / SD delle distanze degli altri fori dal loro centro > k (default 2), n ≥ 5 |
| Direzione | atan2(dx, dy) in gradi, 0° = alto, senso orario, 16 settori (N, NNE, … NNO) |
| IC di σ | [σ̂·√(ν/χ²_{ν,1−α/2}), σ̂·√(ν/χ²_{ν,α/2})], σ̂² = (σx²+σy²)/2, ν = 2(n−1); CEP/R95/R99 e raggio medio atteso (σ·√(π/2)) in proporzione |
| IC del centro gruppo | per asse ± t_{n−1,1−α/2}·s/√n, tradotto in click di correzione |
| Incertezza di scala | √2 / lunghezza del segmento di calibrazione in px (±1 px per punto) |
| Ore dell'orologio | round(direzione / 30°), 0 → 12 |
| Asse maggiore | autovettore maggiore della matrice di covarianza campionaria dei fori; angolo dalla verticale, senso orario, 0–180° |
| Rapporto d'aspetto | √(λ1/λ2) = asse maggiore / asse minore dell'ellisse |
| Correzione prospettica | omografia H dai 4 angoli cliccati al rettangolo wMm × hMm (sistema 8×8, normalizzazione di Hartley); foto ricampionata con interpolazione bilineare; k = √(area del quadrilatero in px / (wMm·hMm)) px/mm |
| Probabilità di colpire un cerchio | 1 − Q₁(d/σ, R/σ) (χ² non centrale a 2 g.d.l.): d = distanza centro colpi – centro bersaglio, R = raggio |
| Probabilità di colpire un rettangolo | [Φ((W/2−dx)/σ) − Φ((−W/2−dx)/σ)] · [Φ((H/2−dy)/σ) − Φ((−H/2−dy)/σ)] |
| IC della probabilità | percentili di 4000 simulazioni: σ² = ν·s²/χ²_ν, centro ± (σ/√n)·N(0,1) per asse |
| Ellisse di dispersione p | semiassi k·√λ1, k·√λ2 con k = √(−2 ln(1−p)) (χ² con 2 gradi di libertà): 1,1774 (50%), 2,1460 (90%), 2,4477 (95%), 3,0349 (99%) |

Riferimenti: 1 MOA = 1,047" a 100 yd; 1 MIL = 10 cm a 100 m.
La correzione indica dove spostare il punto d'impatto (gruppo basso → click SU).

> Nota: la formula `size(in) / dist(yd) × 100` riportata nella specifica originale restituisce i *pollici a 100 yarde* (IPHY/SMOA), non i MOA veri. Il programma calcola entrambi correttamente.

## Sviluppo

```
src/index.html                  l'applicazione (HTML + CSS + JS in un unico file)
tests/calc.test.js              test del motore di calcolo  →  npm run test:calc
tests/ui.test.js                test dell'interfaccia (Playwright)  →  npm run test:ui
package.json                    script di test (npm test = entrambi)
.github/workflows/test.yml      GitHub Actions: tutti i test a ogni push (copia di riferimento in docs/ci/)
index.html, .nojekyll           pagina iniziale di GitHub Pages (reindirizza a src/index.html)
docs/context/                   file di contesto per versione (per riprendere lo sviluppo)
specifiche_target_analyzer.md   specifica di progetto (revisione 2)
CHANGELOG.md                    storia delle versioni
```

Il motore di calcolo (`<script id="calc-engine">`) è puro e testato con Node.js senza dipendenze (126 verifiche, inclusi
confronti con le tavole statistiche e una simulazione Monte Carlo della copertura degli intervalli di confidenza).
L'interfaccia è collaudata end-to-end con Playwright (17 scenari, pagina aperta da `file://`, nessuna richiesta di rete ammessa).
L'applicazione non usa Node: serve solo per i test.

```
npm install                       # una volta: installa Playwright
npx playwright install chromium   # una volta: scarica il browser di test
npm test                          # calcolo + interfaccia
```

Su Windows si può evitare il download del browser usando Edge: `set PW_CHANNEL=msedge && npm run test:ui`
(PowerShell: `$env:PW_CHANNEL="msedge"; npm run test:ui`).

Pubblicazione: ogni push su `main` aggiorna GitHub Pages ed esegue tutti i test con GitHub Actions
(`.github/workflows/test.yml`, risultato nella scheda *Actions*). `docs/ci/test.yml` ne è la copia di riferimento:
gli strumenti remoti di Claude non possono scrivere in `.github/workflows/`, quindi una modifica al workflow va
ricopiata a mano da `docs/ci/`.

## Licenza

MIT © 2026 Rives, vedi [LICENSE](LICENSE).
