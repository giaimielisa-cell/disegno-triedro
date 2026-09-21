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

  function disegnaEtichette(gruppo, solido, vista, off, dimensione) {
    const massimo = Math.min(solido.vertici.length, LETTERE.length);
    for (let i = 0; i < massimo; i++) {
      const p = vista.project(solido.vertici[i]);
      const t = el('text', {
        x: p[0] + off[0] + dimensione * 0.35,
        y: p[1] + off[1] - dimensione * 0.25,
        class: 'etichetta-vertice',
        'font-size': dimensione
      });
      t.textContent = LETTERE[i];
      gruppo.appendChild(t);
    }
  }

  // --- Proiezioni ortogonali: disposizione, richiami, ribaltamento ---

  function layoutProiezioni(solido, distanza) {
    const b = limiti(solido);
    const dyPianta = -b.z0 + distanza - b.y0;
    const dxLaterale = b.x1 + distanza - b.y0;
    return {
      offsets: {
        prospetto: [0, 0],
        pianta: [0, dyPianta],
        laterale: [dxLaterale, 0]
      },
      // linea di ribaltamento a 45°: x - y = costante
      costanteRibaltamento: dxLaterale - dyPianta,
      limiti: b
    };
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

  function disegnaRichiami(gruppo, solido, layout, distanza) {
    const b = layout.limiti;
    const off = layout.offsets;
    const margine = distanza * 0.35;
    const xs = valoriDistinti(solido.vertici.map(v => v[0]), 8);
    const zs = valoriDistinti(solido.vertici.map(v => v[2]), 8);
    const ys = valoriDistinti(solido.vertici.map(v => v[1]), 8);

    // prospetto -> pianta (verticali)
    for (const x of xs) {
      gruppo.appendChild(linea(x, -b.z0 + margine * 0.2, x, b.y1 + off.pianta[1] + margine, 'richiamo'));
    }
    // prospetto -> vista laterale (orizzontali)
    for (const z of zs) {
      gruppo.appendChild(linea(b.x0 - margine, -z, b.y1 + off.laterale[0] + margine, -z, 'richiamo'));
    }
    // pianta -> ribaltamento a 45° -> vista laterale
    const c = layout.costanteRibaltamento;
    for (const y of ys) {
      const yPianta = y + off.pianta[1];
      const xMiter = yPianta + c;
      gruppo.appendChild(linea(b.x0 - margine * 0.4, yPianta, xMiter, yPianta, 'richiamo'));
      gruppo.appendChild(linea(xMiter, yPianta, xMiter, -b.z1 - margine, 'richiamo'));
    }
    // la linea di ribaltamento vera e propria
    const yA = b.y0 + off.pianta[1] - margine;
    const yB = b.y1 + off.pianta[1] + margine;
    gruppo.appendChild(linea(yA + c, yA, yB + c, yB, 'ribaltamento'));
    const testo = el('text', { x: yB + c + margine * 0.3, y: yB + margine * 0.2, class: 'nota-disegno', 'font-size': distanza * 0.42 });
    testo.textContent = 'ribaltamento 45°';
    gruppo.appendChild(testo);
  }

  function disegnaPianiProiezione(gruppo, solido, layout, distanza) {
    const b = layout.limiti;
    const off = layout.offsets;
    const m = distanza * 0.5;
    const riquadri = [
      { x: b.x0 - m, y: -b.z1 - m, w: (b.x1 - b.x0) + 2 * m, h: (b.z1 - b.z0) + 2 * m, etichetta: 'P.V. — piano verticale' },
      { x: b.x0 - m, y: b.y0 + off.pianta[1] - m, w: (b.x1 - b.x0) + 2 * m, h: (b.y1 - b.y0) + 2 * m, etichetta: 'P.O. — piano orizzontale' },
      { x: b.y0 + off.laterale[0] - m, y: -b.z1 - m, w: (b.y1 - b.y0) + 2 * m, h: (b.z1 - b.z0) + 2 * m, etichetta: 'P.L. — piano laterale' }
    ];
    for (const r of riquadri) {
      gruppo.appendChild(el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, class: 'piano-proiezione' }));
      const t = el('text', { x: r.x, y: r.y - distanza * 0.18, class: 'etichetta-piano', 'font-size': distanza * 0.4 });
      t.textContent = r.etichetta;
      gruppo.appendChild(t);
    }
  }

  function disegnaProiezioniOrtogonali(svg, solido, opzioni) {
    const distanza = Math.max(28, (limiti(solido).x1 - limiti(solido).x0) * 0.55);
    const layout = layoutProiezioni(solido, distanza);
    const g = el('g', {});
    svuota(svg);

    const singola = opzioni.vistaSingola;
    if (!singola) {
      if (opzioni.piani) disegnaPianiProiezione(g, solido, layout, distanza);
      if (opzioni.richiami) disegnaRichiami(g, solido, layout, distanza);
    }

    let viste = [
      { vista: Geo.vistaOrtogonale('prospetto'), off: layout.offsets.prospetto },
      { vista: Geo.vistaOrtogonale('pianta'), off: layout.offsets.pianta },
      { vista: Geo.vistaOrtogonale('laterale'), off: layout.offsets.laterale }
    ];
    if (singola) {
      viste = viste.filter(v => v.vista.nome === singola).map(v => ({ vista: v.vista, off: [0, 0] }));
    }
    const dimTesto = distanza * 0.3;
    for (const v of viste) {
      const gv = el('g', { class: 'vista vista-' + v.vista.nome });
      disegnaSpigoli(gv, solido, v.vista, v.off, opzioni);
      if (opzioni.etichette) disegnaEtichette(gv, solido, v.vista, v.off, dimTesto);
      g.appendChild(gv);
      const b = limiti(solido);
      const titolo = el('text', {
        x: (v.vista.nome === 'laterale' ? b.y0 + v.off[0] : b.x0),
        y: (v.vista.nome === 'pianta' ? b.y1 + v.off[1] + distanza * 0.75 : -b.z0 + distanza * 0.75),
        class: 'titolo-vista', 'font-size': dimTesto * 1.1
      });
      titolo.textContent = v.vista.etichetta;
      g.appendChild(titolo);
    }
    svg.appendChild(g);
    adattaViewBox(svg, g, distanza * 0.8);
    return layout;
  }

  // --- Assonometria ---

  function disegnaAssonometria(svg, solido, vista, opzioni) {
    svuota(svg);
    const g = el('g', {});
    const b = limiti(solido);
    const dimensione = Math.max(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    const dimTesto = dimensione * 0.11;

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
