// Motore geometrico condiviso: vettori, rotazioni, proiezioni, spigoli di
// contorno e calcolo delle parti nascoste.
// Ogni vista (proiezioni ortogonali, assonometria e, nelle fasi successive,
// prospettiva e sezioni) usa queste stesse funzioni sugli stessi dati.

const Geo = (function () {
  'use strict';

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }
  function length(a) { return Math.sqrt(dot(a, a)); }
  function normalize(a) {
    const l = length(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  function matVec(m, v) { return [dot(m[0], v), dot(m[1], v), dot(m[2], v)]; }
  function matMul(a, b) {
    const bt = [
      [b[0][0], b[1][0], b[2][0]],
      [b[0][1], b[1][1], b[2][1]],
      [b[0][2], b[1][2], b[2][2]]
    ];
    const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i][j] = dot(a[i], bt[j]);
    return r;
  }

  function rotZ(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  }
  function rotX(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [[1, 0, 0], [0, c, -s], [0, s, c]];
  }
  function rotY(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
  }

  function deg2rad(d) { return d * Math.PI / 180; }
  function rad2deg(r) { return r * 180 / Math.PI; }

  // Normale di una faccia con il metodo di Newell (robusto anche se i punti
  // non sono perfettamente complanari).
  function normaleFaccia(punti) {
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < punti.length; i++) {
      const p0 = punti[i], p1 = punti[(i + 1) % punti.length];
      nx += (p0[1] - p1[1]) * (p0[2] + p1[2]);
      ny += (p0[2] - p1[2]) * (p0[0] + p1[0]);
      nz += (p0[0] - p1[0]) * (p0[1] + p1[1]);
    }
    return normalize([nx, ny, nz]);
  }

  function normaliFacce(solido) {
    return solido.facce.map(f => normaleFaccia(f.map(i => solido.vertici[i])));
  }

  // Topologia degli spigoli: per ogni spigolo le facce adiacenti e se è uno
  // spigolo "netto" (angolo diedro marcato). Gli spigoli non netti appartengono
  // a superfici curve (cilindro, cono) e si disegnano solo quando formano il
  // contorno apparente nella vista corrente.
  const SOGLIA_SPIGOLO_NETTO = 15; // gradi

  function costruisciTopologia(solido) {
    if (solido._topologia) return solido._topologia;
    const normali = normaliFacce(solido);
    const mappa = new Map();
    solido.facce.forEach((f, fi) => {
      for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length];
        const chiave = Math.min(a, b) + '-' + Math.max(a, b);
        if (!mappa.has(chiave)) mappa.set(chiave, { a: Math.min(a, b), b: Math.max(a, b), facce: [] });
        mappa.get(chiave).facce.push(fi);
      }
    });
    const spigoli = [];
    for (const s of mappa.values()) {
      let netto = true;
      if (s.facce.length === 2) {
        const c = Math.max(-1, Math.min(1, dot(normali[s.facce[0]], normali[s.facce[1]])));
        netto = rad2deg(Math.acos(c)) > SOGLIA_SPIGOLO_NETTO;
      }
      spigoli.push({ a: s.a, b: s.b, facce: s.facce, netto: netto });
    }
    solido._topologia = { spigoli: spigoli, normali: normali };
    return solido._topologia;
  }

  // Direzione che da un punto va verso l'osservatore: nelle proiezioni
  // parallele è sempre la stessa, in prospettiva dipende dal punto.
  function versoOsservatore(vista, punto) {
    if (vista.puntoDiVista) return normalize(sub(vista.puntoDiVista, punto));
    return scale(normalize(vista.viewDir), -1);
  }

  // Spigoli da tracciare in una vista: quelli netti, più i contorni apparenti
  // delle superfici curve.
  function spigoliDaTracciare(solido, vista) {
    const topo = costruisciTopologia(solido);
    const out = [];
    for (const s of topo.spigoli) {
      if (s.netto) { out.push([s.a, s.b]); continue; }
      if (s.facce.length === 2) {
        const meta = scale(add(solido.vertici[s.a], solido.vertici[s.b]), 0.5);
        const verso = versoOsservatore(vista, meta);
        const d1 = dot(topo.normali[s.facce[0]], verso);
        const d2 = dot(topo.normali[s.facce[1]], verso);
        if ((d1 > 0) !== (d2 > 0)) out.push([s.a, s.b]); // contorno apparente
      }
    }
    return out;
  }

  function dimensioneCaratteristica(vertici) {
    let max = 0;
    for (const v of vertici) max = Math.max(max, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]));
    return max || 1;
  }

  // Suddivide ogni spigolo in tratti visibili e nascosti. Vale sia per le
  // proiezioni parallele sia per la prospettiva: cambia solo il raggio visivo,
  // che nel secondo caso parte dal punto di vista.
  function segmentiVisibilita(solido, spigoli, vista, campioni) {
    const vertici = solido.vertici;
    const tol = dimensioneCaratteristica(vertici);
    campioni = campioni || (solido.facce.length > 60 ? 14 : 24);

    const normali = normaliFacce(solido);
    // Ogni faccia viene descritta sul proprio piano e leggermente rimpicciolita
    // verso il centro: così uno spigolo che giace esattamente sul bordo di una
    // faccia non risulta nascosto da quella faccia.
    const margine = 1e-3 * tol;
    const facce = solido.facce.map((f, i) => {
      const N = normali[i];
      const p0 = vertici[f[0]];
      const rif = Math.abs(N[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const u = normalize(cross(rif, N));
      const w = cross(N, u);
      const punti = f.map(k => [dot(sub(vertici[k], p0), u), dot(sub(vertici[k], p0), w)]);
      const cx = punti.reduce((s, p) => s + p[0], 0) / punti.length;
      const cy = punti.reduce((s, p) => s + p[1], 0) / punti.length;
      const ridotti = punti.map(p => {
        const dx = p[0] - cx, dy = p[1] - cy;
        const d = Math.hypot(dx, dy) || 1;
        const r = Math.max(0, d - margine) / d;
        return [cx + dx * r, cy + dy * r];
      });
      return {
        normale: N, p0: p0, u: u, w: w, poligono: ridotti,
        minX: Math.min(...ridotti.map(p => p[0])), maxX: Math.max(...ridotti.map(p => p[0])),
        minY: Math.min(...ridotti.map(p => p[1])), maxY: Math.max(...ridotti.map(p => p[1]))
      };
    });

    function puntoInPoligono(p, poligono) {
      let dentro = false;
      for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
        const xi = poligono[i][0], yi = poligono[i][1];
        const xj = poligono[j][0], yj = poligono[j][1];
        if (((yi > p[1]) !== (yj > p[1])) &&
          (p[0] < (xj - xi) * (p[1] - yi) / ((yj - yi) || 1e-12) + xi)) dentro = !dentro;
      }
      return dentro;
    }

    // P è nascosto se, risalendo il raggio visivo da P verso l'osservatore, si
    // incontra una faccia del solido.
    function occluso(P) {
      const verso = versoOsservatore(vista, P);
      const distanzaOsservatore = vista.puntoDiVista ? length(sub(vista.puntoDiVista, P)) : Infinity;
      for (const f of facce) {
        const nv = dot(f.normale, verso);
        if (Math.abs(nv) < 1e-6) continue;             // faccia di taglio: non occlude
        const s = dot(sub(f.p0, P), f.normale) / nv;   // percorso fino al piano della faccia
        if (s < 1e-3 * tol || s > distanzaOsservatore) continue;
        const Q = add(P, scale(verso, s));
        const d = sub(Q, f.p0);
        const q = [dot(d, f.u), dot(d, f.w)];
        if (q[0] < f.minX || q[0] > f.maxX || q[1] < f.minY || q[1] > f.maxY) continue;
        if (puntoInPoligono(q, f.poligono)) return true;
      }
      return false;
    }

    const risultati = [];
    for (const e of spigoli) {
      const A = vertici[e[0]], B = vertici[e[1]];
      // ogni tratto viene classificato dal suo punto medio: così gli estremi
      // dello spigolo, che spesso sfiorano il bordo di una faccia, non falsano
      // il risultato
      const vis = [];
      for (let i = 0; i < campioni; i++) {
        const P = add(A, scale(sub(B, A), (i + 0.5) / campioni));
        vis.push(!occluso(add(P, scale(versoOsservatore(vista, P), 1e-3 * tol))));
      }
      let inizio = 0;
      for (let i = 1; i <= campioni; i++) {
        if (i === campioni || vis[i] !== vis[inizio]) {
          risultati.push({
            a: add(A, scale(sub(B, A), inizio / campioni)),
            b: add(A, scale(sub(B, A), i / campioni)),
            nascosto: !vis[inizio]
          });
          inizio = i;
        }
      }
    }
    return risultati;
  }

  // --- Viste ---
  // Ogni vista espone project(v3) -> [x, y] in coordinate di disegno (y verso
  // il basso, come nell'SVG) e viewDir: direzione dall'osservatore alla scena.

  function vistaOrtogonale(nome) {
    if (nome === 'pianta') return { nome: 'pianta', etichetta: 'Pianta', project: v => [v[0], v[1]], viewDir: [0, 0, -1] };
    // Primo diedro: il solido sta fra l'osservatore e il piano su cui si
    // proietta. Davanti al P.V. significa y positivo, quindi l'osservatore
    // guarda da y verso il piano, non dal lato opposto.
    if (nome === 'prospetto') return { nome: 'prospetto', etichetta: 'Prospetto', project: v => [v[0], -v[2]], viewDir: [0, -1, 0] };
    if (nome === 'laterale') return { nome: 'laterale', etichetta: 'Vista laterale', project: v => [v[1], -v[2]], viewDir: [1, 0, 0] };
    throw new Error('vista ortogonale sconosciuta: ' + nome);
  }

  // Assonometria per costruzione diretta (come si disegna a mano): tre assi
  // con il loro angolo e il loro coefficiente di riduzione.
  function vistaAssonometricaDiretta(config) {
    const ax = deg2rad(config.angoloX), ay = deg2rad(config.angoloY), az = deg2rad(config.angoloZ);
    const dirX = [Math.cos(ax), -Math.sin(ax)];
    const dirY = [Math.cos(ay), -Math.sin(ay)];
    const dirZ = [Math.cos(az), -Math.sin(az)];
    // Direzione di proiezione equivalente: il vettore lungo cui i punti si
    // sovrappongono nel disegno. Si ricava annullando la proiezione 2D.
    const viewDir = direzioneDiProiezione(dirX, dirY, dirZ, config);
    return {
      nome: 'assonometria',
      tipo: config.nomeTipo,
      project: v => [
        v[0] * config.kx * dirX[0] + v[1] * config.ky * dirY[0] + v[2] * config.kz * dirZ[0],
        v[0] * config.kx * dirX[1] + v[1] * config.ky * dirY[1] + v[2] * config.kz * dirZ[1]
      ],
      assi: {
        x: { angolo: config.angoloX, k: config.kx },
        y: { angolo: config.angoloY, k: config.ky },
        z: { angolo: config.angoloZ, k: config.kz }
      },
      viewDir: viewDir,
      fissa: true,
      nota: config.nota || ''
    };
  }

  // Trova la direzione 3D che la proiezione "schiaccia": il vettore d tale che
  // proiettando d si ottiene il vettore nullo.
  function direzioneDiProiezione(dirX, dirY, dirZ, config) {
    const cx = [dirX[0] * config.kx, dirX[1] * config.kx];
    const cy = [dirY[0] * config.ky, dirY[1] * config.ky];
    const cz = [dirZ[0] * config.kz, dirZ[1] * config.kz];
    // cerca d = (a, b, c) con a*cx + b*cy + c*cz = 0, fissando c = 1 quando
    // possibile (l'asse verticale non è mai degenere nelle nostre assonometrie)
    const det = cx[0] * cy[1] - cx[1] * cy[0];
    if (Math.abs(det) > 1e-9) {
      const a = (-cz[0] * cy[1] + cz[1] * cy[0]) / det;
      const b = (-cx[0] * cz[1] + cx[1] * cz[0]) / det;
      const d = normalize([a, b, 1]);
      return d[2] > 0 ? scale(d, -1) : d; // l'osservatore guarda dall'alto
    }
    return [0, 1, 0];
  }

  const TIPI_ASSONOMETRIA = {
    isometrica: {
      nomeTipo: 'isometrica', etichetta: 'Isometrica',
      angoloX: 210, angoloY: 330, angoloZ: 90, kx: 1, ky: 1, kz: 1,
      nota: 'Assi a 120° tra loro. I coefficienti reali sarebbero ≈0,82 su tutti e tre gli assi: come da prassi scolastica si usano le misure vere (coefficiente 1).'
    },
    cavaliera: {
      nomeTipo: 'cavaliera', etichetta: 'Cavaliera',
      angoloX: 0, angoloY: 45, angoloZ: 90, kx: 1, ky: 0.5, kz: 1,
      nota: 'Proiezione obliqua: la faccia frontale resta in vera forma, la profondità è ridotta a metà su un asse a 45°.'
    },
    monometrica: {
      nomeTipo: 'monometrica', etichetta: 'Monometrica',
      angoloX: 210, angoloY: 300, angoloZ: 90, kx: 1, ky: 1, kz: 1,
      nota: 'Angoli fra gli assi: 90° fra x e y, 120° fra x e z, 150° fra y e z. ' +
        'Con x e y ad angolo retto la pianta resta in vera forma e le altezze si riportano verticali.'
    }
  };

  // Assonometria libera: rotazione 3D vera, comandata dal trascinamento.
  // yaw: rotazione attorno all'asse verticale; pitch positivo = si guarda dall'alto.
  function vistaAssonometricaLibera(yawRad, pitchRad) {
    const m = matMul(rotZ(yawRad), rotX(-pitchRad));
    const right = matVec(m, [1, 0, 0]);
    const up = matVec(m, [0, 0, 1]);
    const forward = matVec(m, [0, 1, 0]);
    function asse(v3) {
      const p = [dot(v3, right), -dot(v3, up)];
      let angolo = rad2deg(Math.atan2(-p[1], p[0]));
      if (angolo < 0) angolo += 360;
      return { angolo: angolo, k: Math.hypot(p[0], p[1]) };
    }
    return {
      nome: 'assonometria',
      tipo: 'libera',
      project: v => [dot(v, right), -dot(v, up)],
      assi: { x: asse([1, 0, 0]), y: asse([0, 1, 0]), z: asse([0, 0, 1]) },
      viewDir: forward,
      fissa: false,
      nota: 'Rotazione libera: angoli e coefficienti sono calcolati sulla posizione corrente del solido.'
    };
  }

  // --- Prospettiva ---
  // Il quadro coincide con il piano verticale (y = 0); l'osservatore sta a
  // distanza "distanza" davanti al quadro, all'altezza "altezza" sul piano
  // orizzontale. Un punto del quadro si proietta in vera grandezza, la linea
  // d'orizzonte sta all'altezza dell'occhio.
  // L'osservatore sta dalla stessa parte da cui guarda nelle proiezioni
  // ortogonali (y positivo) e l'oggetto è oltre il quadro, cioè a y negativo.
  function vistaProspettica(cfg) {
    const O = [cfg.x, cfg.distanza, cfg.altezza];
    function project(P) {
      const t = cfg.distanza / (cfg.distanza - P[1]);
      return [O[0] + t * (P[0] - O[0]), -(O[2] + t * (P[2] - O[2]))];
    }
    return {
      nome: 'prospettiva',
      tipo: cfg.tipo,
      puntoDiVista: O,
      distanza: cfg.distanza,
      altezza: cfg.altezza,
      x: cfg.x,
      project: project,
      // punto di fuga di una direzione: dove la parallela condotta dall'occhio
      // incontra il quadro
      puntoDiFuga: function (u) {
        if (Math.abs(u[1]) < 1e-9) return null; // direzione parallela al quadro
        const passo = -cfg.distanza / u[1];
        return [O[0] + passo * u[0], -(O[2] + passo * u[2])];
      }
    };
  }

  return {
    sub, add, scale, dot, cross, length, normalize,
    matVec, matMul, rotX, rotY, rotZ,
    deg2rad, rad2deg,
    normaleFaccia, normaliFacce, versoOsservatore,
    costruisciTopologia, spigoliDaTracciare, segmentiVisibilita,
    vistaOrtogonale, vistaAssonometricaDiretta, vistaAssonometricaLibera,
    vistaProspettica,
    TIPI_ASSONOMETRIA
  };
})();
