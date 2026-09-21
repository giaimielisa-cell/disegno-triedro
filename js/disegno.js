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

  // --- Segmenti proiettati di un solido in una vista ---

  function segmentiProiettati(solido, vista) {
    const spigoli = Geo.spigoliDaTracciare(solido, vista.viewDir);
    const segmenti = Geo.segmentiVisibilita(solido, spigoli, vista.viewDir);
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
    const V = Geo.normalize(vista.viewDir);
    const facce = solido.facce.map((f, i) => {
      const punti = f.map(k => solido.vertici[k]);
      const centro = punti.reduce((a, p) => Geo.add(a, p), [0, 0, 0]).map(c => c / punti.length);
      return { indici: f, normale: normali[i], profondita: Geo.dot(centro, V) };
    }).filter(f => Geo.dot(f.normale, V) < 0);
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
    const V = Geo.normalize(vista.viewDir);
    // i vertici che cadono nello stesso punto della proiezione condividono
    // l'etichetta: davanti quello in vista, tra parentesi quello che sta dietro
    const punti = [];
    for (let i = 0; i < Math.min(solido.vertici.length, LETTERE.length); i++) {
      const v = solido.vertici[i];
      const p = vista.project(v);
      const esistente = punti.find(q => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < dimensione * 0.15);
      const voce = { lettera: LETTERE[i], profondita: Geo.dot(v, V) };
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
  function collocaNelTriedro(solido) {
    if (solido._collocato) return solido._collocato;
    const b = limiti(solido);
    const dimensione = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    const distacco = dimensione * 0.45;
    const dx = -distacco - b.x1;  // a sinistra del piano laterale
    const dy = distacco - b.y0;   // davanti al piano verticale
    const dz = -b.z0;             // appoggiato al piano orizzontale
    const collocato = {
      id: solido.id,
      nome: solido.nome,
      categoria: solido.categoria,
      vertici: solido.vertici.map(v => [v[0] + dx, v[1] + dy, v[2] + dz]),
      facce: solido.facce
    };
    solido._collocato = collocato;
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
    const solido = collocaNelTriedro(solidoOriginale);
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
      disegnaSpigoli(gv, solido, vista, [0, 0], opzioni);
      if (opzioni.etichette) disegnaEtichette(gv, solido, vista, [0, 0], dimTesto * 0.85);
      g.appendChild(gv);
      g.appendChild(titoloVista(vista, b, dimTesto, margine));
    }
    svg.appendChild(g);
    adattaViewBox(svg, g, margine);
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

  // --- Assonometria ---

  function disegnaAssonometria(svg, solido, vista, opzioni) {
    svuota(svg);
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
    disegnaSpigoli(g, solido, vista, [0, 0], opzioniSpigoli);
    if (opzioni.etichette) disegnaEtichette(g, solido, vista, [0, 0], dimTesto);

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
    segmentiProiettati,
    limiti
  };
})();
