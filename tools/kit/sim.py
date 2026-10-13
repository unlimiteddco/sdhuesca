"""Paso 2: cuelga el patrón de una percha con el simulador de tela de Blender.

Uso: blender -b -P tools/kit/sim.py -- [--kit campo|portero] [--preview]
Lee build/panels-<kit>.json y escribe public/models/camiseta-<kit>.glb (camiseta + percha + gancho).
El origen del modelo es el centro de la barra de la que cuelga el gancho.

La prenda son dos paneles (pecho y espalda) cosidos por los hombros y unidos por un
fuelle en cada costado. Cuelga de una percha y envuelve un molde interior invisible,
que le da cuerpo sin estrecharla y deja los costados redondeados.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
PREVIEW = "--preview" in sys.argv
KIT = sys.argv[sys.argv.index("--kit") + 1] if "--kit" in sys.argv else "campo"

FRAMES = 170  # los moldes crecen durante los primeros 50; el resto es para que la tela se asiente
GUSSET = 0.06  # anchura del fuelle lateral (m)
HANGER_HALF = 0.205  # media anchura de la percha
HANGER_DEPTH = 0.022  # semieje en profundidad en los hombros (les da volumen)
NECK_DEPTH = 0.03  # cuánto se separa del plano de la percha el borde del cuello en su centro
CLEAR = 0.007  # la percha queda esta distancia por debajo de la costura del hombro
FORM_DEPTH = (0.044, 0.034)  # semiprofundidad del molde interior arriba y abajo
FORM_FIT = 0.9  # perímetro del molde respecto al contorno de la prenda (<1 = holgura, más pliegues)
FORM_LENGTH = 0.6  # tramo del cuerpo que ocupa el molde; por debajo la tela cuelga libre
FORM_GROW = 50  # fotogramas que tarda el molde en alcanzar su tamaño
SLEEVE_DEPTH = 0.025  # semiprofundidad del molde de cada manga (solo si el patrón trae su franja superior)
SLEEVE_FIT = 0.82  # perímetro del molde de manga respecto al contorno de la manga
SLEEVE_ROUND = 0.012  # radio de sus esquinas: pequeño, para que la cara exterior quede casi plana
SLEEVE_DROOP = 14  # grados que la manga cae respecto a la foto (ahí va sobre un maniquí con los brazos algo abiertos)
HOOK_R = 0.02
STEM = 0.07


def smoothstep(a, b, v):
    u = np.clip((np.asarray(v, float) - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


data = json.loads((HERE / "build" / f"panels-{KIT}.json").read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, FRAMES

# ------------------------------------------------------------------ patrón
xy = np.array(data["verts"])  # x, z (z hacia arriba, 0 en lo alto del cuello)
count = len(xy)
owner = np.zeros(count, int)  # bit 1 = delantero, bit 2 = espalda; 3 = costura del hombro
for bit, name in ((1, "front"), (2, "back")):
    owner[np.array(data["panels"][name]["ids"])] |= bit
side = np.where(owner == 1, 1.0, np.where(owner == 2, -1.0, 0.0))  # espalda hacia -Y
g_ids, g_t = np.array(data["gusset"]["ids"]), np.array(data["gusset"]["t"])
side[g_ids] = 1 - 2 * g_t  # el fuelle va del borde del delantero (+1) al de la espalda (-1)

# en reposo la prenda es una caja: paneles separados la anchura del fuelle, salvo junto al hombro
shoulder_xy = xy[owner == 3]
NECK = float(np.abs(shoulder_xy[:, 0]).min())  # media anchura del cuello: donde arranca la costura del hombro
NECK_Z = float(shoulder_xy[np.argmin(np.abs(shoulder_xy[:, 0])), 1])
d_shoulder = np.array([np.sqrt(((shoulder_xy - p) ** 2).sum(axis=1).min()) for p in xy])
# costado del cuerpo: de la axila (punto más alto de la costura) al bajo; en manga larga la
# costura sube antes por debajo de la manga, y ese tramo no cuenta
body, armpits = [], []
for ids in data["gusset"]["seams"]:
    pts = xy[ids]
    k = int(np.argmax(pts[:, 1]))
    armpits.append(pts[k])
    body.append(pts[k:] if pts[-1, 1] < pts[0, 1] else pts[: k + 1])
# Con franja superior en las mangas (su cara exterior), delantero y espalda se separan ahí lo
# que mide la franja; en el cuerpo, lo que mide el fuelle del costado.
TOPS = data.get("sleeve_tops", {}).get("seams", [])
TOP = data.get("sleeve_tops", {}).get("width", GUSSET)
arm_x = min(abs(float(a[0])) for a in armpits)
# "manga" = más allá de la axila y no por debajo del puño: el costado del cuerpo, que también
# queda lejos del centro, conserva el ancho del fuelle (si no, al bajo le sobra tela y se abre)
cuff_z = min(float(xy[g][:, 1].min()) for g in TOPS) if TOPS else 0.0
in_sleeve = smoothstep(arm_x - 0.03, arm_x + 0.02, np.abs(xy[:, 0])) * smoothstep(cuff_z - 0.07, cuff_z - 0.03, xy[:, 1])
width = GUSSET + (TOP - GUSSET) * in_sleeve
rest = width / 2 * smoothstep(0, 0.07, d_shoulder)


# ------------------------------------------------------------------- percha
# Percha de madera de sección elíptica: alta y estrecha en el centro (donde entra el gancho),
# más baja y ancha hacia los hombros.
def hanger_depth(x):
    return 0.008 + (HANGER_DEPTH - 0.008) * smoothstep(0.04, 0.14, np.abs(x))


def hanger_tall(x):
    return 0.021 - 0.009 * smoothstep(0.02, 0.11, np.abs(x))


# sigue la línea de hombros por debajo de la costura
xs = np.linspace(-HANGER_HALF, HANGER_HALF, 61)
shoulder_line = np.array(data.get("shoulder_line") or shoulder_xy.tolist())  # incluye el tramo que ya no va cosido


def seam_height(sign):
    pts = shoulder_line[shoulder_line[:, 0] * sign > 0]
    pts = pts[np.argsort(np.abs(pts[:, 0]))]
    return np.interp(np.maximum(np.abs(xs), NECK + 0.009), np.abs(pts[:, 0]), pts[:, 1])  # plana bajo el hueco del cuello


line = np.minimum(seam_height(1), seam_height(-1))  # simétrica, por debajo de la costura más baja
line = np.convolve(np.pad(line, 3, mode="edge"), np.ones(7) / 7, mode="valid")
# el centro sube un poco hacia el gancho, sin llegar a asomar por encima del cuello
line += 0.011 * (1 - (xs / (NECK - 0.018)) ** 2).clip(0) ** 2 - CLEAR - hanger_tall(xs)
path = np.c_[xs, line]  # eje de la percha

# estado inicial: la tela nace ya envolviendo la percha (tienda de campaña desde la costura)
dz = xy[:, 1] - np.interp(xy[:, 0], xs, line)
tall = hanger_tall(xy[:, 0])
reach = (hanger_depth(xy[:, 0]) + 0.016) * (1 - smoothstep(HANGER_HALF, HANGER_HALF + 0.03, np.abs(xy[:, 0])))
env = reach * np.where(
    dz >= 0,
    np.clip(1 - dz / (tall + CLEAR), 0, 1),
    np.where(dz > -tall, 1, np.exp(-(((dz + tall) / 0.06) ** 2))),
)
start = np.where((owner == 3) | np.isin(np.arange(count), g_ids), rest, np.maximum(rest, env))
# el borde del cuello va sujeto y dibuja un arco limpio de esquina a esquina (delante y detrás),
# en vez de heredar los escalones del estado inicial
front_neck = xy[data["panels"]["front"]["neck"]]
# cuello polo: las solapas del delantero suben por encima del hombro. Ese tramo es el lateral del
# cuello, la misma tira que la espalda: ahí los dos bordes van casi juntos, o las puntas de las
# solapas quedarían sueltas por delante como dos cuernos
STAND = float(front_neck[:, 1].max()) - NECK_Z > 0.015
TIP = float(np.abs(front_neck[front_neck[:, 1] > front_neck[:, 1].max() - 0.004, 0]).min())
for name in ("front", "back"):
    ids = data["panels"][name]["neck"]
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(xy[ids], axis=0), axis=1))]
    along = d / (d[-1] * (1 + 1 / max(len(ids) - 1, 1)))
    depth = NECK_DEPTH * np.sin(np.pi * along) ** 0.6
    if STAND and name == "front":
        depth *= 1 - 0.87 * smoothstep(-0.01, 0.012, xy[ids, 1] - NECK_Z)
    elif STAND:
        depth *= 1 - 0.8 * smoothstep(TIP - 0.03, TIP, np.abs(xy[ids, 0]))
    for i, v in zip(ids, depth):
        if owner[i] != 3:
            start[i] = max(float(v), 0.004)

mesh = bpy.data.meshes.new("camiseta")
bm = bmesh.new()
bverts = [bm.verts.new((x, side[i] * rest[i], z)) for i, (x, z) in enumerate(xy)]
bm.verts.ensure_lookup_table()
uv_layer = bm.loops.layers.uv.new("UVMap")


def add_faces(faces, uvs, outward):
    for tri, uv3 in zip(faces, uvs):
        try:
            f = bm.faces.new([bverts[i] for i in tri])
        except ValueError:
            continue
        for loop, uv in zip(f.loops, uv3):
            loop[uv_layer].uv = uv
        f.normal_update()
        if f.normal.dot(outward(f)) < 0:  # normales siempre hacia fuera
            f.normal_flip()
        f.smooth = True


add_faces(data["panels"]["front"]["faces"], data["panels"]["front"]["uvs"], lambda f: Vector((0, 1, 0)))
n_front = len(bm.faces)
add_faces(data["panels"]["back"]["faces"], data["panels"]["back"]["uvs"], lambda f: Vector((0, -1, 0)))
add_faces(data["gusset"]["faces"], data["gusset"]["uvs"], lambda f: Vector((f.calc_center_median().x, 0, 0)))
# orientación coherente por conectividad: en manga larga el fuelle interior de la manga mira al cuerpo
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.faces.ensure_lookup_table()
if sum(bm.faces[i].normal.y for i in range(n_front)) < 0:
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
shirt = bpy.data.objects.new("camiseta", mesh)
scene.collection.objects.link(shirt)

# la costura del hombro va sujeta a la percha junto al cuello (como las muescas antideslizantes)
pin = shirt.vertex_groups.new(name="pin")
pinned = [i for i in range(count) if owner[i] == 3 and abs(xy[i, 0]) < NECK + 0.05]
# el canalé del cuello mantiene su forma
pinned += data["panels"]["front"]["neck"] + data["panels"]["back"]["neck"]
pin.add(pinned, 1.0, "REPLACE")

# dobladillos de mangas y bajo: tela doble, mucho más rígida al plegarse (sin esto el borde se riza)
tmp = bmesh.new()
tmp.from_mesh(mesh)
free = np.array([v.index for v in tmp.verts if v.is_boundary and v.index not in set(pinned)])
tmp.free()
d_hem = np.array([np.sqrt(((xy[free] - p) ** 2).sum(axis=1).min()) for p in xy])
hem = shirt.vertex_groups.new(name="hem")
for i, w in enumerate(1 - smoothstep(0.004, 0.03, d_hem)):
    hem.add([i], float(w), "REPLACE")

# las longitudes en reposo salen del patrón (Basis); la simulación arranca desde "start"
basis = shirt.shape_key_add(name="Basis")
key = shirt.shape_key_add(name="start")
for i, (x, z) in enumerate(xy):
    key.data[i].co = (x, side[i] * start[i], z)
key.value = 1.0

hm = bmesh.new()
rings = []
SEG = 18
for i, (x, z) in enumerate(path):
    tan = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]
    tan /= np.linalg.norm(tan)
    nx, nz = -tan[1], tan[0]
    end = min(i, len(path) - 1 - i) / 4
    taper = math.sqrt(1 - (1 - min(end, 1)) ** 2) * 0.92 + 0.08
    ring = []
    for k in range(SEG):
        a = 2 * math.pi * k / SEG
        r = float(hanger_tall(x)) * math.cos(a) * taper
        ring.append(hm.verts.new((x + nx * r, float(hanger_depth(x)) * math.sin(a) * taper, z + nz * r)))
    rings.append(ring)
for a, b in zip(rings, rings[1:]):
    for k in range(SEG):
        hm.faces.new((a[k], a[(k + 1) % SEG], b[(k + 1) % SEG], b[k]))
hm.faces.new(rings[0])
hm.faces.new(rings[-1][::-1])
bmesh.ops.recalc_face_normals(hm, faces=hm.faces)
for f in hm.faces:
    f.smooth = True
hmesh = bpy.data.meshes.new("percha")
hm.to_mesh(hmesh)
hm.free()
hanger = bpy.data.objects.new("percha_colision", hmesh)
scene.collection.objects.link(hanger)
hanger.hide_render = True
hanger.modifiers.new("Collision", "COLLISION")
hanger.collision.thickness_outer = 0.006  # holgura: el suavizado final no debe meter la tela en la madera
hanger.collision.thickness_inner = 0.004
hanger.collision.cloth_friction = 40

# ----------------------------------------------------------- molde interior
# Un torso plano de sección "estadio" (dos caras planas y costados semicirculares). Su
# perímetro es algo menor que el contorno de la tela a cada altura: la prenda lo envuelve
# con holgura, cae recta y el fuelle dobla sobre el costado redondo.
seam = np.vstack(body)
order = np.argsort(seam[:, 1])
seam_z, seam_w = seam[order, 1], np.abs(seam[order, 0])
armpit = seam_z.max()
FORM_TOP = NECK_Z - 0.094
FORM_BOTTOM = FORM_TOP + (seam_z.min() - FORM_TOP) * FORM_LENGTH
form_rings = []
for z in np.linspace(FORM_TOP, FORM_BOTTOM, 48):
    u = (z - FORM_TOP) / (FORM_BOTTOM - FORM_TOP)
    grow = float(smoothstep(0, 0.14, u) * (1 - 0.45 * smoothstep(0.7, 1, u)))  # fino bajo la percha y al acabar
    b = (FORM_DEPTH[0] + (FORM_DEPTH[1] - FORM_DEPTH[0]) * u) * (0.45 + 0.55 * grow)
    half = float(np.interp(min(z, armpit), seam_z, seam_w))  # media anchura del panel a esta altura
    contour = 4 * half + 2 * GUSSET
    a = (FORM_FIT * contour - 2 * math.pi * b) / 4 + b
    form_rings.append((z, max(a * (0.86 + 0.14 * grow), b + 0.004), b))

fm = bmesh.new()
ARC = 9
frings = []
for z, a, b in form_rings:
    ring = []
    for sx in (1, -1):  # semicírculo derecho y luego izquierdo; las caras planas quedan entre ambos
        for t in np.linspace(-math.pi / 2, math.pi / 2, ARC):
            ring.append(fm.verts.new((sx * (a - b + b * math.cos(t)), sx * b * math.sin(t), z)))
    frings.append(ring)
n = 2 * ARC
for r0, r1 in zip(frings, frings[1:]):
    for k in range(n):
        fm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
fm.faces.new(frings[0])
fm.faces.new(frings[-1][::-1])
bmesh.ops.subdivide_edges(fm, edges=[e for e in fm.edges if e.calc_length() > 0.03], cuts=6, use_grid_fill=True)
bmesh.ops.triangulate(fm, faces=fm.faces)
bmesh.ops.recalc_face_normals(fm, faces=fm.faces)
fmesh = bpy.data.meshes.new("molde")
fm.to_mesh(fmesh)
fm.free()
form = bpy.data.objects.new("molde", fmesh)
scene.collection.objects.link(form)
form.hide_render = True
# nace estrecho y fino, dentro de la caja de tela, y crece hasta su tamaño
form.scale = (0.84, 0.3, 1)
form.keyframe_insert("scale", frame=1)
form.scale = (1, 1, 1)
form.keyframe_insert("scale", frame=FORM_GROW)
form.modifiers.new("Collision", "COLLISION")
form.collision.thickness_outer = 0.0025
form.collision.thickness_inner = 0.008
form.collision.cloth_friction = 6

# ------------------------------------------------------------ moldes de manga
# Un tubo de sección rectangular redondeada dentro de cada manga, del hombro hacia el puño: la
# abre para que su cara exterior (la franja, con el parche o entre los dos logos) mire hacia fuera.
for n, ids in enumerate(TOPS):
    top_seam = xy[ids]  # del puño hacia el hombro
    sign = np.sign(top_seam[0, 0])
    under = next(xy[g] for g in data["gusset"]["seams"] if np.sign(xy[g][:, 0].mean()) == sign)
    arm = under[int(np.argmax(under[:, 1]))]
    cuff_bottom = min((under[0], under[-1]), key=lambda q: np.linalg.norm(q - top_seam[0]))
    inner_top = top_seam[int(len(top_seam) * 0.82)]
    c0, c1 = (inner_top + arm) / 2, (top_seam[0] + cuff_bottom) / 2  # eje: de la sisa al centro del puño
    h0, h1 = np.linalg.norm(inner_top - arm) / 2, np.linalg.norm(top_seam[0] - cuff_bottom) / 2
    turn = -sign * math.radians(SLEEVE_DROOP)
    axis = np.array([[math.cos(turn), -math.sin(turn)], [math.sin(turn), math.cos(turn)]]) @ (c1 - c0)
    across = np.array([-axis[1], axis[0]]) / np.linalg.norm(axis)
    centre = c0 + axis / 2
    sm, rings = bmesh.new(), []
    CORNER = 5
    for u in np.linspace(0.3, 0.76, 20):
        # arranca fino pasada la sisa (ahí manda la percha) y vuelve a afinarse hacia el puño, que cuelga libre
        grow = float(smoothstep(0.3, 0.5, u) * (1 - 0.35 * smoothstep(0.6, 0.76, u)))
        b = SLEEVE_DEPTH * (0.35 + 0.65 * grow)
        r = min(SLEEVE_ROUND, b - 0.002)
        contour = 4 * (h0 + (h1 - h0) * u) + 2 * TOP  # dos paneles, franja superior y fuelle inferior
        a = max((SLEEVE_FIT * contour - 2 * math.pi * r - 4 * (b - r)) / 4 + r, r + 0.004) * (0.6 + 0.4 * grow)
        ring = []
        for qa, qb in ((1, 1), (-1, 1), (-1, -1), (1, -1)):  # las cuatro esquinas, en orden
            start_angle = {(1, 1): 0, (-1, 1): 1, (-1, -1): 2, (1, -1): 3}[(qa, qb)] * math.pi / 2
            for t in np.linspace(start_angle, start_angle + math.pi / 2, CORNER):
                along, depth = qa * (a - r) + r * math.cos(t), qb * (b - r) + r * math.sin(t)
                q = c0 + axis * u + across * along - centre
                ring.append(sm.verts.new((q[0], depth, q[1])))
        rings.append(ring)
    m = len(rings[0])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(m):
            sm.faces.new((r0[k], r0[(k + 1) % m], r1[(k + 1) % m], r1[k]))
    sm.faces.new(rings[0])
    sm.faces.new(rings[-1][::-1])
    bmesh.ops.subdivide_edges(sm, edges=[e for e in sm.edges if e.calc_length() > 0.025], cuts=3, use_grid_fill=True)
    bmesh.ops.triangulate(sm, faces=sm.faces)
    bmesh.ops.recalc_face_normals(sm, faces=sm.faces)
    smesh = bpy.data.meshes.new(f"molde_manga_{n}")
    sm.to_mesh(smesh)
    sm.free()
    sleeve = bpy.data.objects.new(f"molde_manga_{n}", smesh)
    scene.collection.objects.link(sleeve)
    sleeve.hide_render = True
    sleeve.location = (centre[0], 0, centre[1])
    sleeve.scale = (0.6, 0.25, 0.6)
    sleeve.keyframe_insert("scale", frame=1)
    sleeve.scale = (1, 1, 1)
    sleeve.keyframe_insert("scale", frame=FORM_GROW)
    sleeve.modifiers.new("Collision", "COLLISION")
    sleeve.collision.thickness_outer = 0.0025
    sleeve.collision.thickness_inner = 0.008
    sleeve.collision.cloth_friction = 6

# --------------------------------------------------------------------- tela
cloth = shirt.modifiers.new("Cloth", "CLOTH")
s = cloth.settings
s.quality = 14
s.mass = 0.006
s.tension_stiffness = 40
s.compression_stiffness = 40
s.shear_stiffness = 15
s.bending_stiffness = 0.45
s.vertex_group_bending = "hem"
s.bending_stiffness_max = 14
s.tension_damping = 8
s.compression_damping = 8
s.shear_damping = 8
s.bending_damping = 0.6
s.air_damping = 2.5
s.vertex_group_mass = "pin"
s.pin_stiffness = 1
s.rest_shape_key = basis
c = cloth.collision_settings
c.use_collision = True
c.collision_quality = 5
c.distance_min = 0.0025
c.friction = 30
c.use_self_collision = True
# donde un fuelle o una franja se estrecha hasta cerrarse, sus filas quedan más juntas que la
# distancia de autocolisión y se empujarían entre sí sin parar: esos vértices no cuentan
crowded = shirt.vertex_groups.new(name="crowded")
crowded.add([int(i) for i in g_ids if 2 * rest[i] / 6 < 0.004], 1.0, "REPLACE")
c.vertex_group_self_collisions = "crowded"
c.self_distance_min = 0.0022
c.self_friction = 8
cloth.point_cache.frame_start = 1
cloth.point_cache.frame_end = FRAMES

for f in range(1, FRAMES + 1):
    scene.frame_set(f)
    if f % 15 == 0:
        # balanceo del bajo: si no tiende a cero, la prenda no ha terminado de asentarse
        co = np.array([v.co[:] for v in shirt.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.vertices])
        low = co[:, 2] < co[:, 2].min() + 0.08
        print("frame", f, "bajo: y media %.3f max %.3f min %.3f" % (co[low, 1].mean(), co[low, 1].max(), co[low, 1].min()), flush=True)

dg = bpy.context.evaluated_depsgraph_get()
final = bpy.data.meshes.new_from_object(shirt.evaluated_get(dg), depsgraph=dg)
final.name = "camiseta_final"
flat = np.array([(x, side[i] * rest[i], z) for i, (x, z) in enumerate(xy)])
now = np.array([v.co[:] for v in final.vertices])
edges = np.array([e.vertices[:] for e in final.edges])
length = lambda p: np.linalg.norm(p[edges[:, 0]] - p[edges[:, 1]], axis=1)  # noqa: E731
ok = length(flat) > 1e-4  # el fuelle no tiene anchura en el patrón plano
strain = length(now)[ok] / length(flat)[ok]
print("strain mean %.3f p95 %.3f" % (strain.mean(), np.percentile(strain, 95)))
print("bbox", now.min(axis=0).round(3), now.max(axis=0).round(3))

# bordes limpios: se suaviza cada contorno abierto (cuello, puños, bajo) a lo largo de sí mismo
fb = bmesh.new()
fb.from_mesh(final)
fixed = set(pinned)  # el cuello va sujeto y ya es una curva limpia
ring = {v: [e.other_vert(v) for e in v.link_edges if e.is_boundary] for v in fb.verts if v.is_boundary and v.index not in fixed}
for _ in range(14):
    moved = {v: v.co.lerp((ns[0].co + ns[1].co) / 2, 0.5) for v, ns in ring.items() if len(ns) == 2}
    for v, co in moved.items():
        v.co = co
fb.to_mesh(final)
fb.free()

result = bpy.data.objects.new("camiseta", final)
scene.collection.objects.link(result)
bpy.data.objects.remove(shirt)
result.name = "camiseta"
smooth = result.modifiers.new("Smooth", "CORRECTIVE_SMOOTH")
smooth.iterations = 6
smooth.factor = 0.4
smooth.use_only_smooth = True
smooth.use_pin_boundary = True
# grosor de tela visible en cuello, puños y bajo
rim = result.modifiers.new("Rim", "SOLIDIFY")
rim.thickness = 0.003
rim.offset = -1
rim.use_rim = True
rim.use_rim_only = True
# en el cuello no: ahí el reborde se veía como una línea extraña sobre la percha
result.vertex_groups.new(name="pin")
rim.vertex_group = "pin"
rim.invert_vertex_group = True
rim.thickness_vertex_group = 0
dg = bpy.context.evaluated_depsgraph_get()
applied = bpy.data.meshes.new_from_object(result.evaluated_get(dg), depsgraph=dg)
result.modifiers.clear()
result.data = applied

# gancho metálico: vástago + anilla abierta
hook = bmesh.new()
stem_base = float(path[len(path) // 2][1]) + float(hanger_tall(0)) - 0.002
ring_c = stem_base + STEM + HOOK_R
pts = [(0, stem_base + STEM * k / 6) for k in range(7)]
pts += [(HOOK_R * math.sin(a), ring_c - HOOK_R * math.cos(a)) for a in np.linspace(0.3, math.pi * 1.5, 30)]
tip = np.array(pts[-1])
pts += [tuple(tip + (-0.004 * k, 0.0025 * k * k)) for k in (1, 2)]  # la punta se abre un poco hacia fuera
prev = None
R = 0.0024
WIRE = 10
for i, (x, z) in enumerate(pts):
    a, b = np.array(pts[max(i - 1, 0)]), np.array(pts[min(i + 1, len(pts) - 1)])
    tan = (b - a) / np.linalg.norm(b - a)
    nx, nz = -tan[1], tan[0]
    ring = [hook.verts.new((x + nx * R * math.cos(t), R * math.sin(t), z + nz * R * math.cos(t))) for t in np.linspace(0, 2 * math.pi, WIRE, endpoint=False)]
    if prev:
        for k in range(WIRE):
            hook.faces.new((prev[k], prev[(k + 1) % WIRE], ring[(k + 1) % WIRE], ring[k]))
    else:
        hook.faces.new(ring[::-1])
    prev = ring
hook.faces.new(prev)
# casquillo metálico donde el gancho entra en la madera
bmesh.ops.create_cone(hook, cap_ends=True, segments=16, radius1=0.0058, radius2=0.0048, depth=0.008, matrix=__import__("mathutils").Matrix.Translation((0, 0, stem_base + 0.005)))
bmesh.ops.recalc_face_normals(hook, faces=hook.faces)
for f in hook.faces:
    f.smooth = True
kmesh = bpy.data.meshes.new("gancho")
hook.to_mesh(kmesh)
hook.free()
hook_obj = bpy.data.objects.new("gancho", kmesh)
scene.collection.objects.link(hook_obj)

# oclusión ambiental horneada en los vértices: oscurece el fondo de los pliegues, las axilas y
# el interior del cuello. Es lo que más ayuda a que la prenda se lea con volumen.
mat = bpy.data.materials.new("kit")
result.data.materials.append(mat)
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 96
scene.world = bpy.data.worlds.new("ao")
scene.world.light_settings.distance = 0.16
ao_attr = result.data.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
result.data.color_attributes.active_color = ao_attr
for o in scene.objects:
    o.select_set(o is result)
bpy.context.view_layer.objects.active = result
scene.render.bake.target = "VERTEX_COLORS"
bpy.ops.object.bake(type="AO")
ao = np.array([c.color[0] for c in ao_attr.data])
print("ao min %.2f mean %.2f max %.2f" % (ao.min(), ao.mean(), ao.max()))
shaped = np.clip(0.22 + 0.86 * ao**1.15, 0, 1)
for c, v in zip(ao_attr.data, shaped):
    c.color = (v, v, v, 1)

# la percha que se ve es algo más fina que la de colisión: así nunca asoma a través de la tela
vm = bmesh.new()
vrings = []
for i, (x, z) in enumerate(path):
    tan = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]
    tan /= np.linalg.norm(tan)
    nx, nz = -tan[1], tan[0]
    end = min(i, len(path) - 1 - i) / 4
    taper = math.sqrt(1 - (1 - min(end, 1)) ** 2) * 0.92 + 0.08
    vrings.append([
        vm.verts.new((
            x + nx * float(hanger_tall(x)) * 0.8 * math.cos(a) * taper,
            float(hanger_depth(x)) * 0.72 * math.sin(a) * taper,
            z + nz * float(hanger_tall(x)) * 0.8 * math.cos(a) * taper,
        ))
        for a in np.linspace(0, 2 * math.pi, SEG, endpoint=False)
    ])
for r0, r1 in zip(vrings, vrings[1:]):
    for k in range(SEG):
        vm.faces.new((r0[k], r0[(k + 1) % SEG], r1[(k + 1) % SEG], r1[k]))
vm.faces.new(vrings[0])
vm.faces.new(vrings[-1][::-1])
bmesh.ops.recalc_face_normals(vm, faces=vm.faces)
for f in vm.faces:
    f.smooth = True
vmesh = bpy.data.meshes.new("percha")
vm.to_mesh(vmesh)
vm.free()
hanger = bpy.data.objects.new("percha", vmesh)
scene.collection.objects.link(hanger)

# origen en el centro de la barra (la anilla la abraza)
for o in (result, hanger, hook_obj):
    o.location.z -= ring_c + 0.004
scene.frame_set(FRAMES)

for o in scene.objects:
    o.select_set(o in (result, hanger, hook_obj))
bpy.context.view_layer.objects.active = result
out = ROOT / "public" / "models"
out.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(out / f"camiseta-{KIT}.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_materials="NONE",
    export_vertex_color="ACTIVE",
    export_active_vertex_color_when_no_material=True,
    export_animations=False,
    export_yup=True,
)
print("exported", KIT, (out / f"camiseta-{KIT}.glb").stat().st_size // 1024, "KB")

if "--forms" in sys.argv:  # depuración: dónde quedan percha y moldes respecto a la prenda
    for o in scene.objects:
        if o.name.startswith("molde") or o.name == "percha_colision":
            o.hide_render = False
            o.scale = (1, 1, 1)
            o.animation_data_clear()
            o.location.z -= ring_c + 0.004
            dm = bpy.data.materials.new("dbg")
            dm.diffuse_color = (1, 0.5, 0.1, 1)
            o.data.materials.append(dm)
    result.display_type = "WIRE"
    result.hide_render = True

if PREVIEW:
    img = bpy.data.images.load(str(HERE / "build" / f"atlas-{KIT}.jpg"))
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    links.new(tex.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "TEXTURE"
    sh.show_cavity = True
    sh.show_shadows = True
    scene.render.resolution_x, scene.render.resolution_y = 700, 900
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 70
    scene.collection.objects.link(cam)
    scene.camera = cam
    centre = Vector((0, 0, -0.47))
    for name, ang in (("back", 0), ("front", 180), ("quarter", 62), ("side", 90)):
        a = math.radians(ang)
        cam.location = centre + Vector((math.sin(a) * 1.75, -math.cos(a) * 1.75, 0.05))
        cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(HERE / "build" / f"sim-{KIT}-{name}.png")
        bpy.ops.render.render(write_still=True)
