// Disegno delle viste in SVG, con le convenzioni del disegno tecnico:
// linea continua grossa per gli spigoli in vista, tratteggio per i nascosti,
// tratto-punto per assi e linee di richiamo.

const Disegno = (function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const LETTERE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function el(nome, attributi) {
    const e = document.createElementNS(NS, nome);
    for (const k in attributi) e.setAttribute(k, attributi[k]);
    return e;
  }

  function svuota(nodo) { while (nodo.firstChild) nodo.removeChild(nodo.firstChild); }

  function linea(x1, y1, x2, y2, classe) {
    return el('line', { x1: x1, y1: y1, x2: x2, y2: y2, class: classe });
  }

  function limiti(solido) {
    const v = solido.vertici;
    return {
      x0: Math.min(...v.map(p => p[0])), x1: Math.max(...v.map(p => p[0])),
      y0: Math.min(...v.map(p => p[1])), y1: Math.max(...v.map(p => p[1])),
      z0: Math.min(...v.map(p => p[2])), z1: Math.max(...v.map(p => p[2]))
    };
  }

  // --- Sezione ---

  // Se la sezione è attiva prepara il solido tagliato e i contorni della
  // figura di sezione; altrimenti restituisce il solido intero.
  function applicaSezione(solido, opzioni) {
    const s = opzioni.sezione;
    if (!s || !s.attiva) return { solido: solido, piano: null, anelli: null };
    const piano = Sezione.piano(solido, s);
    const taglio = Sezione.taglia(solido, piano);
    return {
      solido: s.effettuata ? taglio.solido : solido,
      piano: piano,
      anelli: s.effettuata ? taglio.anelli : null
    };
  }

  function trasformaAnelli(anelli, f) {
    return anelli ? anelli.map(a => a.map(f)) : null;
  }

  // Tratteggio a 45° della figura di sezione, ritagliato sul contorno con la
  // regola pari-dispari (vale anche per sezioni con più contorni o con fori).
  function disegnaTratteggio(gruppo, anelli2D, passo) {
    const dir = [Math.SQRT1_2, -Math.SQRT1_2];      // 45° verso l'alto a destra
    const perp = [-dir[1], dir[0]];
    const proiezioni = [];
    anelli2D.forEach(a => a.forEach(p => proiezioni.push(p[0] * perp[0] + p[1] * perp[1])));
    if (!proiezioni.length) return;
    const minimo = Math.min(...proiezioni), massimo = Math.max(...proiezioni);
    if (massimo - minimo < 1e-6) return;
    const numero = Math.min(240, Math.ceil((massimo - minimo) / passo));
    const passoEffettivo = (massimo - minimo) / Math.max(numero, 1);

    for (let k = 1; k < numero; k++) {
      const t = minimo + k * passoEffettivo;
      const incroci = [];
      for (const anello of anelli2D) {
        for (let i = 0; i < anello.length; i++) {
          const A = anello[i], B = anello[(i + 1) % anello.length];
          const a = A[0] * perp[0] + A[1] * perp[1] - t;
          const b = B[0] * perp[0] + B[1] * perp[1] - t;
          if ((a <= 0 && b > 0) || (a > 0 && b <= 0)) {
            const s = a / (a - b);
            const P = [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s];
            incroci.push(P[0] * dir[0] + P[1] * dir[1]);
          }
        }
      }
      incroci.sort((x, y) => x - y);
      for (let i = 0; i + 1 < incroci.length; i += 2) {
        const p1 = [dir[0] * incroci[i] + perp[0] * t, dir[1] * incroci[i] + perp[1] * t];
        const p2 = [dir[0] * incroci[i + 1] + perp[0] * t, dir[1] * incroci[i + 1] + perp[1] * t];
        gruppo.appendChild(linea(p1[0], p1[1], p2[0], p2[1], 'tratteggio-sezione'));
      }
    }
  }

  function disegnaFiguraDiSezione(gruppo, anelli, vista, off, dimensione) {
    if (!anelli || !anelli.length) return;
    const anelli2D = anelli.map(a => a.map(p => {
      const q = vista.project(p);
      return [q[0] + off[0], q[1] + off[1]];
    }));
    const g = el('g', { class: 'figura-sezione' });
    disegnaTratteggio(g, anelli2D, dimensione * 0.05);
    for (const anello of anelli2D) {
      const punti = anello.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ');
      g.appendChild(el('polygon', { points: punti, class: 'contorno-sezione' }));
    }
    gruppo.appendChild(g);
  }

  function disegnaPianoSezione(gruppo, piano, vista, off, trasforma) {
    const rettangolo = Sezione.rettangoloDelPiano(piano, 0.3).map(trasforma || (p => p));
    const punti = rettangolo.map(p => {
      const q = vista.project(p);
      return (q[0] + off[0]).toFixed(2) + ',' + (q[1] + off[1]).toFixed(2);
    }).join(' ');
    gruppo.appendChild(el('polygon', { points: punti, class: 'piano-sezione' }));
  }

  // Vera forma della sezione, ribaltata sul piano del disegno e affiancata
  // alla vista.
  function disegnaVeraForma(gruppo, anelli, posizione, dimensione, dimTesto) {
    if (!anelli || !anelli.length) return;
    const forme = Sezione.veraForma(anelli);
    const tutti = [].concat.apply([], forme);
    const x0 = Math.min(...tutti.map(p => p[0])), x1 = Math.max(...tutti.map(p => p[0]));
    const y0 = Math.min(...tutti.map(p => p[1])), y1 = Math.max(...tutti.map(p => p[1]));
    const dx = posizione[0] - x0, dy = posizione[1] - y0;
    const spostate = forme.map(f => f.map(p => [p[0] + dx, p[1] + dy]));

    const g = el('g', { class: 'vera-forma' });
    disegnaTratteggio(g, spostate, dimensione * 0.05);
    for (const forma of spostate) {
      g.appendChild(el('polygon', {
        points: forma.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '),
        class: 'contorno-sezione'
      }));
    }
    const t = el('text', {
      x: posizione[0], y: posizione[1] - dimTesto * 0.6,
      class: 'titolo-vista', 'font-size': dimTesto
    });
    t.textContent = 'Vera forma della sezione';
    g.appendChild(t);
    gruppo.appendChild(g);
    return { larghezza: x1 - x0, altezza: y1 - y0 };
  }

  // Ribaltamento della sezione sul P.O. nelle proiezioni ortogonali: la figura
  // arriva in vera grandezza nella posizione che le assegna la costruzione,
  // legata alla pianta dalle rette perpendicolari alla traccia.
  function disegnaRibaltamento(gruppo, solido, dimensione, dimTesto) {
    const anelli = solido.anelli;
    if (!anelli || !anelli.length) return false;
    const b = limiti(solido);
    const centro = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
    const r = Sezione.ribaltamentoSulPO(anelli, centro);
    if (!r) return false;

    // se la cerniera cade lontanissima (piano quasi orizzontale) il disegno
    // diventerebbe enorme: in quel caso si rinuncia al ribaltamento
    const distanzaCerniera = Math.abs(Geo.dot(Geo.sub(centro, r.cerniera.punto),
      Geo.normalize(Geo.cross([0, 0, 1], r.cerniera.direzione))));
    if (distanzaCerniera > dimensione * 4) return false;

    const pianta = Geo.vistaOrtogonale('pianta');
    const g = el('g', { class: 'ribaltamento-sezione' });

    // la traccia del piano sul P.O., cerniera della rotazione
    const estensione = dimensione * 1.4;
    const a1 = Geo.add(r.cerniera.punto, Geo.scale(r.cerniera.direzione, -estensione));
    const a2 = Geo.add(r.cerniera.punto, Geo.scale(r.cerniera.direzione, estensione));
    const pa1 = pianta.project(a1), pa2 = pianta.project(a2);
    g.appendChild(linea(pa1[0], pa1[1], pa2[0], pa2[1], 'traccia-piano'));
    const t = el('text', {
      x: pa2[0] + dimTesto * 0.3, y: pa2[1], class: 'nota-disegno', 'font-size': dimTesto * 0.9
    });
    t.textContent = 'traccia del piano (cerniera)';
    g.appendChild(t);

    // rette di ribaltamento: ogni punto si sposta perpendicolarmente alla traccia
    const passo = Math.max(1, Math.ceil(anelli[0].length / 12));
    anelli.forEach((anello, i) => {
      const ribaltato = r.anelli[i];
      for (let k = 0; k < anello.length; k += passo) {
        const p1 = pianta.project(anello[k]);
        const p2 = pianta.project(ribaltato[k]);
        g.appendChild(linea(p1[0], p1[1], p2[0], p2[1], 'richiamo'));
      }
    });

    const anelli2D = r.anelli.map(a => a.map(p => pianta.project(p)));
    disegnaTratteggio(g, anelli2D, dimensione * 0.05);
    for (const anello of anelli2D) {
      g.appendChild(el('polygon', {
        points: anello.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' '),
        class: 'contorno-ribaltato'
      }));
    }

    const centroRibaltato = anelli2D[0].reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0])
      .map(c => c / anelli2D[0].length);
    const titolo = el('text', {
      x: centroRibaltato[0], y: Math.max(...anelli2D[0].map(p => p[1])) + dimTesto * 1.4,
      class: 'titolo-vista', 'font-size': dimTesto, 'text-anchor': 'middle'
    });
    titolo.textContent = 'sezione ribaltata in vera forma';
    g.appendChild(titolo);
    gruppo.appendChild(g);
    return true;
  }

  // --- Segmenti proiettati di un solido in una vista ---

  function segmentiProiettati(solido, vista) {
    const spigoli = Geo.spigoliDaTracciare(solido, vista);
    const segmenti = Geo.segmentiVisibilita(solido, spigoli, vista);
    return segmenti.map(s => ({
      a: vista.project(s.a),
      b: vista.project(s.b),
      nascosto: s.nascosto
    }));
  }

  function disegnaSpigoli(gruppo, solido, vista, off, opzioni) {
    const segmenti = segmentiProiettati(solido, vista)
      .filter(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) > 1e-6);
    // prima i nascosti, poi quelli in vista: dove si sovrappongono prevale la
    // linea continua, come vuole la convenzione del disegno tecnico
    const ordine = [true, false];
    for (const nascosto of ordine) {
      if (nascosto && !opzioni.spigoliNascosti) continue;
      for (const s of segmenti) {
        if (s.nascosto !== nascosto) continue;
        gruppo.appendChild(linea(
          s.a[0] + off[0], s.a[1] + off[1],
          s.b[0] + off[0], s.b[1] + off[1],
          nascosto ? 'spigolo-nascosto' : 'spigolo-visibile'
        ));
      }
    }
  }

  // Resa ombreggiata: facce in una sola tinta tenue, con luminosità diversa
  // secondo l'orientamento rispetto a una luce convenzionale.
  const LUCE = Geo.normalize([-0.35, -0.5, 0.79]);

  function disegnaFacce(gruppo, solido, vista, off) {
    const normali = Geo.normaliFacce(solido);
    const facce = solido.facce.map((f, i) => {
      const punti = f.map(k => solido.vertici[k]);
      const centro = punti.reduce((a, p) => Geo.add(a, p), [0, 0, 0]).map(c => c / punti.length);
      const verso = Geo.versoOsservatore(vista, centro);
      const profondita = vista.puntoDiVista
        ? -Geo.length(Geo.sub(vista.puntoDiVista, centro))
        : Geo.dot(centro, Geo.normalize(vista.viewDir));
      return { indici: f, normale: normali[i], profondita: profondita, davanti: Geo.dot(normali[i], verso) > 0 };
    }).filter(f => f.davanti);
    facce.sort((a, b) => b.profondita - a.profondita);
    for (const f of facce) {
      const luce = Math.max(0, Geo.dot(f.normale, LUCE));
      const tono = Math.round(212 - 62 * luce);
      const punti = f.indici.map(k => {
        const p = vista.project(solido.vertici[k]);
        return (p[0] + off[0]).toFixed(2) + ',' + (p[1] + off[1]).toFixed(2);
      }).join(' ');
      gruppo.appendChild(el('polygon', {
        points: punti,
        fill: 'rgb(' + tono + ',' + tono + ',' + (tono + 6) + ')',
        class: 'faccia'
      }));
    }
  }

  // Notazione del disegno tecnico: A' è la prima proiezione (sul P.O.),
  // A'' la seconda (sul P.V.), A''' la terza (sul P.L.).
  const APICI = { pianta: '′', prospetto: '″', laterale: '‴' };
  const MAX_VERTICI_ETICHETTATI = 16;

  function disegnaEtichette(gruppo, solido, vista, off, dimensione) {
    if (solido.vertici.length > MAX_VERTICI_ETICHETTATI) return;
    const apice = APICI[vista.nome] || '';
    const profonditaDi = v => vista.puntoDiVista
      ? Geo.length(Geo.sub(vista.puntoDiVista, v))
      : Geo.dot(v, Geo.normalize(vista.viewDir));
    // i vertici che cadono nello stesso punto della proiezione condividono
    // l'etichetta: davanti quello in vista, tra parentesi quello che sta dietro
    const punti = [];
    for (let i = 0; i < Math.min(solido.vertici.length, LETTERE.length); i++) {
      const v = solido.vertici[i];
      const p = vista.project(v);
      const esistente = punti.find(q => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < dimensione * 0.15);
      const voce = { lettera: LETTERE[i], profondita: profonditaDi(v) };
      if (esistente) esistente.vertici.push(voce);
      else punti.push({ p: p, vertici: [voce] });
    }
    for (const punto of punti) {
      punto.vertici.sort((a, b) => a.profondita - b.profondita);
      const lettere = punto.vertici.map(v => v.lettera + apice);
      const t = el('text', {
        x: punto.p[0] + off[0] + dimensione * 0.4,
        y: punto.p[1] + off[1] - dimensione * 0.3,
        class: 'etichetta-vertice',
        'font-size': dimensione
      });
      t.textContent = lettere.length > 1
        ? lettere[0] + '(' + lettere.slice(1).join(' ') + ')'
        : lettere[0];
      gruppo.appendChild(t);
    }
  }

  // --- Proiezioni ortogonali: collocazione nel triedro, richiami, ribaltamento ---

  // Colloca il solido nel primo triedro: appoggiato al piano orizzontale,
  // allontanato dal piano verticale e dal piano laterale. Così le tre viste
  // si dispongono da sole rispetto alla linea di terra e alla sua verticale,
  // alle distanze reali, come nella costruzione di Monge.
  function collocaNelTriedro(solido, posizione) {
    const b0 = limiti(solido);
    const dimensione = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0, b0.z1 - b0.z0);
    const p = posizione || {};
    const allontanamento = p.allontanamento === undefined ? dimensione * 0.45 : p.allontanamento;
    const distanzaPL = p.distanzaPL === undefined ? dimensione * 0.45 : p.distanzaPL;
    const quota = p.quota === undefined ? 0 : p.quota;

    const chiave = allontanamento + '/' + distanzaPL + '/' + quota;
    if (solido._collocato && solido._collocato.chiave === chiave) return solido._collocato.solido;

    const b = b0;
    const dx = -distanzaPL - b.x1;      // a sinistra del piano laterale
    const dy = allontanamento - b.y0;   // davanti al piano verticale
    const dz = quota - b.z0;            // appoggiato al P.O. o sollevato di "quota"
    const trasla = v => [v[0] + dx, v[1] + dy, v[2] + dz];
    const collocato = {
      id: solido.id,
      nome: solido.nome,
      categoria: solido.categoria,
      vertici: solido.vertici.map(trasla),
      facce: solido.facce,
      anelli: trasformaAnelli(solido.anelli, trasla),
      trasforma: trasla
    };
    solido._collocato = { chiave: chiave, solido: collocato };
    return collocato;
  }

  function valoriDistinti(valori, massimo) {
    const unici = [];
    for (const v of valori) {
      if (!unici.some(u => Math.abs(u - v) < 1e-6)) unici.push(v);
    }
    if (unici.length > massimo) {
      return [Math.min(...unici), Math.max(...unici)];
    }
    return unici;
  }

  // Estensione del foglio: le tre viste stanno a sinistra e sotto l'origine
  // (prospetto e pianta) e a destra in alto (vista laterale).
  function estensione(solido, margine) {
    const b = limiti(solido);
    return {
      sinistra: b.x0 - margine,
      destra: b.y1 + margine,
      alto: -b.z1 - margine,
      basso: b.y1 + margine,
      b: b
    };
  }

  function disegnaLineaDiTerra(gruppo, solido, dimTesto, margine, vistaSingola) {
    const e = estensione(solido, margine);
    const b = e.b;
    // con una sola vista si traccia il solo tratto di L.T. che le compete
    const da = vistaSingola === 'laterale' ? b.y0 - margine : e.sinistra;
    const a = vistaSingola === 'laterale' ? b.y1 + margine : (vistaSingola ? b.x1 + margine : e.destra);
    gruppo.appendChild(linea(da, 0, a, 0, 'linea-terra'));
    if (!vistaSingola) gruppo.appendChild(linea(0, e.alto, 0, e.basso, 'linea-terra'));
    const t = el('text', {
      x: da, y: -dimTesto * 0.45,
      class: 'etichetta-lt', 'font-size': dimTesto
    });
    t.textContent = 'L.T.';
    gruppo.appendChild(t);
  }

  function disegnaRichiami(gruppo, solido, dimTesto, margine) {
    const e = estensione(solido, margine);
    const b = e.b;
    const xs = valoriDistinti(solido.vertici.map(v => v[0]), 8);
    const zs = valoriDistinti(solido.vertici.map(v => v[2]), 8);
    const ys = valoriDistinti(solido.vertici.map(v => v[1]), 8);

    // prospetto -> pianta: richiami verticali
    for (const x of xs) gruppo.appendChild(linea(x, -b.z1 - margine * 0.4, x, b.y1 + margine * 0.4, 'richiamo'));
    // prospetto -> vista laterale: richiami orizzontali
    for (const z of zs) gruppo.appendChild(linea(b.x0 - margine * 0.4, -z, b.y1 + margine * 0.4, -z, 'richiamo'));
    // pianta -> linea di ribaltamento a 45° -> vista laterale
    for (const y of ys) {
      gruppo.appendChild(linea(b.x0 - margine * 0.4, y, y, y, 'richiamo'));
      gruppo.appendChild(linea(y, y, y, -b.z1 - margine * 0.4, 'richiamo'));
    }
    // la linea di ribaltamento passa per l'origine dei tre piani
    const fine = b.y1 + margine * 0.6;
    gruppo.appendChild(linea(0, 0, fine, fine, 'ribaltamento'));
    const testo = el('text', {
      x: fine + dimTesto * 0.3, y: fine + dimTesto * 0.35,
      class: 'nota-disegno', 'font-size': dimTesto * 0.92
    });
    testo.textContent = 'ribaltamento 45°';
    gruppo.appendChild(testo);
  }

  // I tre piani di proiezione ribaltati sul foglio: si incontrano nell'origine
  // e la loro traccia comune è la linea di terra.
  function disegnaPianiProiezione(gruppo, solido, dimTesto, margine) {
    const e = estensione(solido, margine);
    const b = e.b;
    const pad = dimTesto * 0.5;
    const riquadri = [
      { x: e.sinistra, y: e.alto, w: -e.sinistra, h: -e.alto, etichetta: 'P.V.', tx: -pad, ty: e.alto + dimTesto * 1.2 },
      { x: e.sinistra, y: 0, w: -e.sinistra, h: b.y1 + margine, etichetta: 'P.O.', tx: -pad, ty: b.y1 + margine - pad },
      { x: 0, y: e.alto, w: b.y1 + margine, h: -e.alto, etichetta: 'P.L.', tx: b.y1 + margine - pad, ty: e.alto + dimTesto * 1.2 }
    ];
    for (const r of riquadri) {
      gruppo.appendChild(el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, class: 'piano-proiezione' }));
      const t = el('text', {
        x: r.tx, y: r.ty, 'text-anchor': 'end',
        class: 'etichetta-piano', 'font-size': dimTesto
      });
      t.textContent = r.etichetta;
      gruppo.appendChild(t);
    }
  }

  function disegnaProiezioniOrtogonali(svg, solidoOriginale, opzioni) {
    const sezione = applicaSezione(solidoOriginale, opzioni);
    const solido = collocaNelTriedro(sezione.solido, opzioni.posizione);
    const b = limiti(solido);
    const dimensione = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    const dimTesto = dimensione * 0.1;
    const margine = dimensione * 0.22;
    const g = el('g', {});
    svuota(svg);

    const singola = opzioni.vistaSingola;
    if (!singola) {
      if (opzioni.piani) disegnaPianiProiezione(g, solido, dimTesto, margine);
      if (opzioni.richiami) disegnaRichiami(g, solido, dimTesto, margine);
    }
    disegnaLineaDiTerra(g, solido, dimTesto, margine, singola);

    let viste = ['prospetto', 'pianta', 'laterale'].map(n => Geo.vistaOrtogonale(n));
    if (singola) viste = viste.filter(v => v.nome === singola);

    for (const vista of viste) {
      const gv = el('g', { class: 'vista vista-' + vista.nome });
      if (sezione.piano && !opzioni.sezione.effettuata) {
        disegnaPianoSezione(gv, sezione.piano, vista, [0, 0], solido.trasforma);
      }
      disegnaSpigoli(gv, solido, vista, [0, 0], opzioni);
      disegnaFiguraDiSezione(gv, solido.anelli, vista, [0, 0], dimensione);
      if (opzioni.etichette) disegnaEtichette(gv, solido, vista, [0, 0], dimTesto * 0.85);
      g.appendChild(gv);
      g.appendChild(titoloVista(vista, b, dimTesto, margine));
    }
    if (solido.anelli && opzioni.sezione.veraForma && !singola) {
      // se il piano è parallelo a un piano di proiezione la sezione è già in
      // vera forma su quella vista e il ribaltamento non serve; altrimenti si
      // ribalta attorno alla traccia del piano sul P.O.
      const dove = vistaInVeraForma(opzioni.sezione.tipo);
      if (dove) {
        const nota = el('text', {
          x: b.x0, y: b.y1 + margine * 1.6, class: 'nota-disegno', 'font-size': dimTesto
        });
        nota.textContent = 'La sezione è già in vera forma ' + dove + '.';
        g.appendChild(nota);
      } else if (!disegnaRibaltamento(g, solido, dimensione, dimTesto)) {
        disegnaVeraForma(g, solido.anelli, [b.y1 + margine * 3, -b.z1], dimensione, dimTesto);
      }
    }
    svg.appendChild(g);
    adattaViewBox(svg, g, margine);
  }

  // Un piano parallelo a un piano di proiezione dà la sezione in vera forma
  // sulla vista corrispondente, senza bisogno di ribaltamenti.
  function vistaInVeraForma(tipoPiano) {
    if (tipoPiano === 'orizzontale') return 'nella pianta';
    if (tipoPiano === 'verticale') return 'nel prospetto';
    if (tipoPiano === 'profilo') return 'nella vista laterale';
    return null;
  }

  function titoloVista(vista, b, dimTesto, margine) {
    // il titolo sta sopra la propria vista, tranne la pianta che lo porta sotto
    const posizioni = {
      prospetto: [b.x0, -b.z1 - margine * 0.45],
      laterale: [b.y0, -b.z1 - margine * 0.45],
      pianta: [b.x0, b.y1 + margine * 0.8]
    };
    const p = posizioni[vista.nome];
    const t = el('text', { x: p[0], y: p[1], class: 'titolo-vista', 'font-size': dimTesto });
    t.textContent = vista.etichetta;
    return t;
  }

  // --- Prospettiva ---

  // Colloca il solido dietro il quadro: ruotato di "alfa" attorno all'asse
  // verticale (0° = prospettiva centrale), appoggiato o sollevato secondo la
  // quota, e allontanato dal quadro come nelle proiezioni ortogonali.
  function collocaDietroIlQuadro(solido, posizione, alfaDeg) {
    const p = posizione || {};
    const b0 = limiti(solido);
    const dimensione = Math.max(b0.x1 - b0.x0, b0.y1 - b0.y0, b0.z1 - b0.z0);
    const allontanamento = p.allontanamento === undefined ? dimensione * 0.45 : p.allontanamento;
    const quota = p.quota === undefined ? 0 : p.quota;

    const chiave = allontanamento + '/' + quota + '/' + alfaDeg;
    if (solido._dietroQuadro && solido._dietroQuadro.chiave === chiave) return solido._dietroQuadro.solido;

    const m = Geo.rotZ(Geo.deg2rad(alfaDeg));
    const ruotati = solido.vertici.map(v => Geo.matVec(m, v));
    const minY = Math.min(...ruotati.map(v => v[1]));
    const minZ = Math.min(...ruotati.map(v => v[2]));
    const cx = (Math.min(...ruotati.map(v => v[0])) + Math.max(...ruotati.map(v => v[0]))) / 2;
    const trasforma = v => {
      const r = Geo.matVec(m, v);
      return [r[0] - cx, r[1] - minY + allontanamento, r[2] - minZ + quota];
    };
    const collocato = {
      id: solido.id, nome: solido.nome, categoria: solido.categoria,
      vertici: ruotati.map(v => [v[0] - cx, v[1] - minY + allontanamento, v[2] - minZ + quota]),
      facce: solido.facce,
      anelli: trasformaAnelli(solido.anelli, trasforma),
      trasforma: trasforma
    };
    solido._dietroQuadro = { chiave: chiave, solido: collocato };
    return collocato;
  }

  // Direzioni orizzontali principali del solido: quelle dei suoi spigoli
  // orizzontali, cioè le direzioni che generano i punti di fuga.
  function direzioniDiFuga(alfaDeg) {
    const a = Geo.deg2rad(alfaDeg);
    return [
      { u: [Math.cos(a), Math.sin(a), 0], nome: 'F1' },
      { u: [-Math.sin(a), Math.cos(a), 0], nome: 'F2' }
    ];
  }

  function disegnaProspettiva(svg, solidoOriginale, vista, opzioni) {
    svuota(svg);
    const sezione = applicaSezione(solidoOriginale, opzioni);
    const solido = collocaDietroIlQuadro(sezione.solido, opzioni.posizione, opzioni.alfa);
    const g = el('g', {});
    const b = limiti(solido);
    const dimensione = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);

    const proiettati = solido.vertici.map(v => vista.project(v));
    const estremi = {
      x0: Math.min(...proiettati.map(p => p[0])),
      x1: Math.max(...proiettati.map(p => p[0])),
      y0: Math.min(...proiettati.map(p => p[1])),
      y1: Math.max(...proiettati.map(p => p[1]))
    };
    const fughe = puntiDiFuga(vista, opzioni.alfa);
    const yOrizzonte = -vista.altezza;

    // L'inquadratura comprende il solido, la linea di terra e l'orizzonte;
    // solo su richiesta si allarga fino ai punti di fuga, che possono cadere
    // molto lontano e rimpicciolire troppo il disegno.
    const riquadro = {
      x0: estremi.x0, x1: estremi.x1,
      y0: Math.min(estremi.y0, yOrizzonte), y1: Math.max(estremi.y1, 0)
    };
    if (opzioni.inquadraFughe) {
      fughe.filter(f => !f.coincidePP).forEach(f => {
        riquadro.x0 = Math.min(riquadro.x0, f.p[0]);
        riquadro.x1 = Math.max(riquadro.x1, f.p[0]);
      });
      riquadro.x0 = Math.min(riquadro.x0, vista.x);
      riquadro.x1 = Math.max(riquadro.x1, vista.x);
    }
    // i testi si dimensionano sull'inquadratura, non sul solido
    const dimTesto = Math.max(dimensione * 0.05, (riquadro.x1 - riquadro.x0) * 0.028);
    const sinistra = riquadro.x0 - dimTesto;
    const destra = riquadro.x1 + dimTesto;

    if (opzioni.lineeDiFuga) disegnaLineeDiFuga(g, solido, vista, fughe, opzioni);

    // linea di terra (base del quadro) e linea d'orizzonte
    g.appendChild(linea(sinistra, 0, destra, 0, 'linea-terra'));
    etichetta(g, 'L.T.', sinistra, -dimTesto * 0.45, 'etichetta-lt', dimTesto);
    const presa = linea(sinistra, yOrizzonte, destra, yOrizzonte, 'area-presa-orizzonte');
    presa.setAttribute('data-punto', 'orizzonte');
    presa.setAttribute('stroke-width', dimTesto * 2.6);
    g.appendChild(presa);
    g.appendChild(linea(sinistra, yOrizzonte, destra, yOrizzonte, 'linea-orizzonte'));
    // sotto la linea, per non finire sopra l'etichetta di un punto di fuga
    etichetta(g, "linea d'orizzonte", sinistra, yOrizzonte + dimTesto * 1.15, 'etichetta-orizzonte', dimTesto);

    const gv = el('g', { class: 'vista vista-prospettiva' });
    const ombreggiato = opzioni.resa === 'ombreggiato';
    if (ombreggiato) disegnaFacce(gv, solido, vista, [0, 0]);
    if (sezione.piano && !opzioni.sezione.effettuata) {
      disegnaPianoSezione(gv, sezione.piano, vista, [0, 0], solido.trasforma);
    }
    disegnaSpigoli(gv, solido, vista, [0, 0],
      ombreggiato ? Object.assign({}, opzioni, { spigoliNascosti: false }) : opzioni);
    disegnaFiguraDiSezione(gv, solido.anelli, vista, [0, 0], dimensione);
    if (opzioni.etichette) disegnaEtichette(gv, solido, vista, [0, 0], dimTesto * 0.85);
    g.appendChild(gv);

    // punto principale e punti di fuga, con l'area di presa per il dito
    puntoTrascinabile(g, [vista.x, yOrizzonte], 'P.P.', 'punto-vista', dimTesto, 'punto-principale');
    fughe.filter(f => !f.coincidePP)
      .forEach(f => puntoTrascinabile(g, f.p, f.etichetta, 'punto-fuga', dimTesto, f.nome));

    svg.appendChild(g);

    const margine = dimTesto * 2.2;
    svg.setAttribute('viewBox', [
      riquadro.x0 - margine, riquadro.y0 - margine,
      Math.max(riquadro.x1 - riquadro.x0 + 2 * margine, 1),
      Math.max(riquadro.y1 - riquadro.y0 + 2 * margine, 1)
    ].join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  function puntiDiFuga(vista, alfaDeg) {
    const fughe = [];
    direzioniDiFuga(alfaDeg).forEach((d, i) => {
      const p = vista.puntoDiFuga(d.u);
      if (!p) return; // direzione parallela al quadro: non ha punto di fuga
      // nella prospettiva centrale la fuga cade nel punto principale
      const coincidePP = Math.abs(p[0] - vista.x) < 1e-6 && Math.abs(p[1] + vista.altezza) < 1e-6;
      fughe.push({ p: p, nome: d.nome, etichetta: i === 0 ? 'F₁' : 'F₂', direzione: d.u, coincidePP: coincidePP });
    });
    return fughe;
  }

  function disegnaLineeDiFuga(gruppo, solido, vista, fughe, opzioni) {
    const topo = Geo.costruisciTopologia(solido);
    const usati = new Map();
    for (const s of topo.spigoli) {
      if (!s.netto) continue;
      const A = solido.vertici[s.a], B = solido.vertici[s.b];
      const dir = Geo.normalize(Geo.sub(B, A));
      if (Math.abs(dir[2]) > 1e-6) continue; // solo gli spigoli orizzontali fuggono
      for (const f of fughe) {
        const allineato = Math.abs(Math.abs(Geo.dot(dir, f.direzione)) - 1) < 1e-4;
        if (!allineato) continue;
        const conteggio = usati.get(f.nome) || 0;
        if (conteggio >= 6) continue;
        usati.set(f.nome, conteggio + 1);
        // si prolunga dallo spigolo fino al suo punto di fuga
        const lontano = Geo.length(Geo.sub(vista.puntoDiVista, A)) > Geo.length(Geo.sub(vista.puntoDiVista, B)) ? A : B;
        const p = vista.project(lontano);
        gruppo.appendChild(linea(p[0], p[1], f.p[0], f.p[1], 'linea-fuga'));
      }
    }
  }

  function puntoTrascinabile(gruppo, p, testo, classe, dimTesto, nome) {
    const g = el('g', { class: 'trascinabile-punto', 'data-punto': nome });
    // area di presa più ampia del punto disegnato, per l'uso con il dito
    g.appendChild(el('circle', { cx: p[0], cy: p[1], r: dimTesto * 1.6, class: 'area-presa' }));
    g.appendChild(el('circle', { cx: p[0], cy: p[1], r: dimTesto * 0.28, class: classe }));
    const t = el('text', { x: p[0] + dimTesto * 0.4, y: p[1] - dimTesto * 0.5, class: 'etichetta-punto', 'font-size': dimTesto });
    t.textContent = testo;
    g.appendChild(t);
    gruppo.appendChild(g);
  }

  function etichetta(gruppo, testo, x, y, classe, dimensione) {
    const t = el('text', { x: x, y: y, class: classe, 'font-size': dimensione });
    t.textContent = testo;
    gruppo.appendChild(t);
  }

  // --- Assonometria ---

  function disegnaAssonometria(svg, solidoOriginale, vista, opzioni) {
    svuota(svg);
    const sezione = applicaSezione(solidoOriginale, opzioni);
    const solido = sezione.solido;
    const g = el('g', {});
    const b = limiti(solido);
    const dimensione = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    const dimTesto = dimensione * 0.075;

    if (opzioni.griglia) disegnaGrigliaBase(g, solido, vista, dimensione);
    if (opzioni.assi) disegnaAssiRiferimento(g, vista, dimensione, dimTesto);
    const ombreggiato = opzioni.resa === 'ombreggiato';
    if (ombreggiato) disegnaFacce(g, solido, vista, [0, 0]);
    // con le facce campite il solido è opaco: gli spigoli nascosti non si vedono
    const opzioniSpigoli = ombreggiato
      ? Object.assign({}, opzioni, { spigoliNascosti: false })
      : opzioni;
    if (sezione.piano && !opzioni.sezione.effettuata) {
      disegnaPianoSezione(g, sezione.piano, vista, [0, 0], null);
    }
    disegnaSpigoli(g, solido, vista, [0, 0], opzioniSpigoli);
    disegnaFiguraDiSezione(g, sezione.anelli, vista, [0, 0], dimensione);
    if (opzioni.etichette) disegnaEtichette(g, solido, vista, [0, 0], dimTesto);
    if (sezione.anelli && opzioni.sezione.veraForma) {
      disegnaVeraForma(g, sezione.anelli, [b.x1 + dimensione * 0.5, -b.z1], dimensione, dimTesto * 1.1);
    }

    svg.appendChild(g);
    adattaViewBox(svg, g, dimensione * 0.18);
  }

  function disegnaAssiRiferimento(gruppo, vista, dimensione, dimTesto) {
    const L = dimensione * 0.85;
    const origine = vista.project([0, 0, 0]);
    const assi = [
      { v: [L, 0, 0], nome: 'x' },
      { v: [0, L, 0], nome: 'y' },
      { v: [0, 0, L], nome: 'z' }
    ];
    for (const a of assi) {
      const p = vista.project(a.v);
      gruppo.appendChild(linea(origine[0], origine[1], p[0], p[1], 'asse-riferimento'));
      const t = el('text', { x: p[0] + dimTesto * 0.3, y: p[1] - dimTesto * 0.2, class: 'etichetta-asse', 'font-size': dimTesto });
      t.textContent = a.nome;
      gruppo.appendChild(t);
    }
  }

  function disegnaGrigliaBase(gruppo, solido, vista, dimensione) {
    const passo = dimensione / 4;
    const n = 4;
    for (let i = -n; i <= n; i++) {
      const a1 = vista.project([i * passo, -n * passo, 0]);
      const b1 = vista.project([i * passo, n * passo, 0]);
      gruppo.appendChild(linea(a1[0], a1[1], b1[0], b1[1], 'griglia'));
      const a2 = vista.project([-n * passo, i * passo, 0]);
      const b2 = vista.project([n * passo, i * passo, 0]);
      gruppo.appendChild(linea(a2[0], a2[1], b2[0], b2[1], 'griglia'));
    }
  }

  // --- Utilità ---

  function adattaViewBox(svg, gruppo, margine) {
    const bb = gruppo.getBBox();
    const x = bb.x - margine, y = bb.y - margine;
    const w = Math.max(bb.width + 2 * margine, 1), h = Math.max(bb.height + 2 * margine, 1);
    svg.setAttribute('viewBox', x + ' ' + y + ' ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  return {
    disegnaProiezioniOrtogonali,
    disegnaAssonometria,
    disegnaProspettiva,
    puntiDiFuga,
    segmentiProiettati,
    limiti
  };
})();
