# Generator 100 mebli (szafy, szafki, komody) – samodzielny skrypt Blendera (4.x/5.x).
# Blender: Scripting → Open → Run Script (zapis na Pulpit\modele-meble) albo: blender -b -P meble_blender.py -- C:\folder
# Generator 50 modeli kuchennych (GLB) dla systemu ofertowania.
# Uruchomienie: w Blenderze (Scripting / MCP) albo: blender -b -P kuchnia_gen.py -- <folder>
# Jednostki: metry. Układ: X = szerokość, -Y = przód (front patrzy na -Y), Z = góra.
# Punkt zaczepienia elementu: lewy-tylny-dolny róg (szafki górne: dół szafki, montaż ok. 145 cm).
# Nazwy materiałów: Front / Blat / Uchwyt = elementy do podmiany kolorów w panelu.
import bpy, bmesh, math, os, json, sys
from mathutils import Matrix, Vector

OUT_DIR = globals().get("OUT_DIR")
NO_AUTORUN = True  # w tym pliku eksport robi część „meble” na końcu
if not OUT_DIR:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    OUT_DIR = argv[0] if argv else os.path.join(os.path.expanduser("~"), "Desktop", "modele-meble")
MODEL_DIR = os.path.join(OUT_DIR, "modele")
os.makedirs(MODEL_DIR, exist_ok=True)

# ---------------------------------------------------------------- wymiary
PL = 0.10      # cokół
BH = 0.72      # korpus dolny
BD = 0.56      # głębokość korpusu dolnego
T = 0.018      # płyta korpusu
FT = 0.018     # front
G = 0.003      # szczelina frontów
WD = 0.33      # głębokość szafki górnej
WH = 0.72      # wysokość szafki górnej
TH = 2.07      # korpus słupka (0.10 .. 2.17)
WT = 0.038     # blat
WTD = 0.60     # głębokość blatu
TOP = PL + BH  # 0.82 – spód blatu
WORK = TOP + WT  # 0.858 – wierzch blatu
WALL_Z = 1.45  # spód szafek górnych

# ---------------------------------------------------------------- scena i materiały
COL_NAME = "GEN_KUCHNIA"
scene = bpy.context.scene
COL = bpy.data.collections.get(COL_NAME) or bpy.data.collections.new(COL_NAME)
if COL.name not in scene.collection.children:
    scene.collection.children.link(COL)

def hex2rgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)

MAT_DEFS = {
    "Front":        dict(c="#d8d1c4", r=0.50),
    "Korpus":       dict(c="#ecebe7", r=0.70),
    "Blat":         dict(c="#e6e3de", r=0.35),
    "Uchwyt":       dict(c="#2b2a29", r=0.40, m=0.7),
    "Cokol":        dict(c="#2f2e2d", r=0.60),
    "Stal":         dict(c="#c9cbcd", r=0.30, m=1.0),
    "AGD_korpus":   dict(c="#3a3b3d", r=0.60, m=0.2),
    "Czarne_szklo": dict(c="#0a0a0b", r=0.08),
    "Szklo":        dict(c="#dfe9ec", r=0.05, a=0.25),
    "Strefy":       dict(c="#4a4b4f", r=0.30),
    "Bialy_AGD":    dict(c="#f2f2f0", r=0.35),
    "Drewno":       dict(c="#9e7350", r=0.60),
    "Czarny_mat":   dict(c="#1b1b1c", r=0.55),
    "Klosz":        dict(c="#232323", r=0.50, m=0.3),
    "Zarowka":      dict(c="#fff4dd", r=0.40, e=3.0),
}
MAT = {}

def make_mat(name, d):
    m = bpy.data.materials.get(name)
    if m is None or not m.get("gen_kuchnia"):
        m = bpy.data.materials.new(name)
        m["gen_kuchnia"] = True
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    col = hex2rgb(d["c"])
    bsdf.inputs["Base Color"].default_value = col
    bsdf.inputs["Roughness"].default_value = d.get("r", 0.5)
    bsdf.inputs["Metallic"].default_value = d.get("m", 0.0)
    m.diffuse_color = col
    if "a" in d:
        bsdf.inputs["Alpha"].default_value = d["a"]
        for attr, val in (("blend_method", "BLEND"), ("surface_render_method", "BLENDED")):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    if "e" in d:
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = col
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = d["e"]
    return m

for _n, _d in MAT_DEFS.items():
    MAT[_n] = make_mat(_n, _d)

# ---------------------------------------------------------------- budowanie siatek
class Ctx:
    """Jeden element: pusty węzeł-korzeń + siatki (jedna siatka = jedna nazwa = jeden materiał)."""
    def __init__(self, rootname, prefix=""):
        self.prefix = prefix
        self.parts = {}
        self.root = bpy.data.objects.new(rootname, None)
        self.root.empty_display_size = 0.1
        COL.objects.link(self.root)

    def bm(self, name, mat):
        key = self.prefix + name
        if key not in self.parts:
            b = bmesh.new()
            b.loops.layers.uv.new("UVMap")
            self.parts[key] = (b, mat)
        b, m = self.parts[key]
        assert m == mat, f"{key}: {m} != {mat}"
        return b

    def finish(self):
        for key, (b, mat) in self.parts.items():
            me = bpy.data.meshes.new(key)
            b.to_mesh(me)
            b.free()
            me.materials.append(MAT[mat])
            ob = bpy.data.objects.new(key, me)
            COL.objects.link(ob)
            ob.parent = self.root
        self.parts = {}
        return self


def _bevel(b, verts, off):
    edges = list({e for v in verts for e in v.link_edges})
    try:
        bmesh.ops.bevel(b, geom=edges, offset=off, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    except TypeError:
        bmesh.ops.bevel(b, geom=edges, offset=off, offset_type="OFFSET", segments=1, profile=0.5, vertex_only=False, clamp_overlap=True)


def box(c, name, mat, x0, x1, y0, y1, z0, z1, bevel=0.0):
    b = c.bm(name, mat)
    sx, sy, sz = abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)
    M = Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @ Matrix.Diagonal((sx, sy, sz, 1.0))
    r = bmesh.ops.create_cube(b, size=1.0, matrix=M, calc_uvs=True)
    if bevel > 0 and min(sx, sy, sz) > bevel * 3:
        _bevel(b, r["verts"], bevel)


def _smooth_sides(b, verts, axis):
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        f.normal_update()
        f.smooth = abs(f.normal.dot(axis)) < 0.5
    for f in faces:
        if not f.smooth:
            for e in f.edges:
                e.smooth = False


AXES = {"Z": (Matrix.Identity(4), Vector((0, 0, 1))),
        "X": (Matrix.Rotation(math.pi / 2, 4, "Y"), Vector((1, 0, 0))),
        "Y": (Matrix.Rotation(math.pi / 2, 4, "X"), Vector((0, 1, 0)))}


def cyl(c, name, mat, center, r, h, axis="Z", segs=16, r2=None):
    b = c.bm(name, mat)
    rot, ax = AXES[axis]
    M = Matrix.Translation(center) @ rot
    res = bmesh.ops.create_cone(b, cap_ends=True, cap_tris=False, segments=segs, radius1=r,
                                radius2=r if r2 is None else r2, depth=h, matrix=M, calc_uvs=True)
    _smooth_sides(b, res["verts"], ax)


def sphere(c, name, mat, center, r, u=12, v=8):
    b = c.bm(name, mat)
    res = bmesh.ops.create_uvsphere(b, u_segments=u, v_segments=v, radius=r, matrix=Matrix.Translation(center), calc_uvs=True)
    for f in {f for vv in res["verts"] for f in vv.link_faces}:
        f.smooth = True

# ---------------------------------------------------------------- uchwyty i fronty
def handle_v(c, x, yface, zc, L=0.16):
    box(c, "Uchwyty", "Uchwyt", x - 0.006, x + 0.006, yface - 0.032, yface - 0.020, zc - L / 2, zc + L / 2, bevel=0.001)
    for z in (zc + L / 2 - 0.015, zc - L / 2 + 0.015):
        box(c, "Uchwyty", "Uchwyt", x - 0.004, x + 0.004, yface - 0.020, yface, z - 0.004, z + 0.004)


def handle_h(c, xc, yface, z, L=0.16):
    box(c, "Uchwyty", "Uchwyt", xc - L / 2, xc + L / 2, yface - 0.032, yface - 0.020, z - 0.006, z + 0.006, bevel=0.001)
    for x in (xc - L / 2 + 0.015, xc + L / 2 - 0.015):
        box(c, "Uchwyty", "Uchwyt", x - 0.004, x + 0.004, yface - 0.020, yface, z - 0.004, z + 0.004)


def doors(c, x0, x1, z0, z1, yb, n=1, hpos="top", hand="R", label="drzwi"):
    w = (x1 - x0) / n
    L = min(0.16, (z1 - z0) * 0.5)
    for i in range(n):
        xa, xb = x0 + i * w + G / 2, x0 + (i + 1) * w - G / 2
        box(c, f"Front_{label}_{i + 1}" if n > 1 else f"Front_{label}", "Front", xa, xb, yb - FT, yb, z0, z1, bevel=0.0015)
        side = hand if n == 1 else ("R" if i == 0 else "L")
        hx = xb - 0.035 if side == "R" else xa + 0.035
        zc = {"top": z1 - 0.05 - L / 2, "bottom": z0 + 0.05 + L / 2, "mid": 1.05}[hpos]
        handle_v(c, hx, yb - FT, zc, L)


def drawers(c, x0, x1, z0, z1, yb, fracs, label="szuflada"):
    h = z1 - z0
    ztop = z1
    L = min(0.32, (x1 - x0) * 0.55)
    for i, f in enumerate(fracs):
        za = ztop - h * f
        zt = ztop - G / 2 if i else ztop
        zb = za + G / 2 if i < len(fracs) - 1 else za
        box(c, f"Front_{label}_{i + 1}" if len(fracs) > 1 else f"Front_{label}", "Front", x0 + G / 2, x1 - G / 2, yb - FT, yb, zb, zt, bevel=0.0015)
        handle_h(c, (x0 + x1) / 2, yb - FT, zt - 0.045, L)
        ztop = za


def carcass(c, w, D, z0, h, top=True, shelves=()):
    k = "Korpus"
    box(c, k, k, 0, T, -D, 0, z0, z0 + h)
    box(c, k, k, w - T, w, -D, 0, z0, z0 + h)
    box(c, k, k, T, w - T, -D, 0, z0, z0 + T)
    if top:
        box(c, k, k, T, w - T, -D, 0, z0 + h - T, z0 + h)
    else:
        box(c, k, k, T, w - T, -D, -D + 0.08, z0 + h - T, z0 + h)
        box(c, k, k, T, w - T, -0.08, 0, z0 + h - T, z0 + h)
    box(c, k, k, T, w - T, -0.006, -0.002, z0 + T, z0 + h - T)
    for z in shelves:
        box(c, k, k, T + 0.001, w - T - 0.001, -D + 0.02, -0.006, z, z + T)


def plinth(c, x0, x1, y=-0.50):
    box(c, "Cokol", "Cokol", x0, x1, y - 0.016, y, 0, PL - 0.002)

# ---------------------------------------------------------------- AGD
def oven(c, x0, z0, yf, name="Piekarnik"):
    w = 0.595
    box(c, f"{name}_obudowa", "AGD_korpus", x0, x0 + w, yf, yf + 0.54, z0, z0 + 0.595)
    box(c, f"{name}_panel", "Stal", x0, x0 + w, yf - 0.02, yf, z0 + 0.48, z0 + 0.595, bevel=0.002)
    box(c, f"{name}_drzwi", "Czarne_szklo", x0, x0 + w, yf - 0.024, yf, z0, z0 + 0.477, bevel=0.003)
    box(c, f"{name}_okno", "Strefy", x0 + 0.08, x0 + w - 0.08, yf - 0.0245, yf - 0.023, z0 + 0.09, z0 + 0.36)
    cyl(c, f"{name}_uchwyt", "Stal", (x0 + w / 2, yf - 0.055, z0 + 0.435), 0.009, 0.50, axis="X", segs=12)
    for x in (x0 + w / 2 - 0.23, x0 + w / 2 + 0.23):
        box(c, f"{name}_uchwyt", "Stal", x - 0.006, x + 0.006, yf - 0.05, yf - 0.024, z0 + 0.429, z0 + 0.441)
    for x in (x0 + 0.08, x0 + w - 0.08):
        cyl(c, f"{name}_pokretla", "Stal", (x, yf - 0.03, z0 + 0.537), 0.018, 0.022, axis="Y", segs=16)
    box(c, f"{name}_wyswietlacz", "Czarne_szklo", x0 + w / 2 - 0.07, x0 + w / 2 + 0.07, yf - 0.021, yf - 0.019, z0 + 0.515, z0 + 0.56)


def microwave(c, x0, z0, yf, name="Mikrofala"):
    w, h = 0.595, 0.38
    box(c, f"{name}_obudowa", "AGD_korpus", x0, x0 + w, yf, yf + 0.40, z0, z0 + h)
    box(c, f"{name}_drzwi", "Czarne_szklo", x0, x0 + 0.44, yf - 0.02, yf, z0, z0 + h, bevel=0.003)
    box(c, f"{name}_panel", "Stal", x0 + 0.44, x0 + w, yf - 0.02, yf, z0, z0 + h, bevel=0.002)
    box(c, f"{name}_wyswietlacz", "Czarne_szklo", x0 + 0.47, x0 + 0.565, yf - 0.021, yf - 0.019, z0 + 0.29, z0 + 0.33)
    cyl(c, f"{name}_pokretlo", "Czarny_mat", (x0 + 0.5175, yf - 0.03, z0 + 0.18), 0.022, 0.02, axis="Y", segs=16)


def cooktop_induction(c, x0=0.0, z0=0.0):
    box(c, "Plyta_indukcyjna", "Czarne_szklo", x0 + 0.005, x0 + 0.595, -0.56, -0.04, z0, z0 + 0.006, bevel=0.002)
    for (x, y, r) in ((0.16, -0.18, 0.10), (0.44, -0.18, 0.08), (0.16, -0.41, 0.08), (0.44, -0.41, 0.10)):
        cyl(c, "Plyta_strefy", "Strefy", (x0 + x, y, z0 + 0.0063), r, 0.0006, segs=32)
    box(c, "Plyta_strefy", "Strefy", x0 + 0.2, x0 + 0.4, -0.535, -0.52, z0 + 0.006, z0 + 0.0066)


def cooktop_gas(c, x0=0.0, z0=0.0):
    box(c, "Plyta_gazowa", "Stal", x0 + 0.005, x0 + 0.595, -0.55, -0.04, z0, z0 + 0.01, bevel=0.002)
    for (x, y) in ((0.16, -0.18), (0.44, -0.18), (0.16, -0.40), (0.44, -0.40)):
        cyl(c, "Palniki", "Czarny_mat", (x0 + x, y, z0 + 0.016), 0.045, 0.012, segs=20)
        cyl(c, "Palniki", "Czarny_mat", (x0 + x, y, z0 + 0.025), 0.03, 0.006, segs=20)
    for (xa, xb) in ((0.025, 0.29), (0.31, 0.575)):
        for y in (-0.07, -0.29, -0.51):
            box(c, "Ruszty", "Czarny_mat", x0 + xa, x0 + xb, y - 0.004, y + 0.004, z0 + 0.03, z0 + 0.038)
        for x in (xa, (xa + xb) / 2, xb):
            box(c, "Ruszty", "Czarny_mat", x0 + x - 0.004, x0 + x + 0.004, -0.51, -0.07, z0 + 0.03, z0 + 0.038)
    for x in (0.12, 0.24, 0.36, 0.48):
        cyl(c, "Pokretla", "Czarny_mat", (x0 + x, -0.53, z0 + 0.02), 0.012, 0.02, segs=12)


def hood_chimney(c, x0=0.0, z0=0.0, w=0.6):
    box(c, "Okap", "Stal", x0, x0 + w, -0.5, 0, z0, z0 + 0.07, bevel=0.004)
    box(c, "Okap", "Stal", x0 + w / 2 - 0.13, x0 + w / 2 + 0.13, -0.25, -0.01, z0 + 0.07, z0 + 0.67)
    box(c, "Okap_filtr", "Czarny_mat", x0 + 0.02, x0 + w - 0.02, -0.48, -0.02, z0 - 0.002, z0)
    for i in range(3):
        box(c, "Okap_przyciski", "Czarne_szklo", x0 + 0.06 + i * 0.035, x0 + 0.085 + i * 0.035, -0.502, -0.5, z0 + 0.025, z0 + 0.045)


def hood_island(c, x0=0.0, z0=0.0):
    box(c, "Okap", "Stal", x0, x0 + 0.9, -0.6, 0, z0, z0 + 0.09, bevel=0.004)
    box(c, "Okap", "Stal", x0 + 0.3, x0 + 0.6, -0.45, -0.15, z0 + 0.09, z0 + 0.8)
    box(c, "Okap_filtr", "Czarny_mat", x0 + 0.02, x0 + 0.88, -0.58, -0.02, z0 - 0.002, z0)


def hood_under(c, x0=0.0, z0=0.0):
    box(c, "Okap_obudowa", "AGD_korpus", x0 + 0.001, x0 + 0.599, -0.29, -0.01, z0, z0 + 0.17)
    box(c, "Okap_listwa", "Stal", x0 + 0.001, x0 + 0.599, -0.31, -0.29, z0, z0 + 0.05, bevel=0.002)
    box(c, "Okap_filtr", "Czarny_mat", x0 + 0.02, x0 + 0.58, -0.28, -0.02, z0 - 0.002, z0)


SINK_HOLE = (0.04, 0.46, -0.45, -0.05)


def sink(c, x0=0.0, z0=0.0):
    hx0, hx1, hy0, hy1 = SINK_HOLE
    s = "Zlew"
    box(c, s, "Stal", x0, x0 + hx0, -0.5, 0, z0, z0 + 0.008)
    box(c, s, "Stal", x0 + hx1, x0 + 0.78, -0.5, 0, z0, z0 + 0.008)
    box(c, s, "Stal", x0 + hx0, x0 + hx1, hy1, 0, z0, z0 + 0.008)
    box(c, s, "Stal", x0 + hx0, x0 + hx1, -0.5, hy0, z0, z0 + 0.008)
    d, t = 0.18, 0.006
    box(c, s, "Stal", x0 + hx0, x0 + hx1, hy0, hy1, z0 - d, z0 - d + t)
    box(c, s, "Stal", x0 + hx0, x0 + hx0 + t, hy0, hy1, z0 - d, z0)
    box(c, s, "Stal", x0 + hx1 - t, x0 + hx1, hy0, hy1, z0 - d, z0)
    box(c, s, "Stal", x0 + hx0, x0 + hx1, hy0, hy0 + t, z0 - d, z0)
    box(c, s, "Stal", x0 + hx0, x0 + hx1, hy1 - t, hy1, z0 - d, z0)
    for i in range(6):
        y = -0.1 - i * 0.055
        box(c, s, "Stal", x0 + 0.5, x0 + 0.75, y - 0.004, y + 0.004, z0 + 0.008, z0 + 0.0095)
    cyl(c, "Zlew_odplyw", "Czarny_mat", (x0 + (hx0 + hx1) / 2, (hy0 + hy1) / 2, z0 - d + t + 0.001), 0.03, 0.002, segs=16)
    faucet(c, x0 + (hx0 + hx1) / 2, -0.025, z0 + 0.008)


def faucet(c, fx, fy, z0):
    n = "Bateria"
    cyl(c, n, "Stal", (fx, fy, z0 + 0.02), 0.026, 0.04, segs=16)
    cyl(c, n, "Stal", (fx, fy, z0 + 0.04 + 0.14), 0.014, 0.28, segs=12)
    cyl(c, n, "Stal", (fx, fy - 0.11, z0 + 0.31), 0.011, 0.22, axis="Y", segs=12)
    cyl(c, n, "Stal", (fx, fy - 0.215, z0 + 0.285), 0.012, 0.05, segs=12)
    box(c, n, "Stal", fx + 0.014, fx + 0.07, -0.006 + fy, 0.006 + fy, z0 + 0.19, z0 + 0.202, bevel=0.002)

# ---------------------------------------------------------------- szafki
def base_cab(c, w, n_doors=1, fracs=None, sink_cab=False, hand="R"):
    carcass(c, w, BD, PL, BH, top=not sink_cab, shelves=() if (fracs or sink_cab) else (PL + BH / 2,))
    plinth(c, 0, w)
    if fracs:
        drawers(c, 0, w, PL + G, TOP - G, -BD, fracs)
    else:
        doors(c, 0, w, PL + G, TOP - G, -BD, n_doors, "top", hand)


def oven_cab(c):
    carcass(c, 0.6, BD, PL, BH)
    plinth(c, 0, 0.6)
    drawers(c, 0, 0.6, PL + G, PL + 0.12, -BD, [1.0])
    oven(c, 0.0025, PL + 0.122, -BD)


def dishwasher(c):
    box(c, "Zmywarka_obudowa", "AGD_korpus", 0.0025, 0.5975, -BD, -0.01, PL, TOP - 0.005)
    plinth(c, 0, 0.6)
    box(c, "Front_zmywarka", "Front", 0.0015, 0.5985, -BD - FT, -BD, PL + G, TOP - G, bevel=0.0015)
    handle_h(c, 0.3, -BD - FT, TOP - G - 0.045, 0.32)


def corner_cab(c, w, D, z0, h, wall=False):
    carcass(c, w, D, z0, h, shelves=(z0 + h / 2,))
    k = "Korpus"
    box(c, k, k, 0, 0.006, -w, -D, z0, z0 + h)
    box(c, k, k, 0, D, -w, -w + T, z0, z0 + h)
    box(c, k, k, 0, D, -w + T, -D, z0, z0 + T)
    box(c, k, k, 0, D, -w + T, -D, z0 + h - T, z0 + h)
    za, zb = z0 + G, z0 + h - G
    box(c, "Front_drzwi_1", "Front", D, w - G / 2, -D - FT, -D, za, zb, bevel=0.0015)
    box(c, "Front_drzwi_2", "Front", D, D + FT, -w + G / 2, -D - FT - G, za, zb, bevel=0.0015)
    L = 0.16
    zc = (z0 + 0.05 + L / 2) if wall else (zb - 0.05 - L / 2)
    handle_v(c, w - 0.035, -D - FT, zc, L)
    if not wall:
        box(c, "Cokol", "Cokol", D - 0.06, w, -0.516, -0.50, 0, PL - 0.002)
        box(c, "Cokol", "Cokol", D - 0.06, D - 0.044, -w, -0.50, 0, PL - 0.002)


def wall_cab(c, w, h=WH, n=1, kind="door", hand="R"):
    carcass(c, w, WD, 0, h, shelves=(h / 2,) if h > 0.5 else ())
    if kind == "door":
        doors(c, 0, w, G, h - G, -WD, n, "bottom", hand)
    elif kind == "flap":
        box(c, "Front_klapa", "Front", G / 2, w - G / 2, -WD - FT, -WD, G, h - G, bevel=0.0015)
        handle_h(c, w / 2, -WD - FT, G + 0.04, min(0.32, w * 0.5))
    elif kind == "glass":
        dw = w / n
        for i in range(n):
            xa, xb = i * dw + G / 2, (i + 1) * dw - G / 2
            nm = f"Front_witryna_{i + 1}"
            s = 0.055
            y0, y1 = -WD - FT, -WD
            box(c, nm, "Front", xa, xa + s, y0, y1, G, h - G)
            box(c, nm, "Front", xb - s, xb, y0, y1, G, h - G)
            box(c, nm, "Front", xa + s, xb - s, y0, y1, G, G + s)
            box(c, nm, "Front", xa + s, xb - s, y0, y1, h - G - s, h - G)
            box(c, f"Szklo_{i + 1}", "Szklo", xa + s, xb - s, -WD - FT * 0.6, -WD - FT * 0.4, G + s, h - G - s)
            side = "R" if i == 0 else "L"
            handle_v(c, xb - 0.03 if side == "R" else xa + 0.03, y0, G + 0.05 + 0.08, 0.16)


def tall_cab(c, w, segs, hand="R"):
    shelves = []
    carcass(c, w, BD, PL, TH, shelves=())
    plinth(c, 0, w)
    z = PL
    for i, (h, kind) in enumerate(segs):
        za, zb = z + G / 2, z + h - G / 2
        if i == 0:
            za = z + G
        if i == len(segs) - 1:
            zb = z + h - G
        if kind == "door":
            hpos = "top" if zb < 1.3 else ("bottom" if za > 0.8 else "mid")
            doors(c, 0, w, za, zb, -BD, 1, hpos, hand, label=f"drzwi_{i + 1}")
            if h > 0.5:
                box(c, "Korpus", "Korpus", T + 0.001, w - T - 0.001, -BD + 0.02, -0.006, z + h / 2, z + h / 2 + T)
        elif kind == "drawer":
            drawers(c, 0, w, za, zb, -BD, [1.0], label=f"szuflada_{i + 1}")
        elif kind == "oven":
            oven(c, (w - 0.595) / 2, z + 0.002, -BD)
        elif kind == "micro":
            microwave(c, (w - 0.595) / 2, z + 0.002, -BD)
        if kind in ("oven", "micro"):
            box(c, "Korpus", "Korpus", T, w - T, -BD, 0, z - T / 2, z)
        z += h

# ---------------------------------------------------------------- blaty
def worktop(c, L, D=WTD, z0=0.0, hole=None, name="Blat"):
    if not hole:
        box(c, name, "Blat", 0, L, -D, 0, z0, z0 + WT, bevel=0.002)
        return
    hx0, hx1, hy0, hy1 = hole  # hy0 < hy1 (y ujemne)
    z1 = z0 + WT
    box(c, name, "Blat", 0, hx0, -D, 0, z0, z1)
    box(c, name, "Blat", hx1, L, -D, 0, z0, z1)
    box(c, name, "Blat", hx0, hx1, hy1, 0, z0, z1)
    box(c, name, "Blat", hx0, hx1, -D, hy0, z0, z1)

# ---------------------------------------------------------------- pozostałe
def table(c):
    box(c, "Stol_blat", "Drewno", -0.6, 0.6, -0.4, 0.4, 0.72, 0.75, bevel=0.003)
    for x in (-0.53, 0.53):
        for y in (-0.33, 0.33):
            box(c, "Stol_nogi", "Czarny_mat", x - 0.02, x + 0.02, y - 0.02, y + 0.02, 0, 0.72)


def chair(c):
    box(c, "Krzeslo_siedzisko", "Drewno", -0.22, 0.22, -0.21, 0.21, 0.44, 0.47, bevel=0.004)
    for x in (-0.19, 0.19):
        for y in (-0.18, 0.18):
            cyl(c, "Krzeslo_nogi", "Czarny_mat", (x, y, 0.22), 0.013, 0.44, segs=10)
        cyl(c, "Krzeslo_nogi", "Czarny_mat", (x, 0.18, 0.47 + 0.21), 0.011, 0.42, segs=10)
    box(c, "Krzeslo_oparcie", "Drewno", -0.21, 0.21, 0.17, 0.195, 0.66, 0.86, bevel=0.004)


def stool(c):
    cyl(c, "Hoker_siedzisko", "Drewno", (0, 0, 0.6575), 0.17, 0.035, segs=24)
    for x in (-0.12, 0.12):
        for y in (-0.12, 0.12):
            cyl(c, "Hoker_nogi", "Czarny_mat", (x, y, 0.32), 0.012, 0.64, segs=10)
    for (xa, xb, ya, yb) in ((-0.12, 0.12, -0.126, -0.114), (-0.12, 0.12, 0.114, 0.126), (-0.126, -0.114, -0.12, 0.12), (0.114, 0.126, -0.12, 0.12)):
        box(c, "Hoker_nogi", "Czarny_mat", xa, xb, ya, yb, 0.245, 0.257)


def shelf(c, L=0.8):
    box(c, "Polka", "Drewno", 0, L, -0.25, 0, 0, 0.025, bevel=0.002)
    for x in (0.1, L - 0.1):
        box(c, "Polka_wsporniki", "Czarny_mat", x - 0.015, x + 0.015, -0.004, 0, -0.15, 0)
        box(c, "Polka_wsporniki", "Czarny_mat", x - 0.015, x + 0.015, -0.2, 0, -0.004, 0)


def pendant(c):
    cyl(c, "Lampa_rozeta", "Klosz", (0, 0, -0.01), 0.06, 0.02, segs=20)
    cyl(c, "Lampa_przewod", "Czarny_mat", (0, 0, -0.02 - 0.4), 0.002, 0.8, segs=6)
    cyl(c, "Lampa_klosz", "Klosz", (0, 0, -0.82 - 0.1), 0.17, 0.2, segs=28, r2=0.035)
    sphere(c, "Zarowka", "Zarowka", (0, 0, -1.03), 0.04)


def fridge(c):
    box(c, "Lodowka_obudowa", "Bialy_AGD", 0, 0.6, -0.6, 0, 0.0, 1.85, bevel=0.008)
    box(c, "Lodowka_drzwi", "Stal", 0.002, 0.598, -0.66, -0.6, 0.08, 0.695, bevel=0.006)
    box(c, "Lodowka_drzwi", "Stal", 0.002, 0.598, -0.66, -0.6, 0.705, 1.848, bevel=0.006)
    for (za, zb) in ((0.45, 0.65), (0.75, 1.05)):
        box(c, "Lodowka_uchwyty", "Czarny_mat", 0.55, 0.565, -0.69, -0.675, za, zb, bevel=0.002)
        for z in (za + 0.01, zb - 0.01):
            box(c, "Lodowka_uchwyty", "Czarny_mat", 0.552, 0.563, -0.675, -0.66, z - 0.005, z + 0.005)
    box(c, "Lodowka_kratka", "Czarny_mat", 0.02, 0.58, -0.62, -0.6, 0.01, 0.07)


def side_panel(c):
    box(c, "Front_panel_boczny", "Front", 0, 0.018, -0.58, 0, 0, TOP, bevel=0.0015)

# ---------------------------------------------------------------- kuchnie (składanie)
def _M(loc, rot):
    return Matrix.Translation(loc) @ Matrix.Rotation(math.radians(rot), 4, "Z")


def place(k, builder, name, loc=(0, 0, 0), rot=0):
    c = Ctx(name, prefix=name + "_")
    builder(c)
    c.finish()
    c.root.parent = k.root
    c.root.location = loc
    c.root.rotation_euler = (0, 0, math.radians(rot))
    return c


def hole_in(sink_loc, sink_rot, top_loc, top_rot, pad=0.003):
    hx0, hx1, hy0, hy1 = SINK_HOLE
    Ms, Mb = _M(sink_loc, sink_rot), _M(top_loc, top_rot).inverted()
    pts = [Mb @ Ms @ Vector((x, y, 0)) for x in (hx0, hx1) for y in (hy0, hy1)]
    return (min(p.x for p in pts) - pad, max(p.x for p in pts) + pad, min(p.y for p in pts) - pad, max(p.y for p in pts) + pad)


def kitchen_straight(k):
    place(k, lambda c: tall_cab(c, 0.6, [(0.72, "door"), (1.35, "door")]), "E01_slupek_lodowka", (0, 0, 0))
    place(k, lambda c: base_cab(c, 0.8, 2, sink_cab=True), "E02_szafka_zlewowa_80", (0.6, 0, 0))
    place(k, dishwasher, "E03_zmywarka_60", (1.4, 0, 0))
    place(k, oven_cab, "E04_szafka_piekarnik_60", (2.0, 0, 0))
    place(k, lambda c: base_cab(c, 0.4, fracs=[0.25, 0.375, 0.375]), "E05_szafka_szuflady_40", (2.6, 0, 0))
    place(k, side_panel, "E06_panel_boczny", (3.0, 0, 0))
    s_loc = (0.61, 0, WORK)
    place(k, lambda c: worktop(c, 2.4, hole=hole_in(s_loc, 0, (0.6, 0, TOP), 0)), "E07_blat_240", (0.6, 0, TOP))
    place(k, sink, "E08_zlew", s_loc)
    place(k, cooktop_induction, "E09_plyta_indukcyjna", (2.0, 0, WORK))
    place(k, lambda c: wall_cab(c, 0.8, n=2), "E10_gorna_80", (0.6, 0, WALL_Z))
    place(k, lambda c: wall_cab(c, 0.6), "E11_gorna_60", (1.4, 0, WALL_Z))
    place(k, lambda c: wall_cab(c, 0.6, h=0.36, kind="flap"), "E12_gorna_nad_okap_60", (2.0, 0, WALL_Z + 0.36))
    place(k, hood_under, "E13_okap_podszafkowy", (2.0, 0, WALL_Z + 0.36 - 0.17))
    place(k, lambda c: wall_cab(c, 0.4, hand="L"), "E14_gorna_40", (2.6, 0, WALL_Z))


def kitchen_L(k):
    place(k, lambda c: corner_cab(c, 0.9, BD, PL, BH), "E01_szafka_narozna_90", (0, 0, 0))
    place(k, oven_cab, "E02_szafka_piekarnik_60", (0.9, 0, 0))
    place(k, lambda c: base_cab(c, 0.6, fracs=[0.25, 0.375, 0.375]), "E03_szafka_szuflady_60", (1.5, 0, 0))
    place(k, lambda c: tall_cab(c, 0.6, [(0.72, "door"), (1.35, "door")]), "E04_slupek_lodowka", (2.1, 0, 0))
    place(k, lambda c: base_cab(c, 0.8, 2, sink_cab=True), "E05_szafka_zlewowa_80", (0, -1.7, 0), 90)
    place(k, dishwasher, "E06_zmywarka_60", (0, -2.3, 0), 90)
    place(k, lambda c: base_cab(c, 0.45, 1, hand="L"), "E07_szafka_45", (0, -2.75, 0), 90)
    place(k, side_panel, "E08_panel_boczny", (0, -2.768, 0), 90)
    place(k, lambda c: worktop(c, 2.1), "E09_blat_tyl", (0, 0, TOP))
    s_loc, t_loc = (0.05, -1.69, WORK), (0, -2.75, TOP)
    place(k, lambda c: worktop(c, 2.15, hole=hole_in(s_loc, 90, t_loc, 90)), "E10_blat_bok", t_loc, 90)
    place(k, sink, "E11_zlew", s_loc, 90)
    place(k, cooktop_induction, "E12_plyta_indukcyjna", (0.9, 0, WORK))
    place(k, hood_chimney, "E13_okap_kominowy", (0.9, 0, WORK + 0.65))
    place(k, lambda c: corner_cab(c, 0.6, WD, 0, WH, wall=True), "E14_gorna_narozna_60", (0, 0, WALL_Z))
    place(k, lambda c: wall_cab(c, 0.3), "E15_gorna_30", (0.6, 0, WALL_Z))
    place(k, lambda c: wall_cab(c, 0.6, hand="L"), "E16_gorna_60", (1.5, 0, WALL_Z))


def kitchen_island(k):
    place(k, lambda c: tall_cab(c, 0.6, [(0.30, "drawer"), (0.60, "oven"), (0.385, "micro"), (0.785, "door")]), "E01_slupek_piekarnik", (0, 0, 0))
    place(k, lambda c: tall_cab(c, 0.6, [(1.27, "door"), (0.80, "door")], hand="L"), "E02_slupek_spizarnia", (0.6, 0, 0))
    place(k, lambda c: tall_cab(c, 0.6, [(0.72, "door"), (1.35, "door")]), "E03_slupek_lodowka", (1.2, 0, 0))
    place(k, lambda c: base_cab(c, 0.8, 2, sink_cab=True), "E04_szafka_zlewowa_80", (1.8, 0, 0))
    place(k, dishwasher, "E05_zmywarka_60", (2.6, 0, 0))
    place(k, lambda c: base_cab(c, 0.6, 1), "E06_szafka_60", (3.2, 0, 0))
    place(k, side_panel, "E07_panel_boczny", (3.8, 0, 0))
    s_loc = (1.81, 0, WORK)
    place(k, lambda c: worktop(c, 2.0, hole=hole_in(s_loc, 0, (1.8, 0, TOP), 0)), "E08_blat", (1.8, 0, TOP))
    place(k, sink, "E09_zlew", s_loc)
    place(k, lambda c: wall_cab(c, 0.8, n=2, kind="glass"), "E10_witryna_80", (1.8, 0, WALL_Z))
    place(k, lambda c: wall_cab(c, 0.6), "E11_gorna_60", (2.6, 0, WALL_Z))
    place(k, lambda c: wall_cab(c, 0.6, kind="flap"), "E12_gorna_klapa_60", (3.2, 0, WALL_Z))
    for i, x in enumerate((2.1, 2.7, 3.3)):
        place(k, lambda c: base_cab(c, 0.6, fracs=[0.25, 0.375, 0.375]), f"E{13 + i}_wyspa_szuflady_60", (x, -2.6, 0), 180)
    box(k, "Front_wyspa_tyl", "Front", 1.5, 3.3, -2.618, -2.6, 0, TOP)
    box(k, "Front_wyspa_bok_L", "Front", 1.482, 1.5, -2.618, -2.0, 0, TOP)
    box(k, "Front_wyspa_bok_P", "Front", 3.3, 3.318, -2.618, -2.0, 0, TOP)
    place(k, lambda c: worktop(c, 2.0, D=1.0), "E16_blat_wyspa", (1.4, -2.0, TOP))
    place(k, cooktop_induction, "E17_plyta_indukcyjna", (2.1, -2.0, WORK))
    place(k, hood_island, "E18_okap_wyspowy", (1.95, -2.0, WORK + 0.7))
    place(k, stool, "E19_hoker", (2.1, -2.8, 0))
    place(k, stool, "E20_hoker", (2.9, -2.8, 0))


def kitchenette(k):
    place(k, lambda c: base_cab(c, 0.4, fracs=[0.25, 0.375, 0.375]), "E01_szafka_szuflady_40", (0, 0, 0))
    place(k, lambda c: base_cab(c, 0.8, 2, sink_cab=True), "E02_szafka_zlewowa_80", (0.4, 0, 0))
    place(k, oven_cab, "E03_szafka_piekarnik_60", (1.2, 0, 0))
    place(k, lambda c: base_cab(c, 0.6, 1), "E04_szafka_60", (1.8, 0, 0))
    s_loc = (0.41, 0, WORK)
    place(k, lambda c: worktop(c, 2.4, hole=hole_in(s_loc, 0, (0, 0, TOP), 0)), "E05_blat_240", (0, 0, TOP))
    place(k, sink, "E06_zlew", s_loc)
    place(k, cooktop_induction, "E07_plyta_indukcyjna", (1.2, 0, WORK))
    place(k, lambda c: wall_cab(c, 0.4, hand="L"), "E08_gorna_40", (0, 0, WALL_Z))
    place(k, lambda c: wall_cab(c, 0.8, n=2), "E09_gorna_80", (0.4, 0, WALL_Z))
    place(k, lambda c: wall_cab(c, 0.6, h=0.36, kind="flap"), "E10_gorna_nad_okap_60", (1.2, 0, WALL_Z + 0.36))
    place(k, hood_under, "E11_okap_podszafkowy", (1.2, 0, WALL_Z + 0.36 - 0.17))
    place(k, lambda c: wall_cab(c, 0.6, kind="flap"), "E12_gorna_klapa_60", (1.8, 0, WALL_Z))
    place(k, lambda c: shelf(c, 0.8), "E13_polka", (0.4, 0, WALL_Z - 0.25))

# ---------------------------------------------------------------- katalog 50 modeli
F3 = [0.25, 0.375, 0.375]
MODELS = [
    # id, nazwa, kategoria, budowniczy
    ("szafka_dolna_30", "Szafka dolna 30 cm", "Szafki dolne", lambda c: base_cab(c, 0.3, 1)),
    ("szafka_dolna_40", "Szafka dolna 40 cm", "Szafki dolne", lambda c: base_cab(c, 0.4, 1)),
    ("szafka_dolna_45", "Szafka dolna 45 cm", "Szafki dolne", lambda c: base_cab(c, 0.45, 1)),
    ("szafka_dolna_60", "Szafka dolna 60 cm", "Szafki dolne", lambda c: base_cab(c, 0.6, 1)),
    ("szafka_dolna_80", "Szafka dolna 80 cm, 2 drzwi", "Szafki dolne", lambda c: base_cab(c, 0.8, 2)),
    ("szafka_dolna_90", "Szafka dolna 90 cm, 2 drzwi", "Szafki dolne", lambda c: base_cab(c, 0.9, 2)),
    ("szafka_szuflady_40", "Szafka 40 cm, 3 szuflady", "Szafki dolne", lambda c: base_cab(c, 0.4, fracs=F3)),
    ("szafka_szuflady_60", "Szafka 60 cm, 3 szuflady", "Szafki dolne", lambda c: base_cab(c, 0.6, fracs=F3)),
    ("szafka_szuflady_80", "Szafka 80 cm, 2 szuflady", "Szafki dolne", lambda c: base_cab(c, 0.8, fracs=[0.5, 0.5])),
    ("szafka_zlewowa_80", "Szafka zlewowa 80 cm", "Szafki dolne", lambda c: base_cab(c, 0.8, 2, sink_cab=True)),
    ("szafka_cargo_20", "Cargo 20 cm", "Szafki dolne", lambda c: base_cab(c, 0.2, fracs=[1.0])),
    ("szafka_narozna_90", "Szafka narożna 90×90 cm", "Szafki dolne", lambda c: corner_cab(c, 0.9, BD, PL, BH)),
    ("szafka_piekarnik_60", "Szafka pod piekarnik 60 cm (z piekarnikiem)", "Szafki dolne", oven_cab),
    ("zmywarka_zabudowa_60", "Zmywarka w zabudowie 60 cm (z frontem)", "Szafki dolne", dishwasher),
    ("szafka_gorna_30", "Szafka górna 30 cm", "Szafki górne", lambda c: wall_cab(c, 0.3)),
    ("szafka_gorna_40", "Szafka górna 40 cm", "Szafki górne", lambda c: wall_cab(c, 0.4)),
    ("szafka_gorna_60", "Szafka górna 60 cm", "Szafki górne", lambda c: wall_cab(c, 0.6)),
    ("szafka_gorna_80", "Szafka górna 80 cm, 2 drzwi", "Szafki górne", lambda c: wall_cab(c, 0.8, n=2)),
    ("szafka_gorna_klapa_60", "Szafka górna 60 cm z klapą", "Szafki górne", lambda c: wall_cab(c, 0.6, kind="flap")),
    ("witryna_80", "Witryna 80 cm (szkło)", "Szafki górne", lambda c: wall_cab(c, 0.8, n=2, kind="glass")),
    ("szafka_gorna_narozna_60", "Szafka górna narożna 60×60 cm", "Szafki górne", lambda c: corner_cab(c, 0.6, WD, 0, WH, wall=True)),
    ("szafka_nad_okap_60", "Szafka nad okap 60 cm (36 cm)", "Szafki górne", lambda c: wall_cab(c, 0.6, h=0.36, kind="flap")),
    ("slupek_piekarnik_mikrofala_60", "Słupek 60 cm: piekarnik + mikrofala", "Słupki", lambda c: tall_cab(c, 0.6, [(0.30, "drawer"), (0.60, "oven"), (0.385, "micro"), (0.785, "door")])),
    ("slupek_lodowka_60", "Słupek 60 cm pod lodówkę w zabudowie", "Słupki", lambda c: tall_cab(c, 0.6, [(0.72, "door"), (1.35, "door")])),
    ("slupek_cargo_30", "Słupek cargo 30 cm", "Słupki", lambda c: tall_cab(c, 0.3, [(2.07, "door")])),
    ("slupek_spizarnia_60", "Słupek spiżarnia 60 cm", "Słupki", lambda c: tall_cab(c, 0.6, [(1.27, "door"), (0.80, "door")])),
    ("blat_60", "Blat 60 cm", "Blaty", lambda c: worktop(c, 0.6)),
    ("blat_120", "Blat 120 cm", "Blaty", lambda c: worktop(c, 1.2)),
    ("blat_180", "Blat 180 cm", "Blaty", lambda c: worktop(c, 1.8)),
    ("blat_240", "Blat 240 cm", "Blaty", lambda c: worktop(c, 2.4)),
    ("blat_wyspa_200", "Blat wyspy 200×100 cm", "Blaty", lambda c: worktop(c, 2.0, D=1.0)),
    ("lodowka_wolnostojaca", "Lodówka wolnostojąca 60 cm", "AGD", fridge),
    ("piekarnik_60", "Piekarnik 60 cm", "AGD", lambda c: oven(c, 0, 0, -0.55)),
    ("mikrofala_zabudowa", "Mikrofala do zabudowy", "AGD", lambda c: microwave(c, 0, 0, -0.42)),
    ("plyta_indukcyjna_60", "Płyta indukcyjna 60 cm", "AGD", cooktop_induction),
    ("plyta_gazowa_60", "Płyta gazowa 60 cm", "AGD", cooktop_gas),
    ("okap_kominowy_60", "Okap kominowy 60 cm", "AGD", hood_chimney),
    ("okap_wyspowy_90", "Okap wyspowy 90 cm", "AGD", hood_island),
    ("okap_podszafkowy_60", "Okap podszafkowy 60 cm", "AGD", hood_under),
    ("zlew_z_bateria", "Zlew 1-komorowy z ociekaczem i baterią", "AGD", sink),
    ("stol_120", "Stół 120×80 cm", "Meble i dodatki", table),
    ("krzeslo", "Krzesło", "Meble i dodatki", chair),
    ("hoker", "Hoker barowy", "Meble i dodatki", stool),
    ("polka_scienna_80", "Półka ścienna 80 cm", "Meble i dodatki", shelf),
    ("lampa_wiszaca", "Lampa wisząca", "Meble i dodatki", pendant),
    ("panel_boczny", "Panel boczny (blenda) 58×82 cm", "Meble i dodatki", side_panel),
    ("kuchnia_prosta_360", "Kuchnia prosta 360 cm (komplet)", "Kuchnie", kitchen_straight),
    ("kuchnia_L", "Kuchnia w L (komplet)", "Kuchnie", kitchen_L),
    ("kuchnia_z_wyspa", "Kuchnia z wyspą (komplet)", "Kuchnie", kitchen_island),
    ("aneks_240", "Aneks kuchenny 240 cm (komplet)", "Kuchnie", kitchenette),
]
assert len(MODELS) == 50, len(MODELS)

ROLE_BY_MAT = {"Front": "front", "Blat": "blat", "Uchwyt": "uchwyt"}

# ---------------------------------------------------------------- eksport
def _gltf_kwargs(path):
    want = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
                export_cameras=False, export_lights=False, export_animations=False,
                export_draco_mesh_compression_enable=False, export_extras=False)
    try:
        props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
        return {k: v for k, v in want.items() if k in props}
    except Exception:
        return want


def clear_generated():
    for ob in list(COL.objects):
        data = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if data is not None and data.users == 0:
            bpy.data.meshes.remove(data)


def build(entry):
    mid, name, cat, fn = entry
    root_name = mid[0].upper() + mid[1:]
    k = Ctx(root_name)
    fn(k)
    k.finish()
    bpy.context.view_layer.update()
    return k


def stats():
    mn, mx = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    tris, tags = 0, {}
    for ob in COL.objects:
        if ob.type != "MESH":
            continue
        mw = ob.matrix_world
        for v in ob.data.vertices:
            p = mw @ v.co
            mn = Vector(map(min, mn, p))
            mx = Vector(map(max, mx, p))
        tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
        mat = ob.data.materials[0].name if ob.data.materials else ""
        role = ROLE_BY_MAT.get(mat.split(".")[0])
        if role:
            tags[ob.name] = role
    size = mx - mn
    return dict(szerokosc_cm=round(size.x * 100, 1), glebokosc_cm=round(size.y * 100, 1), wysokosc_cm=round(size.z * 100, 1),
                trojkaty=tris, tags=dict(sorted(tags.items())))


def export_all(render_cb=None, only=None):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    catalog = []
    for i, entry in enumerate(MODELS, 1):
        mid, name, cat, fn = entry
        if only and mid not in only:
            continue
        clear_generated()
        build(entry)
        st = stats()
        for ob in COL.objects:
            ob.select_set(True)
        fname = f"{i:02d}_{mid}.glb"
        path = os.path.join(MODEL_DIR, fname)
        bpy.ops.export_scene.gltf(**_gltf_kwargs(path))
        for ob in COL.objects:
            ob.select_set(False)
        if render_cb:
            render_cb(i, mid)
        catalog.append(dict(nr=i, id=mid, plik=f"modele/{fname}", nazwa=name, kategoria=cat,
                            rozmiar_kb=round(os.path.getsize(path) / 1024, 1), **st))
    clear_generated()
    return catalog


def write_catalog(catalog):
    with open(os.path.join(OUT_DIR, "katalog.json"), "w", encoding="utf-8") as f:
        json.dump(dict(wersja=1, jednostki="metry w pliku, cm w katalogu", modele=catalog), f, ensure_ascii=False, indent=2)


if __name__ == "__main__" and not globals().get("NO_AUTORUN"):
    cat = export_all()
    write_catalog(cat)
    result = dict(ok=True, out=OUT_DIR, count=len(cat), max_kb=max(c["rozmiar_kb"] for c in cat), total_kb=round(sum(c["rozmiar_kb"] for c in cat), 1))
    print(json.dumps(result))


# ================= meble =================
# Szafki, szafy i komody (GLB) – druga paczka do systemu ofertowania.
# Uruchamiane w przestrzeni nazw kuchnia_gen.py (box, cyl, carcass, handle_h, handle_v, faucet, corner_cab, place, MAT…).
# Układ jak w kuchni: metry, front patrzy na -Y, punkt zaczepienia lewy-tylny-dolny róg.
# Meble wiszące: z = 0 to spód mebla (wysokość montażu w katalogu).


def _recolor(name, hexc, r=None):
    m = MAT[name]
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    col = hex2rgb(hexc)
    bsdf.inputs["Base Color"].default_value = col
    if r is not None:
        bsdf.inputs["Roughness"].default_value = r
    m.diffuse_color = col


# Meble wolnostojące: korpus w jasnym dębie, fronty w złamanej bieli (oba da się zmienić w panelu: fronty).
_recolor("Korpus", "#cdb08a", 0.6)
_recolor("Front", "#eeeae3", 0.45)
for _n, _d in {"Lustro": dict(c="#dfe6ea", r=0.03, m=1.0), "Ceramika": dict(c="#f7f7f5", r=0.15)}.items():
    MAT[_n] = make_mat(_n, _d)

BASE_H = {"cokol": 0.08, "nogi": 0.16, "nogi_metal": 0.12, "rama": 0.10, "wiszaca": 0.0, "kolka": 0.07}


# ---------------------------------------------------------------- uchwyty
def uchwyt(c, styl, kind, xa, xb, za, zb, yface, side="R"):
    """kind: 'sz' (szuflada/klapa – poziomo) albo 'd' (drzwi – pionowo)."""
    if styl == "brak":
        return
    w, h = xb - xa, zb - za
    if kind == "sz":
        if styl == "profil":
            box(c, "Uchwyty", "Uchwyt", xa + 0.02, xb - 0.02, yface - 0.008, yface, zb - 0.016, zb)
        elif styl == "galka":
            xs = [(xa + xb) / 2] if w < 0.7 else [xa + w / 4, xb - w / 4]
            for x in xs:
                cyl(c, "Uchwyty", "Uchwyt", (x, yface - 0.013, zb - min(0.06, h / 2)), 0.015, 0.026, axis="Y", segs=16)
        else:
            handle_h(c, (xa + xb) / 2, yface, zb - min(0.05, h / 2), min(0.32, w * 0.5))
        return
    x = xb - 0.035 if side == "R" else xa + 0.035
    if styl == "profil":
        x0 = xb - 0.016 if side == "R" else xa
        box(c, "Uchwyty", "Uchwyt", x0, x0 + 0.016, yface - 0.008, yface, za + 0.02, zb - 0.02)
        return
    if h > 1.2:
        zc = min(1.05, (za + zb) / 2)
    elif zb > 1.3:
        zc = za + 0.06 + 0.08
    else:
        zc = zb - 0.06 - 0.08
    if styl == "galka":
        cyl(c, "Uchwyty", "Uchwyt", (x, yface - 0.013, zc), 0.015, 0.026, axis="Y", segs=16)
    elif styl == "dluga":
        L = min(h * 0.7, 1.0)
        handle_v(c, x, yface, min(max(zc, za + L / 2 + 0.05), zb - L / 2 - 0.05), L)
    else:
        handle_v(c, x, yface, zc, 0.16)


# ---------------------------------------------------------------- fronty w siatce
def _cell(c, kind, xa, xb, za, zb, yb, styl, idx, side):
    yf = yb - FT
    a, b, p, q = xa + G / 2, xb - G / 2, za + G / 2, zb - G / 2
    if kind == "o":
        return
    if kind in ("sz", "kl"):
        nm = "szuflada" if kind == "sz" else "klapa"
        box(c, f"Front_{nm}_{idx}", "Front", a, b, yf, yb, p, q, bevel=0.0015)
        uchwyt(c, styl, "sz", a, b, p, q, yf)
    elif kind in ("d", "lu"):
        box(c, f"Front_drzwi_{idx}", "Front", a, b, yf, yb, p, q, bevel=0.0015)
        if kind == "lu":
            box(c, f"Lustro_{idx}", "Lustro", a + 0.03, b - 0.03, yf - 0.003, yf, p + 0.03, q - 0.03)
        uchwyt(c, styl, "d", a, b, p, q, yf, side)
    elif kind == "g":
        s = 0.05
        nm = f"Front_witryna_{idx}"
        box(c, nm, "Front", a, a + s, yf, yb, p, q)
        box(c, nm, "Front", b - s, b, yf, yb, p, q)
        box(c, nm, "Front", a + s, b - s, yf, yb, p, p + s)
        box(c, nm, "Front", a + s, b - s, yf, yb, q - s, q)
        box(c, f"Szklo_{idx}", "Szklo", a + s, b - s, yb - FT * 0.6, yb - FT * 0.4, p + s, q - s)
        uchwyt(c, styl, "d", a, b, p, q, yf, side)


def fronty(c, w, d, za, zb, cols, styl):
    """cols: [(udział szerokości, [(rodzaj, udział wysokości) od góry…]), …]
    rodzaje: sz szuflada, kl klapa, d drzwi, lu drzwi z lustrem, g drzwi szklane, o otwarta półka."""
    tot = sum(f for f, _ in cols)
    tylko_drzwi = all(k in ("d", "lu", "g") for _, cells in cols for k, _ in cells)
    x = 0.0
    n = 0
    for ci, (fw, cells) in enumerate(cols):
        xb = x + w * fw / tot
        if ci > 0:
            box(c, "Korpus", "Korpus", x - T / 2, x + T / 2, -d, -0.006, za, zb)
        if tylko_drzwi and len(cols) > 1:
            side = "L" if ci % 2 else "R"
        else:
            side = "R" if (x + xb) / 2 <= w / 2 + 1e-6 else "L"
        tc = sum(f for _, f in cells)
        z = zb
        for k, (kind, fh) in enumerate(cells):
            z0 = z - (zb - za) * fh / tc
            n += 1
            _cell(c, kind, x, xb, z0, z, -d, styl, n, side)
            nxt = cells[k + 1][0] if k + 1 < len(cells) else None
            if k + 1 < len(cells) and (kind in ("o", "g") or nxt in ("o", "g")):
                box(c, "Korpus", "Korpus", x + (T / 2 if ci else T), xb - (T / 2 if ci < len(cols) - 1 else T), -d + 0.01, -0.006, z0 - T / 2, z0 + T / 2)
            z = z0
        x = xb


def baza(c, typ, w, d):
    h = BASE_H[typ]
    if typ == "cokol":
        box(c, "Cokol", "Cokol", 0.02, w - 0.02, -d + 0.03, -d + 0.046, 0, h - 0.002)
        box(c, "Cokol", "Cokol", 0.02, w - 0.02, -0.03, -0.014, 0, h - 0.002)
    elif typ == "nogi":
        for x in (0.05, w - 0.05):
            for y in (-d + 0.05, -0.05):
                cyl(c, "Nogi", "Drewno", (x, y, h / 2), 0.013, h, segs=12, r2=0.021)
    elif typ == "nogi_metal":
        for x in (0.03, w - 0.03):
            for y in (-d + 0.03, -0.03):
                box(c, "Nogi", "Czarny_mat", x - 0.0125, x + 0.0125, y - 0.0125, y + 0.0125, 0, h)
    elif typ == "rama":
        for x in (0.01, w - 0.01):
            for y in (-d + 0.01, -0.01):
                box(c, "Rama", "Czarny_mat", x - 0.01, x + 0.01, y - 0.01, y + 0.01, 0, h)
        box(c, "Rama", "Czarny_mat", 0, w, -d, -d + 0.02, h - 0.02, h)
        box(c, "Rama", "Czarny_mat", 0, w, -0.02, 0, h - 0.02, h)
        box(c, "Rama", "Czarny_mat", 0, 0.02, -d, 0, h - 0.02, h)
        box(c, "Rama", "Czarny_mat", w - 0.02, w, -d, 0, h - 0.02, h)
    elif typ == "kolka":
        for x in (0.05, w - 0.05):
            for y in (-d + 0.05, -0.05):
                cyl(c, "Kolka", "Czarny_mat", (x, y, 0.028), 0.028, 0.022, axis="X", segs=14)
                box(c, "Kolka", "Czarny_mat", x - 0.015, x + 0.015, y - 0.015, y + 0.015, 0.05, h)


def mebel(c, w, h, d, cols, styl="bar", typ_bazy="cokol", wierzch=True, wierzch_mat="Korpus", polki=()):
    bh = BASE_H[typ_bazy]
    tt = 0.025 if wierzch else 0.0
    zt = h - tt
    carcass(c, w, d, bh, zt - bh, shelves=polki)
    if wierzch:
        nm = "Blat" if wierzch_mat == "Blat" else "Wierzch"
        box(c, nm, wierzch_mat, -0.006, w + 0.006, -d - FT - 0.006, 0, zt, h, bevel=0.003)
    if bh:
        baza(c, typ_bazy, w, d)
    fronty(c, w, d, bh, zt, cols, styl)


S = lambda n: [("sz", 1)] * n


def G_(n):
    """Szuflady rosnące ku dołowi (jak w komodach z gradientem)."""
    return [("sz", 1 + 0.25 * i) for i in range(n)]


# ---------------------------------------------------------------- szafy
def szafa(c, w, h, n, d=0.58, nad=0.0, szuflady=0, lustra=(), styl="dluga", typ_bazy="cokol", otwarte=()):
    cols = []
    for i in range(n):
        cells = []
        if nad:
            cells.append(("kl", nad))
        if i in otwarte:
            cells += [("o", 0.25)] * 4
        else:
            cells.append(("lu" if i in lustra else "d", 1.0 - (0.18 if szuflady else 0) - nad))
        if szuflady and i not in otwarte:
            cells += [("sz", 0.18 / szuflady)] * szuflady
        cols.append((1, cells))
    mebel(c, w, h, d, cols, styl, typ_bazy, wierzch=False, polki=(h - 0.35,))
    # drążek w środku (widać przez otwarte kolumny)
    cyl(c, "Drazek", "Stal", (w / 2, -d / 2, h - 0.42), 0.012, w - 2 * T, axis="X", segs=12)


def szafa_przesuwna(c, w, h, n, lustra=(), d=0.62, wnekowa=False):
    dk = d - 0.07
    bh = 0.08
    carcass(c, w, dk, bh, h - bh, shelves=(h - 0.4,))
    if not wnekowa:
        baza(c, "cokol", w, dk)
    cyl(c, "Drazek", "Stal", (w / 2, -dk / 2, h - 0.48), 0.012, w - 2 * T, axis="X", segs=12)
    for i in range(1, n):
        box(c, "Korpus", "Korpus", i * w / n - T / 2, i * w / n + T / 2, -dk, -0.006, bh + T, h - T)
    box(c, "Prowadnice", "Stal", 0, w, -d, -dk, h - 0.035, h)
    box(c, "Prowadnice", "Stal", 0, w, -d, -dk, bh - 0.01, bh + 0.004)
    ov = 0.03
    for i in range(n):
        xa = max(0.0, i * w / n - ov / 2)
        xb = min(w, (i + 1) * w / n + ov / 2)
        y0, y1 = (-dk - 0.062, -dk - 0.044) if i % 2 == 0 else (-dk - 0.035, -dk - 0.017)
        za, zb = bh + 0.006, h - 0.036
        if i in lustra:
            box(c, f"Lustro_{i + 1}", "Lustro", xa + 0.02, xb - 0.02, y0, y1, za + 0.015, zb - 0.015)
        else:
            box(c, f"Front_panel_{i + 1}", "Front", xa + 0.02, xb - 0.02, y0, y1, za + 0.015, zb - 0.015)
        # profile aluminiowe (rola uchwytu: kolor jak okucia)
        for x in (xa, xb - 0.02):
            box(c, "Uchwyty", "Uchwyt", x, x + 0.02, y0 - 0.004, y1 + 0.002, za, zb)
        box(c, "Uchwyty", "Uchwyt", xa + 0.02, xb - 0.02, y0 - 0.002, y1, zb - 0.015, zb)
        box(c, "Uchwyty", "Uchwyt", xa + 0.02, xb - 0.02, y0 - 0.002, y1, za, za + 0.015)


def garderoba(c, segs, h=2.1, d=0.5):
    w = sum(s for s, _ in segs)
    bh = 0.08
    k = "Korpus"
    box(c, k, k, -0.009, w + 0.009, -d, 0, h - T, h)  # wieniec górny
    baza(c, "cokol", w, d)
    box(c, k, k, 0, w, -0.006, -0.002, bh, h - T)  # plecy
    x = 0.0
    sides = [0.0]
    for sw, _ in segs:
        x += sw
        sides.append(x)
    for sx in sides:
        box(c, k, k, sx - T / 2, sx + T / 2, -d, 0, bh, h - T)
    box(c, k, k, 0, w, -d, 0, bh, bh + T)
    n = 0
    for i, (sw, typ) in enumerate(segs):
        xa, xb = sides[i] + T / 2, sides[i + 1] - T / 2
        if typ in ("drazek", "drazek2"):
            box(c, k, k, xa, xb, -d + 0.01, -0.006, h - 0.36, h - 0.36 + T)
            cyl(c, "Drazki", "Stal", ((xa + xb) / 2, -d / 2, h - 0.43), 0.012, xb - xa, axis="X", segs=12)
            if typ == "drazek2":
                box(c, k, k, xa, xb, -d + 0.01, -0.006, 1.05, 1.05 + T)
                cyl(c, "Drazki", "Stal", ((xa + xb) / 2, -d / 2, 0.98), 0.012, xb - xa, axis="X", segs=12)
        elif typ == "polki":
            for z in (0.45, 0.8, 1.15, 1.5, h - 0.36):
                box(c, k, k, xa, xb, -d + 0.01, -0.006, z, z + T)
        elif typ == "szuflady":
            for z in (0.62, 0.97, 1.32, h - 0.36):
                box(c, k, k, xa, xb, -d + 0.01, -0.006, z, z + T)
            hz = (0.6 - bh - T) / 3
            for j in range(3):
                n += 1
                za = bh + T + j * hz
                box(c, f"Front_szuflada_{n}", "Front", xa + G / 2, xb - G / 2, -d - FT, -d, za + G / 2, za + hz - G / 2, bevel=0.0015)
                uchwyt(c, "bar", "sz", xa, xb, za, za + hz, -d - FT)
        elif typ == "buty":
            for z in (0.18, 0.4, 0.62, 1.2, 1.6, h - 0.36):
                box(c, k, k, xa, xb, -d + 0.01, -0.006, z, z + T)
                if z < 1:
                    box(c, "Listwy", "Stal", xa, xb, -d + 0.01, -d + 0.02, z + T, z + T + 0.03)


# ---------------------------------------------------------------- łazienka, przedpokój, dodatki
def umywalka(c, w, cols, styl="profil", h=0.5, d=0.46):
    mebel(c, w, h, d, cols, styl, "wiszaca", wierzch=True, wierzch_mat="Blat")
    bw, bd, bz = min(0.5, w - 0.14), 0.36, 0.13
    x0, y1 = (w - bw) / 2, -0.08
    y0 = y1 - bd
    t = 0.015
    u = "Umywalka"
    box(c, u, "Ceramika", x0, x0 + bw, y0, y1, h, h + t, bevel=0.004)
    box(c, u, "Ceramika", x0, x0 + t, y0, y1, h, h + bz)
    box(c, u, "Ceramika", x0 + bw - t, x0 + bw, y0, y1, h, h + bz)
    box(c, u, "Ceramika", x0 + t, x0 + bw - t, y0, y0 + t, h, h + bz)
    box(c, u, "Ceramika", x0 + t, x0 + bw - t, y1 - t, y1, h, h + bz)
    cyl(c, "Umywalka_odplyw", "Stal", (w / 2, (y0 + y1) / 2, h + t + 0.001), 0.022, 0.002, segs=16)
    faucet(c, w / 2, -0.04, h)


def lustro_na(c, x0, x1, z0, z1, y=-0.03):
    box(c, "Lustro_rama", "Front", x0, x1, y - 0.02, y, z0, z1, bevel=0.002)
    box(c, "Lustro", "Lustro", x0 + 0.03, x1 - 0.03, y - 0.022, y - 0.02, z0 + 0.03, z1 - 0.03)


def komoda(c, w, h, cols, styl="bar", typ_bazy="cokol", d=0.45, extra=None):
    mebel(c, w, h, d, cols, styl, typ_bazy)
    if extra == "przewijak":
        k = "Barierka"
        box(c, k, "Korpus", 0, w, -0.02, 0, h, h + 0.09, bevel=0.003)
        box(c, k, "Korpus", 0, 0.02, -d - FT, 0, h, h + 0.09, bevel=0.003)
        box(c, k, "Korpus", w - 0.02, w, -d - FT, 0, h, h + 0.09, bevel=0.003)
    elif extra == "lustro":
        mw = min(w * 0.8, 0.9)
        lustro_na(c, (w - mw) / 2, (w + mw) / 2, h + 0.03, h + 0.03 + 0.75)


def kredens(c, w=1.2):
    mebel(c, w, 0.85, 0.45, [(1, [("sz", 0.25), ("d", 0.75)]), (1, [("sz", 0.25), ("d", 0.75)]), (1, [("sz", 0.25), ("d", 0.75)])], "galka", "nogi")
    place(c, lambda s: mebel(s, w - 0.04, 1.05, 0.32, [(1, [("g", 1)]), (1, [("g", 1)])], "galka", "wiszaca", polki=(0.35, 0.7)), "Nadstawka", (0.02, -0.02, 0.85))


# ---------------------------------------------------------------- katalog: 50 szafek i szaf
D3 = lambda n: [(1, [("d", 1)])] * n
SZ = "Szafy"
SK = "Szafki"
SZAFY = [
    ("szafa_2d_100", "Szafa 2-drzwiowa 100 cm", SZ, lambda c: szafa(c, 1.0, 2.0, 2)),
    ("szafa_2d_100_lustro", "Szafa 2-drzwiowa 100 cm z lustrem", SZ, lambda c: szafa(c, 1.0, 2.0, 2, lustra=(1,))),
    ("szafa_3d_150", "Szafa 3-drzwiowa 150 cm", SZ, lambda c: szafa(c, 1.5, 2.1, 3)),
    ("szafa_3d_150_szuflady", "Szafa 3-drzwiowa 150 cm z szufladami", SZ, lambda c: szafa(c, 1.5, 2.1, 3, szuflady=2)),
    ("szafa_4d_200", "Szafa 4-drzwiowa 200 cm", SZ, lambda c: szafa(c, 2.0, 2.2, 4)),
    ("szafa_4d_200_nadstawka", "Szafa 4-drzwiowa 200 cm z nadstawką (240 cm)", SZ, lambda c: szafa(c, 2.0, 2.4, 4, nad=0.17)),
    ("szafa_5d_250", "Szafa 5-drzwiowa 250 cm, 2 lustra", SZ, lambda c: szafa(c, 2.5, 2.3, 5, lustra=(1, 3))),
    ("szafa_1d_50", "Szafa wąska 1-drzwiowa 50 cm", SZ, lambda c: szafa(c, 0.5, 2.0, 1)),
    ("szafa_przesuwna_150", "Szafa przesuwna 150 cm, 2 drzwi", SZ, lambda c: szafa_przesuwna(c, 1.5, 2.2, 2)),
    ("szafa_przesuwna_180_lustro", "Szafa przesuwna 180 cm z lustrem", SZ, lambda c: szafa_przesuwna(c, 1.8, 2.2, 2, lustra=(1,))),
    ("szafa_przesuwna_200", "Szafa przesuwna 200 cm, 2 drzwi", SZ, lambda c: szafa_przesuwna(c, 2.0, 2.3, 2)),
    ("szafa_przesuwna_250_3d", "Szafa przesuwna 250 cm, 3 drzwi", SZ, lambda c: szafa_przesuwna(c, 2.5, 2.4, 3)),
    ("szafa_przesuwna_250_lustra", "Szafa przesuwna 250 cm, 2 lustra", SZ, lambda c: szafa_przesuwna(c, 2.5, 2.4, 3, lustra=(0, 2))),
    ("szafa_wnekowa_300", "Szafa wnękowa 300 cm (do sufitu)", SZ, lambda c: szafa_przesuwna(c, 3.0, 2.6, 3, lustra=(1,), wnekowa=True)),
    ("szafa_narozna_100", "Szafa narożna 100×100 cm", SZ, lambda c: corner_cab(c, 1.0, 0.56, 0.10, 2.0)),
    ("szafa_dziecieca_100", "Szafa dziecięca 100 cm z szufladami", SZ, lambda c: szafa(c, 1.0, 1.6, 2, szuflady=1, styl="galka", typ_bazy="nogi")),
    ("szafa_nozki_100", "Szafa na nóżkach 100 cm", SZ, lambda c: szafa(c, 1.0, 1.9, 2, styl="galka", typ_bazy="nogi")),
    ("szafa_regal_120", "Szafa 120 cm z kolumną otwartych półek", SZ, lambda c: szafa(c, 1.2, 2.0, 3, otwarte=(2,))),
    ("garderoba_200", "Garderoba otwarta 200 cm", SZ, lambda c: garderoba(c, [(0.5, "polki"), (1.0, "drazek"), (0.5, "szuflady")])),
    ("garderoba_120", "Garderoba otwarta 120 cm, 2 drążki", SZ, lambda c: garderoba(c, [(0.7, "drazek2"), (0.5, "buty")])),
    ("szafa_przedpokoj_100", "Szafa do przedpokoju 100 cm (drzwi + półki)", SZ, lambda c: szafa(c, 1.0, 2.0, 2, otwarte=(1,), d=0.4)),
    ("szafa_bezuchwytowa_200", "Szafa bezuchwytowa 200 cm (push-to-open)", SZ, lambda c: szafa(c, 2.0, 2.3, 4, styl="brak")),
    ("szafa_profil_150", "Szafa 150 cm z uchwytem krawędziowym", SZ, lambda c: szafa(c, 1.5, 2.2, 3, styl="profil")),
    ("szafa_niska_80", "Szafa niska 80 cm (150 cm)", SZ, lambda c: szafa(c, 0.8, 1.5, 2, styl="bar", typ_bazy="nogi_metal")),
    ("nadstawka_200", "Nadstawka na szafę 200 cm", SZ, lambda c: mebel(c, 2.0, 0.4, 0.58, [(1, [("kl", 1)])] * 4, "dluga", "wiszaca", wierzch=False)),
    ("szafka_buty_60", "Szafka na buty 60 cm, 2 klapy", SK, lambda c: mebel(c, 0.6, 0.9, 0.24, [(1, [("kl", 1), ("kl", 1)])], "bar", "cokol")),
    ("szafka_buty_80", "Szafka na buty 80 cm, 3 klapy", SK, lambda c: mebel(c, 0.8, 1.2, 0.26, [(1, [("kl", 1)] * 3)], "galka", "nogi_metal")),
    ("szafka_buty_120", "Szafka na buty 120 cm, 4 klapy", SK, lambda c: mebel(c, 1.2, 0.9, 0.28, [(1, [("kl", 1)] * 2)] * 2, "profil", "nogi")),
    ("szafka_rtv_120", "Szafka RTV 120 cm", SK, lambda c: mebel(c, 1.2, 0.5, 0.42, [(1, [("kl", 1)]), (1, [("o", 1)]), (1, [("kl", 1)])], "brak", "nogi")),
    ("szafka_rtv_160", "Szafka RTV 160 cm z szufladami", SK, lambda c: mebel(c, 1.6, 0.5, 0.42, [(1, [("sz", 1)] * 2), (1.4, [("o", 1)]), (1, [("sz", 1)] * 2)], "bar", "cokol")),
    ("szafka_rtv_180_wiszaca", "Szafka RTV wisząca 180 cm", SK, lambda c: mebel(c, 1.8, 0.4, 0.38, [(1, [("kl", 1)])] * 3, "brak", "wiszaca")),
    ("szafka_rtv_200", "Szafka RTV 200 cm na nóżkach", SK, lambda c: mebel(c, 2.0, 0.55, 0.42, [(1, [("d", 1)]), (1, [("sz", 1), ("sz", 1)]), (1, [("sz", 1), ("sz", 1)]), (1, [("d", 1)])], "profil", "nogi_metal")),
    ("witryna_60", "Witryna 60 cm, 190 cm", SK, lambda c: mebel(c, 0.6, 1.9, 0.4, [(1, [("g", 0.7), ("sz", 0.15), ("sz", 0.15)])], "galka", "nogi", polki=(0.75, 1.1, 1.45))),
    ("witryna_100", "Witryna 100 cm, szkło + drzwi", SK, lambda c: mebel(c, 1.0, 1.8, 0.4, [(1, [("g", 0.6), ("d", 0.4)])] * 2, "bar", "cokol", polki=(1.0, 1.35))),
    ("regal_80", "Regał otwarty 80 cm", SK, lambda c: mebel(c, 0.8, 1.8, 0.32, [(1, [("o", 1)] * 5)], "brak", "cokol")),
    ("regal_40", "Regał wąski 40 cm", SK, lambda c: mebel(c, 0.4, 1.9, 0.3, [(1, [("o", 1)] * 6)], "brak", "nogi_metal")),
    ("regal_120_drzwi", "Regał 120 cm z drzwiami na dole", SK, lambda c: mebel(c, 1.2, 2.0, 0.36, [(1, [("o", 1), ("o", 1), ("o", 1), ("d", 1.6)])] * 2, "galka", "cokol")),
    ("kredens_120", "Kredens 120 cm z witryną", SK, lambda c: kredens(c, 1.2)),
    ("szafka_lazienkowa_60", "Szafka łazienkowa 60 cm z umywalką", SK, lambda c: umywalka(c, 0.6, [(1, [("d", 1)])] * 2, "profil")),
    ("szafka_lazienkowa_80", "Szafka łazienkowa 80 cm, 2 szuflady, umywalka", SK, lambda c: umywalka(c, 0.8, [(1, [("sz", 1), ("sz", 1)])], "bar")),
    ("slupek_lazienkowy_40", "Słupek łazienkowy 40 cm", SK, lambda c: mebel(c, 0.4, 1.6, 0.3, [(1, [("d", 0.75), ("sz", 0.25)])], "profil", "wiszaca")),
    ("szafka_lustrzana_60", "Szafka łazienkowa z lustrem 60 cm", SK, lambda c: mebel(c, 0.6, 0.7, 0.15, [(1, [("lu", 1)])] * 2, "brak", "wiszaca", wierzch=False, polki=(0.35,))),
    ("szafka_nocna_45", "Szafka nocna 45 cm z szufladą i półką", SK, lambda c: mebel(c, 0.45, 0.5, 0.4, [(1, [("sz", 0.4), ("o", 0.6)])], "galka", "nogi")),
    ("szafka_nocna_50", "Szafka nocna 50 cm, 2 szuflady", SK, lambda c: mebel(c, 0.5, 0.48, 0.4, [(1, [("sz", 1), ("sz", 1)])], "profil", "nogi_metal")),
    ("szafka_biurowa_80", "Szafka biurowa 80 cm", SK, lambda c: mebel(c, 0.8, 1.2, 0.42, D3(2), "bar", "cokol", polki=(0.45, 0.8))),
    ("szafka_aktowa_80", "Szafka na dokumenty 80 cm, 190 cm", SK, lambda c: mebel(c, 0.8, 1.9, 0.42, [(1, [("o", 0.35), ("o", 0.35), ("d", 1)])] * 2, "bar", "cokol")),
    ("kontenerek_40", "Kontenerek biurowy na kółkach", SK, lambda c: mebel(c, 0.4, 0.6, 0.5, [(1, [("sz", 0.25), ("sz", 0.25), ("sz", 0.5)])], "bar", "kolka")),
    ("szafka_wiszaca_80_klapa", "Szafka wisząca 80 cm z klapą", SK, lambda c: mebel(c, 0.8, 0.4, 0.32, [(1, [("kl", 1)])], "profil", "wiszaca")),
    ("szafka_wiszaca_120", "Szafka wisząca 120 cm, półka i drzwi", SK, lambda c: mebel(c, 1.2, 0.36, 0.3, [(2, [("o", 1)]), (1, [("d", 1)])], "brak", "wiszaca")),
    ("szafka_gospodarcza_60", "Szafka gospodarcza 60 cm, 180 cm", SK, lambda c: mebel(c, 0.6, 1.8, 0.5, [(1, [("d", 1)])] * 2, "bar", "cokol", polki=(0.5, 0.9, 1.3))),
]
assert len(SZAFY) == 50, len(SZAFY)

# ---------------------------------------------------------------- katalog: 50 komód
KO = "Komody"


def K(mid, nazwa, w, h, cols, styl, typ_bazy, extra=None, d=0.45):
    return (mid, nazwa, KO, lambda c: komoda(c, w, h, cols, styl, typ_bazy, d=d, extra=extra))


C = lambda *cells: (1, list(cells))
KOMODY = [
    K("komoda_40_3sz", "Komoda 40 cm, 3 szuflady", 0.4, 0.75, [C(*S(3))], "bar", "nogi"),
    K("komoda_40_5sz", "Komoda 40 cm, 5 szuflad (szuflandia)", 0.4, 1.1, [C(*S(5))], "galka", "cokol"),
    K("komoda_50_4sz", "Komoda 50 cm, 4 szuflady", 0.5, 0.9, [C(*S(4))], "profil", "cokol"),
    K("komoda_60_3sz", "Komoda 60 cm, 3 szuflady", 0.6, 0.8, [C(*S(3))], "bar", "nogi_metal"),
    K("komoda_60_4sz", "Komoda 60 cm, 4 szuflady", 0.6, 0.9, [C(*S(4))], "bar", "cokol"),
    K("komoda_60_5sz_wysoka", "Komoda wysoka 60 cm, 5 szuflad", 0.6, 1.2, [C(*S(5))], "galka", "cokol"),
    K("komoda_60_6sz_wysoka", "Komoda wysoka 60 cm, 6 szuflad, bezuchwytowa", 0.6, 1.35, [C(*S(6))], "brak", "nogi"),
    K("komoda_80_3sz", "Komoda 80 cm, 3 szuflady", 0.8, 0.8, [C(*S(3))], "galka", "nogi"),
    K("komoda_80_4sz", "Komoda 80 cm, 4 szuflady, rama", 0.8, 0.9, [C(*S(4))], "bar", "rama"),
    K("komoda_80_5sz", "Komoda 80 cm, 5 szuflad", 0.8, 1.05, [C(*S(5))], "profil", "cokol"),
    K("komoda_90_gradient", "Komoda 90 cm, szuflady stopniowane", 0.9, 0.85, [C(*G_(4))], "bar", "cokol"),
    K("komoda_100_2x3", "Komoda 100 cm, 2×3 szuflady", 1.0, 0.8, [C(*S(3))] * 2, "bar", "nogi"),
    K("komoda_100_2x4", "Komoda 100 cm, 2×4 szuflady", 1.0, 0.95, [C(*S(4))] * 2, "galka", "cokol"),
    K("komoda_100_3sz", "Komoda 100 cm, 3 szerokie szuflady", 1.0, 0.75, [C(*S(3))], "profil", "nogi_metal"),
    K("komoda_120_2x3", "Komoda 120 cm, 2×3 szuflady, rama", 1.2, 0.8, [C(*S(3))] * 2, "bar", "rama"),
    K("komoda_120_2x4", "Komoda 120 cm, 2×4 szuflady, bezuchwytowa", 1.2, 0.9, [C(*S(4))] * 2, "brak", "cokol"),
    K("komoda_120_drzwi_szuflady", "Komoda 120 cm: drzwi + 3 szuflady", 1.2, 0.85, [C(("d", 1)), C(*S(3))], "galka", "nogi"),
    K("komoda_120_2d_2sz", "Komoda 120 cm, 2 drzwi i 2 szuflady", 1.2, 0.85, [C(("sz", 0.25), ("d", 0.75))] * 2, "bar", "cokol"),
    K("komoda_140_3x3", "Komoda 140 cm, 3×3 szuflady", 1.4, 0.8, [C(*S(3))] * 3, "bar", "nogi"),
    K("komoda_140_nisza", "Komoda 140 cm z otwartą półką", 1.4, 0.8, [C(*S(3)), C(("o", 1), ("o", 1)), C(*S(3))], "profil", "nogi_metal"),
    K("komoda_140_d_sz_d", "Komoda 140 cm: drzwi, szuflady, drzwi", 1.4, 0.85, [C(("d", 1)), C(*S(3)), C(("d", 1))], "galka", "cokol"),
    K("komoda_150_3x3", "Komoda 150 cm, 3×3 szuflady, rama", 1.5, 0.8, [C(*S(3))] * 3, "brak", "rama"),
    K("komoda_160_2d_3sz", "Komoda 160 cm, 2 drzwi i 3 szuflady", 1.6, 0.85, [C(("d", 1)), C(("d", 1)), C(*S(3))], "bar", "cokol"),
    K("komoda_160_niska", "Komoda niska 160 cm, 3×2 szuflady", 1.6, 0.6, [C(*S(2))] * 3, "bar", "nogi"),
    K("komoda_160_4d", "Komoda 160 cm, 4 drzwi", 1.6, 0.8, [C(("d", 1))] * 4, "galka", "nogi_metal"),
    K("komoda_180_3d_3sz", "Komoda 180 cm, 3 drzwi z szufladami", 1.8, 0.85, [C(("sz", 0.28), ("d", 0.72))] * 3, "profil", "cokol"),
    K("komoda_180_4x3", "Komoda 180 cm, 4×3 szuflady", 1.8, 0.8, [C(*S(3))] * 4, "bar", "nogi"),
    K("komoda_180_d_sz_sz_d", "Komoda 180 cm: drzwi, 2×3 szuflady, drzwi", 1.8, 0.85, [C(("d", 1)), C(*S(3)), C(*S(3)), C(("d", 1))], "brak", "cokol"),
    K("komoda_200_4x3", "Komoda 200 cm, 4×3 szuflady, rama", 2.0, 0.8, [C(*S(3))] * 4, "bar", "rama"),
    K("komoda_200_4d_sz", "Komoda 200 cm, 4 drzwi z szufladami", 2.0, 0.85, [C(("sz", 0.28), ("d", 0.72))] * 4, "galka", "nogi"),
    K("komoda_200_wiszaca", "Komoda wisząca 200 cm, 3×2 szuflady", 2.0, 0.55, [C(*S(2))] * 3, "brak", "wiszaca", d=0.4),
    K("komoda_wiszaca_120", "Komoda wisząca 120 cm, 2×2 szuflady", 1.2, 0.5, [C(*S(2))] * 2, "profil", "wiszaca", d=0.4),
    K("komoda_wiszaca_160_klapy", "Komoda wisząca 160 cm, 3 klapy", 1.6, 0.4, [C(("kl", 1))] * 3, "brak", "wiszaca", d=0.38),
    K("komoda_wiszaca_80", "Komoda wisząca 80 cm, 2 szuflady", 0.8, 0.45, [C(*S(2))], "bar", "wiszaca", d=0.4),
    K("komoda_przewijak_80", "Komoda z przewijakiem 80 cm, 4 szuflady", 0.8, 0.9, [C(*S(4))], "galka", "cokol", extra="przewijak", d=0.5),
    K("komoda_przewijak_100", "Komoda z przewijakiem 100 cm, 2×3 szuflady", 1.0, 0.9, [C(*S(3))] * 2, "bar", "nogi", extra="przewijak", d=0.5),
    K("komoda_lustro_100", "Komoda 100 cm z lustrem", 1.0, 0.8, [C(*S(3))] * 2, "galka", "nogi", extra="lustro"),
    K("komoda_lustro_80", "Komoda 80 cm z lustrem, 4 szuflady", 0.8, 0.9, [C(*S(4))], "bar", "cokol", extra="lustro"),
    K("komoda_nisza_80", "Komoda 80 cm z niszą u góry", 0.8, 0.9, [C(("o", 1), *S(3))], "bar", "nogi_metal"),
    K("komoda_nisza_120", "Komoda 120 cm z niszami", 1.2, 0.9, [C(("o", 0.3), ("sz", 0.35), ("sz", 0.35))] * 2, "profil", "cokol"),
    K("komoda_witryna_120", "Komoda 120 cm z witrynami", 1.2, 0.85, [C(("g", 1)), C(*S(3)), C(("g", 1))], "galka", "nogi"),
    K("komoda_100_2d", "Komoda 100 cm, 2 drzwi", 1.0, 0.8, [C(("d", 1))] * 2, "galka", "cokol"),
    K("komoda_80_2d_sz", "Komoda 80 cm, szuflada i 2 drzwi", 0.8, 0.85, [C(("sz", 0.25), ("d", 0.75))] * 2, "bar", "nogi"),
    K("komoda_60_d_2sz", "Komoda 60 cm, 2 szuflady i drzwi", 0.6, 0.85, [C(("sz", 0.25), ("sz", 0.25), ("d", 0.5))], "profil", "cokol"),
    K("komoda_kolka_60", "Komoda 60 cm na kółkach, 4 szuflady", 0.6, 0.75, [C(*S(4))], "bar", "kolka"),
    K("komoda_45_7sz", "Szuflandia 45 cm, 7 szuflad", 0.45, 1.3, [C(*S(7))], "galka", "cokol", d=0.4),
    K("komoda_120_3sz_rama", "Komoda 120 cm, 3 szuflady, rama", 1.2, 0.75, [C(*S(3))], "galka", "rama"),
    K("komoda_140_2x4_frez", "Komoda 140 cm, 2×4 szuflady, uchwyt krawędziowy", 1.4, 0.95, [C(*S(4))] * 2, "profil", "nogi"),
    K("komoda_100_wysoka_2x5", "Komoda wysoka 100 cm, 2×5 szuflad", 1.0, 1.15, [C(*S(5))] * 2, "bar", "cokol"),
    K("komoda_220_bufet", "Bufet 220 cm, 4 drzwi z szufladami", 2.2, 0.8, [C(("sz", 0.3), ("d", 0.7))] * 4, "bar", "nogi_metal"),
]
assert len(KOMODY) == 50, len(KOMODY)


# ---------------------------------------------------------------- eksport szafek, szaf i komód
def export_meble():
    for o in list(bpy.context.view_layer.objects):
        if o:
            o.select_set(False)
    katalog = []
    for folder, lista in (("szafy-i-szafki", SZAFY), ("komody", KOMODY)):
        os.makedirs(os.path.join(OUT_DIR, folder), exist_ok=True)
        for i, (mid, name, cat, fn) in enumerate(lista, 1):
            clear_generated()
            build((mid, name, cat, fn))
            st = stats()
            for ob in COL.objects:
                ob.select_set(True)
            fname = f"{i:02d}_{mid}.glb"
            path = os.path.join(OUT_DIR, folder, fname)
            bpy.ops.export_scene.gltf(**_gltf_kwargs(path))
            for ob in COL.objects:
                ob.select_set(False)
            katalog.append(dict(nr=i, id=mid, plik=f"{folder}/{fname}", nazwa=name, kategoria=cat, rozmiar_kb=round(os.path.getsize(path) / 1024, 1), **st))
    clear_generated()
    with open(os.path.join(OUT_DIR, "katalog.json"), "w", encoding="utf-8") as f:
        json.dump(dict(wersja=1, jednostki="metry w pliku, cm w katalogu", modele=katalog), f, ensure_ascii=False, indent=2)
    return katalog


_kat = export_meble()
result = dict(ok=True, out=OUT_DIR, count=len(_kat))
print(json.dumps(result))
