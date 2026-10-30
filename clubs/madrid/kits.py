"""Equipaciones del Real Madrid 26/27 para tools/kit/prep.py: fotos (en fotos/), puntos clave y retoques.

Fotos de la tienda oficial (1500×1500): frente y espalda con el parche de LaLiga. Las coordenadas
son píxeles de cada foto. Los logos de la cara exterior de las mangas (fotos/detalles/*.png) se
recortaron de los primeros planos de la tienda.
"""

# cara exterior de las mangas (ver clubs/huesca/kits.py): aquí se compone a partir del color de la
# tela, las tres rayas que bajan del hombro y el logo de cada manga (HP en la izquierda, parche de
# LaLiga en la derecha)
def sleeve_top(stripes, hp):
    return dict(
        length=0.225,
        width=0.084,
        # huecos libres de la foto delantera (bajo cada manga) donde se guardan las dos franjas
        rects=dict(A=(200, 720), B=(1140, 720)),
        synth=dict(
            stripes=dict(color=stripes, width=0.011, gap=0.0075, start=0.088),
            logos=dict(
                A=dict(photo=f"detalles/{hp}", at=0.052, size=0.052),
                B=dict(photo="detalles/laliga.png", at=0.07, size=0.06),
            ),
        ),
    )


KITS = {
    # Primera equipación 26/27, manga corta. Blanca: el fondo de la foto apenas se distingue,
    # por eso los cortes entre manga y cuerpo van marcados a mano.
    "campo": dict(
        front="campo-frente.jpg",
        back="campo-espalda.jpg",
        back_pts=[(628, 102), (256, 609), (459, 642), (489, 1407), (1060, 1380), (1053, 637), (1245, 615), (904, 108)],
        # foto frontal SIN espejar: [neckL, cuffOutL, cuffInL, hemL, hemR, cuffInR, cuffOutR, neckR]
        front_pts=[(605, 106), (212, 623), (398, 666), (420, 1410), (1103, 1399), (1108, 677), (1277, 644), (898, 105)],
        # escote delantero: borde interior del cuello verde (por encima se ve el interior de la espalda)
        neck=[(605, 106), (628, 104), (650, 125), (680, 150), (705, 165), (760, 170), (820, 165), (845, 150), (865, 125), (880, 104), (898, 105)],
        cuts=dict(
            front=[[(400, 482), (406, 505), (413, 532)], [(1102, 472), (1098, 498), (1093, 522)]],
            back=[[(420, 440), (432, 480), (444, 540), (452, 600), (457, 642)], [(1100, 440), (1088, 480), (1075, 540), (1063, 600), (1056, 638)]],
        ),
        arm=dict(back=[(420, 440), (1100, 440)], front=[(400, 482), (1102, 472)]),
        close=31,  # el ribete blanco del parche de LaLiga, en el canto de la manga, abre una muesca
        crop=dict(x=190, y=40, w=1110, h=1420),
        delight=0,  # fotos de estudio con luz plana: no hay sombreado que quitar
        ink="#143933",  # nombre en verde, como la tienda
        edge="#143933",
        lining="#e6e4df",
        text_cx=765,  # la tienda centra la serigrafía al 51 % de la foto
        lettering=dict(font="Saira Dorsal", nameSize=116, nameCentre=223, numberCentre=568, numberHeight=420, digitGap=33),
        sleeve_top=sleeve_top((75, 44, 156), "hp.png"),
    ),
    # Camiseta de portero negra 26/27 (la que llevan Courtois y Lunin en las fotos oficiales)
    "portero": dict(
        front="portero-frente.jpg",
        back="portero-espalda.jpg",
        back_pts=[(650, 90), (220, 613), (440, 684), (500, 1415), (1045, 1385), (1074, 676), (1279, 602), (850, 85)],
        front_pts=[(643, 65), (206, 584), (436, 648), (460, 1415), (1065, 1418), (1101, 646), (1292, 584), (880, 72)],
        neck=[(643, 65), (660, 80), (700, 95), (760, 100), (820, 95), (860, 82), (880, 72)],
        cuts=dict(
            # solo el tramo final: con la axila más arriba la manga queda suelta y aletea
            front=[[(438, 580), (437, 615), (436, 646)], [(1090, 580), (1095, 615), (1099, 644)]],
            back=[[(444, 615), (442, 650), (441, 682)], [(1068, 610), (1071, 645), (1073, 674)]],
        ),
        arm=dict(back=[(444, 615), (1068, 610)], front=[(438, 580), (1090, 580)]),
        crop=dict(x=180, y=40, w=1140, h=1420),
        delight=0,
        ink="#b2b0b1",
        edge="#b2b0b1",
        lining="#1c1c1e",
        text_cx=750,
        lettering=dict(font="Saira Portero", nameSize=113, nameCentre=203, numberCentre=563, numberHeight=420, digitGap=33),
        sleeve_top=sleeve_top((236, 236, 234), "hp-portero.png"),
    ),
}
