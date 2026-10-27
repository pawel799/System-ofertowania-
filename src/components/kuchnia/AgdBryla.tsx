"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import Szafka, { useDrewno } from "../modul/Szafka";
import { rodzajElementu, type ElementKuchni, type RodzajElementu } from "@/lib/kuchnia";

type Props = {
  el: ElementKuchni;
  kolor: string;
  chropowatosc: number;
  blat: string;
  uchwyt: boolean;
};

const STAL = "#d5d8dc";
const SZKLO = "#16181b";
const CHROM = "#e4e6e8";

function Blat({ el, kolor }: { el: ElementKuchni; kolor: string }) {
  const H = el.h / 100;
  return (
    <mesh position={[0, H + 0.016, 0.01]} castShadow receiveShadow>
      <boxGeometry args={[el.w / 100, 0.028, el.d / 100 + 0.02]} />
      <meshStandardMaterial color={kolor} roughness={0.45} />
    </mesh>
  );
}

function Korpus({
  el,
  kolor,
  chropowatosc,
  uchwyt,
  szuflady,
  bezFrontu,
}: {
  el: ElementKuchni;
  kolor: string;
  chropowatosc: number;
  uchwyt: boolean;
  szuflady?: number;
  bezFrontu?: boolean;
}) {
  return (
    <Szafka
      szerokosc={el.w}
      wysokosc={el.h}
      glebokosc={el.d}
      kolorFrontu={kolor}
      chropowatosc={chropowatosc}
      pokazUchwyt={uchwyt}
      szuflady={szuflady}
      bezFrontu={bezFrontu}
    />
  );
}

function Bateria({ el, skala = 1 }: { el: ElementKuchni; skala?: number }) {
  const H = (el.h / 100) * skala;
  const wysieg = Math.min(el.d / 100, 0.16) * skala;
  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.026, 0.04, 16]} />
        <meshStandardMaterial color={CHROM} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, H * 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.011, Math.max(0.08, H * 0.85), 12]} />
        <meshStandardMaterial color={CHROM} metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, H * 0.88, wysieg / 2]} rotation={[Math.PI / 2.4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, wysieg, 12]} />
        <meshStandardMaterial color={CHROM} metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  );
}

function ZlewNaSzafce({ el }: { el: ElementKuchni }) {
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  const bw = Math.min(0.5, W * 0.62);
  const bd = Math.min(0.4, D * 0.55);
  return (
    <group position={[0, H + 0.032, 0.02]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[bw, 0.018, bd]} />
        <meshStandardMaterial color={STAL} metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[bw * 0.78, 0.008, bd * 0.72]} />
        <meshStandardMaterial color="#6d7378" metalness={0.45} roughness={0.4} />
      </mesh>
      <group position={[0, 0.02, -bd * 0.42]}>
        <Bateria el={{ ...el, h: 28, d: 16 }} skala={0.72} />
      </group>
    </group>
  );
}

function Miseczka({ el }: { el: ElementKuchni }) {
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  return (
    <group>
      <mesh position={[0, H - 0.008, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, 0.016, D]} />
        <meshStandardMaterial color={STAL} metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[0, H * 0.45, 0]} castShadow>
        <boxGeometry args={[W * 0.86, H * 0.82, D * 0.86]} />
        <meshStandardMaterial color="#8b9196" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, H * 0.55, 0]}>
        <boxGeometry args={[W * 0.7, H * 0.5, D * 0.7]} />
        <meshStandardMaterial color="#5c6368" metalness={0.4} roughness={0.45} />
      </mesh>
    </group>
  );
}

function Plyta({ el, gaz }: { el: ElementKuchni; gaz: boolean }) {
  const W = el.w / 100;
  const H = Math.max(0.012, el.h / 100);
  const D = el.d / 100;
  const pola = [
    [-0.22, -0.18],
    [0.22, -0.18],
    [-0.22, 0.16],
    [0.22, 0.16],
  ].map(([x, z]) => [x * (W / 0.6), z * (D / 0.52)] as const);
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={gaz ? "#1a1a1a" : "#121416"} metalness={0.5} roughness={0.22} />
      </mesh>
      {pola.map(([x, z], i) =>
        gaz ? (
          <mesh key={i} position={[x, H + 0.004, z]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.055 * (D / 0.52), 0.004, 8, 20]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.4} />
          </mesh>
        ) : (
          <mesh key={i} position={[x, H + 0.001, z]}>
            <boxGeometry args={[0.14 * (W / 0.6), 0.002, 0.16 * (D / 0.52)]} />
            <meshStandardMaterial color="#2c3136" metalness={0.2} roughness={0.35} />
          </mesh>
        ),
      )}
    </group>
  );
}

function Piekarnik({ el, kolor, chropowatosc, uchwyt }: Props) {
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  const wysoki = el.strefa === "wysoka";
  const front = useMemo(() => new THREE.MeshStandardMaterial({ color: kolor, roughness: chropowatosc, metalness: 0.04 }), [kolor, chropowatosc]);
  useEffect(() => () => front.dispose(), [front]);
  const z = D / 2 + 0.012;
  const piecOd = wysoki ? H * 0.16 : H * 0.08;
  const piecDo = wysoki ? H * 0.52 : H * 0.9;
  return (
    <group>
      <Korpus el={el} kolor={kolor} chropowatosc={chropowatosc} uchwyt={false} bezFrontu />
      {wysoki ? (
        <mesh position={[0, (piecDo + H) / 2, z]} material={front} castShadow>
          <boxGeometry args={[W - 0.008, H - piecDo - 0.01, 0.018]} />
        </mesh>
      ) : null}
      <mesh position={[0, (piecOd + piecDo) / 2, z + 0.002]} castShadow>
        <boxGeometry args={[W - 0.03, piecDo - piecOd, 0.02]} />
        <meshStandardMaterial color={SZKLO} metalness={0.25} roughness={0.15} />
      </mesh>
      <mesh position={[0, piecDo - 0.02, z + 0.016]}>
        <boxGeometry args={[W * 0.55, 0.012, 0.008]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.4} roughness={0.45} />
      </mesh>
      {uchwyt ? (
        <mesh position={[0, (piecOd + piecDo) / 2, z + 0.03]} castShadow>
          <boxGeometry args={[W * 0.42, 0.012, 0.012]} />
          <meshStandardMaterial color="#2b2b2b" metalness={0.8} roughness={0.35} />
        </mesh>
      ) : null}
    </group>
  );
}

function Zmywarka({ el, kolor, chropowatosc, uchwyt }: Props) {
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  return (
    <group>
      <Korpus el={el} kolor={kolor} chropowatosc={chropowatosc} uchwyt={uchwyt} />
      <mesh position={[0, H - 0.045, D / 2 + 0.03]} castShadow>
        <boxGeometry args={[W - 0.02, 0.045, 0.008]} />
        <meshStandardMaterial color="#1c1d1f" metalness={0.35} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Lodowka({ el }: { el: ElementKuchni }) {
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  const dwudrzwi = W >= 0.75;
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#e7e9ed" metalness={0.38} roughness={0.38} />
      </mesh>
      <mesh position={[0, H * 0.64, D / 2 + 0.004]}>
        <boxGeometry args={[W * 0.9, 0.006, 0.004]} />
        <meshStandardMaterial color="#b0b4ba" />
      </mesh>
      <mesh position={[dwudrzwi ? 0.012 : W * 0.36, H * 0.42, D / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.018, H * (dwudrzwi ? 0.55 : 0.38), 0.02]} />
        <meshStandardMaterial color="#c5c8cc" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function LodowkaZabudowa({ el, kolor, chropowatosc, uchwyt }: Props) {
  const W = el.w / 100;
  const D = el.d / 100;
  return (
    <group>
      <Korpus el={el} kolor={kolor} chropowatosc={chropowatosc} uchwyt={uchwyt} />
      <mesh position={[0, 0.06, D / 2 + 0.03]}>
        <boxGeometry args={[W - 0.04, 0.05, 0.006]} />
        <meshStandardMaterial color="#2a2c2e" metalness={0.2} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Mikrofala({ el }: { el: ElementKuchni }) {
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  const panel = Math.min(0.1, W * 0.22);
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#1b1c1e" metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh position={[-panel / 2, H / 2, D / 2 + 0.004]}>
        <boxGeometry args={[W - panel - 0.03, H * 0.72, 0.006]} />
        <meshStandardMaterial color={SZKLO} metalness={0.15} roughness={0.12} />
      </mesh>
      <mesh position={[W / 2 - panel / 2 - 0.008, H / 2, D / 2 + 0.006]}>
        <boxGeometry args={[panel * 0.7, H * 0.7, 0.008]} />
        <meshStandardMaterial color="#2e3134" metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Okap({ el, plaski }: { el: ElementKuchni; plaski: boolean }) {
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  if (plaski) {
    return (
      <mesh position={[0, H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color="#d8d4ce" metalness={0.45} roughness={0.4} />
      </mesh>
    );
  }
  const daszek = Math.min(0.14, H * 0.38);
  return (
    <group>
      <mesh position={[0, daszek / 2, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[W, daszek, D]} />
        <meshStandardMaterial color="#d8d4ce" metalness={0.45} roughness={0.4} />
      </mesh>
      <mesh position={[0, daszek + (H - daszek) / 2, -D * 0.12]} castShadow>
        <boxGeometry args={[Math.min(0.32, W * 0.34), Math.max(0.04, H - daszek), Math.min(0.24, D * 0.4)]} />
        <meshStandardMaterial color="#d8d4ce" metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Polka({ el }: { el: ElementKuchni }) {
  const drewno = useDrewno();
  const W = el.w / 100;
  const H = el.h / 100;
  const D = el.d / 100;
  const t = Math.min(0.028, Math.max(0.012, H * 0.45));
  const pietra = H >= 0.28 ? 2 : 1;
  const ys = pietra === 1 ? [H - t / 2] : [t / 2, H - t / 2];
  return (
    <group>
      {ys.map((y, i) => (
        <mesh key={i} position={[0, y, 0]} material={drewno.korpus} castShadow receiveShadow>
          <boxGeometry args={[W, t, D]} />
        </mesh>
      ))}
      {[-1, 1].map((strona) => (
        <mesh key={strona} position={[strona * (W / 2 - 0.03), Math.max(t, H - t) / 2, -D / 2 + 0.03]} material={drewno.korpus} castShadow>
          <boxGeometry args={[0.018, Math.max(0.02, H - t), 0.05]} />
        </mesh>
      ))}
    </group>
  );
}

function zSzufladami(rodzaj: RodzajElementu, h: number) {
  if (rodzaj !== "szuflady") return 1;
  return h >= 60 ? 3 : 2;
}

export default function AgdBryla(props: Props) {
  const { el, kolor, chropowatosc, blat, uchwyt } = props;
  const rodzaj = rodzajElementu(el);
  if (rodzaj === "blat") {
    return (
      <mesh position={[0, el.h / 200, 0]} castShadow receiveShadow>
        <boxGeometry args={[el.w / 100, Math.max(0.012, el.h / 100), el.d / 100]} />
        <meshStandardMaterial color={blat} roughness={0.45} />
      </mesh>
    );
  }
  if (rodzaj === "polka") return <Polka el={el} />;
  if (rodzaj === "plyta-indukcja" || rodzaj === "plyta-gaz") return <Plyta el={el} gaz={rodzaj === "plyta-gaz"} />;
  if (rodzaj === "bateria") return <Bateria el={el} />;
  if (rodzaj === "zlewozmywak") return <Miseczka el={el} />;
  if (rodzaj === "okap" || rodzaj === "okap-podszafkowy") return <Okap el={el} plaski={rodzaj === "okap-podszafkowy"} />;
  if (rodzaj === "lodowka") return <Lodowka el={el} />;
  if (rodzaj === "mikrofalowka") return <Mikrofala el={el} />;
  if (rodzaj === "piekarnik") {
    return (
      <group>
        <Piekarnik {...props} />
        {el.strefa === "dolna" ? <Blat el={el} kolor={blat} /> : null}
      </group>
    );
  }
  if (rodzaj === "lodowka-zabudowa") return <LodowkaZabudowa {...props} />;
  const blatNaDole = el.strefa === "dolna";
  return (
    <group>
      {rodzaj === "zmywarka" ? (
        <Zmywarka {...props} />
      ) : (
        <Korpus el={el} kolor={kolor} chropowatosc={chropowatosc} uchwyt={uchwyt} szuflady={zSzufladami(rodzaj, el.h)} />
      )}
      {blatNaDole ? <Blat el={el} kolor={blat} /> : null}
      {rodzaj === "zlew" ? <ZlewNaSzafce el={el} /> : null}
    </group>
  );
}
