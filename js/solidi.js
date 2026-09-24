// Libreria dei solidi. Ogni solido è definito una sola volta nello spazio
// (vertici + facce); tutte le viste derivano da questi stessi dati.
// Convenzioni: X = larghezza, Y = profondità, Z = altezza. I solidi
// appoggiano sul piano orizzontale (z = 0) e sono centrati sull'origine.

const Solidi = (function () {
  'use strict';

  function centra(solido) {
    const v = solido.vertici;
    const xs = v.map(p => p[0]), ys = v.map(p => p[1]), zs = v.map(p => p[2]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const minZ = Math.min(...zs);
    solido.vertici = v.map(p => [p[0] - cx, p[1] - cy, p[2] - minZ]);
    return ordinaVertici(solido);
  }

  // L'ordine dei vertici è l'ordine delle lettere: A è il primo, B il secondo e
  // così via. Perché le etichette si leggano allo stesso modo in ogni vista e
  // con ogni metodo, l'ordine segue sempre la stessa regola:
  //   1. si parte dalla faccia inferiore e si sale di quota in quota;
  //   2. dentro ogni quota si gira in senso antiorario, come si vede in pianta;
  //   3. si comincia dal vertice davanti a sinistra sul foglio.
  // In un cubo vengono così A B C D sulla faccia d'appoggio ed E F G H su
  // quella superiore, con E sopra ad A, F sopra a B e via di seguito.
  const DUE_PI = 2 * Math.PI;

  function ordinaVertici(solido) {
    const v = solido.vertici;
    const eps = 1e-6;
    const cx = v.reduce((s, p) => s + p[0], 0) / v.length;
    const cy = v.reduce((s, p) => s + p[1], 0) / v.length;

    const quote = [];
    v.forEach(p => { if (!quote.some(q => Math.abs(q - p[2]) < eps)) quote.push(p[2]); });
    quote.sort((a, b) => a - b);

    // A è il vertice della faccia inferiore che sta più avanti e più a
    // sinistra sul foglio; da lì parte il giro, uguale a ogni quota.
    const base = v.filter(p => Math.abs(p[2] - quote[0]) < eps && Math.hypot(p[0] - cx, p[1] - cy) > eps);
    const primo = base.slice().sort((a, b) =>
      ((b[0] - cx) + (b[1] - cy)) - ((a[0] - cx) + (a[1] - cy)) || (b[0] - a[0]))[0];
    const partenza = primo ? Math.atan2(primo[1] - cy, primo[0] - cx) : Math.PI / 4;

    function giroDi(p) {
      const dx = p[0] - cx, dy = p[1] - cy;
      if (Math.hypot(dx, dy) < eps) return -1;          // sull'asse: viene prima
      let a = Math.atan2(dy, dx) - partenza;
      a = ((a % DUE_PI) + DUE_PI) % DUE_PI;
      return a > DUE_PI - eps ? 0 : a;                  // 360° equivale a 0°
    }
    function raggioDi(p) { return Math.hypot(p[0] - cx, p[1] - cy); }

    const ordine = [];
    for (const q of quote) {
      const livello = [];
      v.forEach((p, i) => { if (Math.abs(p[2] - q) < eps) livello.push(i); });
      livello.sort((a, b) => {
        const d = giroDi(v[a]) - giroDi(v[b]);
        if (Math.abs(d) > eps) return d;
        return raggioDi(v[a]) - raggioDi(v[b]);
      });
      livello.forEach(i => ordine.push(i));
    }

    const nuovoIndice = [];
    ordine.forEach((vecchio, nuovo) => { nuovoIndice[vecchio] = nuovo; });
    solido.vertici = ordine.map(i => v[i]);
    solido.facce = solido.facce.map(f => f.map(i => nuovoIndice[i]));
    return solido;
  }

  function poligonoRegolare(n, raggio, rotazioneDeg) {
    const rot = (rotazioneDeg || 0) * Math.PI / 180;
    const punti = [];
    for (let i = 0; i < n; i++) {
      const a = rot + 2 * Math.PI * i / n;
      punti.push([raggio * Math.cos(a), raggio * Math.sin(a)]);
    }
    return punti;
  }

  // Solido di rotazione/estrusione verticale: base e cima sono due poligoni
  // paralleli (eventualmente di raggio diverso, o la cima ridotta a un punto).
  function solidoVerticale(baseXY, cimaXY, altezza) {
    const vertici = [];
    const n = baseXY.length;
    baseXY.forEach(p => vertici.push([p[0], p[1], 0]));
    const cimaPunto = cimaXY === null;
    if (cimaPunto) {
      vertici.push([0, 0, altezza]);
    } else {
      cimaXY.forEach(p => vertici.push([p[0], p[1], altezza]));
    }
    const facce = [];
    facce.push(baseXY.map((_, i) => n - 1 - i)); // base, normale verso il basso
    if (cimaPunto) {
      const apice = n;
      for (let i = 0; i < n; i++) facce.push([i, (i + 1) % n, apice]);
    } else {
      const cima = [];
      for (let i = 0; i < n; i++) cima.push(n + i);
      facce.push(cima.slice()); // cima, normale verso l'alto
      for (let i = 0; i < n; i++) {
        facce.push([i, (i + 1) % n, n + (i + 1) % n, n + i]);
      }
    }
    return { vertici, facce };
  }

  // Estrusione di un profilo nel piano frontale (x, z) lungo la profondità Y.
  // Il profilo va elencato in senso antiorario guardando il solido di fronte.
  function estrusione(profilo, profondita, foro) {
    const vertici = [];
    const n = profilo.length;
    profilo.forEach(p => vertici.push([p[0], 0, p[1]]));          // faccia davanti
    profilo.forEach(p => vertici.push([p[0], profondita, p[1]])); // faccia dietro
    const F = i => i, B = i => n + i;
    const facce = [];

    if (!foro) {
      facce.push(profilo.map((_, i) => F(i)));                    // davanti
      facce.push(profilo.map((_, i) => B(n - 1 - i)));            // dietro
    } else {
      // la faccia forata si compone in quattro quadrilateri attorno al foro,
      // così resta fatta di poligoni semplici; gli spigoli di raccordo sono
      // complanari e quindi non vengono tracciati
      const idxForoF = [], idxForoB = [];
      foro.forEach(p => { idxForoF.push(vertici.length); vertici.push([p[0], 0, p[1]]); });
      foro.forEach(p => { idxForoB.push(vertici.length); vertici.push([p[0], profondita, p[1]]); });
      const anelloF = anelloAttorno(profilo.map((_, i) => F(i)), idxForoF, vertici, 0);
      const anelloB = anelloAttorno(profilo.map((_, i) => B(i)), idxForoB, vertici, profondita);
      anelloF.forEach(f => facce.push(f));
      anelloB.forEach(f => facce.push(f.slice().reverse()));
      // pareti interne del foro (normali rivolte verso l'interno del foro)
      for (let i = 0; i < foro.length; i++) {
        const j = (i + 1) % foro.length;
        facce.push([idxForoF[j], idxForoB[j], idxForoB[i], idxForoF[i]]);
      }
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      facce.push([F(i), B(i), B(j), F(j)]);
    }
    return { vertici, facce };
  }

  // Divide una faccia rettangolare forata in quattro quadrilateri.
  function anelloAttorno(indiciEsterni, indiciForo, vertici, y) {
    const e = indiciEsterni.map(i => [vertici[i][0], vertici[i][2]]);
    const f = indiciForo.map(i => [vertici[i][0], vertici[i][2]]);
    const x0 = Math.min(...e.map(p => p[0])), x1 = Math.max(...e.map(p => p[0]));
    const z0 = Math.min(...e.map(p => p[1])), z1 = Math.max(...e.map(p => p[1]));
    const hx0 = Math.min(...f.map(p => p[0])), hx1 = Math.max(...f.map(p => p[0]));
    const hz0 = Math.min(...f.map(p => p[1])), hz1 = Math.max(...f.map(p => p[1]));
    const punto = (x, z) => {
      const trovato = vertici.findIndex(v => Math.abs(v[0] - x) < 1e-6 && Math.abs(v[1] - y) < 1e-6 && Math.abs(v[2] - z) < 1e-6);
      if (trovato >= 0) return trovato;
      vertici.push([x, y, z]);
      return vertici.length - 1;
    };
    return [
      [punto(x0, z0), punto(x1, z0), punto(x1, hz0), punto(x0, hz0)],
      [punto(x0, hz1), punto(x1, hz1), punto(x1, z1), punto(x0, z1)],
      [punto(x0, hz0), punto(hx0, hz0), punto(hx0, hz1), punto(x0, hz1)],
      [punto(hx1, hz0), punto(x1, hz0), punto(x1, hz1), punto(hx1, hz1)]
    ];
  }

  // Facce di un poliedro convesso ricavate dai soli vertici: utile per i
  // solidi platonici, le cui coordinate sono note ma le facce no.
  function facceConvesse(vertici) {
    const facce = [];
    const visti = new Set();
    const n = vertici.length;
    const eps = 1e-6;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          const p0 = vertici[i], p1 = vertici[j], p2 = vertici[k];
          const nrm = Geo.cross(Geo.sub(p1, p0), Geo.sub(p2, p0));
          const len = Geo.length(nrm);
          if (len < eps) continue;
          const N = Geo.scale(nrm, 1 / len);
          const d = Geo.dot(N, p0);
          let sopra = 0, sotto = 0;
          const suPiano = [];
          for (let t = 0; t < n; t++) {
            const dist = Geo.dot(N, vertici[t]) - d;
            if (dist > 1e-6) sopra++;
            else if (dist < -1e-6) sotto++;
            else suPiano.push(t);
          }
          if (sopra > 0 && sotto > 0) continue;       // non è una faccia
          const chiave = suPiano.slice().sort((a, b) => a - b).join(',');
          if (visti.has(chiave)) continue;
          visti.add(chiave);
          // ordina i vertici della faccia attorno al loro centro
          const centro = suPiano.reduce((acc, t) => Geo.add(acc, vertici[t]), [0, 0, 0]).map(c => c / suPiano.length);
          const normaleEsterna = sotto > 0 ? N : Geo.scale(N, -1);
          const u = Geo.normalize(Geo.sub(vertici[suPiano[0]], centro));
          const w = Geo.cross(normaleEsterna, u);
          const ordinati = suPiano.slice().sort((a, b) => {
            const va = Geo.sub(vertici[a], centro), vb = Geo.sub(vertici[b], centro);
            return Math.atan2(Geo.dot(va, w), Geo.dot(va, u)) - Math.atan2(Geo.dot(vb, w), Geo.dot(vb, u));
          });
          facce.push(ordinati);
        }
      }
    }
    return facce;
  }

  function solidoPlatonico(vertici) {
    return centra({ vertici: vertici.map(v => v.slice()), facce: facceConvesse(vertici) });
  }

  // --- Generatori ---

  const SEGMENTI_CURVA = 48;

  function prismaRegolare(n, raggio, altezza, rotDeg) {
    const base = poligonoRegolare(n, raggio, rotDeg);
    return centra(solidoVerticale(base, base, altezza));
  }

  function prismaRettangolare(l, p, h) {
    const base = [[0, 0], [l, 0], [l, p], [0, p]];
    return centra(solidoVerticale(base, base, h));
  }

  function piramideRegolare(n, raggio, altezza, rotDeg) {
    return centra(solidoVerticale(poligonoRegolare(n, raggio, rotDeg), null, altezza));
  }

  function cilindro(raggio, altezza) {
    const base = poligonoRegolare(SEGMENTI_CURVA, raggio, 0);
    return centra(solidoVerticale(base, base, altezza));
  }

  function cono(raggio, altezza) {
    return centra(solidoVerticale(poligonoRegolare(SEGMENTI_CURVA, raggio, 0), null, altezza));
  }

  function troncoPiramide(n, raggioBase, raggioCima, altezza, rotDeg) {
    return centra(solidoVerticale(
      poligonoRegolare(n, raggioBase, rotDeg),
      poligonoRegolare(n, raggioCima, rotDeg),
      altezza));
  }

  function troncoCono(raggioBase, raggioCima, altezza) {
    return centra(solidoVerticale(
      poligonoRegolare(SEGMENTI_CURVA, raggioBase, 0),
      poligonoRegolare(SEGMENTI_CURVA, raggioCima, 0),
      altezza));
  }

  // --- Solidi platonici (spigolo a) ---

  function tetraedro(a) {
    return centra(solidoVerticale(poligonoRegolare(3, a / Math.sqrt(3), 90), null, a * Math.sqrt(2 / 3)));
  }

  function cubo(a) { return prismaRettangolare(a, a, a); }

  function ottaedro(a) {
    const r = a / Math.sqrt(2);
    return solidoPlatonico([
      [0, 0, -r], [r, 0, 0], [0, r, 0], [-r, 0, 0], [0, -r, 0], [0, 0, r]
    ]);
  }

  function icosaedro(a) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const s = a / 2;
    const v = [];
    [[0, 1, phi], [0, 1, -phi], [0, -1, phi], [0, -1, -phi]].forEach(p => {
      v.push([p[0] * s, p[1] * s, p[2] * s]);
      v.push([p[1] * s, p[2] * s, p[0] * s]);
      v.push([p[2] * s, p[0] * s, p[1] * s]);
    });
    return solidoPlatonico(v);
  }

  function dodecaedro(a) {
    const phi = (1 + Math.sqrt(5)) / 2;
    const s = a * phi / 2;
    const v = [];
    [-1, 1].forEach(x => [-1, 1].forEach(y => [-1, 1].forEach(z => v.push([x * s, y * s, z * s]))));
    [[0, 1 / phi, phi], [0, -1 / phi, phi], [0, 1 / phi, -phi], [0, -1 / phi, -phi]].forEach(p => {
      v.push([p[0] * s, p[1] * s, p[2] * s]);
      v.push([p[1] * s, p[2] * s, p[0] * s]);
      v.push([p[2] * s, p[0] * s, p[1] * s]);
    });
    return solidoPlatonico(v);
  }

  // --- Solidi composti (profilo estruso) ---

  function solidoL(l, h, spessore, profondita) {
    return centra(estrusione([
      [0, 0], [l, 0], [l, spessore], [spessore, spessore], [spessore, h], [0, h]
    ], profondita));
  }

  function solidoT(l, h, spessore, profondita) {
    const m = (l - spessore) / 2;
    return centra(estrusione([
      [0, 0], [l, 0], [l, spessore], [m + spessore, spessore], [m + spessore, h], [m, h], [m, spessore], [0, spessore]
    ], profondita));
  }

  function solidoGradini(l, h, profondita) {
    const p = l / 3, q = h / 3;
    return centra(estrusione([
      [0, 0], [l, 0], [l, q], [2 * p, q], [2 * p, 2 * q], [p, 2 * q], [p, h], [0, h]
    ], profondita));
  }

  function solidoC(l, h, spessore, profondita) {
    return centra(estrusione([
      [0, 0], [l, 0], [l, spessore], [spessore, spessore], [spessore, h - spessore],
      [l, h - spessore], [l, h], [0, h]
    ], profondita));
  }

  function blocoConIncavo(l, h, profondita, larghezzaIncavo, profonditaIncavo) {
    const a = (l - larghezzaIncavo) / 2;
    return centra(estrusione([
      [0, 0], [l, 0], [l, h], [a + larghezzaIncavo, h],
      [a + larghezzaIncavo, h - profonditaIncavo], [a, h - profonditaIncavo], [a, h], [0, h]
    ], profondita));
  }

  function bloccoConForo(l, h, profondita, foroL, foroH) {
    const fx = (l - foroL) / 2, fz = (h - foroH) / 2;
    const esterno = [[0, 0], [l, 0], [l, h], [0, h]];
    const foro = [[fx, fz], [fx, fz + foroH], [fx + foroL, fz + foroH], [fx + foroL, fz]];
    return centra(estrusione(esterno, profondita, foro));
  }

  // --- Catalogo ---

  const CATALOGO = [
    { id: 'prisma-quadrato', nome: 'Prisma a base quadrata', categoria: 'Prismi', crea: () => prismaRegolare(4, 32, 60, 45) },
    { id: 'prisma-rettangolare', nome: 'Prisma a base rettangolare', categoria: 'Prismi', crea: () => prismaRettangolare(60, 35, 45) },
    { id: 'prisma-triangolare', nome: 'Prisma a base triangolare', categoria: 'Prismi', crea: () => prismaRegolare(3, 35, 60, 90) },
    { id: 'prisma-esagonale', nome: 'Prisma a base esagonale', categoria: 'Prismi', crea: () => prismaRegolare(6, 32, 60, 0) },
    { id: 'piramide-quadrata', nome: 'Piramide a base quadrata', categoria: 'Piramidi', crea: () => piramideRegolare(4, 34, 65, 45) },
    { id: 'piramide-esagonale', nome: 'Piramide a base esagonale', categoria: 'Piramidi', crea: () => piramideRegolare(6, 33, 65, 0) },
    { id: 'tronco-piramide', nome: 'Tronco di piramide', categoria: 'Piramidi', crea: () => troncoPiramide(4, 36, 20, 55, 45) },
    { id: 'cilindro', nome: 'Cilindro', categoria: 'Solidi di rotazione', crea: () => cilindro(28, 62) },
    { id: 'cono', nome: 'Cono', categoria: 'Solidi di rotazione', crea: () => cono(30, 66) },
    { id: 'tronco-cono', nome: 'Tronco di cono', categoria: 'Solidi di rotazione', crea: () => troncoCono(32, 18, 55) },
    { id: 'tetraedro', nome: 'Tetraedro', categoria: 'Solidi platonici', crea: () => tetraedro(60) },
    { id: 'cubo', nome: 'Cubo (esaedro)', categoria: 'Solidi platonici', crea: () => cubo(55) },
    { id: 'ottaedro', nome: 'Ottaedro', categoria: 'Solidi platonici', crea: () => ottaedro(48) },
    { id: 'dodecaedro', nome: 'Dodecaedro', categoria: 'Solidi platonici', crea: () => dodecaedro(28) },
    { id: 'icosaedro', nome: 'Icosaedro', categoria: 'Solidi platonici', crea: () => icosaedro(36) },
    { id: 'composto-l', nome: 'Solido a L', categoria: 'Solidi composti', crea: () => solidoL(60, 60, 24, 40) },
    { id: 'composto-t', nome: 'Solido a T', categoria: 'Solidi composti', crea: () => solidoT(66, 58, 24, 38) },
    { id: 'composto-gradini', nome: 'Solido a gradini', categoria: 'Solidi composti', crea: () => solidoGradini(66, 60, 40) },
    { id: 'composto-c', nome: 'Solido a C', categoria: 'Solidi composti', crea: () => solidoC(58, 62, 20, 38) },
    { id: 'composto-incavo', nome: 'Blocco con incavo', categoria: 'Solidi composti', crea: () => blocoConIncavo(64, 50, 40, 26, 22) },
    { id: 'composto-foro', nome: 'Blocco con foro passante', categoria: 'Solidi composti', crea: () => bloccoConForo(64, 52, 38, 26, 22) }
  ];

  const cache = new Map();

  function ottieni(id, inclinato) {
    const chiave = id + (inclinato ? '-inc' : '');
    if (cache.has(chiave)) return cache.get(chiave);
    const voce = CATALOGO.find(v => v.id === id);
    if (!voce) throw new Error('solido sconosciuto: ' + id);
    let solido = voce.crea();
    solido.id = voce.id;
    solido.nome = voce.nome;
    solido.categoria = voce.categoria;
    if (inclinato) solido = inclina(solido, 28, 12);
    cache.set(chiave, solido);
    return solido;
  }

  // Variante con base inclinata rispetto al piano orizzontale.
  function inclina(solido, angoloDeg, angoloDeg2) {
    const m = Geo.matMul(Geo.rotY(Geo.deg2rad(angoloDeg)), Geo.rotX(Geo.deg2rad(angoloDeg2 || 0)));
    const vertici = solido.vertici.map(v => Geo.matVec(m, v));
    const minZ = Math.min(...vertici.map(v => v[2]));
    return {
      id: solido.id,
      nome: solido.nome,
      categoria: solido.categoria,
      inclinato: true,
      vertici: vertici.map(v => [v[0], v[1], v[2] - minZ]),
      facce: solido.facce.map(f => f.slice())
    };
  }

  // Specchia il solido rispetto al piano x = 0. L'ordine dei vertici di ogni
  // faccia va invertito, altrimenti le normali punterebbero verso l'interno.
  function specchia(solido) {
    return centra({
      vertici: solido.vertici.map(v => [-v[0], v[1], v[2]]),
      facce: solido.facce.map(f => f.slice().reverse())
    });
  }

  function ruota(solido, gradi) {
    const m = Geo.rotZ(Geo.deg2rad(gradi));
    return centra({
      vertici: solido.vertici.map(v => Geo.matVec(m, v)),
      facce: solido.facce.map(f => f.slice())
    });
  }

  return {
    CATALOGO, ottieni, facceConvesse, specchia, ruota, centra,
    prismaRegolare, prismaRettangolare, piramideRegolare, cilindro, cono,
    troncoPiramide, troncoCono, tetraedro, cubo, ottaedro,
    solidoL, solidoT, solidoGradini, solidoC, blocoConIncavo, bloccoConForo
  };
})();
