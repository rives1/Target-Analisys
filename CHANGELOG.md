# Changelog

## [0.3.0] - 2026-11-13
### Cambiato
- **Revisione 2 della specifica**: l'applicazione è il solo file `src/index.html`, multipiattaforma.
  Eliminati il requisito `.exe` Windows x64, il wrapper Python/pywebview (ex Fase 4) e la build PyInstaller (ex Fase 5).
- `specifiche_target_analyzer.md` aggiornato di conseguenza (incluse la correzione della formula MOA e la rimozione della nota per l'AI).
- Salvataggio file: dialog nativo «Salva con nome» tramite File System Access API (Edge/Chrome), con ripiego sul download
  (Firefox/Safari). Se l'utente annulla, nessun messaggio di conferma.
- Result Card generata con `canvas.toBlob` invece di un data URL.
- Nome dei file salvati con data/ora locale (prima UTC).
### Rimosso
- Codice di aggancio a `window.pywebview`.

## [0.2.0] - 2026-11-13
### Aggiunto
- Lente di ingrandimento (×4 rispetto alla vista, mirino ciano con centro libero): visibile al passaggio del mouse
  nelle modalità Scala/Mira/Foro (attivabile/disattivabile con 🔍 o tasto `L`) e sempre attiva durante il trascinamento
  di un punto, centrata esattamente sul punto trascinato. Nella lente i fori sono disegnati solo come contorno sottile.
- Result Card: selettore «Gruppo attivo» (default) / «Tutti i gruppi»; la versione multi-gruppo mostra la rosata
  completa e un riepilogo compatto per ogni gruppo.
- Licenza MIT.

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
