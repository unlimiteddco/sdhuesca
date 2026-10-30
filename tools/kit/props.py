"""Convierte los modelos de atrezo en GLB ligeros para la web.

  balón  Poly Haven "football" (CC0)                     -> clubs/<club>/public/models/balon.glb
  botas  generadas con Magnific (texto a 3D, motor Tripo) -> clubs/<club>/public/models/bota-*.glb

Uso: blender -b -P tools/kit/props.py -- <carpeta polyhaven> <carpeta botas> [--club <club>]
Cada modelo queda centrado, apoyado en el suelo, a tamaño real y con las texturas dentro del .glb
(en WebP: 1K las botas y 512 px el balón, que en pantalla es pequeño).
Las botas quedan con el largo a lo largo del eje X.
"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1 :]
CLUB = ARGS[ARGS.index("--club") + 1] if "--club" in ARGS else "huesca"
OUT = Path(__file__).parent.parent.parent / "clubs" / CLUB / "public" / "models"


def bounds(obj):
    box = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return Vector([min(v[i] for v in box) for i in range(3)]), Vector([max(v[i] for v in box) for i in range(3)])


def convert(path, name, keep=None, length=None, level=0.0, max_tris=8000, tex=1024):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    obj = next(o for o in meshes if keep is None or keep in o.name)
    for o in meshes:
        if o is not obj:
            bpy.data.objects.remove(o)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if length:  # el eje principal del objeto (su largo) se alinea con X y se escala a su largo real
        pts = np.array([v.co[:] for v in obj.data.vertices])
        vals, vecs = np.linalg.eigh(np.cov((pts - pts.mean(axis=0)).T))
        axis = Vector(vecs[:, np.argmax(vals)])
        if axis.x < 0:
            axis = -axis
        obj.rotation_mode = "QUATERNION"
        obj.rotation_quaternion = axis.rotation_difference(Vector((1, 0, 0)))
        bpy.ops.object.transform_apply(rotation=True)
        # el eje principal de una bota queda algo inclinado hacia el talón: se nivela la suela
        obj.rotation_mode = "XYZ"
        obj.rotation_euler.y = math.radians(level)
        bpy.ops.object.transform_apply(rotation=True)
        lo, hi = bounds(obj)
        obj.scale = (length / (hi.x - lo.x),) * 3
        bpy.ops.object.transform_apply(scale=True)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris > max_tris:
        obj.modifiers.new("Decimate", "DECIMATE").ratio = max_tris / tris
    lo, hi = bounds(obj)
    obj.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    bpy.ops.object.transform_apply(location=True)
    for img in bpy.data.images:
        if max(img.size) > tex:
            img.scale(tex, tex)
    obj.name = name
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / f"{name}.glb"), export_format="GLB", use_selection=True, export_apply=True,
        export_image_format="WEBP", export_image_quality=82, export_yup=True,
    )
    print("exported", name, (OUT / f"{name}.glb").stat().st_size // 1024, "KB", "tris", tris, "dims", tuple(round(d, 3) for d in obj.dimensions))


polyhaven, boots = Path(ARGS[0]), Path(ARGS[1])
convert(polyhaven / "football" / "football.gltf", "balon", keep="inflated", tex=512)
convert(boots / "negra" / "model.glb", "bota-negra", length=0.285)
convert(boots / "blanca" / "model.glb", "bota-blanca", length=0.285)
