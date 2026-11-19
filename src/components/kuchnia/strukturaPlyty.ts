/*
 * Proceduralna struktura płyty w 3D (K3D-PLYTY-01): drewno, kamień, beton – rysowana w canvasie, własna.
 * Bez tekstur, zdjęć i skanów producentów: tekstura jest szara (mnoży kolor HEX dobrany ręcznie),
 * więc pokazuje tylko ogólny charakter powierzchni. Kolory są poglądowe.
 */
import * as THREE from "three";
import type { WykonczeniePlyty } from "@/lib/plyty";

const cache = new Map<WykonczeniePlyty, THREE.Texture | null>();

/** Prosty, powtarzalny pseudolosowy generator (ten sam wygląd przy każdym renderze). */
function los(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rysuj(wzor: WykonczeniePlyty): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const N = 256;
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N;
  const g = c.getContext("2d");
  if (!g) return null;
  const r = los(wzor.length * 7919);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, N, N);
  if (wzor === "drewno") {
    // Słoje wzdłuż długości płyty: pasy o zmiennej szerokości i jasności, lekko faliste.
    for (let i = 0; i < 70; i++) {
      const x0 = r() * N;
      const w = 0.6 + r() * 2.4;
      const a = 0.05 + r() * 0.12;
      g.strokeStyle = `rgba(60,40,20,${a})`;
      g.lineWidth = w;
      g.beginPath();
      for (let y = 0; y <= N; y += 8) {
        const x = x0 + Math.sin((y / N) * Math.PI * 2 * (1 + r() * 0.2) + i) * 2.5;
        if (y === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
  } else if (wzor === "beton") {
    const img = g.getImageData(0, 0, N, N);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 215 + r() * 40 - (r() < 0.01 ? 60 : 0);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
      g.beginPath();
      g.arc(r() * N, r() * N, 4 + r() * 22, 0, Math.PI * 2);
      g.fill();
    }
  } else if (wzor === "kamien") {
    // Delikatne żyłki.
    for (let i = 0; i < 9; i++) {
      g.strokeStyle = `rgba(80,80,85,${0.08 + r() * 0.14})`;
      g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath();
      let x = r() * N;
      let y = 0;
      g.moveTo(x, y);
      while (y < N) {
        x += (r() - 0.5) * 30;
        y += 10 + r() * 20;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  } else return null;
  return c;
}

/** Tekstura struktury (szara, do mnożenia z kolorem) albo null dla mat / połysk / inne. */
export function teksturaPlyty(wzor: WykonczeniePlyty | undefined): THREE.Texture | null {
  if (!wzor) return null;
  if (cache.has(wzor)) return cache.get(wzor) ?? null;
  const c = rysuj(wzor);
  const t = c ? new THREE.CanvasTexture(c) : null;
  if (t) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
  }
  cache.set(wzor, t);
  return t;
}
