# Shoot Analyzer

Applicazione **portatile e multipiattaforma** (un unico file HTML) che analizza la foto di un bersaglio e calcola la dispersione dei gruppi di colpi: group size (extreme spread), raggio medio, MOA/MIL e correzione in click del mirino.
Funziona **100% offline**: nessuna chiamata di rete, nessun tracking.

> Stato: **v0.7.0** · **Usala online: https://rives1.github.io/Target-Analisys/**, applicazione completa in `src/index.html`.
> Funziona su Windows, macOS e Linux con qualsiasi browser moderno: nessun eseguibile, nessuna installazione.

## Uso

**Online**: https://rives1.github.io/Target-Analisys/ (GitHub Pages). Anche online l'app non invia nulla: immagini e sessioni restano sul tuo dispositivo.

**Offline**: apri `src/index.html` con un browser (doppio clic sul file). Non serve installare nulla e non serve connessione.
Il file si può copiare dove si vuole (chiavetta USB, cloud, allegato email): è l'intera applicazione.

| Browser | Stato |
|---|---|
| Edge / Chrome (Windows, macOS, Linux) | riferimento, testato · salvataggio con dialog «Salva con nome» |
| Firefox | collaudato · i file salvati finiscono nella cartella Download |
| Safari | supportato, non ancora collaudato · salvataggi nella cartella Download |

1. **Carica foto**: pulsante o trascinamento. La foto va scattata perpendicolare al bersaglio.
2. **Scala**: clicca due punti a distanza nota e inserisci il valore.
3. **Mira**: clicca il punto mirato.
4. **Foro**: clicca il centro di ogni foro.
5. Per più rosate sulla stessa immagine: **＋ Nuovo gruppo**.

La **lente di ingrandimento** (🔍, tasto `L`) appare vicino al cursore quando inserisci i punti ed è sempre attiva mentre trascini un punto.
La tabella dei punti mostra per ogni foro, e per il **centro gruppo** (la correzione da applicare), i click verticali e orizzontali per portarlo sul punto di mira.
La **Result Card** PNG può contenere il gruppo attivo (default, con la tabella punti dal centro gruppo in giù) o tutti i gruppi.
Per ogni gruppo si registrano i **dati di ricarica e le condizioni** (polvere, palla, innesco, meteo, vento, colpi sparati, note…), riportati nella Result Card.
La **griglia angolare** MIL/MOA (`G`) si sovrappone all'immagine centrata sul punto di mira. **Tema scuro** con 🌙 (`T`).
Il **calibro** si sceglie da un elenco dei calibri più diffusi oppure si scrive a mano il diametro della palla.

Trascina un punto per spostarlo · tasto destro su un punto per eliminarlo · `Alt`+clic per un foro sovrapposto · rotella = zoom · trascina lo sfondo = pan · `Ctrl+Z` / `Ctrl+Y` undo/redo.

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

Riferimenti: 1 MOA = 1,047" a 100 yd; 1 MIL = 10 cm a 100 m.
La correzione indica dove spostare il punto d'impatto (gruppo basso → click SU).

> Nota: la formula `size(in) / dist(yd) × 100` riportata nella specifica originale restituisce i *pollici a 100 yarde* (IPHY/SMOA), non i MOA veri. Il programma calcola entrambi correttamente.

## Struttura

```
src/index.html            frontend autocontenuto (HTML+CSS+JS, nessuna dipendenza)
tests/calc.test.js        test del motore di calcolo  →  node tests/calc.test.js
index.html                reindirizza a src/index.html (pagina iniziale di GitHub Pages)
.nojekyll                 GitHub Pages pubblica i file senza elaborarli
docs/context/             file di contesto per versione (per riprendere lo sviluppo)
specifiche_target_analyzer.md   specifica di progetto
CHANGELOG.md
LICENSE
```

## Roadmap

- [x] Fase 1: layout, canvas, caricamento immagine
- [x] Fase 2: zoom/pan, punti, drag, undo/redo
- [x] Fase 3: motore di calcolo e risultati in tempo reale
- [x] ~~Fase 4: wrapper Python~~ e ~~Fase 5: build `.exe`~~: eliminate (rev. 2 della specifica, v0.3.0)
- [x] Collaudo su Firefox
- [x] Click per singolo foro e per il centro gruppo nella tabella punti (v0.4.0)
- [x] Combo calibri, tabella punti nella Result Card (v0.5.0)
- [x] Data/ora nei nomi file, esportazione in cima al pannello, gruppo attivo nella tabella punti (v0.6.0)
- [x] Pubblicazione su GitHub Pages (v0.6.1)
- [x] Dati di ricarica e condizioni, griglia MIL/MOA, tema scuro (v0.7.0)
- [ ] Collaudo su Safari

## Licenza

MIT, vedi [LICENSE](LICENSE).
