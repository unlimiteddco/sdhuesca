# Vestuarios en 3D

Las camisetas de un club colgadas en un vestuario 3D: una percha por jugador, ficha con estadísticas y un personalizador que lleva a la tienda oficial con tu nombre y dorsal ya puestos.

Un mismo código y una web por club:

| Club | Carpeta | Web |
|---|---|---|
| SD Huesca | `clubs/huesca` | https://sdhuesca.bellostas.studio |
| Real Madrid | `clubs/madrid` | https://realmadrid.bellostas.studio |

Tributos no oficiales, sin relación con los clubes ni con las competiciones. Escudos, equipaciones, fotos y marcas pertenecen a sus titulares.

Astro, Tailwind y Three.js · Diseñado y desarrollado por [Bellostas Studio](https://bellostas.studio)

## Desarrollo

```bash
npm install
npm run dev                      # Huesca (por defecto), http://localhost:4321
CLUB=madrid npm run dev          # otro club
CLUB=madrid npm run build        # sitio estático en dist/
CLUB=madrid npm run stats        # actualiza las estadísticas de liga (Transfermarkt)
```

## Qué hay en la carpeta de cada club

- `club.json`: textos, colores del vestuario, serigrafía (letra, medidas, cifras), tienda (producto, variantes y propiedades del carrito) y fuente de estadísticas.
- `theme.css`: colores de la interfaz y letras de serigrafía.
- `squad.ts` (plantilla) y `stats.ts` (generado por `npm run stats`).
- `kits.py`: fotos y puntos clave de cada equipación para generar las camisetas 3D.
- `fotos/`: fotos de producto de origen (no entran en la web).
- `public/`: lo que se publica (modelos, texturas, retratos, escudo); `og/` y `fonts/`: tarjetas de compartir y letras.

## Despliegue

El `Dockerfile` compila un club y lo sirve con nginx en el puerto 80 (compresión, caché y página 404 en `nginx.conf`). En Dokploy, una aplicación por club desde este mismo repositorio: tipo de compilación **Dockerfile**, en *Build Args* `CLUB=madrid` (sin nada, Huesca), y el dominio apuntando al puerto 80.

Tras cada jornada: `CLUB=<club> npm run stats`, commit y push.

## Camisetas 3D

Salen de las fotos de producto:

```bash
python tools/kit/prep.py --club madrid             # patrón y texturas (frente, espalda y cara exterior de las mangas)
blender -b -P tools/kit/sim.py -- --club madrid --kit campo   # simulación de tela en la percha → .glb
python tools/kit/lettering.py --club madrid        # cifras del dorsal y letras de los nombres
```

`tools/kit/props.py` convierte el balón ([Poly Haven](https://polyhaven.com/a/football), CC0) y las botas. Las letras de serigrafía son fuentes libres (Archivo y Saira, OFL) ajustadas en ancho y grosor a las oficiales.
