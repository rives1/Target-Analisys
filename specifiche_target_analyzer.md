# 📄 Specifiche di Progetto e di Sviluppo: Target Analyzer Portatile

> **Revisione 2 (2026-11-13)**: l'applicazione è un **singolo file HTML** che gira in qualsiasi browser moderno su qualsiasi sistema operativo.
> Eliminati il requisito dell'eseguibile `.exe` per Windows, il wrapper Python/pywebview (ex Fase 4) e la build PyInstaller (ex Fase 5).
> Corretta la formula MOA (sez. 5.6).

## 1. Panoramica del Progetto
**Obiettivo**: Realizzare un'applicazione portatile e multipiattaforma, costituita da un unico file HTML, che replichi esattamente le funzionalità di [https://www.holdover.ca/target-analyzer/](https://www.holdover.ca/target-analyzer/).  
**Scopo**: Consentire ai tiratori di caricare una foto di un bersaglio, calibrarla su una scala nota, marcare i fori dei proiettili e ottenere misurazioni precise (dimensione del gruppo, raggio medio, MOA/MIL, correzione in click) senza inviare alcun dato a server esterni.  
**Vincolo Principale**: Il software deve essere **100% portatile**: un singolo file `index.html` autocontenuto (HTML, CSS e JavaScript inline, nessuna libreria esterna) che si apre con doppio clic in un browser moderno (Edge, Chrome, Firefox, Safari) su Windows, macOS, Linux, **senza alcuna installazione** e senza dipendenze.

---

## 2. Requisiti Funzionali
Il software deve implementare le seguenti funzionalità, replicando la logica del sito originale:

1. **Caricamento Immagine**: Supporto per caricare un'immagine locale (JPG, PNG) tramite pulsante o drag-and-drop.
2. **Calibrazione della Scala**: 
   - L'utente seleziona due punti sull'immagine che rappresentano una distanza reale nota (es. 1 pollice o 10 mm).
   - L'utente inserisce il valore reale di questa distanza e l'unità di misura.
3. **Marcatura dei Punti**:
   - Clic sull'immagine per aggiungere punti di tipo: "Punto di mira" (Point of Aim), "Foro" (Shot Hole).
   - Funzionalità di spostamento (drag) dei punti già inseriti per affinamento.
   - Funzionalità di annullamento (Undo), ripristino (Redo) ed eliminazione di singoli punti o di tutti i punti.
4. **Motore di Calcolo** (aggiornato in tempo reale):
   - **Dimensione del Gruppo (Group Size)**: Massima distanza euclidea tra due qualsiasi fori marcati (Extreme Spread).
   - **Raggio Medio (Mean Radius)**: Media delle distanze di tutti i fori dal centroide (centro geometrico) del gruppo.
   - **Offset del Punto di Mira**: Distanza e direzione (es. "3 click in alto, 1 a destra") tra il punto di mira e il centroide del gruppo.
   - **Misura Angolare**: Conversione della dimensione del gruppo in MOA (Minute of Angle) e MIL (Milliradian), basata sulla distanza di tiro inserita dall'utente.
   - **Correzione in Click**: Calcolo del numero di click necessari per correggere l'offset, basato sul valore di click del mirino inserito dall'utente (es. 1/4 MOA per click, 0.1 MIL per click).
   - **H-spread / V-spread**, **FOM** (media tra H e V), **SD delle distanze dal centro**, **SD radiale √(σx²+σy²)**, **CEP / R95 / R99** previsti (modello circolare normale, σ corretto per pochi colpi).
   - **Flyer**: segnalati automaticamente (leave-one-out, soglia k·SD, default 2, da 5 colpi); ogni colpo può essere escluso dal gruppo e dalle statistiche.
   - **Forma del gruppo**: angolo dell'asse maggiore (gradi dalla verticale, senso orario), rapporto d'aspetto (asse maggiore / minore), ellisse di dispersione di concentrazione (χ², percentuale 50/90/95/99%) disegnata sull'immagine e nei grafici.
   - **Tabella punti**: per ogni foro distanza dal punto di mira e dal centro gruppo, direzione dal centro gruppo in gradi (0° = alto, senso orario) con sigla cardinale.
5. **Gestione Dati Locali**:
   - Salvataggio della sessione di lavoro in un file JSON locale (non nel `localStorage`, per garantire vera portabilità): dialog «Salva con nome» del browser dove disponibile (File System Access API: Edge/Chrome), altrimenti download del file.
   - Funzionalità di "Importa JSON" per riprendere sessioni precedenti.
6. **Esportazione Risultati**: Generazione di una "Result Card" (scheda risultato) in formato testo o immagine sintetica da affiancare al quaderno di tiro. L'immagine può riguardare il solo gruppo attivo (default; include la tabella punti dal centro gruppo in giù) o tutti i gruppi.
7. **Dati di ricarica e condizioni** (per gruppo): data, bossolo, polvere e carica in grani, palla, innesco, condizioni atmosferiche, temperatura, velocità e direzione del vento, colpi sparati totali (flyer esclusi compresi), colpi scaldacanna, note. Devono comparire nella Result Card.
8. **Griglia angolare** opzionale (MOA o MIL) sovrapposta all'immagine, centrata sul punto di mira, per una verifica visiva immediata.
9. **Tema scuro** opzionale per la pagina.
10. **Grafici del gruppo attivo**: dispersione dei soli punti (senza immagine), istogramma delle distanze dal centro gruppo, diagramma a orologio delle direzioni (dal punto di mira o dal centro gruppo).
11. **Statistiche comparate**: con più gruppi (nella sessione o importati da altre sessioni come storico in sola lettura) confronto affiancato delle metriche principali, differenza della metrica scelta rispetto al gruppo precedente, grafico dell'andamento nel tempo e media mobile sugli ultimi N gruppi. Metrica selezionabile (ES di default, raggio medio, FOM, CEP), in MOA o MIL.
12. **Modalità Offline Totale**: Nessuna chiamata di rete, nessun tracking, nessun caricamento su cloud.

---

## 3. Requisiti Non Funzionali e Vincoli
- **Piattaforma**: qualsiasi sistema operativo con un browser moderno (Chromium ≥ 100, Firefox ≥ 100, Safari ≥ 16). Riferimento principale: Edge/Chrome su Windows 11.
- **Portabilità**: Il rilascio è il singolo file `index.html` (distribuibile anche da chiavetta USB o come allegato). Nessun eseguibile, nessun installer.
- **Distribuzione web**: lo stesso file è pubblicato su GitHub Pages (https://rives1.github.io/Target-Analisys/) direttamente dal branch `main` (radice del repo, `index.html` che reindirizza a `src/index.html`), aggiornato automaticamente a ogni push. Anche online nessun dato lascia il dispositivo.
- **Privacy**: I dati dell'immagine e delle sessioni devono risiedere esclusivamente nella memoria locale o su file system locale gestito dall'utente.
- **Prestazioni**: Rendering del canvas fluido anche con immagini ad alta risoluzione (fino a 20MP). Zoom e pan dell'immagine devono essere reattivi.
- **Interfaccia**: Layout pulito, moderno, a due colonne (area di lavoro a sinistra, pannello di controllo e risultati a destra), responsive all'interno della finestra desktop.

---

## 4. Stack Tecnologico
- **Unico file `index.html`**: HTML5, CSS3 vanilla, JavaScript vanilla. `<canvas>` per il disegno e l'interazione sull'immagine.
- **Nessuna dipendenza esterna** (niente CDN): requisito offline. Una Content-Security-Policy nel file blocca qualsiasi connessione di rete.
- **File system**: lettura con `<input type=file>` / drag & drop; scrittura con File System Access API (`showSaveFilePicker`) dove disponibile, altrimenti download.
- **Test**: test automatici del motore di calcolo con Node.js (`node tests/calc.test.js`), che estraggono il blocco di calcolo dal file HTML.

*(Rimossi: wrapper Python + `pywebview` e build PyInstaller. Motivo: tutto il programma gira già nel solo file HTML; il wrapper aggiungeva solo il vincolo Windows.)*

---

## 5. Specifiche Algoritmiche e di Calcolo
L'AI deve implementare le seguenti formule matematiche nel modulo JavaScript:

1. **Distanza Euclidea** tra due punti $P_1(x_1, y_1)$ e $P_2(x_2, y_2)$:  
   $d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$
2. **Fattore di Scala** (pixel per unità reale):  
   $S = \frac{d_{pixel}}{d_{reale\_nota}}$
3. **Centroide del Gruppo** (Media delle coordinate X e Y di tutti i fori):  
   $C_x = \frac{\sum x_i}{n}$, $C_y = \frac{\sum y_i}{n}$
4. **Dimensione del Gruppo (Extreme Spread)**:  
   $Max(d)$ tra tutte le coppie di punti di tipo "Foro".
5. **Raggio Medio**:  
   $MR = \frac{\sum d(P_i, C)}{n}$, dove $C$ è il centroide.
6. **Conversione Angolare** (approssimazione standard per piccole angolazioni):
   - **Angolo esatto** di una dimensione $s$ a distanza $D$: $\theta = 2\arctan\left(\frac{s}{2D}\right)$; di uno scostamento $o$: $\theta = \arctan\left(\frac{o}{D}\right)$
   - **MOA**: $\theta \times (180/\pi) \times 60$ (1 MOA ≈ 1,047" a 100 yd)
   - *Nota: $\text{size (in)} / \text{distance (yd)} \times 100$ dà i pollici a 100 yarde (IPHY/SMOA), non i MOA: differenza ≈ 4,7%. Il programma mostra IPHY solo come unità di click opzionale.*
   - **MIL**: $\theta \times 1000$ (≈ $\text{size (mm)} / \text{distance (m)}$ per piccoli angoli)
7. **Correzione in Click**:  
   $\text{Click} = \text{Round}\left(\frac{\text{Offset (MOA o MIL)}}{\text{Valore per click (es. 0.25 MOA)}}\right)$

---

## 6. Design dell'Interfaccia Utente (UI/UX)
L'interfaccia deve essere suddivisa in due pannelli principali:

- **Pannello Sinistro (Area di Lavoro - 65% larghezza)**:
  - Area Canvas con supporto a Zoom (rotella mouse) e Pan (trascinamento).
  - Toolbar flottante in alto: `[Carica Foto]` `[Undo]` `[Redo]` `[Elimina Ultimo]` `[Adatta allo Schermo]`.
  - Overlay visivo: i punti devono essere chiaramente distinguibili per colore (es. Rosso = Punto di mira, Blu = Foro, Verde = Punti di calibrazione scala).
- **Pannello Destro (Controlli e Risultati - 35% larghezza di default, ridimensionabile trascinando la linea di separazione)**:
  - **Intestazione**: titolo, versione e, subito sotto, `[Esporta Result Card]` con la scelta «Gruppo attivo / Tutti i gruppi».
  - **Sezione Parametri**: Input per "Distanza di calibrazione nota", "Distanza di tiro", "Valore click mirino (MOA/MIL)", "Calibro" (combo con i calibri più diffusi e diametro nominale della palla in mm, sempre modificabile a mano per calibri non convenzionali).
  - **Sezione Risultati**: Visualizzazione in tempo reale di: Dimensione Gruppo, Raggio Medio, MOA/MIL, Correzione suggerita (es. "3 click SU, 1 click DESTRA").
  - **Sezione Gestione Dati**: Tabella elenco punti marcati del gruppo attivo (nome e colore del gruppo indicati in testa; con coordinate X/Y, tipo e **click ↕/↔ per portare il punto sul punto di mira**, più una riga evidenziata per il **centro gruppo**, che è la correzione da applicare), pulsante `[Salva Sessione JSON]`, `[Carica Sessione JSON]`, `[Copia risultati]`.
  - **Nomi dei file salvati**: data e ora locali in coda, formato `AAAA-MM-GG--hh-mm` (es. `2026-10-01--22-33`).

---

## 7. Piano di Sviluppo Step-by-Step (Prompt per l'AI)
Se si utilizza un'AI per scrivere il codice, fornire queste istruzioni in sequenza:

1. **Fase 1: Struttura e Frontend Base**  
   "Crea un file `index.html` con un layout a due colonne usando CSS moderno. Includi un elemento `<canvas>` a sinistra e un pannello di controllo a destra. Implementa la logica JavaScript base per caricare un'immagine locale nel canvas e gestirne il rendering."
2. **Fase 2: Interazione Canvas**  
   "Aggiungi la logica JavaScript per gestire gli eventi del mouse sul canvas: zoom con la rotella, pan con trascinamento, e clic per aggiungere punti (oggetti con proprietà x, y, tipo). Implementa Undo/Redo con uno stack di stati."
3. **Fase 3: Motore di Calcolo**  
   "Implementa le funzioni matematiche per calcolare: fattore di scala, centroide, dimensione massima del gruppo, raggio medio, MOA/MIL e correzione in click. Aggiorna il DOM del pannello destro in tempo reale quando i punti cambiano."
*(Fasi 4 e 5, wrapper Python e build PyInstaller, eliminate nella revisione 2.)*

---

## 8. Criteri di Collaudo e Accettazione
Prima di considerare il progetto completato, verificare i seguenti punti:
- [x] Il file `index.html` si apre con doppio clic e funziona in Edge/Chrome su Windows 11 e in almeno un altro browser/OS (es. Firefox, Safari su macOS), senza installazione. *(Chrome: test automatici; Firefox: collaudo utente, v0.3.0)*
- [ ] Caricando un'immagine di test e marcando 3 punti a distanza nota, i calcoli di MOA e correzione in click corrispondono a quelli ottenuti manualmente o sul sito originale.
- [ ] Le funzionalità di Salvataggio e Caricamento JSON funzionano correttamente, preservando tutti i punti e i parametri.
- [ ] Monitorando il traffico di rete (es. con Resource Monitor o Wireshark), non viene effettuata alcuna chiamata in uscita durante l'utilizzo.
- [ ] Il ridimensionamento della finestra non rompe il layout e il canvas si adatta correttamente.

---
