# 📄 Specifiche di Progetto e di Sviluppo: Target Analyzer Portatile

## 1. Panoramica del Progetto
**Obiettivo**: Realizzare un software desktop portatile per Windows 11 x64 che replichi esattamente le funzionalità di [https://www.holdover.ca/target-analyzer/](https://www.holdover.ca/target-analyzer/).  
**Scopo**: Consentire ai tiratori di caricare una foto di un bersaglio, calibrarla su una scala nota, marcare i fori dei proiettili e ottenere misurazioni precise (dimensione del gruppo, raggio medio, MOA/MIL, correzione in click) senza inviare alcun dato a server esterni.  
**Vincolo Principale**: Il software deve essere **100% portatile**, eseguito come singolo file `.exe` (o cartella autocontenuta) su Windows 11 x64, **senza alcuna procedura di installazione** e senza dipendenze di sistema pregresse (a eccezione di WebView2, già nativo in Windows 11).

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
5. **Gestione Dati Locali**:
   - Salvataggio della sessione di lavoro in un file JSON locale (superando i limiti del `localStorage` del browser per garantire vera portabilità).
   - Funzionalità di "Importa JSON" per riprendere sessioni precedenti.
6. **Esportazione Risultati**: Generazione di una "Result Card" (scheda risultato) in formato testo o immagine sintetica da affiancare al quaderno di tiro.
7. **Modalità Offline Totale**: Nessuna chiamata di rete, nessun tracking, nessun caricamento su cloud.

---

## 3. Requisiti Non Funzionali e Vincoli
- **Sistema Operativo**: Windows 11 x64.
- **Portabilità**: Il rilascio finale deve essere un singolo file `.exe` (o una cartella con eseguibile e risorse, senza installer MSI/NSIS).
- **Privacy**: I dati dell'immagine e delle sessioni devono risiedere esclusivamente nella memoria locale o su file system locale gestito dall'utente.
- **Prestazioni**: Rendering del canvas fluido anche con immagini ad alta risoluzione (fino a 20MP). Zoom e pan dell'immagine devono essere reattivi.
- **Interfaccia**: Layout pulito, moderno, a due colonne (area di lavoro a sinistra, pannello di controllo e risultati a destra), responsive all'interno della finestra desktop.

---

## 4. Stack Tecnologico Raccomandato (Ottimizzato per Generazione AI)
Per massimizzare la probabilità che un'AI generi codice funzionante al primo tentativo, si raccomanda il seguente stack:

- **Frontend (UI e Logica di Calcolo)**: HTML5, CSS3 (Tailwind CSS o CSS vanilla per semplicità), JavaScript (Vanilla JS o Alpine.js per la reattività). L'uso di `<canvas>` è obbligatorio per il disegno e l'interazione sull'immagine.
- **Wrapper Desktop**: **Python + `pywebview`**.  
  *Motivazione*: `pywebview` utilizza il motore Edge WebView2 già presente in Windows 11, offrendo un'esperienza nativa e leggera. Python gestisce facilmente le operazioni di file system (salvataggio/caricamento JSON) che il browser sandboxato non può fare in modo portabile.
- **Strumento di Build**: **PyInstaller** con il flag `--onefile` e `--noconsole`. Questo compila l'interprete Python, le librerie e i file HTML/JS in un unico eseguibile `.exe` portatile.

*(Alternativa valida: Tauri (Rust + JS), ma richiede un toolchain Rust che può essere più complesso da far generare e configurare correttamente all'AI in un unico flusso).*

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
   - **MOA**: $\text{Group Size (inch)} / \text{Distance (yards)} \times 100$ *(o formula esatta: $\arctan(\text{size}/\text{distance}) \times (180/\pi) \times 60$)*
   - **MIL**: $\text{Group Size (mm)} / \text{Distance (m)}$
7. **Correzione in Click**:  
   $\text{Click} = \text{Round}\left(\frac{\text{Offset (MOA o MIL)}}{\text{Valore per click (es. 0.25 MOA)}}\right)$

---

## 6. Design dell'Interfaccia Utente (UI/UX)
L'interfaccia deve essere suddivisa in due pannelli principali:

- **Pannello Sinistro (Area di Lavoro - 65% larghezza)**:
  - Area Canvas con supporto a Zoom (rotella mouse) e Pan (trascinamento).
  - Toolbar flottante in alto: `[Carica Foto]` `[Undo]` `[Redo]` `[Elimina Ultimo]` `[Adatta allo Schermo]`.
  - Overlay visivo: i punti devono essere chiaramente distinguibili per colore (es. Rosso = Punto di mira, Blu = Foro, Verde = Punti di calibrazione scala).
- **Pannello Destro (Controlli e Risultati - 35% larghezza)**:
  - **Sezione Parametri**: Input per "Distanza di calibrazione nota", "Distanza di tiro", "Valore click mirino (MOA/MIL)".
  - **Sezione Risultati**: Visualizzazione in tempo reale di: Dimensione Gruppo, Raggio Medio, MOA/MIL, Correzione suggerita (es. "3 click SU, 1 click DESTRA").
  - **Sezione Gestione Dati**: Tabella elenco punti marcati (con coordinate X/Y e tipo), pulsante `[Salva Sessione JSON]`, `[Carica Sessione JSON]`, `[Esporta Result Card]`.

---

## 7. Piano di Sviluppo Step-by-Step (Prompt per l'AI)
Se si utilizza un'AI per scrivere il codice, fornire queste istruzioni in sequenza:

1. **Fase 1: Struttura e Frontend Base**  
   "Crea un file `index.html` con un layout a due colonne usando CSS moderno. Includi un elemento `<canvas>` a sinistra e un pannello di controllo a destra. Implementa la logica JavaScript base per caricare un'immagine locale nel canvas e gestirne il rendering."
2. **Fase 2: Interazione Canvas**  
   "Aggiungi la logica JavaScript per gestire gli eventi del mouse sul canvas: zoom con la rotella, pan con trascinamento, e clic per aggiungere punti (oggetti con proprietà x, y, tipo). Implementa Undo/Redo con uno stack di stati."
3. **Fase 3: Motore di Calcolo**  
   "Implementa le funzioni matematiche per calcolare: fattore di scala, centroide, dimensione massima del gruppo, raggio medio, MOA/MIL e correzione in click. Aggiorna il DOM del pannello destro in tempo reale quando i punti cambiano."
4. **Fase 4: Wrapper Python e File System**  
   "Crea uno script Python `main.py` che usa `webview.create_window` per caricare `index.html`. Aggiungi API JavaScript-to-Python (tramite `window.pywebview.api`) per permettere al frontend di salvare e caricare file JSON dal file system locale."
5. **Fase 5: Build e Packaging**  
   "Fornisci lo script di configurazione e il comando PyInstaller esatto (`pyinstaller --onefile --noconsole --add-data "index.html;." main.py`) per generare l'eseguibile portatile Windows x64."

---

## 8. Criteri di Collaudo e Accettazione
Prima di considerare il progetto completato, verificare i seguenti punti:
- [ ] L'eseguibile `.exe` si avvia su Windows 11 x64 senza richiedere privilegi di amministratore o installazione.
- [ ] Caricando un'immagine di test e marcando 3 punti a distanza nota, i calcoli di MOA e correzione in click corrispondono a quelli ottenuti manualmente o sul sito originale.
- [ ] Le funzionalità di Salvataggio e Caricamento JSON funzionano correttamente, preservando tutti i punti e i parametri.
- [ ] Monitorando il traffico di rete (es. con Resource Monitor o Wireshark), non viene effettuata alcuna chiamata in uscita durante l'utilizzo.
- [ ] Il ridimensionamento della finestra non rompe il layout e il canvas si adatta correttamente.

---

### 💡 Nota per l'Utilizzo con l'AI
Per ottenere il miglior risultato, copia e incolla questo documento intero nel tuo prompt iniziale all'AI, aggiungendo alla fine:  
*"Agisci come un Senior Software Engineer. Inizia generando la Fase 1 e la Fase 2 in un unico file HTML/JS autocontenuto per permettermi di testare subito la logica del canvas. Attendi la mia conferma prima di procedere con la Fase 4 (wrapper Python)."*