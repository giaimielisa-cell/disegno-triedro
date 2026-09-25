# Triedro

**Un solido, più modi di rappresentarlo.**

Applicazione web per la didattica dei *metodi di rappresentazione* nel biennio
e nel triennio del liceo scientifico. Un solido viene definito una volta sola e
mostrato in proiezioni ortogonali, assonometria, prospettiva e sezione: sono
sempre gli stessi dati, cambia solo il modo di proiettarli. È questo il punto
che si fatica a far passare alla lavagna, ed è il motivo per cui l'applicazione
esiste.

👉 **[Apri Triedro](https://giaimielisa-cell.github.io/disegno-triedro/)**

Si apre nel browser, da computer, tablet o telefono. Non c'è niente da
installare e non serve registrarsi.

---

## Cosa contiene

### Esploratore

Si sceglie un solido (prismi, piramidi, solidi di rotazione, solidi platonici,
solidi composti) e lo si guarda con i quattro metodi:

- **Proiezioni ortogonali** — metodo europeo, primo triedro: prospetto, pianta
  e vista da sinistra, con linea di terra, linee di richiamo e ribaltamento ad
  archi. Si può spostare il solido nello spazio (allontanamento dal P.V., quota
  sul P.O., distanza dal P.L.) e vedere le tre viste muoversi di conseguenza.
- **Assonometria** — isometrica, cavaliera, monometrica e rotazione libera col
  trascinamento del dito o del mouse, con la lettura degli angoli fra gli assi
  e dei coefficienti di riduzione.
- **Prospettiva** — centrale e accidentale, con linea d'orizzonte, punto
  principale e punti di fuga trascinabili direttamente nel disegno.
- **Sezioni** — piani paralleli ai piani di proiezione e piani inclinati, con
  tracce, tratteggio a 45° e vera forma ottenuta per ribaltamento sul P.V.

Si possono accendere e spegnere spigoli nascosti, etichette dei vertici,
triedro di riferimento e griglia, e mettere due metodi affiancati per
confrontarli.

### Palestra

Esercizi generati ogni volta diversi, con correzione immediata, punteggio e
statistiche per argomento. I solidi sbagliati tornano a farsi rivedere. Due
livelli di difficoltà. Le alternative sbagliate non sono buttate lì a caso:
differiscono dalla risposta giusta per un dettaglio vero e verificato: un
coefficiente, un orientamento, una faccia.

### Aiuti alla lettura

Il pulsante **Aa Leggibilità** in alto a destra apre tre comandi indipendenti
— dimensione del testo, interlinea, spaziatura fra le lettere — e la lettura
ad alta voce delle consegne della Palestra, spenta di norma. Le scelte restano
memorizzate nel browser dello studente.

---

## Come è fatta

Sito statico: solo HTML, CSS e JavaScript scritti a mano. **Nessuna libreria,
nessun carattere e nessuna immagine presi dall'esterno**, nessun passaggio di
compilazione. Si apre anche senza collegamento a internet e non raccoglie
nessun dato di chi lo usa.

I disegni sono SVG generati dal codice a partire dai vertici e dalle facce del
solido: nessuna figura è disegnata a mano.

| File | A cosa serve |
| --- | --- |
| `index.html` | la pagina |
| `css/stile.css` | colori, caratteri e impaginazione (le variabili in cima) |
| `js/geometria.js` | proiezioni, spigoli nascosti, punti di fuga |
| `js/solidi.js` | i solidi e l'ordine delle lettere dei vertici |
| `js/sezione.js` | taglio del solido, vera forma, ribaltamenti |
| `js/disegno.js` | tutto ciò che finisce sul foglio |
| `js/esploratore.js` · `js/palestra.js` | le due sezioni |
| `js/accessibilita.js` | gli aiuti alla lettura |
| `js/app.js` | avvia l'applicazione |

Le convenzioni di disegno rispettate in tutti i metodi (metodo europeo, primo
triedro, ordine delle lettere dei vertici, ecc.) sono scritte in
[`CLAUDE.md`](CLAUDE.md).

## Provarla sul proprio computer

Scaricato il repository, la pagina va aperta attraverso un piccolo server
locale: aperta come semplice file alcune parti non funzionano. Con Python
installato basta, dalla cartella del progetto:

```bash
python -m http.server 8123
```

e poi aprire `http://localhost:8123/index.html`.

## Crediti

Realizzata da **Elisa Giaimi**, docente di Disegno e Storia dell'Arte, per le
proprie classi di liceo scientifico, nell'ambito di un corso di formazione
sull'intelligenza artificiale. Il codice è stato scritto con l'assistenza di
Claude (Anthropic).

Chiunque insegni la materia può usarla, copiarla e adattarla liberamente per la
propria didattica.
