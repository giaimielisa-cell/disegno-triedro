// Palestra: esercizi generati a caso, con punteggio e riscontro immediato.
// I distrattori nascono dalla risposta corretta cambiando un solo dato, e
// vengono accettati solo se producono davvero un disegno diverso: così non
// sono né palesemente errati né ambigui.

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
      assonometria: { giuste: 0, totali: 0 },
      sezioni: { giuste: 0, totali: 0 },
      prospettiva: { giuste: 0, totali: 0 }
    },
    ripescaggio: [],
    esercizio: null,
    risposto: false,
    abbinamenti: {}
  };

  let el = {};

  function scegli(elenco) { return elenco[Math.floor(Math.random() * elenco.length)]; }
  function intero(minimo, massimo) { return minimo + Math.floor(Math.random() * (massimo - minimo + 1)); }
  function mescola(elenco) { return elenco.slice().sort(() => Math.random() - 0.5); }

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

  // --- Firme: due disegni identici non possono stare nella stessa domanda ---

  function firmaConVista(solido, vista) {
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
      prospetto: firmaConVista(solido, Geo.vistaOrtogonale('prospetto')),
      pianta: firmaConVista(solido, Geo.vistaOrtogonale('pianta')),
      laterale: firmaConVista(solido, Geo.vistaOrtogonale('laterale'))
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

  // --- Disegno ---

  const OPZIONI_VISTE = {
    spigoliNascosti: true, etichette: false, assi: false, griglia: false,
    richiami: false, piani: false, resa: 'wireframe',
    posizione: { allontanamento: 14, quota: 0, distanzaPL: 14 }
  };
  const OPZIONI_ASSONOMETRIA = {
    spigoliNascosti: true, etichette: false, assi: false, griglia: false, resa: 'wireframe'
  };

  // Porta il solido nel primo triedro, appoggiato all'origine: gli assi di
  // riferimento formano così l'angolo alla base del solido.
  function nelTriedro(solido) {
    const v = solido.vertici;
    const dx = Math.min(...v.map(p => p[0])), dy = Math.min(...v.map(p => p[1])), dz = Math.min(...v.map(p => p[2]));
    return {
      id: solido.id, nome: solido.nome,
      vertici: v.map(p => [p[0] - dx, p[1] - dy, p[2] - dz]),
      facce: solido.facce
    };
  }

  function nuovoSvg(contenitore, classe) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', classe);
    contenitore.appendChild(svg);
    return svg;
  }

  function disegnaViste(svg, solido) {
    Disegno.disegnaProiezioniOrtogonali(svg, solido, OPZIONI_VISTE);
  }

  function disegnaAsso(svg, solido, vista, extra) {
    Disegno.disegnaAssonometria(svg, solido, vista,
      Object.assign({}, OPZIONI_ASSONOMETRIA, extra || {}));
  }

  function vistaCanonica(tipo) {
    return Geo.vistaAssonometricaDiretta(Geo.TIPI_ASSONOMETRIA[tipo]);
  }

  // --- Esercizi sulle proiezioni ortogonali ---

  function generaQuattroSolidi() {
    for (let tentativo = 0; tentativo < 12; tentativo++) {
      const descrizione = stato.ripescaggio.length && Math.random() < 0.4
        ? stato.ripescaggio[intero(0, stato.ripescaggio.length - 1)]
        : descrizioneCasuale(stato.livello);
      const corretto = { descrizione: descrizione, solido: costruisci(descrizione) };
      corretto.firma = firmaViste(corretto.solido);

      const scelti = [];
      for (const c of mescola(varianti(descrizione))) {
        if (scelti.length === 3) break;
        let solido;
        try { solido = costruisci(c); } catch (e) { continue; }
        const firma = firmaViste(solido);
        if (firmeUguali(firma, corretto.firma)) continue;
        if (scelti.some(s => firmeUguali(s.firma, firma))) continue;
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
    const mescolate = mescola([insieme.corretto].concat(insieme.distrattori));
    const indiceCorretto = mescolate.indexOf(insieme.corretto);

    return {
      argomento: 'ortogonali',
      tipo: tipo,
      forma: 'scelta',
      domanda: tipo === 'viste-al-solido'
        ? 'Queste sono le tre proiezioni ortogonali di un solido. Quale dei quattro solidi le genera?'
        : 'Questo è il solido in assonometria, collocato nel triedro di riferimento. Quale terna di proiezioni ortogonali gli corrisponde?',
      disegnaDomanda: svg => {
        if (tipo === 'viste-al-solido') disegnaViste(svg, insieme.corretto.solido);
        else disegnaAsso(svg, nelTriedro(insieme.corretto.solido), vistaCanonica('isometrica'), { assi: true });
      },
      opzioni: mescolate.map(o => ({
        dato: o,
        disegna: svg => {
          if (tipo === 'viste-al-solido') disegnaAsso(svg, o.solido, vistaCanonica('isometrica'));
          else disegnaViste(svg, o.solido);
        }
      })),
      indiceCorretto: indiceCorretto,
      riscontro: (indiceScelto, giusta) => {
        const corretta = mescolate[indiceCorretto];
        if (giusta) {
          const altra = mescolate.find(o => o !== corretta);
          return 'Le alternative si smascherano guardando ' + elenco(visteCheDifferiscono(corretta.firma, altra.firma)) + '.';
        }
        const scelta = mescolate[indiceScelto];
        return differenzaDescrizioni(corretta.descrizione, scelta.descrizione) +
          ' Se ne accorgi confrontando ' + elenco(visteCheDifferiscono(corretta.firma, scelta.firma)) + '.';
      },
      ripescabile: insieme.corretto.descrizione
    };
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

  // --- Esercizi sull'assonometria ---

  const NOMI_ASSONOMETRIA = {
    isometrica: 'Isometrica', cavaliera: 'Cavaliera', monometrica: 'Monometrica'
  };

  // Per gli esercizi sull'assonometria servono solidi con spigoli ben visibili:
  // su cilindri e coni le direzioni degli assi non si leggono.
  function solidoPerAssonometria() {
    if (stato.livello === 'facile') {
      const famiglia = scegli(['prisma', 'piramide', 'tronco']);
      const lati = scegli([3, 4, 6]);
      return costruisci({
        famiglia: famiglia, lati: lati, raggio: intero(26, 34), altezza: intero(45, 65),
        raggioCima: intero(14, 20), rot: lati === 4 ? 45 : 0, specchiato: false, rotazione: 0
      });
    }
    let descrizione = descrizioneCasuale('difficile');
    descrizione = Object.assign({}, descrizione, { rotazione: 0 });
    return costruisci(descrizione);
  }

  // 1. Riconoscere il tipo di assonometria (esercizio di abbinamento)
  function generaTipoAssonometria() {
    const solido = solidoPerAssonometria();
    const tipi = mescola(['isometrica', 'cavaliera', 'monometrica']);
    return {
      argomento: 'assonometria',
      tipo: 'tipo-assonometria',
      forma: 'abbinamento',
      domanda: 'Lo stesso solido è rappresentato nei tre tipi di assonometria. Assegna a ciascuna immagine il tipo corretto.',
      disegnaDomanda: null,
      scelte: ['isometrica', 'cavaliera', 'monometrica'].map(t => ({ valore: t, etichetta: NOMI_ASSONOMETRIA[t] })),
      elementi: tipi.map(t => ({
        valore: t,
        disegna: (svg, conRiscontro) => disegnaAsso(svg, solido, vistaCanonica(t),
          conRiscontro ? { assi: true, assiConDati: true } : {})
      })),
      riscontro: () => 'Guarda gli angoli degli assi: la cavaliera ha l\'asse x orizzontale e la profondità a 45°, ' +
        'l\'isometrica ha i tre assi a 120° tra loro, la monometrica ha gli assi a 7° e 42° sull\'orizzontale.'
    };
  }

  // Solidi dichiarati con le loro misure: senza un termine di paragone noto
  // non si potrebbe giudicare se una rappresentazione è corretta.
  function solidoNominato() {
    const lato = scegli([40, 45, 50]);
    const scelte = [
      { nome: 'un cubo di spigolo ' + lato, crea: () => Solidi.cubo(lato) },
      { nome: 'un cubo di spigolo ' + lato, crea: () => Solidi.cubo(lato) },
      {
        nome: 'un parallelepipedo di ' + (lato + 20) + ' × ' + lato + ' × ' + (lato + 10) +
          ' (larghezza, profondità, altezza)',
        crea: () => Solidi.prismaRettangolare(lato + 20, lato, lato + 10)
      },
      {
        nome: 'un prisma a base quadrata di lato ' + lato + ' e altezza ' + (lato + 25),
        crea: () => Solidi.prismaRettangolare(lato, lato, lato + 25)
      }
    ];
    const s = scegli(scelte);
    return { nome: s.nome, solido: s.crea() };
  }

  // 2. Riconoscere i coefficienti di riduzione corretti
  function generaCoefficienti() {
    const nominato = solidoNominato();
    const solido = nominato.solido;
    const tipo = scegli(['cavaliera', 'monometrica', 'isometrica']);
    const base = Geo.TIPI_ASSONOMETRIA[tipo];
    const sbagliati = [
      Object.assign({}, base, { ky: base.ky === 1 ? 0.5 : 1 }),
      Object.assign({}, base, { kz: 0.6 }),
      Object.assign({}, base, { kx: 0.6, ky: base.ky === 1 ? 0.6 : base.ky })
    ];
    const opzioni = mescola([base].concat(sbagliati));
    const indiceCorretto = opzioni.indexOf(base);

    return {
      argomento: 'assonometria',
      tipo: 'coefficienti',
      forma: 'scelta',
      domanda: 'Le quattro immagini rappresentano ' + nominato.nome + ' in assonometria ' +
        NOMI_ASSONOMETRIA[tipo].toLowerCase() +
        ', ma una sola usa i coefficienti di riduzione corretti. Quale?',
      disegnaDomanda: null,
      opzioni: opzioni.map(config => ({
        dato: config,
        disegna: (svg, conRiscontro) => disegnaAsso(svg, solido, Geo.vistaAssonometricaDiretta(config),
          conRiscontro ? { assi: true, assiConDati: true, assiInEvidenza: config !== base } : {})
      })),
      indiceCorretto: indiceCorretto,
      riscontro: (indiceScelto, giusta) => {
        const misure = 'Nell\'assonometria ' + NOMI_ASSONOMETRIA[tipo].toLowerCase() + ' i coefficienti sono ' +
          'kx=' + numero(base.kx) + ', ky=' + numero(base.ky) + ', kz=' + numero(base.kz) + '.';
        if (giusta) return misure + ' Sugli assi delle altre immagini leggi le misure sbagliate.';
        const scelta = opzioni[indiceScelto];
        return 'Quella che hai scelto usa kx=' + numero(scelta.kx) + ', ky=' + numero(scelta.ky) +
          ', kz=' + numero(scelta.kz) + '. ' + misure;
      }
    };
  }

  function numero(v) { return v.toFixed(2).replace('.', ',').replace(',00', ''); }

  // 3. Individuare l'unica assonometria costruita correttamente
  const ERRORI = {
    fuga: {
      nome: 'gli spigoli paralleli nello spazio convergono invece di restare paralleli',
      applica: vista => Object.assign({}, vista, {
        project: v => {
          const p = vista.project(v);
          const k = 1 - 0.005 * v[1];
          return [p[0] * k, p[1] * k];
        }
      })
    },
    angoli: {
      nome: 'uno degli assi è disegnato con un angolo sbagliato',
      config: base => Object.assign({}, base, { angoloY: base.angoloY - 24 })
    },
    proporzioni: {
      nome: 'le proporzioni tra gli assi non sono coerenti',
      config: base => Object.assign({}, base, { kz: 0.65, kx: 1.1 })
    },
    verticale: {
      nome: 'l\'asse delle altezze non è verticale',
      config: base => Object.assign({}, base, { angoloZ: 79 })
    }
  };

  function generaErroreCostruzione() {
    const nominato = solidoNominato();
    const solido = nominato.solido;
    const tipo = scegli(['isometrica', 'cavaliera', 'monometrica']);
    const base = Geo.TIPI_ASSONOMETRIA[tipo];
    const corretta = { errore: null, vista: Geo.vistaAssonometricaDiretta(base) };
    const errori = mescola(Object.keys(ERRORI)).slice(0, 3);
    const sbagliate = errori.map(nome => {
      const e = ERRORI[nome];
      const vista = e.config
        ? Geo.vistaAssonometricaDiretta(e.config(base))
        : e.applica(Geo.vistaAssonometricaDiretta(base));
      return { errore: nome, vista: vista };
    });
    const opzioni = mescola([corretta].concat(sbagliate));
    const indiceCorretto = opzioni.indexOf(corretta);

    return {
      argomento: 'assonometria',
      tipo: 'errore-costruzione',
      forma: 'scelta',
      domanda: 'Le quattro immagini rappresentano ' + nominato.nome + ' in assonometria ' +
        NOMI_ASSONOMETRIA[tipo].toLowerCase() +
        ', ma tre contengono un errore di costruzione. Qual è l\'unica corretta?',
      disegnaDomanda: null,
      opzioni: opzioni.map(o => ({
        dato: o,
        disegna: (svg, conRiscontro) => disegnaAsso(svg, solido, o.vista,
          conRiscontro ? { assi: true, assiConDati: true, assiInEvidenza: !!o.errore } : {})
      })),
      indiceCorretto: indiceCorretto,
      riscontro: (indiceScelto, giusta) => {
        const elencoErrori = sbagliate.map(s => ERRORI[s.errore].nome).join('; ');
        if (giusta) return 'Nelle altre tre: ' + elencoErrori + '. Gli assi in rosso mostrano dove.';
        const scelta = opzioni[indiceScelto];
        return 'In quella che hai scelto ' + ERRORI[scelta.errore].nome +
          '. Gli assi in rosso segnalano le immagini sbagliate.';
      }
    };
  }

  // --- Registro dei generatori ---

  const GENERATORI = {
    ortogonali: [generaEsercizioOrtogonali],
    assonometria: [generaTipoAssonometria, generaCoefficienti, generaErroreCostruzione]
  };

  function generatoriAttivi() {
    if (stato.argomento === 'misto') {
      return GENERATORI.ortogonali.concat(GENERATORI.assonometria);
    }
    return GENERATORI[stato.argomento] || GENERATORI.ortogonali;
  }

  // --- Svolgimento ---

  function nuovoEsercizio() {
    let esercizio = null;
    for (let tentativo = 0; tentativo < 5 && !esercizio; tentativo++) {
      esercizio = scegli(generatoriAttivi())();
    }
    if (!esercizio) {
      el.domanda.textContent = 'Non sono riuscito a costruire un esercizio: prova a cambiare livello.';
      return;
    }
    stato.esercizio = esercizio;
    stato.risposto = false;
    stato.abbinamenti = {};

    el.domanda.textContent = esercizio.domanda;
    el.riscontro.textContent = '';
    el.riscontro.className = 'riscontro';
    el.prossimo.hidden = true;

    el.riquadroDomanda.innerHTML = '';
    el.riquadroDomanda.hidden = !esercizio.disegnaDomanda;
    if (esercizio.disegnaDomanda) {
      esercizio.disegnaDomanda(nuovoSvg(el.riquadroDomanda, 'disegno-domanda'));
    }

    el.opzioni.innerHTML = '';
    el.opzioni.className = esercizio.forma === 'abbinamento' ? 'opzioni abbinamento' : 'opzioni';
    if (esercizio.forma === 'abbinamento') costruisciAbbinamento(esercizio);
    else costruisciScelta(esercizio);
  }

  function costruisciScelta(esercizio) {
    esercizio.opzioni.forEach((opzione, indice) => {
      const carta = document.createElement('button');
      carta.type = 'button';
      carta.className = 'carta-opzione';
      carta.dataset.indice = indice;
      const etichetta = document.createElement('span');
      etichetta.className = 'lettera-opzione';
      etichetta.textContent = 'ABCD'[indice];
      carta.appendChild(etichetta);
      opzione.disegna(nuovoSvg(carta, 'disegno-opzione'), false);
      carta.addEventListener('click', () => rispondi(indice));
      el.opzioni.appendChild(carta);
    });
  }

  function costruisciAbbinamento(esercizio) {
    esercizio.elementi.forEach((elemento, indice) => {
      const carta = document.createElement('div');
      carta.className = 'carta-abbinamento';
      carta.dataset.indice = indice;
      const etichetta = document.createElement('span');
      etichetta.className = 'lettera-opzione';
      etichetta.textContent = 'ABC'[indice];
      carta.appendChild(etichetta);
      elemento.disegna(nuovoSvg(carta, 'disegno-opzione'), false);

      const scelte = document.createElement('div');
      scelte.className = 'scelte-abbinamento';
      esercizio.scelte.forEach(scelta => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = scelta.etichetta;
        b.dataset.valore = scelta.valore;
        b.addEventListener('click', () => {
          if (stato.risposto) return;
          stato.abbinamenti[indice] = scelta.valore;
          scelte.querySelectorAll('button').forEach(x => x.classList.toggle('attivo', x === b));
          el.verifica.disabled = Object.keys(stato.abbinamenti).length < esercizio.elementi.length;
        });
        scelte.appendChild(b);
      });
      carta.appendChild(scelte);
      el.opzioni.appendChild(carta);
    });
    el.verifica.hidden = false;
    el.verifica.disabled = true;
  }

  function rispondi(indice) {
    if (stato.risposto) return;
    stato.risposto = true;
    const esercizio = stato.esercizio;
    const giusta = indice === esercizio.indiceCorretto;

    el.opzioni.querySelectorAll('.carta-opzione').forEach(carta => {
      const i = Number(carta.dataset.indice);
      carta.disabled = true;
      if (i === esercizio.indiceCorretto) carta.classList.add('giusta');
      else if (i === indice) carta.classList.add('sbagliata');
      // il riscontro ridisegna l'opzione mostrando assi, angoli e coefficienti
      const svg = carta.querySelector('svg');
      esercizio.opzioni[i].disegna(svg, true);
    });

    concludi(giusta, giusta
      ? 'Giusto. ' + esercizio.riscontro(indice, true)
      : 'Non è questa: la risposta corretta è ' + 'ABCD'[esercizio.indiceCorretto] + '. ' +
        esercizio.riscontro(indice, false));
  }

  function verificaAbbinamento() {
    if (stato.risposto) return;
    const esercizio = stato.esercizio;
    stato.risposto = true;
    let tutteGiuste = true;

    el.opzioni.querySelectorAll('.carta-abbinamento').forEach(carta => {
      const i = Number(carta.dataset.indice);
      const scelto = stato.abbinamenti[i];
      const giusta = scelto === esercizio.elementi[i].valore;
      if (!giusta) tutteGiuste = false;
      carta.classList.add(giusta ? 'giusta' : 'sbagliata');
      carta.querySelectorAll('.scelte-abbinamento button').forEach(b => {
        b.disabled = true;
        if (b.dataset.valore === esercizio.elementi[i].valore) b.classList.add('valore-giusto');
      });
      esercizio.elementi[i].disegna(carta.querySelector('svg'), true);
    });

    el.verifica.hidden = true;
    concludi(tutteGiuste, (tutteGiuste ? 'Tutte e tre corrette. ' : 'Qualche abbinamento non torna. ') +
      esercizio.riscontro());
  }

  function concludi(giusta, testo) {
    const esercizio = stato.esercizio;
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
      if (esercizio.ripescabile) {
        stato.ripescaggio.push(esercizio.ripescabile);
        if (stato.ripescaggio.length > 8) stato.ripescaggio.shift();
      }
    }
    el.riscontro.className = 'riscontro ' + (giusta ? 'esito-giusto' : 'esito-sbagliato');
    el.riscontro.textContent = testo;
    el.prossimo.hidden = false;
    aggiornaTabellone();
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
      righe.push('<div><span>' + etichettaArgomento(nome) + '</span><span>' +
        s.giuste + '/' + s.totali + ' &middot; ' + Math.round(100 * s.giuste / s.totali) + '%</span></div>');
    }
    el.statistiche.innerHTML = righe.length ? '<h3>Come stai andando</h3>' + righe.join('') : '';
  }

  function etichettaArgomento(nome) {
    if (nome === 'ortogonali') return 'Proiezioni ortogonali';
    if (nome === 'assonometria') return 'Assonometria';
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
      verifica: document.getElementById('verifica'),
      punteggio: document.getElementById('punteggio'),
      serie: document.getElementById('serie'),
      migliore: document.getElementById('migliore'),
      risposte: document.getElementById('risposte'),
      statistiche: document.getElementById('statistiche'),
      livelli: document.querySelectorAll('[data-livello]'),
      argomenti: document.querySelectorAll('[data-argomento]')
    };

    el.prossimo.addEventListener('click', () => { el.verifica.hidden = true; nuovoEsercizio(); });
    el.verifica.addEventListener('click', verificaAbbinamento);
    el.livelli.forEach(b => b.addEventListener('click', () => {
      stato.livello = b.dataset.livello;
      el.livelli.forEach(x => x.classList.toggle('attivo', x === b));
      stato.ripescaggio = [];
      el.verifica.hidden = true;
      nuovoEsercizio();
    }));
    el.argomenti.forEach(b => b.addEventListener('click', () => {
      if (b.disabled) return;
      stato.argomento = b.dataset.argomento;
      el.argomenti.forEach(x => x.classList.toggle('attivo', x === b));
      el.verifica.hidden = true;
      nuovoEsercizio();
    }));

    aggiornaTabellone();
    nuovoEsercizio();
  }

  return { avvia, stato };
})();
