# Shoot Analyzer

Applicazione desktop **portatile** per Windows 11 x64 che analizza la foto di un bersaglio e calcola la dispersione dei gruppi di colpi: group size (extreme spread), raggio medio, MOA/MIL e correzione in click del mirino.
Funziona **100% offline**: nessuna chiamata di rete, nessun tracking.

> Stato: **v0.2.0**, frontend completo (Fasi 1, 2 e 3), testabile in qualsiasi browser.
> Il wrapper desktop (Python + pywebview) e la build `.exe` (PyInstaller via GitHub Actions) sono le prossime fasi.

## Provare subito

Apri `src/index.html` con Edge o Chrome (doppio clic sul file). Non serve installare nulla.

1. **Carica foto**: pulsante o trascinamento. La foto va scattata perpendicolare al bersaglio.
2. **Scala**: clicca due punti a distanza nota e inserisci il valore.
3. **Mira**: clicca il punto mirato.
4. **Foro**: clicca il centro di ogni foro.
5. Per più rosate sulla stessa immagine: **＋ Nuovo gruppo**.

La **lente di ingrandimento** (🔍, tasto `L`) appare vicino al cursore quando inserisci i punti ed è sempre attiva mentre trascini un punto.
La **Result Card** PNG può contenere il gruppo attivo (default) o tutti i gruppi.

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
docs/context/             file di contesto per versione (per riprendere lo sviluppo)
specifiche_target_analyzer.md   specifica di progetto
CHANGELOG.md
LICENSE
```

## Roadmap

- [x] Fase 1: layout, canvas, caricamento immagine
- [x] Fase 2: zoom/pan, punti, drag, undo/redo
- [x] Fase 3: motore di calcolo e risultati in tempo reale
- [ ] Fase 4: wrapper Python `pywebview` + API file system
- [ ] Fase 5: build PyInstaller su runner Windows (GitHub Actions)

## Licenza

MIT, vedi [LICENSE](LICENSE).
