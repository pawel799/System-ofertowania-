/*
 * Tekstury pokoju rysowane w przeglądarce (bez plików do pobrania): tynk ścian, panele podłogowe, płyta stropowa.
 * Każda raz na stronę (wspólna dla scen), powtarzalna (RepeatWrapping); UV liczymy w metrach (uvWMetrach),
 * więc wzór ma tę samą skalę na każdej ścianie i podłodze.
 */
import * as THREE from "three";

/** Stały „los” – tekstury zawsze takie same (zdjęcia do PDF, porównania). */
function generator(ziarno: number) {
  let s = ziarno;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function plotno(n: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = n;
  return [c, c.getContext("2d")!];
}

function tekstura(c: HTMLCanvasElement, kolor: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (kolor) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const pamiec = new Map<string, THREE.Texture>();
const raz = (klucz: string, fn: () => THREE.Texture) => {
  let t = pamiec.get(klucz);
  if (!t) pamiec.set(klucz, (t = fn()));
  return t;
};

/** Tynk: prawie biały szum (mnoży kolor ściany – kolor zostaje), płytka 1 m. Ten sam obraz jako mapa wypukłości. */
export const tynk = () =>
  raz("tynk", () => {
    const N = 512;
    const [c, g] = plotno(N);
    g.fillStyle = "#f4f4f4";
    g.fillRect(0, 0, N, N);
    const los = generator(97);
    // Plamy (nierówne zacieranie) i drobne ziarno.
    for (let i = 0; i < 160; i++) {
      const v = 236 + Math.round(los() * 19);
      g.fillStyle = `rgba(${v},${v},${v},0.16)`;
      g.beginPath();
      g.arc(los() * N, los() * N, 10 + los() * 46, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 26000; i++) {
      const v = 220 + Math.round(los() * 35);
      g.fillStyle = `rgba(${v},${v},${v},0.45)`;
      g.fillRect(los() * N, los() * N, 1 + los() * 1.4, 1 + los() * 1.4);
    }
    return tekstura(c, true);
  });

/**
 * Panele podłogowe (dąb): deski 20 × 120 cm, w każdym rzędzie przesunięte, różne odcienie, słoje, sęki i fugi.
 * Płytka 2,4 × 2,4 m: 12 rzędów po dwie deski – wzór ciągły na krawędziach płytki.
 */
export const PLYTKA_PANELI = 2.4;
export const panele = () =>
  raz("panele", () => {
    const N = 1024;
    const [c, g] = plotno(N);
    const los = generator(4242);
    const rzedy = 12;
    const h = N / rzedy;
    const L = N / 2;
    for (let r = 0; r < rzedy; r++) {
      const przesun = Math.floor(los() * L);
      // Odcienie szarości – kolor daje materiał (wybrany kolor podłogi mnoży teksturę).
      const deski = [0, 1].map(() => ({ jas: 84 + los() * 12, nas: 0, ton: 0 }));
      g.save();
      g.beginPath();
      g.rect(0, r * h, N, h);
      g.clip();
      for (let k = -1; k <= 2; k++) {
        const x0 = przesun + k * L;
        const d = deski[((k % 2) + 2) % 2];
        g.fillStyle = `hsl(${d.ton} ${d.nas}% ${d.jas}%)`;
        g.fillRect(x0, r * h, L, h);
        const zl = generator(1000 + r * 7 + (((k % 2) + 2) % 2));
        for (let s2 = 0; s2 < 16; s2++) {
          const y = r * h + zl() * h;
          const amp = 0.6 + zl() * 2.2;
          const okres = 1.5 + zl() * 2;
          g.strokeStyle = `hsla(0 0% ${d.jas - 22 - zl() * 14}% / ${0.1 + zl() * 0.16})`;
          g.lineWidth = 0.6 + zl() * 1.4;
          g.beginPath();
          for (let x = 0; x <= L; x += 12) g.lineTo(x0 + x, y + Math.sin((x / L) * Math.PI * okres) * amp);
          g.stroke();
        }
        if (zl() < 0.2) {
          g.fillStyle = `hsla(0 0% ${d.jas - 34}% / 0.35)`;
          g.beginPath();
          g.ellipse(x0 + zl() * L, r * h + h / 2 + (zl() - 0.5) * h * 0.4, 5 + zl() * 7, 2.5 + zl() * 2.5, 0, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = "rgba(40,40,40,0.45)";
        g.fillRect(x0 - 1, r * h, 2, h);
      }
      g.restore();
      g.fillStyle = "rgba(40,40,40,0.5)";
      g.fillRect(0, r * h, N, 2);
    }
    return tekstura(c, true);
  });

/** Płytki 60 × 60 cm z fugą (odcienie szarości, kolor z materiału). Płytka tekstury 1,2 × 1,2 m = 2 × 2 płytki. */
export const PLYTKA_PLYTEK = 1.2;
export const plytki = () =>
  raz("plytki", () => {
    const N = 1024;
    const [c, g] = plotno(N);
    const los = generator(777);
    const p = N / 2;
    const fuga = 5;
    g.fillStyle = "rgb(150,150,150)";
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const x = i * p + fuga / 2;
        const y = j * p + fuga / 2;
        const v = 236 + Math.round(los() * 14);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(x, y, p - fuga, p - fuga);
        // Delikatne „żyłki” i ziarno – płytka nie jest idealnie płaska w kolorze.
        for (let k = 0; k < 2600; k++) {
          const w = 222 + Math.round(los() * 33);
          g.fillStyle = `rgba(${w},${w},${w},0.35)`;
          g.fillRect(x + los() * (p - fuga), y + los() * (p - fuga), 1 + los() * 2, 1 + los() * 2);
        }
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = `rgba(190,190,190,${0.12 + los() * 0.15})`;
          g.lineWidth = 0.8 + los() * 1.6;
          g.beginPath();
          let px = x + los() * (p - fuga);
          let py = y + los() * (p - fuga);
          g.moveTo(px, py);
          for (let s2 = 0; s2 < 8; s2++) {
            px = Math.min(x + p - fuga, Math.max(x, px + (los() - 0.3) * 60));
            py = Math.min(y + p - fuga, Math.max(y, py + (los() - 0.5) * 60));
            g.lineTo(px, py);
          }
          g.stroke();
        }
      }
    return tekstura(c, true);
  });

/** Wierzch stropu: jednolita płyta (beton zatarty) – bez fug i łączeń, delikatne ziarno i plamy. */
export const strop = () =>
  raz("strop", () => {
    const N = 512;
    const [c, g] = plotno(N);
    g.fillStyle = "#c4c1bb";
    g.fillRect(0, 0, N, N);
    const los = generator(1234567);
    for (let i = 0; i < 120; i++) {
      const v = 180 + Math.round(los() * 30);
      g.fillStyle = `rgba(${v},${v - 1},${v - 4},0.12)`;
      g.beginPath();
      g.arc(los() * N, los() * N, 14 + los() * 50, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 18000; i++) {
      const v = Math.round(170 + los() * 50);
      g.fillStyle = `rgba(${v},${v - 1},${v - 4},0.35)`;
      g.fillRect(los() * N, los() * N, 1 + los() * 1.2, 1 + los() * 1.2);
    }
    return tekstura(c, true);
  });

/** Prostokąt w + h [m] z UV w metrach (od u0, v0) / płytka – wzór ciągły między kawałkami ściany. */
export function prostokatUV(w: number, h: number, u0: number, v0: number, plytka: number) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (u0 + uv.getX(i) * w) / plytka, (v0 + uv.getY(i) * h) / plytka);
  uv.needsUpdate = true;
  return g;
}

/** Wielokąt z rzutu (cm) leżący poziomo, normalna w górę, UV w metrach / płytka. */
export function wielokatPoziomy(punkty: readonly { x: number; z: number }[], plytka: number) {
  const g = new THREE.ShapeGeometry(new THREE.Shape(punkty.map((p) => new THREE.Vector2(p.x / 100, -p.z / 100))));
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / plytka, uv.getY(i) / plytka);
  uv.needsUpdate = true;
  return g;
}
