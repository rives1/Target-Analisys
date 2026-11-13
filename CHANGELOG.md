# Changelog

## [0.1.0] - 2026-11-13
### Aggiunto
- `src/index.html` autocontenuto: layout a due colonne (65/35), canvas con zoom (rotella, centrato sul cursore) e pan.
- Caricamento immagine da pulsante e drag & drop (JPG/PNG/WebP/BMP).
- Calibrazione scala a due punti (mm, cm, pollici).
- Gruppi multipli per immagine, ciascuno con nome, colore, punto di mira e fori.
- Punti trascinabili, eliminazione con tasto destro / Canc / tabella, "Elimina ultimo", "Elimina tutto".
- Undo/Redo a snapshot (300 livelli), scorciatoie da tastiera.
- Motore di calcolo: centroide, extreme spread c-c e bordo-bordo (con calibro), raggio medio, larghezza×altezza,
  angoli esatti (MOA, MIL, IPHY), scostamento dal punto di mira, correzione in click per asse.
- Salvataggio/caricamento sessione JSON (immagine incorporata opzionale).
- Result Card PNG del gruppo attivo e copia risultati in testo.
- Content-Security-Policy che blocca qualsiasi connessione di rete.
- Test automatici del motore di calcolo (`node tests/calc.test.js`, 29 verifiche).
