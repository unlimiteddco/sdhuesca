# El vestuario del Huesca en 3D

Las camisetas de la SD Huesca 2026/27 colgadas en un vestuario 3D: una percha por jugador, ficha con estadísticas y un personalizador que lleva a la tienda oficial con tu nombre y dorsal ya puestos.

Tributo no oficial, sin relación con la SD Huesca ni con la RFEF. Escudo, equipaciones, fotos y marcas pertenecen a sus titulares.

**https://sdhuesca.bellostas.studio** · Astro, Tailwind y Three.js · Diseñado y desarrollado por [Bellostas Studio](https://bellostas.studio)

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # sitio estático en dist/
npm run stats    # actualiza las estadísticas de liga (Transfermarkt)
```

## Despliegue

El `Dockerfile` compila el sitio y lo sirve con nginx en el puerto 80 (compresión, caché y página 404 en `nginx.conf`). En Dokploy: tipo de compilación **Dockerfile** y dominio apuntando al puerto 80.

Tras cada jornada: `npm run stats`, commit y push.

## Datos

- Plantilla: `src/data/squad.ts` (web oficial del club).
- Estadísticas: `src/data/stats.ts`, generado por `tools/stats.mjs`.
- Tienda: `src/data/store.ts` (producto y variantes de la tienda oficial; revisar si el club cambia el producto).

## Modelos 3D

Las camisetas salen de las fotos de producto: `tools/kit/prep.py` saca el patrón y las texturas, y `tools/kit/sim.py` las cuelga de la percha con el simulador de tela de Blender. `tools/kit/lettering.py` prepara la serigrafía: las cifras del dorsal (los dibujos de la tienda oficial, con el escudo a una tinta) y la letra de los nombres (Archivo, OFL, ajustada a la oficial). `tools/kit/props.py` convierte el balón ([Poly Haven](https://polyhaven.com/a/football), CC0) y las botas. Solo hace falta para regenerar los modelos; los `.glb` ya están en `public/models/`.
