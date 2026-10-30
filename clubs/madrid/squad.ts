import type { Player } from '../../src/data/players';

// Plantilla del primer equipo, temporada 2026/27.
// Dorsales y demarcación: realmadrid.com/es-ES/futbol/primer-equipo/plantilla (30 oct 2026). Nombre en la
// camiseta: el de la tienda oficial (shop.realmadrid.com, personalización por jugador). Edad,
// nacionalidad, procedencia, contrato y puesto: transfermarkt.es.
const raw: Omit<Player, 'id'>[] = [
  { dorsal: 1, shirt: 'COURTOIS', nombre: 'Thibaut', apellido: 'Courtois', pos: 'POR', rol: 'Portero', edad: 34, pais: 'Bélgica', bandera: '🇧🇪', procedencia: 'Chelsea FC', contrato: 2027 },
  { dorsal: 13, shirt: 'LUNIN', nombre: 'Andriy', apellido: 'Lunin', pos: 'POR', rol: 'Portero', edad: 27, pais: 'Ucrania', bandera: '🇺🇦', procedencia: 'Zorya Lugansk', contrato: 2030 },

  { dorsal: 2, shirt: 'ASENCIO', nombre: 'Raúl', apellido: 'Asencio', pos: 'DEF', rol: 'Defensa central', edad: 23, pais: 'España', bandera: '🇪🇸', procedencia: 'Real Madrid Castilla', contrato: 2031 },
  { dorsal: 3, shirt: 'E. MILITÃO', nombre: 'Éder', apellido: 'Militão', pos: 'DEF', rol: 'Defensa central', edad: 28, pais: 'Brasil', bandera: '🇧🇷', procedencia: 'FC Oporto', contrato: 2028 },
  { dorsal: 4, shirt: 'HUIJSEN', nombre: 'Dean', apellido: 'Huijsen', pos: 'DEF', rol: 'Defensa central', edad: 21, pais: 'España', bandera: '🇪🇸', procedencia: 'AFC Bournemouth', contrato: 2030 },
  { dorsal: 12, shirt: 'TRENT', nombre: 'Trent', apellido: 'Alexander-Arnold', pos: 'DEF', rol: 'Lateral derecho', edad: 28, pais: 'Inglaterra', bandera: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', procedencia: 'Liverpool FC', contrato: 2031 },
  { dorsal: 16, shirt: 'KONATÉ', nombre: 'Ibrahima', apellido: 'Konaté', pos: 'DEF', rol: 'Defensa central', edad: 27, pais: 'Francia', bandera: '🇫🇷', procedencia: 'Liverpool FC', contrato: 2030 },
  { dorsal: 17, shirt: 'CUCURELLA', nombre: 'Marc', apellido: 'Cucurella', pos: 'DEF', rol: 'Lateral izquierdo', edad: 28, pais: 'España', bandera: '🇪🇸', procedencia: 'Chelsea FC', contrato: 2032 },
  { dorsal: 18, shirt: 'A. CARRERAS', nombre: 'Álvaro', apellido: 'Carreras', pos: 'DEF', rol: 'Lateral izquierdo', edad: 23, pais: 'España', bandera: '🇪🇸', procedencia: 'SL Benfica', contrato: 2031 },
  { dorsal: 22, shirt: 'RÜDIGER', nombre: 'Antonio', apellido: 'Rüdiger', pos: 'DEF', rol: 'Defensa central', edad: 33, pais: 'Alemania', bandera: '🇩🇪', procedencia: 'Chelsea FC', contrato: 2027 },
  { dorsal: 23, shirt: 'F. MENDY', nombre: 'Ferland', apellido: 'Mendy', pos: 'DEF', rol: 'Lateral izquierdo', edad: 31, pais: 'Francia', bandera: '🇫🇷', procedencia: 'Olympique de Lyon', contrato: 2028 },
  { dorsal: 24, shirt: 'DUMFRIES', nombre: 'Denzel', apellido: 'Dumfries', pos: 'DEF', rol: 'Lateral derecho', edad: 30, pais: 'Países Bajos', bandera: '🇳🇱', procedencia: 'Inter de Milán', contrato: 2030 },

  { dorsal: 5, shirt: 'BELLINGHAM', nombre: 'Jude', apellido: 'Bellingham', pos: 'MED', rol: 'Mediocentro ofensivo', edad: 23, pais: 'Inglaterra', bandera: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', procedencia: 'Borussia Dortmund', contrato: 2029 },
  { dorsal: 6, shirt: 'CAMAVINGA', nombre: 'Eduardo', apellido: 'Camavinga', pos: 'MED', rol: 'Mediocentro', edad: 23, pais: 'Francia', bandera: '🇫🇷', procedencia: 'Stade Rennais FC', contrato: 2029 },
  { dorsal: 8, shirt: 'VALVERDE', nombre: 'Federico', apellido: 'Valverde', pos: 'MED', rol: 'Mediocentro', edad: 28, pais: 'Uruguay', bandera: '🇺🇾', procedencia: 'Real Madrid Castilla', contrato: 2029, capitan: true },
  { dorsal: 14, shirt: 'TCHOUAMENI', nombre: 'Aurélien', apellido: 'Tchouaméni', pos: 'MED', rol: 'Pivote', edad: 26, pais: 'Francia', bandera: '🇫🇷', procedencia: 'AS Mónaco', contrato: 2028 },
  { dorsal: 15, shirt: 'ARDA GÜLER', nombre: 'Arda', apellido: 'Güler', pos: 'MED', rol: 'Mediocentro ofensivo', edad: 21, pais: 'Turquía', bandera: '🇹🇷', procedencia: 'Fenerbahce', contrato: 2029 },
  { dorsal: 20, shirt: 'BERNARDO', nombre: 'Bernardo', apellido: 'Silva', pos: 'MED', rol: 'Mediocentro ofensivo', edad: 32, pais: 'Portugal', bandera: '🇵🇹', procedencia: 'Manchester City', contrato: 2028 },
  { dorsal: 27, shirt: 'THIAGO', nombre: 'Thiago', apellido: 'Pitarch', pos: 'MED', rol: 'Mediocentro', edad: 19, pais: 'España', bandera: '🇪🇸', procedencia: 'Real Madrid Castilla', contrato: 2030 },

  { dorsal: 7, shirt: 'VINI JR.', nombre: 'Vinícius', apellido: 'Júnior', pos: 'DEL', rol: 'Extremo izquierdo', edad: 26, pais: 'Brasil', bandera: '🇧🇷', procedencia: 'CR Flamengo', contrato: 2032 },
  { dorsal: 9, shirt: 'ENDRICK', nombre: '', apellido: 'Endrick', pos: 'DEL', rol: 'Delantero centro', edad: 20, pais: 'Brasil', bandera: '🇧🇷', procedencia: 'SE Palmeiras', contrato: 2030 },
  { dorsal: 10, shirt: 'MBAPPÉ', nombre: 'Kylian', apellido: 'Mbappé', pos: 'DEL', rol: 'Delantero centro', edad: 27, pais: 'Francia', bandera: '🇫🇷', procedencia: 'París Saint-Germain', contrato: 2029 },
  { dorsal: 11, shirt: 'RODRYGO', nombre: '', apellido: 'Rodrygo', pos: 'DEL', rol: 'Extremo derecho', edad: 25, pais: 'Brasil', bandera: '🇧🇷', procedencia: 'Santos FC', contrato: 2028 },
  { dorsal: 19, shirt: 'C. ESPÍ', nombre: 'Carlos', apellido: 'Espí', pos: 'DEL', rol: 'Delantero centro', edad: 21, pais: 'España', bandera: '🇪🇸', procedencia: 'Levante UD', contrato: 2031 },
  { dorsal: 21, shirt: 'BRAHIM', nombre: 'Brahim', apellido: 'Díaz', pos: 'DEL', rol: 'Extremo derecho', edad: 27, pais: 'Marruecos', bandera: '🇲🇦', procedencia: 'Manchester City', contrato: 2027 },
  { dorsal: 25, shirt: 'YAN DIOMANDE', nombre: 'Yan', apellido: 'Diomande', pos: 'DEL', rol: 'Extremo derecho', edad: 19, pais: 'Costa de Marfil', bandera: '🇨🇮', procedencia: 'RB Leipzig', contrato: 2033 },
];

export const SQUAD: Player[] = raw.map((p) => ({ ...p, id: `p${p.dorsal}` }));
