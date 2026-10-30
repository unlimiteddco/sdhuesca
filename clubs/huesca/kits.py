"""Equipaciones del SD Huesca para tools/kit/prep.py: fotos (en fotos/), puntos clave y retoques.

Las coordenadas son píxeles de cada foto."""

KITS = {
    # Primera equipación 2026/27, manga corta
    "campo": dict(
        front="front.webp",
        back="back.webp",
        back_pts=[(343, 80), (70, 477), (227, 496), (242, 998), (689, 989), (677, 480), (823, 465), (537, 74)],
        # foto frontal SIN espejar: [neckL, cuffOutL, cuffInL, hemL, hemR, cuffInR, cuffOutR, neckR]
        front_pts=[(348, 91), (104, 471), (247, 479), (220, 1018), (697, 1010), (660, 483), (807, 473), (543, 85)],
        neck=None,  # el escote se detecta solo (interior gris de la espalda)
        cuts=dict(front=[], back=[]),
        crop=dict(x=50, y=45, w=800, h=1035),
        delight=16,
        crest=dict(detail="escudo-detalle.webp", detail_roi=(150, 330, 640, 800), roi=(548, 212, 672, 328)),
        ink="#f7f5ee",
        edge="#0c0c10",
        lining="#1f3f5c",  # color del interior de la prenda (se ve por el cuello)
        text_cx=450,  # la tienda oficial centra la serigrafía en la foto, no en el cuello
        # Cara exterior de la manga. De frente y de espalda se ve de canto, así que el patrón que sale
        # de esas fotos se queda sin ella: se añade como una franja entre delantero y espalda, desde
        # el puño hacia el hombro, con la tela de la foto lateral y el parche de su primer plano.
        sleeve_top=dict(
            length=0.225,  # metros de costura que cubre, contados desde el puño
            width=0.084,  # ancho de la franja: lo que mide el parche más un margen
            side="lateral.webp",  # foto lateral (manga izquierda): eje de la manga, borde del puño y media banda lisa entre los dos logos
            centre=496, cuff=490, band=41,
            # parche de la manga derecha: su elipse en el primer plano, a qué distancia del puño va y cuánto mide
            patch=dict(photo="manga-rfef.webp", centre=(336, 706), radius=(187, 211), at=0.086, size=0.078),
        ),
    ),
    # Tercera equipación de portero (tienda oficial, 2025/26), manga larga con cuello polo. Es la
    # naranja, el color con el que posan los porteros en las fotos oficiales de la plantilla
    "portero": dict(
        front="portero-naranja/01.jpg",
        back="portero-naranja/02.jpg",
        back_pts=[(333, 120), (64, 1021), (160, 1021), (200, 1039), (727, 1016), (753, 1012), (857, 1008), (583, 122)],
        front_pts=[(330, 129), (56, 1033), (167, 1036), (200, 1035), (703, 1040), (727, 1054), (806, 1051), (584, 114)],
        # escote delantero a mano: solapas del polo, interior visible y pico
        neck=[(330, 129), (353, 100), (368, 85), (375, 88), (375, 108), (375, 150), (377, 181), (416, 194), (452, 206), (499, 190), (545, 176), (550, 150), (552, 128), (551, 106), (552, 88), (560, 89), (572, 100), (584, 114)],
        # las mangas largas caen pegadas al cuerpo: estas líneas las separan
        cuts=dict(
            front=[
                [(213, 455), (217, 470), (221, 490), (224, 520), (225, 540), (220, 558)],
                [(695, 450), (692, 465), (688, 485), (683, 515), (682, 545), (684, 600), (687, 680), (689, 760), (697, 860), (700, 940), (702, 1000), (704, 1040), (705, 1064)],
            ],
            back=[
                [(179, 440), (180, 515), (178, 600), (175, 680), (176, 720), (176, 780), (174, 830)],
                [(702, 438), (700, 465), (701, 500), (698, 545), (699, 580), (702, 620), (705, 665)],
            ],
        ),
        # axilas (arranque de esas líneas): en manga larga la costura lateral tiene dos tramos
        arm=dict(back=[(179, 440), (702, 438)], front=[(213, 455), (695, 450)]),
        crop=dict(x=40, y=30, w=820, h=1061),
        delight=44,  # el zigzag es dibujo, no sombra: solo se aplana lo muy suave
        crest=dict(detail="portero-naranja/04.jpg", detail_roi=(170, 230, 700, 770), roi=(527, 238, 630, 336)),
        ink="#f7f5ee",  # la tienda serigrafía esta camiseta en blanco con borde negro
        edge="#0c0c10",
        lining="#242424",
    ),
}
