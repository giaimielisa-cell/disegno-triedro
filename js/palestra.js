// Palestra: esercizi generati a caso, con punteggio e riscontro immediato.
// I distrattori nascono dalla risposta corretta cambiando un solo dato, e
// vengono accettati solo se producono davvero viste diverse: così non sono
// né palesemente errati né ambigui.

const Palestra = (function () {
  'use strict';

  const stato = {
    argomento: 'ortogonali',
    livello: 'facile',
    punteggio: 0,
    serie: 0,
    miglioreSerie: 0,
    risposte: 0,
    statistiche: {
      ortogonali: { giuste: 0, totali: 0 },
      sezioni: { giuste: 0, totali: 0 },
      prospettiva: { giuste: 0, totali: 0 }
    },
    ripescaggio: [],
    esercizio: null,
    risposto: false
  };

  let el = {};

  function scegli(elenco) { return elenco[Math.floor(Math.random() * elenco.length)]; }
  function intero(minimo, massimo) { return minimo + Math.floor(Math.random() * (massimo - minimo + 1)); }

  // --- Descrizione dei solidi da esercizio ---
  // Un solido è descritto da pochi dati: cambiarne uno solo dà un distrattore.

  function costruisci(d) {
    let solido;
    switch (d.famiglia) {
      case 'prisma': solido = Solidi.prismaRegolare(d.lati, d.raggio, d.altezza, d.rot); break;
      case 'piramide': solido = Solidi.piramideRegolare(d.lati, d.raggio, d.altezza, d.rot); break;
      case 'tronco': solido = Solidi.troncoPiramide(d.lati, d.raggio, d.raggioCima, d.altezza, d.rot); break;
      case 'cilindro': solido = Solidi.cilindro(d.raggio, d.altezza); break;
      case 'cono': solido = Solidi.cono(d.raggio, d.altezza); break;
      case 'troncoCono': solido = Solidi.troncoCono(d.raggio, d.raggioCima, d.altezza); break;
      case 'L': solido = Solidi.solidoL(d.l, d.h, d.s, d.p); break;
      case 'T': solido = Solidi.solidoT(d.l, d.h, d.s, d.p); break;
      case 'gradini': solido = Solidi.solidoGradini(d.l, d.h, d.p); break;
      case 'C': solido = Solidi.solidoC(d.l, d.h, d.s, d.p); break;
      case 'incavo': solido = Solidi.blocoConIncavo(d.l, d.h, d.p, d.li, d.pi); break;
      case 'foro': solido = Solidi.bloccoConForo(d.l, d.h, d.p, d.li, d.pi); break;
      default: throw new Error('famiglia sconosciuta: ' + d.famiglia);
    }
    if (d.specchiato) solido = Solidi.specchia(solido);
    if (d.rotazione) solido = Solidi.ruota(solido, d.rotazione);
    return solido;
  }

  function descrizioneCasuale(livello) {
    if (livello === 'facile') {
      const famiglia = scegli(['prisma', 'prisma', 'piramide', 'tronco', 'cilindro', 'cono', 'troncoCono']);
      const lati = scegli([3, 4, 5, 6, 8]);
      const raggio = intero(26, 34);
      const altezza = intero(40, 70);
      return {
        famiglia: famiglia, lati: lati, raggio: raggio, altezza: altezza,
        raggioCima: Math.round(raggio * 0.55), rot: famiglia === 'prisma' && lati === 4 ? 45 : 0,
        specchiato: false, rotazione: 0
      };
    }
    const famiglia = scegli(['L', 'T', 'gradini', 'C', 'incavo', 'foro']);
    return {
      famiglia: famiglia,
      l: intero(56, 70), h: intero(48, 64), p: intero(32, 44), s: intero(18, 26),
      li: intero(22, 30), pi: intero(16, 24),
      specchiato: Math.random() < 0.5,
      rotazione: scegli([0, 0, 90, 270])
    };
  }

  // Ogni variante cambia un dato solo rispetto alla descrizione di partenza.
  function varianti(d) {
    const lista = [];
    const copia = modifiche => Object.assign({}, d, modifiche);

    if (d.famiglia === 'prisma' || d.famiglia === 'piramide' || d.famiglia === 'tronco') {
      [-2, -1, 1, 2].forEach(delta => {
        const lati = d.lati + delta;
        if (lati >= 3 && lati <= 10) lista.push(copia({ lati: lati }));
      });
    }
    if (d.famiglia === 'prisma') lista.push(copia({ famiglia: 'tronco' }), copia({ famiglia: 'piramide' }));
    if (d.famiglia === 'piramide') lista.push(copia({ famiglia: 'tronco' }), copia({ famiglia: 'prisma' }));
    if (d.famiglia === 'tronco') lista.push(copia({ famiglia: 'prisma' }), copia({ famiglia: 'piramide' }));
    if (d.famiglia === 'cilindro') lista.push(copia({ famiglia: 'cono' }), copia({ famiglia: 'troncoCono' }));
    if (d.famiglia === 'cono') lista.push(copia({ famiglia: 'cilindro' }), copia({ famiglia: 'troncoCono' }));
    if (d.famiglia === 'troncoCono') lista.push(copia({ famiglia: 'cilindro' }), copia({ famiglia: 'cono' }));

    lista.push(copia({ altezza: Math.round(d.altezza * 1.45) }));
    lista.push(copia({ altezza: Math.round(d.altezza * 0.6) }));
    if (d.raggioCima) lista.push(copia({ raggioCima: Math.round(d.raggio * 0.85) }));

    // solidi composti: specchiatura, rotazione e una misura alla volta
    if (d.l) {
      lista.push(copia({ specchiato: !d.specchiato }));
      lista.push(copia({ rotazione: (d.rotazione + 90) % 360 }));
      lista.push(copia({ rotazione: (d.rotazione + 180) % 360 }));
      lista.push(copia({ s: Math.round(d.s * 1.5) }));
      lista.push(copia({ h: Math.round(d.h * 0.7) }));
      lista.push(copia({ p: Math.round(d.p * 1.5) }));
      lista.push(copia({ li: Math.round(d.li * 1.4) }));
    }
    return lista;
  }

  // --- Firma delle viste ---
  // Due solidi con la stessa firma darebbero le stesse proiezioni: una domanda
  // che li mettesse insieme non avrebbe una risposta sola.

  function firmaPerVista(solido, nome) {
    const vista = Geo.vistaOrtogonale(nome);
    const spigoli = Geo.spigoliDaTracciare(solido, vista);
    const segmenti = Geo.segmentiVisibilita(solido, spigoli, vista, 6);
    const q = v => Math.round(v * 2) / 2;
    return segmenti.map(s => {
      const a = vista.project(s.a), b = vista.project(s.b);
      const p = [[q(a[0]), q(a[1])], [q(b[0]), q(b[1])]];
      p.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
      return (s.nascosto ? 'n' : 'v') + p[0] + '/' + p[1];
    }).sort().join(';');
  }

  function firmaViste(solido) {
    return {
      prospetto: firmaPerVista(solido, 'prospetto'),
      pianta: firmaPerVista(solido, 'pianta'),
      laterale: firmaPerVista(solido, 'laterale')
    };
  }

  function firmeUguali(a, b) {
    return a.prospetto === b.prospetto && a.pianta === b.pianta && a.laterale === b.laterale;
  }

  function visteCheDifferiscono(a, b) {
    const nomi = [];
    if (a.prospetto !== b.prospetto) nomi.push('il prospetto');
    if (a.pianta !== b.pianta) nomi.push('la pianta');
    if (a.laterale !== b.laterale) nomi.push('la vista laterale');
    return nomi;
  }

  // --- Generazione di un esercizio sulle proiezioni ortogonali ---

  function generaQuattroSolidi() {
    for (let tentativo = 0; tentativo < 12; tentativo++) {
      const descrizione = stato.ripescaggio.length && Math.random() < 0.4
        ? stato.ripescaggio[intero(0, stato.ripescaggio.length - 1)]
        : descrizioneCasuale(stato.livello);
      const corretto = { descrizione: descrizione, solido: costruisci(descrizione) };
      corretto.firma = firmaViste(corretto.solido);

      const candidati = varianti(descrizione).sort(() => Math.random() - 0.5);
      const scelti = [];
      for (const c of candidati) {
        if (scelti.length === 3) break;
        let solido;
        try { solido = costruisci(c); } catch (e) { continue; }
        const firma = firmaViste(solido);
        if (firmeUguali(firma, corretto.firma)) continue;          // indistinguibile
        if (scelti.some(s => firmeUguali(s.firma, firma))) continue; // doppione
        scelti.push({ descrizione: c, solido: solido, firma: firma });
      }
      if (scelti.length === 3) return { corretto: corretto, distrattori: scelti };
    }
    return null;
  }

  function generaEsercizioOrtogonali() {
    const insieme = generaQuattroSolidi();
    if (!insieme) return null;
    const tipo = Math.random() < 0.5 ? 'viste-al-solido' : 'solido-alle-viste';
    const opzioni = [insieme.corretto].concat(insieme.distrattori).sort(() => Math.random() - 0.5);
    return {
      argomento: 'ortogonali',
      tipo: tipo,
      domanda: tipo === 'viste-al-solido'
        ? 'Queste sono le tre proiezioni ortogonali di un solido. Quale dei quattro solidi le genera?'
        : 'Questo è il solido in assonometria. Quale terna di proiezioni ortogonali gli corrisponde?',
      corretto: insieme.corretto,
      opzioni: opzioni,
      indiceCorretto: opzioni.indexOf(insieme.corretto)
    };
  }

  // --- Disegno ---

  const OPZIONI_VISTE = {
    spigoliNascosti: true, etichette: false, assi: false, griglia: false,
    richiami: false, piani: false, resa: 'wireframe',
    posizione: { allontanamento: 14, quota: 0, distanzaPL: 14 }
  };
  const OPZIONI_ASSONOMETRIA = {
    spigoliNascosti: true, etichette: false, assi: false, griglia: false, resa: 'wireframe'
  };

  function nuovoSvg(contenitore, classe) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', classe);
    contenitore.appendChild(svg);
    return svg;
  }

  function disegnaViste(svg, solido) {
    Disegno.disegnaProiezioniOrtogonali(svg, solido, OPZIONI_VISTE);
  }

  function disegnaAssonometria(svg, solido) {
    Disegno.disegnaAssonometria(svg, solido,
      Geo.vistaAssonometricaDiretta(Geo.TIPI_ASSONOMETRIA.isometrica), OPZIONI_ASSONOMETRIA);
  }

  // --- Svolgimento ---

  function nuovoEsercizio() {
    const esercizio = generaEsercizioOrtogonali();
    if (!esercizio) {
      el.domanda.textContent = 'Non sono riuscito a costruire un esercizio: riprova.';
      return;
    }
    stato.esercizio = esercizio;
    stato.risposto = false;

    el.domanda.textContent = esercizio.domanda;
    el.riscontro.textContent = '';
    el.riscontro.className = 'riscontro';
    el.prossimo.hidden = true;

    el.riquadroDomanda.innerHTML = '';
    const svgDomanda = nuovoSvg(el.riquadroDomanda, 'disegno-domanda');
    if (esercizio.tipo === 'viste-al-solido') disegnaViste(svgDomanda, esercizio.corretto.solido);
    else disegnaAssonometria(svgDomanda, esercizio.corretto.solido);

    el.opzioni.innerHTML = '';
    esercizio.opzioni.forEach((opzione, indice) => {
      const carta = document.createElement('button');
      carta.type = 'button';
      carta.className = 'carta-opzione';
      carta.dataset.indice = indice;
      const etichetta = document.createElement('span');
      etichetta.className = 'lettera-opzione';
      etichetta.textContent = 'ABCD'[indice];
      carta.appendChild(etichetta);
      const svg = nuovoSvg(carta, 'disegno-opzione');
      if (esercizio.tipo === 'viste-al-solido') disegnaAssonometria(svg, opzione.solido);
      else disegnaViste(svg, opzione.solido);
      carta.addEventListener('click', () => rispondi(indice));
      el.opzioni.appendChild(carta);
    });
  }

  function rispondi(indice) {
    if (stato.risposto) return;
    stato.risposto = true;
    const esercizio = stato.esercizio;
    const giusta = indice === esercizio.indiceCorretto;
    const statistica = stato.statistiche[esercizio.argomento];

    statistica.totali++;
    stato.risposte++;
    if (giusta) {
      statistica.giuste++;
      stato.punteggio += 10 + Math.min(stato.serie, 5) * 2;
      stato.serie++;
      stato.miglioreSerie = Math.max(stato.miglioreSerie, stato.serie);
    } else {
      stato.serie = 0;
      // il solido sbagliato torna più spesso nelle domande successive
      stato.ripescaggio.push(esercizio.corretto.descrizione);
      if (stato.ripescaggio.length > 8) stato.ripescaggio.shift();
    }

    el.opzioni.querySelectorAll('.carta-opzione').forEach(carta => {
      const i = Number(carta.dataset.indice);
      carta.disabled = true;
      if (i === esercizio.indiceCorretto) carta.classList.add('giusta');
      else if (i === indice) carta.classList.add('sbagliata');
    });

    el.riscontro.className = 'riscontro ' + (giusta ? 'esito-giusto' : 'esito-sbagliato');
    el.riscontro.textContent = giusta
      ? 'Giusto. ' + perchePlausibile(esercizio, indice)
      : 'Non è questa: la risposta corretta è ' + 'ABCD'[esercizio.indiceCorretto] + '. ' +
        perchePlausibile(esercizio, indice);
    el.prossimo.hidden = false;
    aggiornaTabellone();
  }

  // Il riscontro dice dove si vede la differenza, non solo se la risposta è giusta.
  function perchePlausibile(esercizio, indiceScelto) {
    const corretta = esercizio.opzioni[esercizio.indiceCorretto];
    const scelta = esercizio.opzioni[indiceScelto];
    if (scelta === corretta) {
      const altra = esercizio.opzioni.find(o => o !== corretta);
      const viste = visteCheDifferiscono(corretta.firma, altra.firma);
      return 'Le alternative si smascherano guardando ' + elenco(viste) + '.';
    }
    const viste = visteCheDifferiscono(corretta.firma, scelta.firma);
    return differenzaDescrizioni(corretta.descrizione, scelta.descrizione) +
      ' Se ne accorgi confrontando ' + elenco(viste) + '.';
  }

  function elenco(nomi) {
    if (!nomi.length) return 'le tre viste';
    if (nomi.length === 1) return nomi[0];
    return nomi.slice(0, -1).join(', ') + ' e ' + nomi[nomi.length - 1];
  }

  function differenzaDescrizioni(a, b) {
    if (a.famiglia !== b.famiglia) return 'Il solido che hai scelto è di un altro tipo.';
    if (a.specchiato !== b.specchiato) return 'Quello che hai scelto è l\'immagine speculare del solido giusto.';
    if (a.rotazione !== b.rotazione) return 'Quello che hai scelto è lo stesso solido ruotato attorno all\'asse verticale.';
    if (a.lati !== b.lati) return 'Cambia il numero dei lati della base: ' + b.lati + ' invece di ' + a.lati + '.';
    if (a.altezza !== b.altezza) return 'Cambia l\'altezza del solido.';
    if (a.raggioCima !== b.raggioCima) return 'Cambia la dimensione della faccia superiore.';
    if (a.s !== b.s) return 'Cambia lo spessore della parte.';
    if (a.h !== b.h) return 'Cambia l\'altezza del solido.';
    if (a.p !== b.p) return 'Cambia la profondità del solido.';
    if (a.li !== b.li) return 'Cambia la larghezza dell\'incavo.';
    return 'I due solidi differiscono per un solo dettaglio.';
  }

  function aggiornaTabellone() {
    el.punteggio.textContent = stato.punteggio;
    el.serie.textContent = stato.serie;
    el.migliore.textContent = stato.miglioreSerie;
    el.risposte.textContent = stato.risposte;

    const righe = [];
    for (const nome in stato.statistiche) {
      const s = stato.statistiche[nome];
      if (!s.totali) continue;
      const percentuale = Math.round(100 * s.giuste / s.totali);
      righe.push('<div><span>' + etichettaArgomento(nome) + '</span><span>' +
        s.giuste + '/' + s.totali + ' &middot; ' + percentuale + '%</span></div>');
    }
    el.statistiche.innerHTML = righe.length
      ? '<h3>Come stai andando</h3>' + righe.join('')
      : '';
  }

  function etichettaArgomento(nome) {
    if (nome === 'ortogonali') return 'Proiezioni ortogonali';
    if (nome === 'sezioni') return 'Sezioni';
    return 'Prospettiva';
  }

  function avvia() {
    el = {
      domanda: document.getElementById('domanda'),
      riquadroDomanda: document.getElementById('riquadro-domanda'),
      opzioni: document.getElementById('opzioni'),
      riscontro: document.getElementById('riscontro'),
      prossimo: document.getElementById('prossimo'),
      punteggio: document.getElementById('punteggio'),
      serie: document.getElementById('serie'),
      migliore: document.getElementById('migliore'),
      risposte: document.getElementById('risposte'),
      statistiche: document.getElementById('statistiche'),
      livelli: document.querySelectorAll('[data-livello]'),
      argomenti: document.querySelectorAll('[data-argomento]')
    };

    el.prossimo.addEventListener('click', nuovoEsercizio);
    el.livelli.forEach(b => b.addEventListener('click', () => {
      stato.livello = b.dataset.livello;
      el.livelli.forEach(x => x.classList.toggle('attivo', x === b));
      stato.ripescaggio = [];
      nuovoEsercizio();
    }));
    el.argomenti.forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      stato.argomento = b.dataset.argomento;
      el.argomenti.forEach(x => x.classList.toggle('attivo', x === b));
      nuovoEsercizio();
    }));

    aggiornaTabellone();
    nuovoEsercizio();
  }

  return { avvia, stato };
})();
