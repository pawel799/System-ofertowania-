"use client";

/*
 * Obrys zaznaczenia i dopasowanie modelu GLB do wymiarów – liczone z geometrii, w układzie lokalnym.
 *
 * Skąd był błąd: Box3.setFromObject() liczy pudełko w układzie ŚWIATA (matrixWorld). Model siedzi
 * w grupie elementu, która ma pozycję na rzucie i obrót (0/90/180/270°). Po pierwszym ułożeniu
 * każda zmiana wymiaru liczyła pudełko razem z tą pozycją i obrotem, a wynik wpisywała do LOKALNEJ
 * pozycji i skali modelu: przy obrocie 90° szerokość trafiała w głębokość, a przesunięcie elementu
 * na rzucie dokładało się drugi raz – model odjeżdżał od obrysu i się rozciągał. Obrys był z kolei
 * siatką wireframe (widać przekątne trójkątów), rysowaną z wymiarów z planu, a nie z modelu.
 *
 * Tutaj: pudełko zawsze względem wskazanego węzła (macierz odwrotna × matrixWorld siatki), więc
 * pozycja i obrót rodzica się znoszą – działa dla każdego pivotu/originu i każdego obrotu.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Box3,
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineSegments,
  Matrix4,
  Vector3,
  type BufferGeometry,
  type Mesh,
  type Object3D,
} from "three";

const _odwr = new Matrix4();
const _m = new Matrix4();
const _b = new Box3();

/**
 * Pudełko widocznych siatek `content` w układzie lokalnym węzła `root` (root może być samym content).
 * Ukryte siatki (np. uchwyty przy push-to-open) się nie liczą.
 */
export function boxWzgledem(root: Object3D, content: Object3D, out = new Box3()) {
  out.makeEmpty();
  root.updateWorldMatrix(true, false);
  content.updateWorldMatrix(true, true);
  _odwr.copy(root.matrixWorld).invert();
  content.traverseVisible((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry as BufferGeometry | undefined;
    if (!g?.attributes?.position) return;
    if (!g.boundingBox) g.computeBoundingBox();
    if (!g.boundingBox) return;
    _m.multiplyMatrices(_odwr, mesh.matrixWorld);
    out.union(_b.copy(g.boundingBox).applyMatrix4(_m));
  });
  return out;
}

export type Dopasowanie = { scale: [number, number, number]; position: [number, number, number] };

/**
 * Skala i przesunięcie, po których model ma dokładnie w × h × d [m], środek w osi X/Z i spód na y = 0.
 * Liczone z pudełka w układzie modelu – nie zależy od tego, gdzie i jak obrócony jest element.
 */
export function dopasuj(model: Object3D, w: number, h: number, d: number): Dopasowanie {
  const box = boxWzgledem(model, model);
  if (box.isEmpty()) return { scale: [1, 1, 1], position: [0, 0, 0] };
  const size = box.getSize(new Vector3());
  const c = box.getCenter(new Vector3());
  const s: [number, number, number] = [w / Math.max(size.x, 1e-4), h / Math.max(size.y, 1e-4), d / Math.max(size.z, 1e-4)];
  return { scale: s, position: [-c.x * s[0], -box.min.y * s[1], -c.z * s[2]] };
}

/**
 * Model GLB w „uchwycie”: grupa-uchwyt ma własny węzeł, więc transformacje z pliku (root sceny) zostają
 * nietknięte, a skala/przesunięcie są deklaratywne (props), nie mutowane w efekcie.
 */
export function useUchwytModelu(scene: Object3D) {
  return useMemo(() => {
    const uchwyt = new Group();
    uchwyt.name = "dopasowanie";
    uchwyt.add(scene.clone(true));
    return uchwyt;
  }, [scene]);
}

const EPS = 1e-4;
const rozne = (a: Box3, b: Box3) =>
  Math.abs(a.min.x - b.min.x) > EPS ||
  Math.abs(a.min.y - b.min.y) > EPS ||
  Math.abs(a.min.z - b.min.z) > EPS ||
  Math.abs(a.max.x - b.max.x) > EPS ||
  Math.abs(a.max.y - b.max.y) > EPS ||
  Math.abs(a.max.z - b.max.z) > EPS;

/**
 * Obrys zaznaczenia nakładany na dowolny mebel: 12 krawędzi pudełka policzonego z geometrii dzieci
 * (bez przekątnych), w układzie tej grupy. Sam się poprawia po wczytaniu modelu, zmianie wymiarów,
 * podmianie materiału z ukryciem uchwytów itd. Nie przechwytuje kliknięć.
 */
export function Obrys({
  aktywny,
  children,
  kolor = "#7c98ff",
  zapas = 0.01,
}: {
  aktywny: boolean;
  children: ReactNode;
  kolor?: string;
  /** Odsunięcie obrysu od bryły [m], żeby linie nie wchodziły w ściany modelu. */
  zapas?: number;
}) {
  const grupa = useRef<Group>(null);
  const linie = useRef<LineSegments>(null);
  const invalidate = useThree((s) => s.invalidate);
  const ostatni = useRef(new Box3());
  const tmp = useMemo(() => new Box3(), []);
  const geo = useMemo(() => new EdgesGeometry(new BoxGeometry(1, 1, 1)), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => {
    ostatni.current.makeEmpty();
    invalidate();
  }, [aktywny, invalidate]);

  useFrame(() => {
    const g = grupa.current;
    const l = linie.current;
    if (!aktywny || !g || !l) return;
    boxWzgledem(g, g, tmp);
    if (tmp.isEmpty()) {
      l.visible = false;
      return;
    }
    if (!rozne(tmp, ostatni.current) && l.visible) return;
    ostatni.current.copy(tmp);
    const size = tmp.getSize(new Vector3());
    l.scale.set(size.x + 2 * zapas, size.y + 2 * zapas, size.z + 2 * zapas);
    tmp.getCenter(l.position);
    l.visible = true;
    invalidate();
  });

  return (
    <group ref={grupa}>
      {children}
      {aktywny ? (
        <lineSegments ref={linie} geometry={geo} visible={false} renderOrder={10} raycast={() => null}>
          <lineBasicMaterial color={kolor} depthTest={false} transparent opacity={0.95} />
        </lineSegments>
      ) : null}
    </group>
  );
}
