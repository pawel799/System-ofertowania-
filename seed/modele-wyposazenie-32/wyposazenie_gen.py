# Generator 32 modeli wyposażenia (GLB): RTV, salon, sypialnia, biuro, AGD wolnostojące, łazienka, dekoracje.
# Uruchomienie: blender -b -P wyposazenie_gen.py -- <folder>   albo   python3 wyposazenie_gen.py <folder>  (pip install bpy)
# Z dopiskiem --miniatury renderuje też podglądy PNG do <folder>/miniatury (do public/biblioteka idą jako WebP 240 px).
# Korzysta z pomocników kuchnia_gen.py (box, cyl, sphere, oven, MAT…) – plik musi leżeć w ../modele-kuchnia-50/.
# Układ jak w pozostałych paczkach: metry, X = szerokość, front patrzy na -Y, Z = góra, zaczep: lewy-tylny-dolny róg.
# Modele są bez tekstur, napisów i znaków firmowych – same bryły i jednolite materiały.
import bpy, bmesh, math, os, json, sys
from mathutils import Matrix, Vector

_TU = os.path.dirname(os.path.abspath(__file__))
if "--" in sys.argv:
    _argv = sys.argv[sys.argv.index("--") + 1:]
else:
    _argv = [a for a in sys.argv[1:] if not a.startswith("-")]
OUT_DIR = _argv[0] if _argv else _TU
NO_AUTORUN = True
_SRC = os.path.join(_TU, "..", "modele-kuchnia-50", "kuchnia_gen.py")
exec(compile(open(_SRC, encoding="utf-8").read(), _SRC, "exec"), globals())
# kuchnia_gen zakłada folder „modele” – tu też.
MODEL_DIR = os.path.join(OUT_DIR, "modele")
os.makedirs(MODEL_DIR, exist_ok=True)

for _n, _d in {
    "Ekran":           dict(c="#060607", r=0.07),
    "Tkanina":         dict(c="#8f918d", r=0.95),
    "Tkanina_jasna":   dict(c="#cdc7ba", r=0.95),
    "Tkanina_ciemna":  dict(c="#3c3f42", r=0.9),
    "Tkanina_akcent":  dict(c="#6f8178", r=0.95),
    "Zielen":          dict(c="#44703f", r=0.75),
    "Doniczka":        dict(c="#cbc5b8", r=0.8),
    "Ziemia":          dict(c="#3a2e25", r=1.0),
    "Dywan":           dict(c="#bbb3a4", r=1.0),
    "Dywan_wzor":      dict(c="#9c9486", r=1.0),
    "Materac":         dict(c="#f1efea", r=0.9),
    "Posciel":         dict(c="#d9d5cb", r=0.95),
    "Poduszka":        dict(c="#f6f5f1", r=0.95),
    "Ceramika":        dict(c="#f7f7f5", r=0.15),
    "Lustro":          dict(c="#dfe6ea", r=0.03, m=1.0),
    "Zaslona":         dict(c="#dad5c9", r=0.95),
    "Abazur":          dict(c="#ebe4d4", r=0.9),
    "Plotno":          dict(c="#efece4", r=0.9),
    "Obraz_1":         dict(c="#c26d4b", r=0.85),
    "Obraz_2":         dict(c="#2f4a5a", r=0.85),
    "Obraz_3":         dict(c="#d9b26a", r=0.85),
}.items():
    MAT[_n] = make_mat(_n, _d)


def rbox(c, name, mat, size, loc, rot=(0, 0, 0), bevel=0.0):
    """Prostopadłościan o środku loc, obrócony o kąty Eulera XYZ [stopnie]."""
    b = c.bm(name, mat)
    R = Matrix.Rotation(math.radians(rot[2]), 4, "Z") @ Matrix.Rotation(math.radians(rot[1]), 4, "Y") @ Matrix.Rotation(math.radians(rot[0]), 4, "X")
    M = Matrix.Translation(loc) @ R @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
    r = bmesh.ops.create_cube(b, size=1.0, matrix=M, calc_uvs=True)
    if bevel > 0 and min(size) > bevel * 3:
        _bevel(b, r["verts"], bevel)


def ellipsoid(c, name, mat, center, rx, ry, rz, u=10, v=6):
    b = c.bm(name, mat)
    M = Matrix.Translation(center) @ Matrix.Diagonal((rx, ry, rz, 1.0))
    res = bmesh.ops.create_uvsphere(b, u_segments=u, v_segments=v, radius=1.0, matrix=M, calc_uvs=True)
    for f in {f for vv in res["verts"] for f in vv.link_faces}:
        f.smooth = True


# ---------------------------------------------------------------- RTV
def tv(c, w, h, mode="sciana"):
    """Telewizor bez znaków: cienka ramka, ekran. mode: sciana (uchwyt z tyłu) albo podstawa (dwie stopki)."""
    if mode == "sciana":
        yb, z0 = -0.028, 0.0
        box(c, "TV_uchwyt_scienny", "Czarny_mat", w * 0.36, w * 0.64, yb, 0, h * 0.3, h * 0.7)
    else:
        yb, z0 = -0.105, 0.055
        for x in (w * 0.2, w * 0.8):
            box(c, "TV_podstawa", "Czarny_mat", x - 0.02, x + 0.02, -0.24, 0, 0, 0.012, bevel=0.002)
            box(c, "TV_podstawa", "Czarny_mat", x - 0.012, x + 0.012, yb - 0.02, yb + 0.005, 0.012, z0 + 0.02)
    box(c, "TV_obudowa", "Czarny_mat", 0, w, yb - 0.03, yb, z0, z0 + h, bevel=0.004)
    box(c, "TV_tyl", "Czarny_mat", w * 0.12, w * 0.88, yb, yb + 0.022, z0 + h * 0.08, z0 + h * 0.62, bevel=0.004)
    box(c, "TV_ekran", "Ekran", 0.008, w - 0.008, yb - 0.0312, yb - 0.03, z0 + 0.014, z0 + h - 0.008)


# ---------------------------------------------------------------- salon
def sofa(c, w, seats, d=0.90, arms="LR", accent=True):
    al = 0.16 if "L" in arms else 0.0
    ar = 0.16 if "R" in arms else 0.0
    box(c, "Sofa_korpus", "Tkanina", 0.012, w - 0.012, -d + 0.012, -0.012, 0.10, 0.42)
    for x in (0.07, w - 0.07):
        for y in (-0.07, -d + 0.07):
            cyl(c, "Sofa_nozki", "Czarny_mat", (x, y, 0.05), 0.02, 0.10, segs=10)
    if al:
        box(c, "Sofa_boki", "Tkanina", 0, al, -d, 0, 0.10, 0.62, bevel=0.03)
    if ar:
        box(c, "Sofa_boki", "Tkanina", w - ar, w, -d, 0, 0.10, 0.62, bevel=0.03)
    box(c, "Sofa_oparcie", "Tkanina", max(al - 0.01, 0), w - max(ar - 0.01, 0), -0.20, 0, 0.40, 0.82, bevel=0.03)
    sw = (w - al - ar) / seats
    for i in range(seats):
        xa, xb = al + i * sw + 0.005, al + (i + 1) * sw - 0.005
        box(c, "Sofa_siedziska", "Tkanina_jasna", xa, xb, -d + 0.01, -0.21, 0.42, 0.52, bevel=0.025)
        box(c, "Sofa_poduchy_oparcia", "Tkanina_jasna", xa + 0.01, xb - 0.01, -0.36, -0.20, 0.52, 0.80, bevel=0.035)
    if accent:
        rbox(c, "Sofa_poduszka", "Tkanina_akcent", (0.40, 0.12, 0.40), (al + 0.24, -0.44, 0.70), rot=(-18, 0, 8), bevel=0.04)


def corner_sofa(c, w=2.6, d=0.95, dl=1.70):
    """Narożnik: sofa + szezlong po lewej (od frontu)."""
    sofa(c, w, 3, d=d, arms="R", accent=False)
    box(c, "Sofa_korpus", "Tkanina", 0.012, 0.95, -dl, -d + 0.03, 0.10, 0.42, bevel=0.02)
    box(c, "Sofa_siedziska", "Tkanina_jasna", 0.165, 0.945, -dl + 0.01, -d + 0.02, 0.42, 0.52, bevel=0.025)
    box(c, "Sofa_boki", "Tkanina", 0, 0.16, -dl - 0.004, 0, 0.10, 0.62, bevel=0.03)
    for x in (0.07, 0.88):
        cyl(c, "Sofa_nozki", "Czarny_mat", (x, -dl + 0.07, 0.05), 0.02, 0.10, segs=10)
    rbox(c, "Sofa_poduszka", "Tkanina_akcent", (0.40, 0.12, 0.40), (w - 0.42, -0.44, 0.70), rot=(-18, 0, -8), bevel=0.04)


def coffee_table(c, w=1.1, d=0.6):
    box(c, "Stolik_blat", "Drewno", 0, w, -d, 0, 0.37, 0.40, bevel=0.004)
    box(c, "Stolik_polka", "Drewno", 0.05, w - 0.05, -d + 0.05, -0.05, 0.12, 0.138, bevel=0.003)
    for x in (0.04, w - 0.04):
        for y in (-0.04, -d + 0.04):
            box(c, "Stolik_nogi", "Czarny_mat", x - 0.014, x + 0.014, y - 0.014, y + 0.014, 0, 0.37)


def floor_lamp(c):
    cx, cy = 0.20, -0.20
    cyl(c, "Lampa_podstawa", "Czarny_mat", (cx, cy, 0.01), 0.14, 0.02, segs=24)
    cyl(c, "Lampa_stojak", "Czarny_mat", (cx, cy, 0.02 + 0.65), 0.011, 1.30, segs=10)
    cyl(c, "Lampa_abazur", "Abazur", (cx, cy, 1.46), 0.20, 0.28, segs=28, r2=0.15)
    sphere(c, "Zarowka", "Zarowka", (cx, cy, 1.42), 0.035)


def rug(c, w=2.0, d=1.4):
    box(c, "Dywan", "Dywan", 0, w, -d, 0, 0, 0.012, bevel=0.003)
    m, s = 0.14, 0.03
    for (xa, xb, ya, yb) in ((m, w - m, -m - s, -m), (m, w - m, -d + m, -d + m + s), (m, m + s, -d + m, -m), (w - m - s, w - m, -d + m, -m)):
        box(c, "Dywan_wzor", "Dywan_wzor", xa, xb, ya, yb, 0.012, 0.0128)


def plant(c):
    cx, cy = 0.25, -0.25
    cyl(c, "Doniczka", "Doniczka", (cx, cy, 0.18), 0.15, 0.36, segs=20, r2=0.19)
    cyl(c, "Ziemia", "Ziemia", (cx, cy, 0.352), 0.178, 0.012, segs=20)
    cyl(c, "Pien", "Drewno", (cx, cy, 0.36 + 0.22), 0.016, 0.44, segs=8)
    for (dx, dy, z, r) in ((0, 0, 0.98, 0.19), (0.10, 0.05, 0.84, 0.15), (-0.10, -0.04, 0.86, 0.15), (0.03, -0.10, 0.80, 0.13), (-0.04, 0.10, 0.78, 0.13), (0.02, 0.02, 1.10, 0.12)):
        ellipsoid(c, "Liscie", "Zielen", (cx + dx, cy + dy, z), r, r, r * 0.85)


def picture(c, w=1.0, h=0.7):
    box(c, "Obraz_rama", "Czarny_mat", 0, w, -0.03, 0, 0, h, bevel=0.002)
    box(c, "Obraz_plotno", "Plotno", 0.03, w - 0.03, -0.032, -0.03, 0.03, h - 0.03)
    box(c, "Obraz_plama_1", "Obraz_1", w * 0.12, w * 0.50, -0.0335, -0.032, h * 0.18, h * 0.62)
    cyl(c, "Obraz_plama_2", "Obraz_2", (w * 0.62, -0.0331, h * 0.56), h * 0.22, 0.0012, axis="Y", segs=32)
    box(c, "Obraz_plama_3", "Obraz_3", w * 0.44, w * 0.86, -0.0343, -0.0335, h * 0.14, h * 0.30)


def curtains(c, w=2.0, h=2.5):
    cyl(c, "Karnisz", "Czarny_mat", (w / 2, -0.07, h - 0.04), 0.012, w, axis="X", segs=10)
    for x in (0.012, w - 0.012):
        sphere(c, "Karnisz", "Czarny_mat", (x, -0.07, h - 0.04), 0.022, u=10, v=6)
    for x in (0.12, w - 0.12):
        box(c, "Karnisz", "Czarny_mat", x - 0.01, x + 0.01, -0.07, 0, h - 0.05, h - 0.03)
    for x0 in (0.04, w - 0.04 - 0.42):
        for i in range(7):
            cyl(c, "Zaslony", "Zaslona", (x0 + 0.03 + i * 0.06, -0.07 + (0.012 if i % 2 else -0.012), (h - 0.06) / 2 + 0.01), 0.034, h - 0.08, segs=10)


# ---------------------------------------------------------------- sypialnia
def bed(c, wm=1.6, L=2.0):
    W = wm + 0.10
    box(c, "Lozko_zaglowek", "Tkanina", 0, W, -0.08, 0, 0.0, 0.95, bevel=0.02)
    box(c, "Lozko_rama", "Tkanina", 0, W, -(L + 0.12), -0.08, 0.12, 0.30, bevel=0.015)
    for x in (0.06, W - 0.06):
        for y in (-0.16, -(L + 0.05)):
            box(c, "Lozko_nozki", "Czarny_mat", x - 0.025, x + 0.025, y - 0.025, y + 0.025, 0, 0.12)
    box(c, "Lozko_materac", "Materac", 0.05, W - 0.05, -(L + 0.08), -0.09, 0.30, 0.52, bevel=0.03)
    box(c, "Lozko_koldra", "Posciel", 0.03, W - 0.03, -(L + 0.09), -0.72, 0.50, 0.565, bevel=0.02)
    n = 2 if wm >= 1.4 else 1
    pw = 0.62 if n == 2 else 0.66
    for i in range(n):
        xc = W / 2 if n == 1 else (W / 2 - 0.36 + i * 0.72)
        rbox(c, "Lozko_poduszki", "Poduszka", (pw, 0.40, 0.13), (xc, -0.36, 0.60), rot=(12, 0, 0), bevel=0.045)


# ---------------------------------------------------------------- biuro
def desk(c, w=1.4, d=0.7):
    box(c, "Biurko_blat", "Drewno", 0, w, -d, 0, 0.72, 0.75, bevel=0.004)
    for x in (0.04, w - 0.04):
        box(c, "Biurko_nogi", "Czarny_mat", x - 0.02, x + 0.02, -d + 0.03, -d + 0.07, 0, 0.72)
        box(c, "Biurko_nogi", "Czarny_mat", x - 0.02, x + 0.02, -0.07, -0.03, 0, 0.72)
        box(c, "Biurko_nogi", "Czarny_mat", x - 0.02, x + 0.02, -d + 0.07, -0.07, 0.68, 0.72)
    box(c, "Biurko_oslona", "Drewno", 0.06, w - 0.06, -0.06, -0.042, 0.42, 0.70)
    box(c, "Biurko_szuflada", "Drewno", w - 0.50, w - 0.07, -d + 0.04, -0.10, 0.60, 0.72, bevel=0.002)
    box(c, "Biurko_uchwyt", "Czarny_mat", w - 0.36, w - 0.21, -d + 0.028, -d + 0.04, 0.655, 0.667)


def office_chair(c):
    cx, cy = 0.31, -0.31
    for i in range(5):
        a = math.radians(90 + i * 72)
        dx, dy = math.cos(a), math.sin(a)
        rbox(c, "Krzeslo_podstawa", "Czarny_mat", (0.29, 0.04, 0.03), (cx + dx * 0.145, cy + dy * 0.145, 0.075), rot=(0, 0, 90 + i * 72))
        cyl(c, "Krzeslo_kolka", "Czarny_mat", (cx + dx * 0.28, cy + dy * 0.28, 0.028), 0.028, 0.04, axis="X", segs=12)
    cyl(c, "Krzeslo_podnosnik", "Stal", (cx, cy, 0.25), 0.026, 0.32, segs=12)
    box(c, "Krzeslo_siedzisko", "Tkanina_ciemna", cx - 0.24, cx + 0.24, cy - 0.24, cy + 0.23, 0.42, 0.50, bevel=0.03)
    rbox(c, "Krzeslo_oparcie", "Tkanina_ciemna", (0.44, 0.06, 0.56), (cx, cy + 0.25, 0.84), rot=(-8, 0, 0), bevel=0.025)
    rbox(c, "Krzeslo_lacznik", "Czarny_mat", (0.06, 0.03, 0.22), (cx, cy + 0.235, 0.50), rot=(-8, 0, 0))
    for sx in (-1, 1):
        box(c, "Krzeslo_podlokietniki", "Czarny_mat", cx + sx * 0.27 - 0.025, cx + sx * 0.27 + 0.025, cy - 0.14, cy + 0.14, 0.66, 0.685, bevel=0.006)
        box(c, "Krzeslo_podlokietniki", "Czarny_mat", cx + sx * 0.27 - 0.012, cx + sx * 0.27 + 0.012, cy + 0.02, cy + 0.06, 0.46, 0.66)


def monitor(c, w=0.615, h=0.365):
    box(c, "Monitor_podstawa", "Czarny_mat", w / 2 - 0.12, w / 2 + 0.12, -0.19, -0.01, 0, 0.012, bevel=0.003)
    box(c, "Monitor_noga", "Czarny_mat", w / 2 - 0.025, w / 2 + 0.025, -0.075, -0.055, 0.012, 0.30)
    box(c, "Monitor_obudowa", "Czarny_mat", 0, w, -0.105, -0.08, 0.085, 0.085 + h, bevel=0.003)
    box(c, "Monitor_ekran", "Ekran", 0.007, w - 0.007, -0.1062, -0.105, 0.085 + 0.014, 0.085 + h - 0.007)


def laptop(c, w=0.34, d=0.235):
    box(c, "Laptop_podstawa", "Stal", 0, w, -d, 0, 0, 0.015, bevel=0.003)
    box(c, "Laptop_klawiatura", "Czarny_mat", 0.02, w - 0.02, -d + 0.085, -0.02, 0.015, 0.0156)
    box(c, "Laptop_gladzik", "AGD_korpus", w / 2 - 0.055, w / 2 + 0.055, -d + 0.012, -d + 0.075, 0.015, 0.0154)
    ang = 20
    hh = 0.225
    cz = 0.015 + math.cos(math.radians(ang)) * hh / 2
    cyy = 0.0 + math.sin(math.radians(ang)) * hh / 2 - 0.004
    rbox(c, "Laptop_pokrywa", "Stal", (w, 0.007, hh), (w / 2, cyy, cz), rot=(-ang, 0, 0), bevel=0.002)
    rbox(c, "Laptop_ekran", "Ekran", (w - 0.016, 0.001, hh - 0.02), (w / 2, cyy - 0.0042 * math.cos(math.radians(ang)), cz - 0.0042 * math.sin(math.radians(ang))), rot=(-ang, 0, 0))


# ---------------------------------------------------------------- AGD wolnostojące
def washer(c, kind="pralka"):
    w, d, h = 0.60, 0.56, 0.85
    box(c, "Obudowa", "Bialy_AGD", 0, w, -d, 0, 0.012, h, bevel=0.008)
    for x in (0.06, w - 0.06):
        for y in (-0.06, -d + 0.06):
            cyl(c, "Nozki", "Czarny_mat", (x, y, 0.006), 0.02, 0.012, segs=10)
    yf = -d
    box(c, "Panel", "Czarne_szklo" if kind == "pralka" else "AGD_korpus", 0.012, w - 0.012, yf - 0.004, yf, h - 0.115, h - 0.02, bevel=0.001)
    cyl(c, "Pokretlo", "Stal", (w * 0.72 if kind == "pralka" else w * 0.5, yf - 0.014, h - 0.067), 0.028, 0.02, axis="Y", segs=20)
    box(c, "Wyswietlacz", "Ekran", w * 0.36 if kind == "pralka" else w * 0.66, (w * 0.36 if kind == "pralka" else w * 0.66) + 0.10, yf - 0.0046, yf - 0.004, h - 0.085, h - 0.05)
    zc = 0.42
    if kind == "pralka":
        box(c, "Szuflada", "Bialy_AGD", 0.03, 0.17, yf - 0.006, yf - 0.004, h - 0.10, h - 0.035, bevel=0.001)
        cyl(c, "Drzwi_rama", "Stal", (w / 2, yf - 0.015, zc), 0.20, 0.03, axis="Y", segs=32)
        cyl(c, "Drzwi_szyba", "Czarne_szklo", (w / 2, yf - 0.019, zc), 0.155, 0.03, axis="Y", segs=32)
    else:
        cyl(c, "Drzwi_rama", "Czarny_mat", (w / 2, yf - 0.014, zc), 0.215, 0.028, axis="Y", segs=32)
        cyl(c, "Drzwi_szyba", "Czarne_szklo", (w / 2, yf - 0.017, zc), 0.165, 0.028, axis="Y", segs=32)
        cyl(c, "Drzwi_pierscien", "Stal", (w / 2, yf - 0.0185, zc), 0.172, 0.027, axis="Y", segs=32)
        cyl(c, "Drzwi_szyba", "Czarne_szklo", (w / 2, yf - 0.0195, zc), 0.160, 0.027, axis="Y", segs=32)
        box(c, "Klapka_filtra", "Bialy_AGD", 0.06, w - 0.06, yf - 0.004, yf, 0.045, 0.13, bevel=0.002)
    box(c, "Drzwi_uchwyt", "Czarny_mat" if kind == "pralka" else "Stal", w / 2 + 0.165, w / 2 + 0.20, yf - 0.036, yf - 0.03, zc - 0.05, zc + 0.05, bevel=0.003)


def fridge_sbs(c):
    w, d, h = 0.91, 0.66, 1.78
    box(c, "Lodowka_obudowa", "AGD_korpus", 0, w, -d, 0, 0, h, bevel=0.006)
    for i, (xa, xb) in enumerate(((0.002, w / 2 - 0.002), (w / 2 + 0.002, w - 0.002))):
        box(c, "Lodowka_drzwi", "Stal", xa, xb, -d - 0.055, -d, 0.07, h - 0.002, bevel=0.006)
        hx = xb - 0.045 if i == 0 else xa + 0.045
        box(c, "Lodowka_uchwyty", "Czarny_mat", hx - 0.01, hx + 0.01, -d - 0.085, -d - 0.07, 0.55, 1.45, bevel=0.003)
        for z in (0.58, 1.42):
            box(c, "Lodowka_uchwyty", "Czarny_mat", hx - 0.008, hx + 0.008, -d - 0.07, -d - 0.055, z - 0.008, z + 0.008)
    box(c, "Lodowka_dystrybutor", "Czarne_szklo", 0.14, 0.30, -d - 0.0565, -d - 0.055, 0.98, 1.30, bevel=0.0)
    box(c, "Lodowka_dystrybutor_wneka", "Czarny_mat", 0.16, 0.28, -d - 0.0572, -d - 0.0565, 1.0, 1.16)
    box(c, "Lodowka_kratka", "Czarny_mat", 0.02, w - 0.02, -d - 0.02, -d, 0.01, 0.06)


def range_cooker(c):
    w, d, h = 0.60, 0.60, 0.85
    box(c, "Kuchenka_obudowa", "Bialy_AGD", 0, w, -d + 0.03, 0, 0.0, h - 0.01, bevel=0.004)
    oven(c, 0.0025, 0.16, -d + 0.03, name="Piekarnik")
    box(c, "Kuchenka_szuflada", "Bialy_AGD", 0.004, w - 0.004, -d + 0.008, -d + 0.03, 0.03, 0.15, bevel=0.003)
    box(c, "Kuchenka_cokol", "Czarny_mat", 0.02, w - 0.02, -d + 0.05, -d + 0.07, 0, 0.03)
    box(c, "Kuchenka_plyta", "Stal", 0, w, -d + 0.01, 0, h - 0.01, h, bevel=0.002)
    for (x, y) in ((0.16, -0.16), (0.44, -0.16), (0.16, -0.42), (0.44, -0.42)):
        cyl(c, "Palniki", "Czarny_mat", (x, y, h + 0.006), 0.045, 0.012, segs=20)
        cyl(c, "Palniki", "Czarny_mat", (x, y, h + 0.015), 0.03, 0.006, segs=20)
    for (xa, xb) in ((0.025, 0.29), (0.31, 0.575)):
        for y in (-0.06, -0.29, -0.52):
            box(c, "Ruszty", "Czarny_mat", xa, xb, y - 0.004, y + 0.004, h + 0.02, h + 0.028)
        for x in (xa, (xa + xb) / 2, xb):
            box(c, "Ruszty", "Czarny_mat", x - 0.004, x + 0.004, -0.52, -0.06, h + 0.02, h + 0.028)


def coffee_machine(c):
    w, d, h = 0.25, 0.42, 0.35
    box(c, "Ekspres_obudowa", "Czarny_mat", 0, w, -d + 0.06, 0, 0, h, bevel=0.01)
    box(c, "Ekspres_panel", "Czarne_szklo", 0.012, w - 0.012, -d + 0.058, -d + 0.06, h - 0.10, h - 0.015)
    box(c, "Ekspres_wylewka", "Stal", w / 2 - 0.05, w / 2 + 0.05, -d + 0.01, -d + 0.06, 0.16, 0.22, bevel=0.004)
    for x in (w / 2 - 0.018, w / 2 + 0.018):
        cyl(c, "Ekspres_wylewka", "Stal", (x, -d + 0.03, 0.15), 0.006, 0.02, segs=8)
    box(c, "Ekspres_tacka", "Stal", 0.02, w - 0.02, -d, -d + 0.06, 0, 0.025, bevel=0.003)
    box(c, "Ekspres_kratka", "Czarny_mat", 0.03, w - 0.03, -d + 0.008, -d + 0.058, 0.025, 0.027)
    cyl(c, "Filizanka", "Ceramika", (w / 2, -d + 0.033, 0.027 + 0.03), 0.032, 0.06, segs=16, r2=0.036)
    box(c, "Ekspres_pokrywa", "AGD_korpus", 0.03, w - 0.03, -0.16, -0.03, h, h + 0.006, bevel=0.002)


def kettle(c):
    cx, cy = 0.085, -0.08
    cyl(c, "Czajnik_podstawa", "Czarny_mat", (cx, cy, 0.01), 0.082, 0.02, segs=24)
    cyl(c, "Czajnik_korpus", "Stal", (cx, cy, 0.02 + 0.095), 0.078, 0.19, segs=24, r2=0.062)
    cyl(c, "Czajnik_pokrywka", "Czarny_mat", (cx, cy, 0.216), 0.06, 0.012, segs=24)
    sphere(c, "Czajnik_pokrywka", "Czarny_mat", (cx, cy, 0.23), 0.014, u=10, v=6)
    box(c, "Czajnik_uchwyt", "Czarny_mat", cx + 0.105, cx + 0.13, cy - 0.013, cy + 0.013, 0.06, 0.20, bevel=0.006)
    for z in (0.075, 0.185):
        box(c, "Czajnik_uchwyt", "Czarny_mat", cx + 0.06, cx + 0.11, cy - 0.011, cy + 0.011, z - 0.011, z + 0.011)
    rbox(c, "Czajnik_dziobek", "Stal", (0.05, 0.035, 0.03), (cx - 0.075, cy, 0.19), rot=(0, 25, 0), bevel=0.004)


# ---------------------------------------------------------------- łazienka i instalacje
def toilet(c):
    w = 0.37
    box(c, "WC_zbiornik", "Ceramika", 0, w, -0.19, 0, 0.38, 0.78, bevel=0.02)
    cyl(c, "WC_przycisk", "Stal", (w / 2, -0.095, 0.783), 0.03, 0.008, segs=16)
    box(c, "WC_stopa", "Ceramika", 0.055, w - 0.055, -0.56, -0.02, 0, 0.36, bevel=0.03)
    box(c, "WC_miska", "Ceramika", 0.02, w - 0.02, -0.47, -0.16, 0.30, 0.40, bevel=0.03)
    b = c.bm("WC_miska", "Ceramika")
    M = Matrix.Translation((w / 2, -0.47, 0.35)) @ Matrix.Diagonal((1.0, 1.0, 1.0, 1.0))
    res = bmesh.ops.create_cone(b, cap_ends=True, cap_tris=False, segments=24, radius1=0.165, radius2=0.165, depth=0.10, matrix=M, calc_uvs=True)
    _smooth_sides(b, res["verts"], Vector((0, 0, 1)))
    cyl(c, "WC_deska", "Bialy_AGD", (w / 2, -0.47, 0.41), 0.168, 0.02, segs=24)
    box(c, "WC_deska", "Bialy_AGD", 0.022, w - 0.022, -0.47, -0.19, 0.40, 0.417)


def bathtub(c, L=1.7, W=0.75, H=0.58):
    t = 0.06
    box(c, "Wanna", "Ceramika", 0, L, -W, -W + t, 0, H, bevel=0.012)
    box(c, "Wanna", "Ceramika", 0, L, -t, 0, 0, H, bevel=0.012)
    box(c, "Wanna", "Ceramika", 0, t, -W + t, -t, 0, H, bevel=0.012)
    box(c, "Wanna", "Ceramika", L - t, L, -W + t, -t, 0, H, bevel=0.012)
    box(c, "Wanna_dno", "Ceramika", t, L - t, -W + t, -t, 0.0, 0.14)
    cyl(c, "Wanna_odplyw", "Stal", (L * 0.5, -W / 2, 0.141), 0.025, 0.003, segs=16)
    fx, fy = L - 0.03, -W / 2
    for dy in (-0.07, 0.07):
        cyl(c, "Wanna_bateria", "Stal", (fx, fy + dy, H + 0.02), 0.018, 0.04, segs=12)
    cyl(c, "Wanna_bateria", "Stal", (fx, fy, H + 0.05), 0.016, 0.18, axis="Y", segs=12)
    cyl(c, "Wanna_bateria", "Stal", (fx - 0.07, fy, H + 0.05), 0.012, 0.14, axis="X", segs=12)


def shower(c, s=0.9, H=2.0):
    box(c, "Brodzik", "Ceramika", 0, s, -s, 0, 0, 0.10, bevel=0.015)
    cyl(c, "Brodzik_odplyw", "Stal", (s / 2, -s / 2, 0.101), 0.045, 0.003, segs=16)
    g = 0.006
    box(c, "Szklo_front", "Szklo", 0.02, s - 0.02, -s + 0.012, -s + 0.012 + g, 0.10, H)
    box(c, "Szklo_bok", "Szklo", s - 0.012 - g, s - 0.012, -s + 0.02, -0.005, 0.10, H)
    for (x, y) in ((0.012, -s + 0.015), (s - 0.015, -s + 0.015), (s - 0.015, -0.012)):
        box(c, "Profile", "Stal", x - 0.012, x + 0.012, y - 0.012, y + 0.012, 0.10, H)
    box(c, "Profile", "Stal", 0, s, -s + 0.003, -s + 0.027, H - 0.025, H)
    box(c, "Profile", "Stal", s - 0.027, s - 0.003, -s, 0, H - 0.025, H)
    box(c, "Uchwyt_drzwi", "Stal", s * 0.5 - 0.008, s * 0.5 + 0.008, -s - 0.018, -s + 0.004, 0.95, 1.25, bevel=0.003)
    cyl(c, "Deszczownica", "Stal", (0.30, -0.035, 1.45), 0.011, 1.0, segs=10)
    cyl(c, "Deszczownica", "Stal", (0.30, -0.16, 1.95), 0.011, 0.25, axis="Y", segs=10)
    cyl(c, "Deszczownica", "Stal", (0.30, -0.30, 1.935), 0.11, 0.012, segs=24)
    box(c, "Bateria_prysznic", "Stal", 0.22, 0.38, -0.06, -0.01, 1.02, 1.07, bevel=0.006)


def radiator(c, w=1.0, h=0.6):
    box(c, "Grzejnik", "Bialy_AGD", 0, w, -0.10, -0.035, 0, h, bevel=0.005)
    n = int(w / 0.05)
    for i in range(1, n):
        x = i * w / n
        box(c, "Grzejnik_zlobienia", "Bialy_AGD", x - 0.012, x + 0.012, -0.102, -0.10, 0.03, h - 0.03)
    for x in (0.15, w - 0.15):
        box(c, "Grzejnik_wsporniki", "Bialy_AGD", x - 0.015, x + 0.015, -0.035, 0, h * 0.25, h * 0.75)
    cyl(c, "Grzejnik_zawor", "Bialy_AGD", (w - 0.02, -0.068, h + 0.025), 0.018, 0.05, segs=12)


def wall_mirror(c, w=0.6, h=1.2):
    box(c, "Lustro_rama", "Czarny_mat", 0, w, -0.025, 0, 0, h, bevel=0.003)
    box(c, "Lustro", "Lustro", 0.015, w - 0.015, -0.0262, -0.025, 0.015, h - 0.015)


def round_table(c, r=0.5):
    cyl(c, "Stol_blat", "Drewno", (r, -r, 0.735), r, 0.03, segs=40)
    cyl(c, "Stol_noga", "Czarny_mat", (r, -r, 0.37), 0.04, 0.70, segs=14)
    cyl(c, "Stol_podstawa", "Czarny_mat", (r, -r, 0.012), 0.26, 0.024, segs=28)


def upholstered_chair(c):
    w = 0.46
    box(c, "Krzeslo_siedzisko", "Tkanina_jasna", 0, w, -0.47, -0.03, 0.42, 0.49, bevel=0.025)
    rbox(c, "Krzeslo_oparcie", "Tkanina_jasna", (w, 0.06, 0.42), (w / 2, -0.045, 0.70), rot=(-7, 0, 0), bevel=0.025)
    for x in (0.035, w - 0.035):
        for y in (-0.44, -0.06):
            cyl(c, "Krzeslo_nogi", "Drewno", (x, y, 0.21), 0.016, 0.42, segs=10, r2=0.02)


# ---------------------------------------------------------------- katalog 32 modeli
MODELS = [
    ("tv_55_scienny", "Telewizor 55″ na ścianie", "RTV", lambda c: tv(c, 1.23, 0.71)),
    ("tv_65_scienny", "Telewizor 65″ na ścianie", "RTV", lambda c: tv(c, 1.45, 0.84)),
    ("tv_50_podstawa", "Telewizor 50″ na podstawie", "RTV", lambda c: tv(c, 1.12, 0.65, mode="podstawa")),
    ("sofa_2", "Sofa 2-osobowa 160 cm", "Salon", lambda c: sofa(c, 1.6, 2)),
    ("sofa_3", "Sofa 3-osobowa 220 cm", "Salon", lambda c: sofa(c, 2.2, 3, d=0.92)),
    ("naroznik_260", "Narożnik 260 × 170 cm", "Salon", corner_sofa),
    ("fotel", "Fotel", "Salon", lambda c: sofa(c, 0.85, 1, d=0.85, accent=False)),
    ("stolik_kawowy", "Stolik kawowy 110 × 60 cm", "Salon", coffee_table),
    ("lampa_stojaca", "Lampa stojąca", "Salon", floor_lamp),
    ("dywan_200", "Dywan 200 × 140 cm", "Salon", rug),
    ("roslina", "Roślina w donicy", "Dekoracje", plant),
    ("obraz_100", "Obraz 100 × 70 cm", "Dekoracje", picture),
    ("zaslony_200", "Zasłony z karniszem 200 cm", "Dekoracje", curtains),
    ("lustro_scienne", "Lustro ścienne 60 × 120 cm", "Dekoracje", wall_mirror),
    ("lozko_160", "Łóżko 160 × 200 cm", "Sypialnia", lambda c: bed(c, 1.6)),
    ("lozko_90", "Łóżko 90 × 200 cm", "Sypialnia", lambda c: bed(c, 0.9)),
    ("biurko_140", "Biurko 140 × 70 cm", "Biuro", desk),
    ("krzeslo_biurowe", "Krzesło biurowe", "Biuro", office_chair),
    ("monitor_27", "Monitor 27″", "Biuro", monitor),
    ("laptop", "Laptop", "Biuro", laptop),
    ("stol_okragly_100", "Stół okrągły 100 cm", "Jadalnia", round_table),
    ("krzeslo_tapicerowane", "Krzesło tapicerowane", "Jadalnia", upholstered_chair),
    ("pralka", "Pralka wolnostojąca 60 cm", "AGD wolnostojące", lambda c: washer(c, "pralka")),
    ("suszarka", "Suszarka wolnostojąca 60 cm", "AGD wolnostojące", lambda c: washer(c, "suszarka")),
    ("lodowka_side_by_side", "Lodówka side by side 91 cm", "AGD wolnostojące", fridge_sbs),
    ("kuchenka_wolnostojaca", "Kuchenka wolnostojąca 60 cm", "AGD wolnostojące", range_cooker),
    ("ekspres", "Ekspres do kawy", "AGD wolnostojące", coffee_machine),
    ("czajnik", "Czajnik elektryczny", "AGD wolnostojące", kettle),
    ("wc_kompakt", "Miska WC kompakt", "Łazienka", toilet),
    ("wanna_170", "Wanna 170 × 75 cm", "Łazienka", bathtub),
    ("kabina_90", "Kabina prysznicowa 90 × 90 cm", "Łazienka", shower),
    ("grzejnik_100", "Grzejnik płytowy 100 × 60 cm", "Łazienka", radiator),
]
assert len(MODELS) == 32, len(MODELS)
ROLE_BY_MAT = {}  # wyposażenie nie ma części do podmiany kolorów (front / blat / uchwyt)


# ---------------------------------------------------------------- miniatury (240 × 240, jak public/biblioteka)
def setup_render():
    sc = bpy.context.scene
    for ob in list(sc.objects):  # domyślna scena Blendera: sześcian, lampa, kamera
        if ob.name not in COL.objects:
            bpy.data.objects.remove(ob, do_unlink=True)
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 24
    sc.cycles.use_denoising = False
    sc.cycles.device = "CPU"
    sc.render.resolution_x = sc.render.resolution_y = 480
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.72, 0.72, 0.72, 1)
    bg.inputs[1].default_value = 1.0
    sun = bpy.data.lights.new("S", "SUN")
    sun.energy = 2.2
    sun.angle = math.radians(25)
    so = bpy.data.objects.new("S", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    cam = bpy.data.cameras.new("C")
    cam.type = "ORTHO"
    co = bpy.data.objects.new("C", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    return co


def frame(cam):
    mn, mx = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for ob in COL.objects:
        if ob.type != "MESH":
            continue
        for v in ob.data.vertices:
            p = ob.matrix_world @ v.co
            mn = Vector(map(min, mn, p))
            mx = Vector(map(max, mx, p))
    ctr = (mn + mx) / 2
    d = Vector((0.75, -1.0, 0.55)).normalized()
    cam.location = ctr + d * 12
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for x in (mn.x, mx.x):
        for y in (mn.y, mx.y):
            for z in (mn.z, mx.z):
                p = inv @ Vector((x, y, z))
                xs.append(p.x)
                ys.append(p.y)
    cam.data.ortho_scale = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.12
    cam.data.shift_x = ((max(xs) + min(xs)) / 2) / cam.data.ortho_scale
    cam.data.shift_y = ((max(ys) + min(ys)) / 2) / cam.data.ortho_scale


def export_wyposazenie(miniatury=True):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    cam = setup_render() if miniatury else None
    thumbs = os.path.join(OUT_DIR, "miniatury")
    if miniatury:
        os.makedirs(thumbs, exist_ok=True)
    catalog = []
    for i, entry in enumerate(MODELS, 1):
        mid, name, cat, fn = entry
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
        if miniatury:
            frame(cam)
            bpy.context.scene.render.filepath = os.path.join(thumbs, f"{i:02d}_{mid}.png")
            bpy.ops.render.render(write_still=True)
        catalog.append(dict(nr=i, id=mid, plik=f"modele/{fname}", nazwa=name, kategoria=cat,
                            rozmiar_kb=round(os.path.getsize(path) / 1024, 1), **st))
    clear_generated()
    write_catalog(catalog)
    return catalog


if __name__ == "__main__":
    _cat = export_wyposazenie(miniatury="--miniatury" in sys.argv)
    print(json.dumps(dict(ok=True, out=OUT_DIR, count=len(_cat), max_kb=max(x["rozmiar_kb"] for x in _cat), total_kb=round(sum(x["rozmiar_kb"] for x in _cat), 1))))
