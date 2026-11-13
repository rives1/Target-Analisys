# Shoot Analyzer

Analisi della dispersione dei colpi da una foto del bersaglio: group size, raggio medio, statistiche, forma del gruppo,
correzione in click del mirino, confronto tra gruppi e sessioni.

**Un unico file HTML**: nessuna installazione, nessuna dipendenza, funziona su Windows, macOS e Linux.
**100% offline**: la pagina non effettua connessioni di rete; immagini e dati restano sul tuo dispositivo.

**Versione 1.0.0** · **Online: https://rives1.github.io/Target-Analisys/**

## Come usarla

- **Online**: apri https://rives1.github.io/Target-Analisys/
- **Offline**: scarica `src/index.html` e aprilo con doppio clic. Il file è l'intera applicazione: si può copiare su una chiavetta o inviare per email.

| Browser | Stato |
|---|---|
| Edge / Chrome (Windows, macOS, Linux) | riferimento, collaudato · salvataggio con «Salva con nome» |
| Firefox | collaudato · i file salvati vanno nella cartella Download |
| Safari | supportato, non collaudato · i file salvati vanno nella cartella Download |

### In breve

1. **Carica la foto** (pulsante o trascinamento), scattata perpendicolare al bersaglio e con l'alto in alto.
2. **Scala**: clicca due punti a distanza nota, il più lontani possibile, e inserisci il valore.
3. **Mira**: clicca il punto mirato. **Foro**: clicca il centro di ogni foro (la lente 🔍 aiuta).
4. Imposta distanza di tiro, calibro (elenco o valore libero) e valore del click del mirino.
5. Leggi risultati, grafici e correzione; esporta la **Result Card** (PNG) o copia i risultati come testo; salva la sessione (JSON).

Più rosate sulla stessa foto: **＋ Nuovo gruppo**. Per confrontare sessioni diverse nel tempo: **Importa sessioni nello storico**.

### Funzioni

- **Misure**: group size centro-centro e bordo-bordo, raggio medio, H-spread, V-spread, FOM, in mm, pollici, MOA e MIL.
- **Statistiche** (modello normale circolare): SD delle distanze dal centro, SD radiale √(σx²+σy²), CEP, R95, R99, con **intervalli di confidenza** (90/95/99%).
- **Forma del gruppo**: angolo dell'asse maggiore, rapporto d'aspetto, **ellisse di dispersione** (50–99%).
- **Correzione**: click per asse dal centro gruppo al punto di mira, con intervallo di confidenza; click anche per ogni foro nella tabella punti.
- **Flyer**: segnalati automaticamente (⚠, da 5 fori) ed escludibili dal calcolo.
- **Tabella punti**: coordinate, distanza da mira e da centro, direzione (gradi e sigla cardinale), click.
- **Ricarica e condizioni** per gruppo: data, bossolo, polvere e carica, palla, innesco, meteo, temperatura, vento, colpi sparati, scaldacanna, note.
- **Grafici**: dispersione senza immagine, istogramma delle distanze dal centro, orologio delle direzioni.
- **Confronto tra gruppi**: tabella affiancata, differenza rispetto al precedente, andamento nel tempo con media mobile, storico da altre sessioni.
- **Qualità dei dati**: incertezza della scala, inquadratura improbabile (errori di unità), risoluzione del foro, avviso sotto i 3 e i 5 colpi.
- **Strumenti**: griglia angolare MIL/MOA, lente di ingrandimento, undo/redo, tema chiaro/scuro, pannello ridimensionabile.

### Mouse e tastiera

Trascina un punto per spostarlo · tasto destro su un punto = elimina · `Alt`+clic = foro sopra un punto esistente ·
rotella = zoom · trascina lo sfondo o tasto centrale = pan.
`1`–`4` strumenti · `Ctrl+Z` / `Ctrl+Y` undo/redo · `Canc` elimina il punto selezionato · `Backspace` elimina l'ultimo ·
`X` escludi/includi il foro selezionato · `F` adatta · `L` lente · `G` griglia · `T` tema · `Ctrl+S` salva · `Ctrl+O` apri foto.

### Limiti

- La foto deve essere perpendicolare al bersaglio: non c'è correzione prospettica né rotazione dell'immagine.
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
| Ellisse di dispersione p | semiassi k·√λ1, k·√λ2 con k = √(−2 ln(1−p)) (χ² con 2 gradi di libertà): 1,1774 (50%), 2,1460 (90%), 2,4477 (95%), 3,0349 (99%) |

Riferimenti: 1 MOA = 1,047" a 100 yd; 1 MIL = 10 cm a 100 m.
La correzione indica dove spostare il punto d'impatto (gruppo basso → click SU).

> Nota: la formula `size(in) / dist(yd) × 100` riportata nella specifica originale restituisce i *pollici a 100 yarde* (IPHY/SMOA), non i MOA veri. Il programma calcola entrambi correttamente.

## Sviluppo

```
src/index.html                  l'applicazione (HTML + CSS + JS in un unico file)
tests/calc.test.js              test del motore di calcolo  →  node tests/calc.test.js
index.html, .nojekyll           pagina iniziale di GitHub Pages (reindirizza a src/index.html)
docs/context/                   file di contesto per versione (per riprendere lo sviluppo)
specifiche_target_analyzer.md   specifica di progetto (revisione 2)
CHANGELOG.md                    storia delle versioni
```

Il motore di calcolo (`<script id="calc-engine">`) è puro e testato con Node.js senza dipendenze (90 verifiche, inclusi
confronti con le tavole statistiche e una simulazione Monte Carlo della copertura degli intervalli di confidenza).
Pubblicazione: ogni push su `main` aggiorna GitHub Pages.

## Licenza

MIT © 2026 Rives, vedi [LICENSE](LICENSE).
