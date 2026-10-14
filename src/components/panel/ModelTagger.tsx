"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, Color, Mesh, MeshStandardMaterial, Sphere, Vector3, type Material, type Object3D, type PerspectiveCamera } from "three";
import { ROLE_LABEL, type ModelRole } from "../modelRoles";
import { assetsApi, modelUrl, type ModelMeta } from "./offerApi";
import { toast } from "./ui";

/*
 * Oznaczanie elementów wgranego modelu: klik w element na podglądzie 3D (Shift = kilka),
 * potem rola: front / blat / uchwyt. Albo hurtem: wszystkie elementy z danym materiałem.
 * Element = węzeł z pliku GLB (nazwa jest unikalna, nadana przy wgrywaniu).
 * Zapis: PUT /api/models/:id { tags } – strona oferty koloruje po tych nazwach.
 */

type Element = { name: string; material: string; meshes: Mesh[]; triangles: number };

const ROLE_COLOR: Record<ModelRole, string> = { front: "#3f63e0", blat: "#c27100", uchwyt: "#0f8f84" };
const ROLES: ModelRole[] = ["front", "blat", "uchwyt"];

type Associations = Map<Object3D, { nodes?: number; meshes?: number; primitives?: number }>;

/** Element, do którego należy siatka: ona sama (węzeł) albo grupa węzła z wieloma częściami. */
function elementOf(mesh: Object3D, assoc: Associations | undefined): Object3D {
  if (!assoc || assoc.get(mesh)?.nodes !== undefined) return mesh;
  return mesh.parent && assoc.get(mesh.parent)?.nodes !== undefined ? mesh.parent : mesh;
}

function TaggedModel({
  url,
  tags,
  selected,
  onElements,
  onPick,
}: {
  url: string;
  tags: Record<string, ModelRole>;
  selected: Set<string>;
  onElements: (list: Element[]) => void;
  onPick: (name: string, add: boolean) => void;
}) {
  const gltf = useGLTF(url, true, true) as unknown as { scene: Object3D; parser?: { associations?: Associations } };
  const { scene } = gltf;
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const invalidate = useThree((s) => s.invalidate);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));

  const { elements, byMesh, offset, radius, height } = useMemo(() => {
    const assoc = gltf.parser?.associations;
    const map = new Map<string, Element>();
    const byMesh = new Map<Mesh, string>();
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const el = elementOf(o, assoc);
      const name = el.name || o.name;
      if (!name) return;
      const mat = Array.isArray(o.material) ? o.material[0] : (o.material as Material);
      const tris = Math.floor((o.geometry.index?.count ?? o.geometry.attributes.position?.count ?? 0) / 3);
      const cur: Element = map.get(name) ?? { name, material: mat?.name || "bez nazwy", meshes: [], triangles: 0 };
      cur.meshes.push(o);
      cur.triangles += tris;
      map.set(name, cur);
      byMesh.set(o, name);
      if (!o.userData.tagOriginal) o.userData.tagOriginal = o.material;
    });
    const box = new Box3().setFromObject(scene);
    const center = box.getCenter(new Vector3());
    return {
      elements: Array.from(map.values()),
      byMesh,
      offset: [-center.x, -box.min.y, -center.z] as [number, number, number],
      radius: box.getBoundingSphere(new Sphere()).radius || 1,
      height: box.max.y - box.min.y,
    };
  }, [scene, gltf.parser]);

  useEffect(() => onElements(elements), [elements, onElements]);

  useLayoutEffect(() => {
    const target = new Vector3(0, height * 0.45, 0);
    // Na wąskim ekranie (telefon) o kadrze decyduje szerokość kadru, nie wysokość.
    const vHalf = (camera.fov * Math.PI) / 360;
    const half = aspect < 1 ? Math.atan(Math.tan(vHalf) * aspect) : vHalf;
    const dist = (radius / Math.sin(half)) * 0.95;
    camera.position.copy(target).add(new Vector3(0.45, 0.35, 1).normalize().multiplyScalar(dist));
    camera.near = Math.max(0.01, radius / 200);
    camera.far = radius * 40;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
    invalidate();
  }, [camera, controls, radius, height, aspect, invalidate]);

  // Podbarwienie wg roli + podświetlenie zaznaczenia (klony materiałów w pamięci podręcznej).
  const clones = useMemo(() => new Map<string, Material>(), []);
  useEffect(() => {
    byMesh.forEach((name, mesh) => {
      const original = mesh.userData.tagOriginal as Material;
      if (!(original instanceof MeshStandardMaterial)) return;
      const role = tags[name];
      const sel = selected.has(name);
      if (!role && !sel) {
        mesh.material = original;
        return;
      }
      const key = `${original.uuid}|${role ?? "-"}|${sel ? 1 : 0}`;
      let m = clones.get(key) as MeshStandardMaterial | undefined;
      if (!m) {
        m = original.clone();
        if (role) {
          m.map = null;
          m.color.copy(new Color(ROLE_COLOR[role]));
        }
        if (sel) {
          m.emissive = new Color("#ffffff");
          m.emissiveIntensity = 0.35;
        }
        clones.set(key, m);
      }
      mesh.material = m;
    });
    invalidate();
  }, [byMesh, tags, selected, clones, invalidate]);

  useEffect(
    () => () => {
      byMesh.forEach((_, mesh) => (mesh.material = mesh.userData.tagOriginal as Material));
      clones.forEach((m) => m.dispose());
    },
    [byMesh, clones],
  );

  const click = (e: ThreeEvent<MouseEvent>) => {
    // Przeciągnięcie (obrót kamery) to nie klik.
    if (e.delta > 4) return;
    e.stopPropagation();
    const name = byMesh.get(e.object as Mesh);
    if (name) onPick(name, e.shiftKey || e.metaKey || e.ctrlKey);
  };

  return (
    <>
      <group position={offset}>
        <primitive object={scene} onClick={click} />
      </group>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={radius * 0.3} maxDistance={radius * 4} />
    </>
  );
}

export default function ModelTagger({ model, onBack, onSaved }: { model: ModelMeta; onBack: () => void; onSaved: (m: ModelMeta) => void }) {
  const [tags, setTags] = useState<Record<string, ModelRole>>(model.tags);
  const [elements, setElements] = useState<Element[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(tags) !== JSON.stringify(model.tags);

  const onPick = useCallback((name: string, add: boolean) => {
    setSelected((prev) => {
      const next = new Set(add ? prev : []);
      if (add && prev.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const setRole = (names: string[], role: ModelRole | null) =>
    setTags((prev) => {
      const next = { ...prev };
      for (const n of names) {
        if (role) next[n] = role;
        else delete next[n];
      }
      return next;
    });

  const groups = useMemo(() => {
    const map = new Map<string, Element[]>();
    for (const el of elements) map.set(el.material, [...(map.get(el.material) ?? []), el]);
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [elements]);

  const selList = elements.filter((e) => selected.has(e.name));
  const selMaterials = Array.from(new Set(selList.map((e) => e.material)));
  const counts = ROLES.map((r) => ({ role: r, n: Object.values(tags).filter((x) => x === r).length }));

  const save = async () => {
    setSaving(true);
    try {
      // Zapisujemy tylko elementy, które są w pliku (stare nazwy po podmianie modelu odpadają).
      const known = new Set(elements.map((e) => e.name));
      const clean = Object.fromEntries(Object.entries(tags).filter(([n]) => known.has(n)));
      const saved = await assetsApi.updateModel(model.id, { tags: clean });
      setTags(saved.tags);
      onSaved(saved);
      toast("Zapisano oznaczenia", { desc: `${model.name} · ${Object.keys(saved.tags).length} elementów z rolą` });
    } catch (e) {
      toast("Nie udało się zapisać", { type: "err", desc: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tagger">
      <div className="tg-head">
        <button type="button" className="btn btn-plain" onClick={onBack}>
          <svg viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Modele
        </button>
        <h2 className="tg-title">{model.name}</h2>
        <span className="grow" />
        <span className="faint" style={{ fontSize: 12 }}>
          {dirty ? "Niezapisane zmiany" : "Zapisane"}
        </span>
        <button type="button" className="btn btn-ink" disabled={!dirty || saving} onClick={save}>
          {saving ? "Zapisywanie…" : "Zapisz oznaczenia"}
        </button>
      </div>

      <div className="tg-body">
        <div className="vp tg-vp">
          <Canvas
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: [3, 2, 3], fov: 45 }}
            onPointerMissed={(e) => e.type === "click" && setSelected(new Set())}
          >
            <color attach="background" args={["#0c0b0a"]} />
            <directionalLight position={[4, 6, 5]} intensity={1.6} />
            <ambientLight intensity={0.4} />
            <Suspense
              fallback={
                <Html center>
                  <div style={{ color: "#a8a29e", fontSize: 12, whiteSpace: "nowrap" }}>Wczytywanie modelu…</div>
                </Html>
              }
            >
              <TaggedModel url={modelUrl(model)} tags={tags} selected={selected} onElements={setElements} onPick={onPick} />
              <Environment files="/hdri/lebombo_2k.hdr" environmentIntensity={0.7} />
            </Suspense>
          </Canvas>
          <div className="vp-bar">
            <span className="vp-tag">Klik = zaznacz · Shift + klik = kilka · przeciągnij = obrót</span>
          </div>
          <div className="tg-legend" aria-hidden>
            {ROLES.map((r) => (
              <span key={r}>
                <i style={{ background: ROLE_COLOR[r] }} />
                {ROLE_LABEL[r]}
              </span>
            ))}
          </div>
        </div>

        <aside className="tg-side">
          <section className="tg-card" aria-live="polite">
            <h3>Zaznaczone</h3>
            {selList.length ? (
              <>
                <p className="lede">
                  {selList.length === 1 ? selList[0].name : `${selList.length} elementy`} · materiał{" "}
                  {selMaterials.length === 1 ? selMaterials[0] : `${selMaterials.length} różne`}
                </p>
                <div className="tg-roles">
                  {ROLES.map((r) => (
                    <button key={r} type="button" className="btn btn-ghost" onClick={() => setRole(Array.from(selected), r)}>
                      <i className="tg-dot" style={{ background: ROLE_COLOR[r] }} />
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                  <button type="button" className="btn btn-plain" onClick={() => setRole(Array.from(selected), null)}>
                    Bez roli
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-plain tg-same"
                  onClick={() => setSelected(new Set(elements.filter((e) => selMaterials.includes(e.material)).map((e) => e.name)))}
                >
                  Zaznacz wszystkie z tym materiałem
                </button>
              </>
            ) : (
              <p className="lede">Kliknij element na podglądzie albo wybierz rolę dla całego materiału poniżej.</p>
            )}
          </section>

          <section className="tg-card">
            <h3>
              Materiały <span className="faint">({elements.length} elementów)</span>
            </h3>
            <p className="lede">
              {counts.map((c) => `${ROLE_LABEL[c.role]}: ${c.n}`).join(" · ")}
            </p>
            <ul className="tg-mats">
              {groups.map(([mat, els]) => {
                const roles = new Set(els.map((e) => tags[e.name] ?? null));
                const role = roles.size === 1 ? Array.from(roles)[0] : "mixed";
                return (
                  <li key={mat}>
                    <button
                      type="button"
                      className="tg-mat-name"
                      onClick={() => setSelected(new Set(els.map((e) => e.name)))}
                      title="Zaznacz te elementy"
                    >
                      <span>{mat}</span>
                      <span className="faint mono">{els.length}</span>
                    </button>
                    <select
                      className="input tg-select"
                      aria-label={`Rola dla materiału ${mat}`}
                      value={role ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "mixed") return;
                        setRole(
                          els.map((x) => x.name),
                          v ? (v as ModelRole) : null,
                        );
                      }}
                    >
                      {role === "mixed" ? <option value="mixed">Różne</option> : null}
                      <option value="">Bez roli</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
