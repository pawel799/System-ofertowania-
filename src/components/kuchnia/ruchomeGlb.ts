/*
 * Otwieranie frontów w modelach GLB (biblioteka i wgrane pliki):
 *   drzwi / witryna / door        – drzwi na zawiasie przy bliższym boku (100°),
 *   klapa / flap                  – klapa do góry (zawias u góry),
 *   zmywarka / dishwasher         – w dół (zawias u dołu),
 *   szuflada / drawer             – wysuw do przodu ze skrzynką dorobioną w środku,
 *   Front_panel* (bez „boczny”), przesuwne / sliding – drzwi przesuwne: przednie skrzydło jedzie na sąsiednie.
 * Biblioteka ma nazwy jak w Blenderze (Front_drzwi_1…). Wgrane pliki mają dowolne nazwy, więc:
 *   - nazwę sprawdzamy na każdym węźle (obiekt z Blendera, grupa, siatka), nie tylko na siatce; front to najwyższy
 *     pasujący węzeł, a grupa z kilkoma osobnymi frontami („Drzwi” → „Drzwi_L”, „Drzwi_P”) dzieli się na nie;
 *   - bez pasujących nazw fronty bierzemy z oznaczeń „Front” (Ustawienia → Modele 3D), a rodzaj (drzwi / szuflada)
 *     z proporcji;
 *   - kierunek frontu (+Z, −Z, +X, −X) wykrywamy z położenia frontów w bryle (biblioteka: +Z).
 * Uchwyty w plikach są jedną siatką („Uchwyty”) – trójkąty rozdzielamy na fronty, żeby jechały razem z nimi.
 *
 * Pivot wstawiamy między węzeł a jego rodzica, więc oznaczenia ról (tagi po nazwach węzłów-rodziców) dalej działają;
 * kawałki uchwytów dostają nowe nazwy z tą samą rolą (aliasy).
 */
import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";
import { boxWzgledem } from "./obrys";
import { meshRoles, type ModelRole } from "../modelRoles";

export type Ruchomy =
  | { obj: Object3D; typ: "obrot"; os: Vector3; kat: number }
  | { obj: Object3D; typ: "przesuw"; baza: Vector3; o: Vector3 };

type Typ = "drzwi" | "klapa" | "zmywarka" | "szuflada" | "panel";

const UCHWYT = /uchwyt|handle|knob|ga[lł]k/i;
const KORPUS = /korpus|carcass|body|cokol|cokół|blat|countertop|worktop|panel_boczny/i;

/** Rodzaj frontu z nazwy węzła (null = to nie front). Kolejność ma znaczenie: „drzwi_zmywarki” to zmywarka. */
export function typZNazwy(nazwa: string, tylkoFront = false): Typ | null {
  const n = nazwa || "";
  if (!n || UCHWYT.test(n) || KORPUS.test(n)) return null;
  if (tylkoFront) {
    // Nazwy z biblioteki (Blender): zawsze z przedrostkiem „Front_”.
    if (!/front_/i.test(n)) return null;
    if (/front_(drzwi|witryna)/i.test(n)) return "drzwi";
    if (/front_klapa/i.test(n)) return "klapa";
    if (/front_zmywarka/i.test(n)) return "zmywarka";
    if (/front_szuflada/i.test(n)) return "szuflada";
    if (/front_panel(?!_boczny)/i.test(n)) return "panel";
    return null;
  }
  // AGD z szybą w osobnym elemencie (piekarnik, mikrofala) zostaje bez ruchu – szyba nie pojechałaby z drzwiami.
  if (/piekarnik|oven|mikrofal|microwave/i.test(n)) return null;
  if (/zmywark|dishwasher/i.test(n)) return "zmywarka";
  if (/szuflad|drawer|schowek_wysuw/i.test(n)) return "szuflada";
  if (/klap|flap/i.test(n)) return "klapa";
  if (/front_panel|przesuw|sliding/i.test(n)) return "panel";
  if (/drzwi|door|witryn|skrzyd/i.test(n)) return "drzwi";
  return null;
}

/** Strona zawiasu z nazwy („Drzwi lewe”, „door_R”), null = z położenia. */
function zawiasZNazwy(nazwa: string): "lewy" | "prawy" | null {
  if (/lew|left|(^|[^a-z])l([^a-z]|$)/i.test(nazwa)) return "lewy";
  if (/praw|right|(^|[^a-z])[pr]([^a-z]|$)/i.test(nazwa)) return "prawy";
  return null;
}

const st = (deg: number) => (deg * Math.PI) / 180;

function wPrzestrzeniRodzica(root: Object3D, parent: Object3D, p: Vector3) {
  return parent.worldToLocal(root.localToWorld(p.clone()));
}

/** Kierunek z układu root do układu rodzica (bez przesunięcia), znormalizowany. */
function kierunekWRodzicu(root: Object3D, parent: Object3D, v: Vector3) {
  return wPrzestrzeniRodzica(root, parent, v).sub(wPrzestrzeniRodzica(root, parent, new Vector3())).normalize();
}

/** Wstawia pivot między węzeł a rodzica; pivot w punkcie `punkt` (układ root). */
function owin(root: Object3D, node: Object3D, punkt: Vector3) {
  const parent = node.parent ?? root;
  const pivot = new Group();
  pivot.name = `${node.name}__ruch`;
  pivot.userData.ruchomy = true;
  pivot.position.copy(wPrzestrzeniRodzica(root, parent, punkt));
  parent.add(pivot);
  pivot.updateMatrixWorld(true);
  pivot.attach(node);
  return pivot;
}

/** Czy węzeł (albo coś pod nim) ma geometrię. */
function maGeometrie(o: Object3D) {
  let jest = false;
  o.traverse((c) => {
    if ((c as Mesh).isMesh) jest = true;
  });
  return jest;
}

/**
 * Czy pudełka są osobnymi frontami (obok siebie w płaszczyźnie frontu), a nie częściami jednego
 * (rama + szyba witryny, kilka materiałów jednego obiektu). Pudełka w układzie modelu; płaszczyzna frontu
 * to Y i ta oś pozioma, w której para jest szersza (fronty w +Z albo w +X).
 */
function osobne(pudelka: Box3[]) {
  if (pudelka.length < 2) return false;
  for (let i = 0; i < pudelka.length; i++) {
    for (let j = i + 1; j < pudelka.length; j++) {
      const a = pudelka[i];
      const b = pudelka[j];
      const wX = a.max.x - a.min.x + (b.max.x - b.min.x);
      const wZ = a.max.z - a.min.z + (b.max.z - b.min.z);
      const os = wX >= wZ ? "x" : "z";
      const ip = Math.min(a.max[os], b.max[os]) - Math.max(a.min[os], b.min[os]);
      const iy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
      if (ip <= 0 || iy <= 0) continue;
      const pole = (p: Box3) => Math.max(1e-9, (p.max[os] - p.min[os]) * (p.max.y - p.min.y));
      if ((ip * iy) / Math.min(pole(a), pole(b)) > 0.3) return false;
    }
  }
  return true;
}

/** Rozdziela siatkę uchwytów na kawałki przy frontach (środek trójkąta w rzucie XY frontu, w ramce frontu). */
function rozdzielUchwyty(root: Object3D, uchwyty: Mesh, fronty: { bb: Box3; doRamki: Matrix4 }[]) {
  const geo = (uchwyty.geometry.index ? uchwyty.geometry.toNonIndexed() : uchwyty.geometry) as BufferGeometry;
  const pos = geo.getAttribute("position");
  const atrybuty = Object.keys(geo.attributes);
  const doRoot = new Matrix4().copy(root.matrixWorld).invert().multiply(uchwyty.matrixWorld);
  const grupy = new Map<number, number[]>();
  const reszta: number[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const s = new Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    a.fromBufferAttribute(pos, t).applyMatrix4(doRoot);
    b.fromBufferAttribute(pos, t + 1).applyMatrix4(doRoot);
    c.fromBufferAttribute(pos, t + 2).applyMatrix4(doRoot);
    const srodek = a.add(b).add(c).multiplyScalar(1 / 3);
    const i = fronty.findIndex(({ bb, doRamki }) => {
      s.copy(srodek).applyMatrix4(doRamki);
      return s.x >= bb.min.x - 0.01 && s.x <= bb.max.x + 0.01 && s.y >= bb.min.y - 0.01 && s.y <= bb.max.y + 0.01 && s.z >= bb.min.z - 0.005 && s.z <= bb.max.z + 0.09;
    });
    if (i >= 0) {
      const lista = grupy.get(i) ?? [];
      lista.push(t);
      grupy.set(i, lista);
    } else reszta.push(t);
  }
  if (!grupy.size) return [];
  const zbuduj = (trojkaty: number[]) => {
    const g = new BufferGeometry();
    for (const nazwa of atrybuty) {
      const src = geo.getAttribute(nazwa);
      const dane = new (src.array.constructor as new (n: number) => Float32Array)(trojkaty.length * 3 * src.itemSize);
      trojkaty.forEach((t, k) => {
        for (let v = 0; v < 3; v++) for (let j = 0; j < src.itemSize; j++) dane[(k * 3 + v) * src.itemSize + j] = src.array[(t + v) * src.itemSize + j];
      });
      g.setAttribute(nazwa, new BufferAttribute(dane, src.itemSize, src.normalized));
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  };
  const kawalki: { mesh: Mesh; front: number }[] = [];
  grupy.forEach((trojkaty, i) => {
    const mesh = new Mesh(zbuduj(trojkaty), uchwyty.material);
    mesh.name = `${uchwyty.name}__${i}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    (uchwyty.parent ?? root).add(mesh);
    mesh.position.copy(uchwyty.position);
    mesh.quaternion.copy(uchwyty.quaternion);
    mesh.scale.copy(uchwyty.scale);
    mesh.updateMatrixWorld(true);
    kawalki.push({ mesh, front: i });
  });
  uchwyty.geometry = zbuduj(reszta);
  return kawalki;
}

/** Skrzynka szuflady w układzie ramki (front w +Z). */
function skrzynka(korpusGl: number, bb: Box3, material: MeshStandardMaterial) {
  const g = new Group();
  const w = Math.max(0.05, bb.max.x - bb.min.x - 0.04);
  const h = Math.max(0.04, Math.min(0.24, (bb.max.y - bb.min.y) * 0.72));
  const d = Math.max(0.1, korpusGl * 0.8);
  const cx = (bb.min.x + bb.max.x) / 2;
  const y0 = bb.min.y + 0.015;
  const zTyl = bb.min.z - d;
  const czesci: [number, number, number, number, number, number][] = [
    [w, 0.008, d, cx, y0 + 0.004, zTyl + d / 2],
    [0.014, h, d, cx - w / 2 + 0.007, y0 + h / 2, zTyl + d / 2],
    [0.014, h, d, cx + w / 2 - 0.007, y0 + h / 2, zTyl + d / 2],
    [w, h, 0.014, cx, y0 + h / 2, zTyl + 0.007],
  ];
  for (const [sx, sy, sz, x, y, z] of czesci) {
    const m = new Mesh(new BoxGeometry(sx, sy, sz), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

type Kandydat = { node: Object3D; typ: Typ | null };

/** Fronty z nazw: najwyższy pasujący węzeł; grupa z kilkoma osobnymi frontami dzieli się na nie. */
function frontyZNazw(root: Object3D, pudelko: (o: Object3D) => Box3, cienki: (o: Object3D) => boolean, tylkoFront: boolean) {
  const wynik: Kandydat[] = [];
  const pasuje = (o: Object3D) => o !== root && !!typZNazwy(o.name, tylkoFront) && maGeometrie(o) && cienki(o);
  const najblizsze = (o: Object3D) => {
    const out: Object3D[] = [];
    const idz = (c: Object3D) => {
      if (pasuje(c)) out.push(c);
      else c.children.forEach(idz);
    };
    o.children.forEach(idz);
    return out;
  };
  const odwiedz = (o: Object3D) => {
    const typ = pasuje(o) ? typZNazwy(o.name, tylkoFront) : null;
    if (typ) {
      const pod = najblizsze(o);
      if (pod.length >= 2 && osobne(pod.map(pudelko))) {
        o.children.forEach(odwiedz);
        return;
      }
      wynik.push({ node: o, typ });
      return;
    }
    o.children.forEach(odwiedz);
  };
  odwiedz(root);
  return wynik;
}

/** Fronty z oznaczeń „Front” (bez nazw): oznaczony węzeł, a gdy pod nim leżą osobne fronty – każdy z nich. */
function frontyZOznaczen(root: Object3D, tags: Record<string, ModelRole>, pudelko: (o: Object3D) => Box3, cienki: (o: Object3D) => boolean) {
  const nazwy = Object.keys(tags).filter((n) => tags[n] === "front");
  const wezly = nazwy.map((n) => root.getObjectByName(n)).filter((o): o is Object3D => !!o && o !== root && maGeometrie(o));
  // Bez węzłów zagnieżdżonych w innych oznaczonych (rodzic wygrywa – dzieli się niżej).
  const gorne = wezly.filter((o) => !wezly.some((p) => p !== o && czyPrzodek(p, o)));
  const wynik: Kandydat[] = [];
  const podziel = (o: Object3D) => {
    let wezel = o;
    // Pojedyncze opakowania (grupa → jedna grupa → siatki) schodzimy w dół.
    while (wezel.children.filter(maGeometrie).length === 1 && !(wezel as Mesh).isMesh) wezel = wezel.children.find(maGeometrie)!;
    const dzieci = wezel.children.filter((c) => maGeometrie(c) && !UCHWYT.test(c.name));
    if (dzieci.length >= 2 && osobne(dzieci.map(pudelko))) dzieci.forEach(podziel);
    else if (cienki(o)) wynik.push({ node: o, typ: typZNazwy(o.name) });
  };
  gorne.forEach(podziel);
  return wynik;
}

function czyPrzodek(p: Object3D, o: Object3D) {
  for (let x = o.parent; x; x = x.parent) if (x === p) return true;
  return false;
}

/** Obrót wokół Y do ramki (front w +Z) dla kierunku, w który patrzy front. */
const KAT: Record<"+z" | "-z" | "+x" | "-x", number> = { "+z": 0, "-z": Math.PI, "+x": -Math.PI / 2, "-x": Math.PI / 2 };

/**
 * Przygotowuje kopię sceny do otwierania (raz po wczytaniu). Zwraca listę ruchomych węzłów i aliasy ról
 * (nowe nazwy kawałków uchwytów → rola oryginału), do dołożenia do tagów przy applyRoles.
 */
export function przygotujRuchome(root: Object3D, tags: Record<string, ModelRole> = {}) {
  const ruchome: Ruchomy[] = [];
  const aliasy: Record<string, ModelRole> = {};
  if (root.userData.ruchomeGotowe) return { ruchome: root.userData.ruchome as Ruchomy[], aliasy: root.userData.aliasy as Record<string, ModelRole> };
  root.updateMatrixWorld(true);
  const cale = boxWzgledem(root, root);
  if (cale.isEmpty()) return { ruchome, aliasy };
  const wRoot = (o: Object3D) => boxWzgledem(root, o);

  // Front to płyta: w jednej osi poziomej (X albo Z) wyraźnie cieńszy niż bryła. Nazwa całego mebla
  // („Zmywarka_zabudowa_60”, „Szafa_drzwi”) nie jest frontem – schodzimy niżej.
  const cienki = (o: Object3D) => {
    const bb = wRoot(o);
    const gx = bb.max.x - bb.min.x;
    const gz = bb.max.z - bb.min.z;
    return gx <= Math.max(0.08, (cale.max.x - cale.min.x) * 0.35) || gz <= Math.max(0.08, (cale.max.z - cale.min.z) * 0.35);
  };
  // Kolejno: nazwy z biblioteki (Front_…), dowolne nazwy (drzwi, door, szuflada…), oznaczenia „Front” z panelu.
  let kandydaci = frontyZNazw(root, wRoot, cienki, true);
  if (!kandydaci.length) kandydaci = frontyZNazw(root, wRoot, cienki, false);
  if (!kandydaci.length) kandydaci = frontyZOznaczen(root, tags, wRoot, cienki);
  if (!kandydaci.length) return { ruchome, aliasy };

  // Bryła za frontami: pudełka siatek spoza frontów (i spoza uchwytów).
  const wFroncie = (o: Object3D) => kandydaci.some((k) => k.node === o || czyPrzodek(k.node, o));
  const bryla: Box3[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && !wFroncie(o) && !UCHWYT.test(o.name)) {
      const bb = wRoot(o);
      if (!bb.isEmpty()) bryla.push(bb);
    }
  });

  // Kierunek każdego frontu: oś, w której płyta jest cienka (remis → Z jak biblioteka), zwrot – od korpusu,
  // który stoi za frontem (pudełka bryły nachodzące na front w jego płaszczyźnie). Kuchnia w L i wyspa mają
  // fronty w różne strony.
  const fronty = kandydaci.map((k) => {
    const r = wRoot(k.node);
    const osX = r.max.x - r.min.x < (r.max.z - r.min.z) * 0.5;
    const sr = r.getCenter(new Vector3());
    const za = bryla.filter((bb) => {
      const iy = Math.min(bb.max.y, r.max.y) - Math.max(bb.min.y, r.min.y);
      const ip = osX ? Math.min(bb.max.z, r.max.z) - Math.max(bb.min.z, r.min.z) : Math.min(bb.max.x, r.max.x) - Math.max(bb.min.x, r.min.x);
      const szer = osX ? r.max.z - r.min.z : r.max.x - r.min.x;
      // Tylko korpus przylegający do frontu (sąsiednia szafka dalej w tej osi – np. w kuchni w L – się nie liczy).
      const przerwa = osX ? Math.max(bb.min.x - r.max.x, r.min.x - bb.max.x, 0) : Math.max(bb.min.z - r.max.z, r.min.z - bb.max.z, 0);
      return iy > (r.max.y - r.min.y) * 0.3 && ip > szer * 0.3 && przerwa < 0.03;
    });
    const srodekBryly = za.length
      ? za.reduce((a, bb) => a + (osX ? (bb.min.x + bb.max.x) / 2 : (bb.min.z + bb.max.z) / 2), 0) / za.length
      : osX
        ? (cale.min.x + cale.max.x) / 2
        : (cale.min.z + cale.max.z) / 2;
    const roznica = (osX ? sr.x : sr.z) - srodekBryly;
    const kier = osX ? (roznica < -1e-4 ? "-x" : "+x") : roznica < -1e-4 ? "-z" : "+z";
    const doRamki = new Matrix4().makeRotationY(KAT[kier]);
    const zRamki = new Matrix4().makeRotationY(-KAT[kier]);
    const bb = r.clone().applyMatrix4(doRamki);
    const caly = cale.clone().applyMatrix4(doRamki);
    // Głębokość szuflady: korpus za frontem (kuchnia w L – nie cała bryła), bez korpusu – cała bryła.
    let gl = caly.max.z - caly.min.z;
    if (za.length) {
      const zaR = za.map((z) => z.clone().applyMatrix4(doRamki));
      const zaFrontem = bb.max.z - Math.min(...zaR.map((z) => z.min.z));
      if (zaFrontem < gl * 0.75) gl = zaFrontem;
    }
    let typ = k.typ;
    if (!typ) {
      // Z oznaczenia „Front” bez nazwy: niski i szeroki = szuflada, reszta = drzwi.
      const w = bb.max.x - bb.min.x;
      const h = bb.max.y - bb.min.y;
      typ = h <= w * 0.45 ? "szuflada" : "drzwi";
    }
    return { node: k.node, bb, typ, kier, doRamki, zRamki, cx: (caly.min.x + caly.max.x) / 2, gl };
  });

  // Uchwyty: kawałek przy froncie jedzie z frontem, z tą samą rolą (np. „uchwyt” – kolor i ukrycie przy push-to-open).
  const uchwyty: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && UCHWYT.test(o.name) && !wFroncie(o)) uchwyty.push(o as Mesh);
  });
  const role = meshRoles(root, tags);
  const kawalkiFrontu = new Map<number, Mesh[]>();
  for (const u of uchwyty) {
    const rola = role.get(u);
    for (const { mesh, front } of rozdzielUchwyty(root, u, fronty)) {
      if (rola) aliasy[mesh.name] = rola;
      kawalkiFrontu.set(front, [...(kawalkiFrontu.get(front) ?? []), mesh]);
    }
  }

  const drewno = new MeshStandardMaterial({ color: "#d9cbb5", roughness: 0.8 });
  const panele = fronty.map((f, i) => ({ f, i })).filter(({ f }) => f.typ === "panel");

  fronty.forEach((f, i) => {
    const { bb, zRamki } = f;
    const naRoot = (v: Vector3) => v.clone().applyMatrix4(zRamki);
    const przesuniecie = (pivot: Object3D, v: Vector3) => {
      const parent = pivot.parent ?? root;
      return wPrzestrzeniRodzica(root, parent, naRoot(v)).sub(wPrzestrzeniRodzica(root, parent, new Vector3()));
    };
    const obrot = (pivot: Object3D, osRamki: Vector3, kat: number) => {
      ruchome.push({ obj: pivot, typ: "obrot", os: kierunekWRodzicu(root, pivot.parent ?? root, naRoot(osRamki)), kat });
    };
    const sx = (bb.min.x + bb.max.x) / 2;
    let pivot: Object3D;
    if (f.typ === "drzwi") {
      const zNazwy = zawiasZNazwy(f.node.name);
      const lewy = zNazwy ? zNazwy === "lewy" : sx <= f.cx + 0.005;
      pivot = owin(root, f.node, naRoot(new Vector3(lewy ? bb.min.x : bb.max.x, 0, bb.max.z)));
      obrot(pivot, new Vector3(0, 1, 0), lewy ? -st(100) : st(100));
    } else if (f.typ === "klapa") {
      pivot = owin(root, f.node, naRoot(new Vector3(0, bb.max.y, bb.max.z)));
      obrot(pivot, new Vector3(1, 0, 0), -st(80));
    } else if (f.typ === "zmywarka") {
      pivot = owin(root, f.node, naRoot(new Vector3(0, bb.min.y, bb.max.z)));
      obrot(pivot, new Vector3(1, 0, 0), st(75));
    } else if (f.typ === "szuflada") {
      pivot = owin(root, f.node, new Vector3(0, 0, 0));
      // Skrzynka budowana w ramce, przeniesiona do układu pivota (działa przy dowolnej skali / obrocie rodzica).
      const s = skrzynka(f.gl, bb, drewno);
      root.updateMatrixWorld(true);
      s.applyMatrix4(new Matrix4().copy(pivot.matrixWorld).invert().multiply(root.matrixWorld).multiply(zRamki));
      pivot.add(s);
      ruchome.push({ obj: pivot, typ: "przesuw", baza: pivot.position.clone(), o: przesuniecie(pivot, new Vector3(0, 0, f.gl * 0.7)) });
    } else {
      // Drzwi przesuwne: rusza tylko skrzydło z przedniego toru, na miejsce najbliższego sąsiada (ten sam kierunek).
      const tory = panele.filter(({ f: g }) => g.kier === f.kier);
      const zPrzodu = Math.max(...tory.map(({ f: g }) => g.bb.max.z));
      if (bb.max.z < zPrzodu - 0.004) return;
      const sasiad = tory
        .filter(({ i: j }) => j !== i)
        .map(({ f: g }) => (g.bb.min.x + g.bb.max.x) / 2)
        .sort((a, b) => Math.abs(a - sx) - Math.abs(b - sx))[0];
      if (sasiad === undefined) return;
      pivot = owin(root, f.node, new Vector3(0, 0, 0));
      ruchome.push({ obj: pivot, typ: "przesuw", baza: pivot.position.clone(), o: przesuniecie(pivot, new Vector3((sasiad - sx) * 0.96, 0, 0)) });
    }
    for (const m of kawalkiFrontu.get(i) ?? []) pivot.attach(m);
  });

  root.userData.ruchomeGotowe = true;
  root.userData.ruchome = ruchome;
  root.userData.aliasy = aliasy;
  return { ruchome, aliasy };
}

const _q = new Quaternion();

/** Ustawia otwarcie 0–1 (wygładzone) na wszystkich ruchomych węzłach. */
export function ustawOtwarcie(ruchome: readonly Ruchomy[], p: number) {
  for (const r of ruchome) {
    if (r.typ === "obrot") r.obj.quaternion.copy(_q.setFromAxisAngle(r.os, r.kat * p));
    else r.obj.position.copy(r.baza).addScaledVector(r.o, p);
  }
}
