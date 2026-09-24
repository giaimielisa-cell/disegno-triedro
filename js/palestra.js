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

  // Un riquadro con la sua didascalia, per le domande che mostrano più disegni.
  function pannello(contenitore, didascalia) {
    const figura = document.createElement('figure');
    figura.className = 'pannello-domanda';
    const svg = nuovoSvg(figura, 'disegno-domanda');
    const testo = document.createElement('figcaption');
    testo.textContent = didascalia;
    figura.appendChild(testo);
    contenitore.appendChild(figura);
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
      disegnaDomanda: contenitore => {
        const svg = nuovoSvg(contenitore, 'disegno-domanda');
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

  // --- Esercizi sulle sezioni ---

  const NOMI_PIANO = {
    orizzontale: 'orizzontale (parallelo al P.O.)',
    verticale: 'verticale (parallelo al P.V.)',
    profilo: 'di profilo (parallelo al P.L.)',
    inclinato: 'inclinato'
  };

  function solidoDaSezionare() {
    if (stato.livello === 'facile') {
      const famiglia = scegli(['prisma', 'piramide', 'cilindro', 'cono', 'tronco']);
      const lati = scegli([3, 4, 6]);
      return {
        solido: costruisci({
          famiglia: famiglia, lati: lati, raggio: intero(26, 32), altezza: intero(50, 68),
          raggioCima: 18, rot: lati === 4 ? 45 : 0, specchiato: false, rotazione: 0
        }),
        nome: famiglia
      };
    }
    const d = Object.assign({}, descrizioneCasuale('difficile'), { rotazione: 0 });
    return { solido: costruisci(d), nome: d.famiglia };
  }

  // Sagoma di una sezione, ridotta a una firma indipendente dalla scala:
  // due sagome con la stessa firma sarebbero la stessa figura ingrandita.
  function firmaSagoma(forme) {
    return forme.map(forma => {
      let perimetro = 0;
      const lati = [];
      for (let i = 0; i < forma.length; i++) {
        const a = forma[i], b = forma[(i + 1) % forma.length];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        lati.push(l);
        perimetro += l;
      }
      if (!perimetro) return '';
      return lati.map(l => (l / perimetro).toFixed(3)).sort().join(',');
    }).sort().join('|');
  }

  // Sui solidi curvi il contorno di sezione è fatto di molti segmenti: contarli
  // non direbbe nulla allo studente.
  function descriviSagoma(forme) {
    const lati = forme[0].length;
    if (forme.length > 1) return 'La sezione è formata da più contorni separati.';
    if (lati > 12) return 'La sezione è una figura a contorno curvo.';
    const nomi = { 3: 'un triangolo', 4: 'un quadrilatero', 5: 'un pentagono', 6: 'un esagono' };
    return 'La sezione è ' + (nomi[lati] || 'un poligono di ' + lati + ' lati') + '.';
  }

  function sezioneDi(solido, config) {
    const piano = Sezione.piano(solido, config);
    const taglio = Sezione.taglia(solido, piano);
    if (!taglio.anelli.length) return null;
    const forme = Sezione.veraForma(taglio.anelli);
    if (!forme.length || forme[0].length < 3) return null;
    return {
      config: config, forme: forme, firma: firmaSagoma(forme),
      misura: misuraSagoma(forme)
    };
  }

  function misuraSagoma(forme) {
    const punti = forme[0];
    let area = 0;
    for (let i = 0; i < punti.length; i++) {
      const a = punti[i], b = punti[(i + 1) % punti.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const larghezza = Math.max(...punti.map(p => p[0])) - Math.min(...punti.map(p => p[0]));
    const altezza = Math.max(...punti.map(p => p[1])) - Math.min(...punti.map(p => p[1]));
    return {
      area: Math.abs(area) / 2,
      rapporto: altezza ? larghezza / altezza : 1,
      lati: punti.length,
      contorni: forme.length
    };
  }

  // Due sagome vanno bene nella stessa domanda solo se la differenza si vede a
  // occhio: senza poter misurare, uno scarto di pochi millimetri non è una
  // domanda ma un indovinello.
  function abbastanzaDiverse(a, b) {
    if (a.contorni !== b.contorni) return true;
    if (a.lati !== b.lati && (a.lati <= 12 || b.lati <= 12)) return true;
    const scartoArea = Math.abs(a.area - b.area) / Math.max(a.area, b.area);
    const scartoForma = Math.abs(a.rapporto - b.rapporto) / Math.max(a.rapporto, b.rapporto);
    return scartoArea > 0.15 || scartoForma > 0.15;
  }

  function generaRiconoscimentoSezione() {
    for (let tentativo = 0; tentativo < 10; tentativo++) {
      const base = solidoDaSezionare();
      const solido = base.solido;
      const config = {
        tipo: scegli(['orizzontale', 'verticale', 'profilo', 'inclinato']),
        posizione: intero(35, 65), inclinazione: scegli([25, 35, 45]),
        invertito: false, attiva: true, effettuata: false
      };
      const corretta = sezioneDi(solido, config);
      if (!corretta) continue;

      // i distrattori sono sezioni dello stesso solido con un piano diverso:
      // sono figure vere, non inventate, e per questo plausibili
      const alternative = mescola([
        { tipo: 'orizzontale' }, { tipo: 'verticale' }, { tipo: 'profilo' },
        { tipo: 'inclinato', inclinazione: 25 }, { tipo: 'inclinato', inclinazione: 45 },
        { tipo: 'inclinato', inclinazione: -35 },
        { posizione: 20 }, { posizione: 40 }, { posizione: 60 }, { posizione: 80 },
        { tipo: 'verticale', posizione: 30 }, { tipo: 'profilo', posizione: 70 }
      ]);
      const candidati = [];
      for (const modifica of alternative) {
        const altra = sezioneDi(solido, Object.assign({}, config, modifica));
        if (!altra) continue;
        if (altra.firma === corretta.firma) continue;
        if (!abbastanzaDiverse(altra.misura, corretta.misura)) continue;
        if (candidati.some(s => !abbastanzaDiverse(s.misura, altra.misura))) continue;
        candidati.push(altra);
      }
      // si preferiscono le sagome con un numero di lati diverso: distinguerle
      // richiede di immaginare la forma, non di confrontare proporzioni simili
      const latiCorretti = corretta.forme[0].length;
      candidati.sort((a, b) =>
        (Math.abs(b.forme[0].length - latiCorretti) > 0 ? 1 : 0) -
        (Math.abs(a.forme[0].length - latiCorretti) > 0 ? 1 : 0));
      const scelti = candidati.slice(0, 3);
      if (scelti.length < 3) continue;

      const opzioni = mescola([corretta].concat(scelti));
      const indiceCorretto = opzioni.indexOf(corretta);
      // tutte le sagome alla stessa scala
      const estensione = Math.max.apply(null, opzioni.map(o => {
        const punti = [].concat.apply([], o.forme);
        return Math.max(
          Math.max(...punti.map(p => p[0])) - Math.min(...punti.map(p => p[0])),
          Math.max(...punti.map(p => p[1])) - Math.min(...punti.map(p => p[1]))
        );
      })) * 0.62;

      return {
        argomento: 'sezioni',
        tipo: 'riconoscimento-sezione',
        forma: 'scelta',
        domanda: 'Il solido è tagliato dal piano ' + NOMI_PIANO[config.tipo] +
          ' che vedi in figura. Quale delle quattro sagome è la sezione che ne risulta, in vera forma?',
        // due riquadri: il prospetto dice a che altezza taglia il piano,
        // l'assonometria fa capire la forma del solido
        disegnaDomanda: contenitore => {
          const opzioniPiano = Object.assign({}, OPZIONI_VISTE, {
            sezione: config, vistaSingola: 'prospetto'
          });
          Disegno.disegnaProiezioniOrtogonali(
            pannello(contenitore, 'Prospetto, con il piano di sezione'), solido, opzioniPiano);
          Disegno.disegnaAssonometria(
            pannello(contenitore, 'Lo stesso solido in assonometria'), solido,
            vistaCanonica('isometrica'), Object.assign({}, OPZIONI_ASSONOMETRIA, { sezione: config }));
        },
        opzioni: opzioni.map(o => ({
          dato: o,
          disegna: svg => Disegno.disegnaFiguraPiana(svg, o.forme, { estensione: estensione })
        })),
        indiceCorretto: indiceCorretto,
        riscontro: (indiceScelto, giusta) => {
          const descrizione = descriviSagoma(corretta.forme);
          if (giusta) return descrizione + ' Le altre sagome sono sezioni vere dello stesso solido, ma con il piano in un\'altra posizione.';
          const scelta = opzioni[indiceScelto];
          const suo = scelta.config;
          const differenza = suo.tipo !== config.tipo
            ? 'quella sagoma si otterrebbe con un piano ' + NOMI_PIANO[suo.tipo]
            : (suo.inclinazione !== config.inclinazione
              ? 'quella sagoma si otterrebbe con il piano inclinato diversamente'
              : 'quella sagoma si otterrebbe spostando il piano lungo il suo asse');
          return descrizione + ' Invece ' + differenza + '.';
        }
      };
    }
    return null;
  }

  // --- Disegno libero in due dimensioni (schemi e piante prospettiche) ---

  function tela(svg) {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    const punti = [];
    const crea = (nome, attributi) => {
      const e = document.createElementNS(NS, nome);
      for (const k in attributi) e.setAttribute(k, attributi[k]);
      g.appendChild(e);
      return e;
    };
    const segna = (x, y) => punti.push([x, y]);
    return {
      linea(x1, y1, x2, y2, classe) {
        segna(x1, y1); segna(x2, y2);
        return crea('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: classe });
      },
      poligono(lista, classe) {
        lista.forEach(p => segna(p[0], p[1]));
        return crea('polygon', { points: lista.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '), class: classe });
      },
      punto(x, y, raggio, classe) {
        segna(x - raggio, y - raggio); segna(x + raggio, y + raggio);
        return crea('circle', { cx: x, cy: y, r: raggio, class: classe });
      },
      testo(x, y, contenuto, classe, dimensione) {
        segna(x, y);
        const t = crea('text', { x: x, y: y, class: classe, 'font-size': dimensione });
        t.textContent = contenuto;
        return t;
      },
      chiudi(margine) {
        svg.appendChild(g);
        const xs = punti.map(p => p[0]), ys = punti.map(p => p[1]);
        const x0 = Math.min(...xs) - margine, x1 = Math.max(...xs) + margine;
        const y0 = Math.min(...ys) - margine, y1 = Math.max(...ys) + margine;
        svg.setAttribute('viewBox', [x0, y0, Math.max(x1 - x0, 1), Math.max(y1 - y0, 1)].join(' '));
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
    };
  }

  // --- Esercizi sulla prospettiva ---

  // Pianta della scena prospettica: quadro, punto di vista e oggetto ruotato.
  // Sul foglio la profondità cresce verso l'alto, come nelle tavole.
  function disegnaPiantaScena(svg, scena, costruzione, estensione) {
    const t = tela(svg);
    const dim = Math.max(scena.larghezza, scena.profondita);
    const testo = dim * 0.22;
    const semiQuadro = dim * 2.2;

    // quadro
    t.linea(-semiQuadro, 0, semiQuadro, 0, 'quadro');
    t.testo(-semiQuadro, -testo * 0.4, 'quadro', 'etichetta-schema', testo);

    // oggetto ruotato, dietro il quadro (in alto)
    const a = Geo.deg2rad(scena.alfa);
    const centro = [scena.x, -(scena.distanzaOggetto + scena.profondita / 2)];
    const u = [Math.cos(a), -Math.sin(a)], w = [Math.sin(a), Math.cos(a)];
    const angoli = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(s => [
      centro[0] + u[0] * s[0] * scena.larghezza / 2 + w[0] * s[1] * scena.profondita / 2,
      centro[1] + u[1] * s[0] * scena.larghezza / 2 + w[1] * s[1] * scena.profondita / 2
    ]);
    t.poligono(angoli, 'pianta-oggetto');

    // punto di vista, davanti al quadro (in basso)
    const pv = [scena.xOsservatore, scena.distanza];
    t.punto(pv[0], pv[1], dim * 0.05, 'punto-vista');
    t.testo(pv[0] + dim * 0.1, pv[1] + testo, 'P.V.', 'etichetta-punto', testo);
    t.linea(pv[0], pv[1], pv[0], 0, 'richiamo');
    t.punto(pv[0], 0, dim * 0.035, 'punto-vista');
    t.testo(pv[0] + dim * 0.1, -testo * 0.4, 'P.P.', 'etichetta-punto', testo);

    // nel riscontro si mostra da dove nascono i punti di fuga: dal punto di
    // vista si conducono le parallele alle due direzioni dell'oggetto
    if (costruzione) {
      [{ d: u, nome: 'F₁' }, { d: w, nome: 'F₂' }].forEach(direzione => {
        const dir = direzione.d;
        if (Math.abs(dir[1]) < 1e-6) return;
        const k = -pv[1] / dir[1];
        const incontro = [pv[0] + dir[0] * k, 0];
        t.linea(pv[0], pv[1], incontro[0], incontro[1], 'linea-fuga');
        t.punto(incontro[0], 0, dim * 0.05, 'punto-fuga');
        t.testo(incontro[0] + dim * 0.08, -testo * 0.5, direzione.nome, 'etichetta-punto', testo);
      });
    }
    if (estensione) {
      // stessa scala per tutte le piante di una domanda: altrimenti un punto
      // di vista più lontano verrebbe rimpicciolito e sembrerebbe uguale
      t.linea(-estensione, -estensione, -estensione, estensione, 'cornice-invisibile');
      t.linea(estensione, -estensione, estensione, estensione, 'cornice-invisibile');
    }
    t.chiudi(dim * 0.25);
  }

  // Linea d'orizzonte con i due punti di fuga proposti.
  function disegnaOrizzonteConFughe(svg, fughe, estensione) {
    const t = tela(svg);
    const testo = estensione * 0.09;
    t.linea(-estensione, 0, estensione, 0, 'linea-orizzonte');
    t.punto(0, 0, estensione * 0.022, 'punto-vista');
    t.testo(testo * 0.3, testo * 1.3, 'P.P.', 'etichetta-punto', testo);
    [{ x: fughe[0], nome: 'F₁' }, { x: fughe[1], nome: 'F₂' }].forEach(f => {
      t.punto(f.x, 0, estensione * 0.03, 'punto-fuga');
      t.testo(f.x + testo * 0.3, -testo * 0.6, f.nome, 'etichetta-punto', testo);
    });
    t.chiudi(estensione * 0.08);
  }

  function scenaCasuale() {
    return {
      alfa: scegli([30, 35, 40, 50, 55, 60]),
      distanza: intero(120, 180),
      distanzaOggetto: intero(15, 35),
      larghezza: intero(50, 70),
      profondita: intero(40, 60),
      x: 0,
      xOsservatore: 0
    };
  }

  // 1. Costruzione dei punti di fuga
  function generaPuntiDiFuga() {
    const scena = scenaCasuale();
    const a = Geo.deg2rad(scena.alfa);
    const d = scena.distanza;
    const corretti = [d / Math.tan(a), -d * Math.tan(a)];

    const alternative = [
      { fughe: [-d / Math.tan(a), d * Math.tan(a)], perche: 'i due punti sono scambiati di lato' },
      { fughe: [d * Math.tan(a), -d / Math.tan(a)], perche: 'le due direzioni dell\'oggetto sono state scambiate fra loro' },
      { fughe: [d, -d], perche: 'varrebbe solo se l\'oggetto fosse ruotato di 45°' },
      { fughe: [d / (2 * Math.tan(a)), -d * Math.tan(a) / 2], perche: 'la distanza del punto di vista è stata dimezzata' }
    ];
    // sulla prospettiva bastano tre alternative: l'argomento è già impegnativo
    const scelti = mescola(alternative).slice(0, 2);
    const opzioni = mescola([{ fughe: corretti, perche: null }].concat(scelti));
    const indiceCorretto = opzioni.findIndex(o => o.perche === null);
    const estensione = Math.max.apply(null,
      opzioni.map(o => Math.max(Math.abs(o.fughe[0]), Math.abs(o.fughe[1])))) * 1.15;

    return {
      argomento: 'prospettiva',
      tipo: 'punti-di-fuga',
      forma: 'scelta',
      disposizioneOpzioni: 'colonna',
      domanda: 'La pianta mostra il quadro, il punto di vista e l\'oggetto ruotato di ' + scena.alfa +
        '°. Quale delle tre alternative dà la posizione corretta dei punti di fuga sulla linea d\'orizzonte?',
      disegnaDomanda: contenitore => {
        disegnaPiantaScena(pannello(contenitore, 'Pianta: quadro, punto di vista e oggetto'), scena, false);
      },
      opzioni: opzioni.map(o => ({
        dato: o,
        disegna: svg => disegnaOrizzonteConFughe(svg, o.fughe, estensione)
      })),
      indiceCorretto: indiceCorretto,
      riscontro: (indiceScelto, giusta) => {
        const regola = 'Dal punto di vista si conducono le parallele alle due direzioni dell\'oggetto: ' +
          'dove incontrano il quadro stanno i punti di fuga. Con l\'oggetto ruotato di ' + scena.alfa +
          '° distano dal P.P. ' + Math.round(Math.abs(corretti[0])) + ' e ' + Math.round(Math.abs(corretti[1])) +
          ', da parti opposte.';
        if (giusta) return regola;
        return 'In quella che hai scelto ' + opzioni[indiceScelto].perche + '. ' + regola;
      },
      // il riscontro ridisegna la pianta con la costruzione
      riscontroDomanda: contenitore => {
        disegnaPiantaScena(pannello(contenitore, 'Costruzione: le parallele condotte dal punto di vista'), scena, true);
      }
    };
  }

  // 2. Effetto dei parametri
  function generaEffettoParametri() {
    const solido = Solidi.prismaRettangolare(intero(50, 70), intero(35, 50), intero(45, 65));
    const base = { distanza: 150, altezza: 45, alfa: 40, x: 0 };
    const cambi = [
      { chiave: 'altezza', valore: base.altezza + scegli([-35, 55]), etichetta: 'l\'altezza della linea d\'orizzonte' },
      { chiave: 'distanza', valore: base.distanza + scegli([-70, 130]), etichetta: 'la distanza del punto di vista' },
      { chiave: 'alfa', valore: base.alfa + scegli([-25, 30]), etichetta: 'la rotazione dell\'oggetto' }
    ];
    const cambio = scegli(cambi);
    const modificata = Object.assign({}, base, { [cambio.chiave]: cambio.valore });

    const opzioni = mescola(cambi.map(c => ({ etichetta: c.etichetta })));
    const indiceCorretto = opzioni.findIndex(o => o.etichetta === cambio.etichetta);

    const disegna = (svg, config, riquadro) => Disegno.disegnaProspettiva(svg, solido,
      Geo.vistaProspettica({ x: config.x, distanza: config.distanza, altezza: config.altezza }),
      Object.assign({}, OPZIONI_ASSONOMETRIA, {
        alfa: config.alfa, posizione: { allontanamento: 30, quota: 0 },
        lineeDiFuga: false, inquadraFughe: false, mostraPunti: false,
        riquadroForzato: riquadro
      }));

    // le due immagini vanno confrontate, quindi devono avere la stessa
    // inquadratura: con scale diverse non si capirebbe che cosa è cambiato
    function inquadraturaComune(contenitore) {
      const provvisorio = nuovoSvg(contenitore, 'disegno-domanda');
      const a = disegna(provvisorio, base);
      const b = disegna(provvisorio, modificata);
      contenitore.removeChild(provvisorio);
      return {
        x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1),
        y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1)
      };
    }

    return {
      argomento: 'prospettiva',
      tipo: 'effetto-parametri',
      forma: 'scelta',
      domanda: 'Le due immagini rappresentano lo stesso solido: fra la prima e la seconda è cambiato un solo parametro. Quale?',
      disegnaDomanda: contenitore => {
        const riquadro = inquadraturaComune(contenitore);
        disegna(pannello(contenitore, 'Prima'), base, riquadro);
        disegna(pannello(contenitore, 'Dopo'), modificata, riquadro);
      },
      opzioni: opzioni.map(o => ({ dato: o, etichetta: o.etichetta })),
      indiceCorretto: indiceCorretto,
      riscontro: (indiceScelto, giusta) => {
        const spiegazioni = {
          altezza: 'Alzando l\'occhio la linea d\'orizzonte sale rispetto al solido e si scopre di più la faccia superiore.',
          distanza: 'Allontanando l\'osservatore i punti di fuga si allontanano e lo scorcio si attenua.',
          alfa: 'Ruotando l\'oggetto cambiano gli angoli degli spigoli di base, mentre l\'orizzonte resta dov\'è.'
        };
        return spiegazioni[cambio.chiave];
      }
    };
  }

  // 3. Dalla prospettiva alla pianta
  function generaProspettivaAllaPianta() {
    const solido = Solidi.prismaRettangolare(60, 45, 55);
    const scena = scenaCasuale();
    scena.xOsservatore = 0;
    const alternative = mescola([
      { alfa: scena.alfa + scegli([25, -25]) },
      { distanza: Math.round(scena.distanza * scegli([0.55, 1.7])) },
      { xOsservatore: scegli([-45, 45]), x: 0 },
      { alfa: 90 - scena.alfa }
    ]).slice(0, 2).map(m => Object.assign({}, scena, m));
    const opzioni = mescola([scena].concat(alternative));
    const indiceCorretto = opzioni.indexOf(scena);
    const estensione = Math.max.apply(null, opzioni.map(o =>
      Math.max(o.distanza, o.distanzaOggetto + o.profondita, Math.abs(o.xOsservatore) + o.larghezza))) * 1.2;

    return {
      argomento: 'prospettiva',
      tipo: 'prospettiva-alla-pianta',
      forma: 'scelta',
      domanda: 'Questa è l\'immagine prospettica di un parallelepipedo. Quale delle tre piante rappresenta la configurazione di punto di vista e oggetto che l\'ha generata?',
      disegnaDomanda: contenitore => {
        const svg = pannello(contenitore, 'Immagine prospettica');
        Disegno.disegnaProspettiva(svg, solido,
          Geo.vistaProspettica({ x: 0, distanza: scena.distanza, altezza: 45 }),
          Object.assign({}, OPZIONI_ASSONOMETRIA, {
            alfa: scena.alfa, posizione: { allontanamento: scena.distanzaOggetto, quota: 0 },
            lineeDiFuga: true, inquadraFughe: false
          }));
      },
      opzioni: opzioni.map(o => ({
        dato: o,
        disegna: svg => disegnaPiantaScena(svg, o, false, estensione)
      })),
      indiceCorretto: indiceCorretto,
      riscontro: (indiceScelto, giusta) => {
        if (giusta) return 'L\'angolo di rotazione decide quanto scorciano le due facce, la distanza del punto di vista quanto è marcata la fuga.';
        const scelta = opzioni[indiceScelto];
        if (scelta.alfa !== scena.alfa) return 'In quella pianta l\'oggetto è ruotato di ' + scelta.alfa + '° invece che di ' + scena.alfa + '°: le due facce scorcerebbero in modo diverso.';
        if (scelta.distanza !== scena.distanza) return 'In quella pianta il punto di vista è a distanza diversa dal quadro: la fuga risulterebbe più (o meno) marcata.';
        return 'In quella pianta l\'osservatore è spostato di lato: il punto principale non cadrebbe al centro dell\'immagine.';
      }
    };
  }

  // 4. Lettura della prospettiva: riconoscere il tipo e, se accidentale,
  // ritrovare i punti di fuga orientando due rette lungo gli spigoli che fuggono.

  // Fra gli spigoli paralleli a una direzione si sceglie quello che nel disegno
  // risulta più lungo, cioè il più leggibile.
  function spigoloDaSeguire(solido, vista, direzione, fuga) {
    const topo = Geo.costruisciTopologia(solido);
    let migliore = null;
    for (const s of topo.spigoli) {
      const A = solido.vertici[s.a], B = solido.vertici[s.b];
      const d = Geo.normalize(Geo.sub(B, A));
      if (Math.abs(Math.abs(Geo.dot(d, direzione)) - 1) > 1e-4) continue;
      const pa = vista.project(A), pb = vista.project(B);
      const lunghezza = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (!migliore || lunghezza > migliore.lunghezza) migliore = { pa: pa, pb: pb, lunghezza: lunghezza };
    }
    if (!migliore) return null;
    // l'ancora è l'estremo lontano dal punto di fuga: la retta si orienta
    // partendo di lì e puntando verso la fuga
    const distA = Math.hypot(migliore.pa[0] - fuga[0], migliore.pa[1] - fuga[1]);
    const distB = Math.hypot(migliore.pb[0] - fuga[0], migliore.pb[1] - fuga[1]);
    const ancora = distA > distB ? migliore.pa : migliore.pb;
    const verso = distA > distB ? migliore.pb : migliore.pa;
    return {
      ancora: ancora,
      altroEstremo: verso,
      angoloGiusto: Math.atan2(verso[1] - ancora[1], verso[0] - ancora[0]) * 180 / Math.PI,
      lunghezza: migliore.lunghezza
    };
  }

  function generaLetturaProspettiva() {
    const accidentale = Math.random() < 0.7;
    const alfa = accidentale ? scegli([30, 40, 50, 60]) : 0;
    const distanza = intero(130, 190);
    const altezza = intero(35, 70);
    const solido = Solidi.prismaRettangolare(intero(55, 70), intero(40, 55), intero(45, 62));
    const posizione = { allontanamento: intero(20, 40), quota: 0 };
    const vista = Geo.vistaProspettica({ x: 0, distanza: distanza, altezza: altezza });
    const collocato = Disegno.collocaPerProspettiva(solido, posizione, alfa);
    const fughe = Disegno.puntiDiFuga(vista, alfa).filter(f => !f.coincidePP);

    let bersagli = [];
    if (accidentale && fughe.length === 2) {
      bersagli = fughe.map(f => spigoloDaSeguire(collocato, vista, f.direzione, f.p)).filter(Boolean);
    }
    if (accidentale && bersagli.length < 2) return null;

    const disegnaScena = (svg, conRiscontro) => {
      Disegno.disegnaProspettiva(svg, solido, vista, Object.assign({}, OPZIONI_ASSONOMETRIA, {
        alfa: alfa, posizione: posizione,
        lineeDiFuga: conRiscontro, inquadraFughe: conRiscontro,
        mostraPunti: conRiscontro
      }));
    };

    return {
      argomento: 'prospettiva',
      tipo: 'lettura-prospettiva',
      forma: 'lettura',
      domanda: 'Questa è l\'immagine prospettica di un parallelepipedo. È una prospettiva centrale o accidentale? ' +
        'Se è accidentale dovrai poi ritrovare i punti di fuga prolungando gli spigoli.',
      scelte: [{ valore: 'centrale', etichetta: 'Centrale' }, { valore: 'accidentale', etichetta: 'Accidentale' }],
      valoreGiusto: accidentale ? 'accidentale' : 'centrale',
      bersagli: bersagli,
      fughe: fughe,
      disegnaScena: disegnaScena,
      disegnaDomanda: contenitore => disegnaScena(pannello(contenitore, 'Immagine prospettica'), false),
      spiegazione: accidentale
        ? 'È accidentale: nessuna faccia è parallela al quadro, quindi gli spigoli orizzontali fuggono verso due punti distinti sull\'orizzonte.'
        : 'È centrale: la faccia frontale è parallela al quadro e resta in vera forma, mentre gli spigoli di profondità fuggono tutti nel punto principale.'
    };
  }

  // --- Registro dei generatori ---

  const GENERATORI = {
    ortogonali: [generaEsercizioOrtogonali],
    assonometria: [generaTipoAssonometria, generaCoefficienti, generaErroreCostruzione],
    sezioni: [generaRiconoscimentoSezione],
    prospettiva: [generaPuntiDiFuga, generaEffettoParametri, generaProspettivaAllaPianta, generaLetturaProspettiva]
  };

  function generatoriAttivi() {
    if (stato.argomento === 'misto') {
      return GENERATORI.ortogonali.concat(GENERATORI.assonometria, GENERATORI.sezioni, GENERATORI.prospettiva);
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
    // nella lettura le risposte sono due soli pulsanti: il disegno può prendersi più spazio
    el.riquadroDomanda.classList.toggle('alto', esercizio.forma === 'lettura');
    if (esercizio.disegnaDomanda) esercizio.disegnaDomanda(el.riquadroDomanda);

    el.opzioni.innerHTML = '';
    const quante = esercizio.forma === 'scelta' ? esercizio.opzioni.length : 3;
    el.opzioni.className = 'opzioni opzioni-' + quante +
      (esercizio.forma === 'abbinamento' ? ' abbinamento' : '') +
      (esercizio.disposizioneOpzioni === 'colonna' ? ' in-colonna' : '');
    if (esercizio.forma === 'abbinamento') costruisciAbbinamento(esercizio);
    else if (esercizio.forma === 'lettura') costruisciLettura(esercizio);
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
      if (opzione.disegna) {
        opzione.disegna(nuovoSvg(carta, 'disegno-opzione'), false);
      } else {
        carta.classList.add('opzione-testo');
        const testo = document.createElement('span');
        testo.className = 'testo-opzione';
        testo.textContent = opzione.etichetta;
        carta.appendChild(testo);
      }
      carta.addEventListener('click', () => rispondi(indice));
      el.opzioni.appendChild(carta);
    });
  }

  // Esercizio di lettura: prima si riconosce il tipo, poi si orientano le due
  // rette di fuga finché non seguono gli spigoli e si incontrano nel punto di fuga.
  const TOLLERANZA_RETTE = 5;   // gradi

  function costruisciLettura(esercizio) {
    const scelte = document.createElement('div');
    scelte.className = 'scelte-lettura';
    esercizio.scelte.forEach(scelta => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'carta-opzione opzione-testo';
      b.textContent = scelta.etichetta;
      b.addEventListener('click', () => rispondiLettura(scelta.valore, b));
      scelte.appendChild(b);
    });
    el.opzioni.appendChild(scelte);
  }

  function rispondiLettura(valore, pulsante) {
    if (stato.risposto) return;
    const esercizio = stato.esercizio;
    const giusta = valore === esercizio.valoreGiusto;
    el.opzioni.querySelectorAll('.carta-opzione').forEach(b => {
      b.disabled = true;
      if (b === pulsante) b.classList.add(giusta ? 'giusta' : 'sbagliata');
    });

    if (!giusta || esercizio.valoreGiusto === 'centrale') {
      stato.risposto = true;
      esercizio.disegnaScena(el.riquadroDomanda.querySelector('svg'), true);
      concludi(giusta, (giusta ? 'Giusto. ' : 'Non è così. ') + esercizio.spiegazione);
      return;
    }
    // riconosciuta come accidentale: si passa a ritrovare i punti di fuga
    el.riscontro.className = 'riscontro esito-giusto';
    el.riscontro.innerHTML = '<b>Giusto, è accidentale.</b> ' +
      'Nel disegno sono evidenziati due spigoli, uno rosso e uno verde, che nello spazio sono orizzontali. ' +
      'Le rette r₁ e r₂ sono rette di costruzione: trascina il loro pallino per portarle sopra lo spigolo ' +
      'dello stesso colore e prolungarlo. Dove le due rette si incontrano cade il punto di fuga.';
    avviaRetteDiFuga(esercizio);
  }

  function avviaRetteDiFuga(esercizio) {
    const svg = el.riquadroDomanda.querySelector('svg');
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'rette-di-fuga');
    svg.appendChild(g);

    // le rette si prolungano oltre il solido: l'inquadratura va allargata,
    // altrimenti verrebbero tagliate dal bordo del riquadro
    const riquadro = svg.getAttribute('viewBox').split(' ').map(Number);
    const fattore = 1.3;
    const cx = riquadro[0] + riquadro[2] / 2, cy = riquadro[1] + riquadro[3] / 2;
    const larghezza = riquadro[2] * fattore, altezza = riquadro[3] * fattore;
    svg.setAttribute('viewBox', [cx - larghezza / 2, cy - altezza / 2, larghezza, altezza].join(' '));

    const scala = Math.max(larghezza, altezza);
    const raggio = scala * 0.022;
    const lunghezza = scala * 0.3;

    // le rette partono disorientate: vanno ruotate fino a seguire lo spigolo
    const rette = esercizio.bersagli.map((b, i) => ({
      bersaglio: b,
      angolo: b.angoloGiusto + (i === 0 ? 34 : -34)
    }));

    const elementi = rette.map(() => ({
      linea: document.createElementNS(NS, 'line'),
      presa: document.createElementNS(NS, 'circle'),
      maniglia: document.createElementNS(NS, 'circle'),
      nome: document.createElementNS(NS, 'text')
    }));
    // gli spigoli da prolungare vengono evidenziati nei colori delle rette:
    // così si capisce quale retta segue quale spigolo
    esercizio.bersagli.forEach((b, i) => {
      const spigolo = document.createElementNS(NS, 'line');
      spigolo.setAttribute('class', 'spigolo-bersaglio retta-' + (i + 1));
      spigolo.setAttribute('x1', b.ancora[0]);
      spigolo.setAttribute('y1', b.ancora[1]);
      spigolo.setAttribute('x2', b.altroEstremo[0]);
      spigolo.setAttribute('y2', b.altroEstremo[1]);
      g.appendChild(spigolo);
    });

    const incrocio = document.createElementNS(NS, 'circle');
    incrocio.setAttribute('class', 'punto-incrocio');
    incrocio.setAttribute('r', raggio * 0.9);

    elementi.forEach((e, i) => {
      // due colori diversi: le rette vanno distinte l'una dall'altra
      e.linea.setAttribute('class', 'retta-di-fuga retta-' + (i + 1));
      e.presa.setAttribute('class', 'area-presa');
      e.presa.setAttribute('r', raggio * 3);
      e.presa.dataset.retta = i;
      e.maniglia.setAttribute('class', 'maniglia-retta maniglia-' + (i + 1));
      e.maniglia.setAttribute('r', raggio);
      e.nome.setAttribute('class', 'etichetta-retta retta-' + (i + 1));
      e.nome.setAttribute('font-size', raggio * 2.4);
      e.nome.textContent = 'r' + (i === 0 ? '₁' : '₂');
      g.appendChild(e.linea);
      g.appendChild(e.maniglia);
      g.appendChild(e.nome);
      g.appendChild(e.presa);
    });
    g.appendChild(incrocio);

    function aggiorna() {
      rette.forEach((r, i) => {
        const a = Geo.deg2rad(r.angolo);
        const fine = [r.bersaglio.ancora[0] + Math.cos(a) * lunghezza,
                      r.bersaglio.ancora[1] + Math.sin(a) * lunghezza];
        const e = elementi[i];
        e.linea.setAttribute('x1', r.bersaglio.ancora[0]);
        e.linea.setAttribute('y1', r.bersaglio.ancora[1]);
        e.linea.setAttribute('x2', fine[0]);
        e.linea.setAttribute('y2', fine[1]);
        e.maniglia.setAttribute('cx', fine[0]);
        e.maniglia.setAttribute('cy', fine[1]);
        e.presa.setAttribute('cx', fine[0]);
        e.presa.setAttribute('cy', fine[1]);
        e.nome.setAttribute('x', fine[0] + raggio * 1.2);
        e.nome.setAttribute('y', fine[1] - raggio * 1.2);
      });
      const p = intersezione(rette);
      if (p) {
        incrocio.setAttribute('cx', p[0]);
        incrocio.setAttribute('cy', p[1]);
        incrocio.setAttribute('visibility', 'visible');
      } else {
        incrocio.setAttribute('visibility', 'hidden');
      }
    }

    function intersezione(rette) {
      const [r1, r2] = rette;
      const a1 = Geo.deg2rad(r1.angolo), a2 = Geo.deg2rad(r2.angolo);
      const d1 = [Math.cos(a1), Math.sin(a1)], d2 = [Math.cos(a2), Math.sin(a2)];
      const den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) < 1e-6) return null;
      const p1 = r1.bersaglio.ancora, p2 = r2.bersaglio.ancora;
      const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / den;
      return [p1[0] + d1[0] * t, p1[1] + d1[1] * t];
    }

    let trascinata = null;
    function coordinate(e) {
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const punto = svg.createSVGPoint();
      punto.x = e.clientX; punto.y = e.clientY;
      return punto.matrixTransform(ctm.inverse());
    }
    svg.addEventListener('pointerdown', e => {
      const nodo = e.target.closest('[data-retta]');
      if (!nodo || stato.risposto) return;
      trascinata = Number(nodo.dataset.retta);
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    svg.addEventListener('pointermove', e => {
      if (trascinata === null) return;
      const p = coordinate(e);
      if (!p) return;
      const r = rette[trascinata];
      r.angolo = Math.atan2(p.y - r.bersaglio.ancora[1], p.x - r.bersaglio.ancora[0]) * 180 / Math.PI;
      aggiorna();
    });
    const fine = e => {
      if (trascinata === null) return;
      trascinata = null;
      if (svg.hasPointerCapture && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    };
    svg.addEventListener('pointerup', fine);
    svg.addEventListener('pointercancel', fine);

    aggiorna();
    el.verifica.hidden = false;
    el.verifica.disabled = false;
    el.verifica.textContent = 'Verifica le rette di fuga';
    stato.retteDiFuga = rette;
  }

  function verificaRetteDiFuga() {
    if (stato.risposto) return;
    stato.risposto = true;
    const esercizio = stato.esercizio;
    const scarti = stato.retteDiFuga.map(r => {
      let d = Math.abs(((r.angolo - r.bersaglio.angoloGiusto) % 360 + 360) % 360);
      if (d > 180) d = 360 - d;
      return Math.min(d, Math.abs(180 - d));      // la retta vale anche capovolta
    });
    const giusta = scarti.every(s => s <= TOLLERANZA_RETTE);
    el.verifica.hidden = true;

    const svg = el.riquadroDomanda.querySelector('svg');
    esercizio.disegnaScena(svg, true);
    disegnaCorrezioneRette(svg, esercizio, stato.retteDiFuga);

    const dettaglio = 'Scarto delle tue rette: ' +
      scarti.map(s => Math.round(s) + '°').join(' e ') + '.';
    concludi(giusta, giusta
      ? 'Rette orientate bene: si incontrano nel punto di fuga. ' + dettaglio + ' ' + esercizio.spiegazione
      : 'Le rette non seguono ancora gli spigoli. ' + dettaglio +
        ' In verde vedi le rette giuste, prolungate fino ai punti di fuga; tratteggiate le tue.');
  }

  // Correzione: le rette tracciate dallo studente restano visibili, tratteggiate,
  // accanto a quelle corrette prolungate fino ai punti di fuga.
  function disegnaCorrezioneRette(svg, esercizio, rette) {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'correzione-rette');
    const riquadro = svg.getAttribute('viewBox').split(' ').map(Number);
    const scala = Math.max(riquadro[2], riquadro[3]);

    const linea = (x1, y1, x2, y2, classe) => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('class', classe);
      g.appendChild(l);
    };

    rette.forEach((r, i) => {
      const fuga = esercizio.fughe[i].p;
      const ancora = r.bersaglio.ancora;
      // la retta corretta: dallo spigolo fino al suo punto di fuga
      linea(ancora[0], ancora[1], fuga[0], fuga[1], 'retta-giusta');
      // la retta tracciata dallo studente, per confronto
      const a = Geo.deg2rad(r.angolo);
      const distanza = Math.hypot(fuga[0] - ancora[0], fuga[1] - ancora[1]);
      linea(ancora[0], ancora[1],
        ancora[0] + Math.cos(a) * distanza, ancora[1] + Math.sin(a) * distanza,
        'retta-tentativo');
    });

    esercizio.fughe.forEach(f => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', f.p[0]); c.setAttribute('cy', f.p[1]);
      c.setAttribute('r', scala * 0.016);
      c.setAttribute('class', 'punto-fuga');
      g.appendChild(c);
    });
    svg.appendChild(g);
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
      if (svg && esercizio.opzioni[i].disegna) esercizio.opzioni[i].disegna(svg, true);
    });

    // alcune domande mostrano nel riscontro la costruzione che dà la risposta
    if (esercizio.riscontroDomanda) {
      el.riquadroDomanda.innerHTML = '';
      esercizio.riscontroDomanda(el.riquadroDomanda);
    }

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
    el.verifica.addEventListener('click', () => {
      if (stato.esercizio && stato.esercizio.forma === 'lettura') verificaRetteDiFuga();
      else verificaAbbinamento();
    });
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
