import type { Player } from '../../src/data/players';

// Plantilla del primer equipo, temporada 2026/27 (Primera Federación, Grupo 2).
// Dorsales, demarcación y nombre de camiseta: sdhuesca.es/plantilla-sd-huesca-2026-27 (12 oct 2026).
// Edad, procedencia y contrato: es.wikipedia.org/wiki/Sociedad_Deportiva_Huesca y lapreferente.com.
const raw: Omit<Player, 'id'>[] = [
  { dorsal: 1, shirt: 'GAZZANIGA', nombre: 'Gianfranco', apellido: 'Gazzaniga', pos: 'POR', rol: 'Portero', edad: 32, pais: 'Argentina', bandera: '🇦🇷', procedencia: 'Real Murcia', contrato: 2027 },
  { dorsal: 13, shirt: 'Á. KILLANE', nombre: 'Álvaro', apellido: 'Killane', pos: 'POR', rol: 'Portero', edad: 21, pais: 'Argentina', bandera: '🇦🇷', procedencia: 'Las Palmas Atlético', contrato: 2028 },

  { dorsal: 2, shirt: 'DJETEI', nombre: 'Mohammed', apellido: 'Djetei', pos: 'DEF', rol: 'Central', edad: 32, pais: 'Camerún', bandera: '🇨🇲', procedencia: 'Maccabi Netanya', contrato: 2027 },
  { dorsal: 3, shirt: 'IVÁN R.', nombre: 'Iván', apellido: 'Rodríguez', pos: 'DEF', rol: 'Lateral izquierdo', edad: 20, pais: 'Andorra', bandera: '🇦🇩', procedencia: 'FC Andorra', contrato: 2027 },
  { dorsal: 4, shirt: 'Y. KEMBO', nombre: 'Yann', apellido: 'Kembo', pos: 'DEF', rol: 'Central', edad: 24, pais: 'Francia', bandera: '🇫🇷', procedencia: 'Real Sporting', contrato: 2027 },
  { dorsal: 5, shirt: 'FORNOS', nombre: 'Quique', apellido: 'Fornos', pos: 'DEF', rol: 'Central', edad: 29, pais: 'España', bandera: '🇪🇸', procedencia: 'Cultural Leonesa', contrato: 2028 },
  { dorsal: 15, shirt: 'G. MOLINA', nombre: 'Guillem', apellido: 'Molina', pos: 'DEF', rol: 'Lateral derecho', edad: 26, pais: 'España', bandera: '🇪🇸', procedencia: 'AVS Futebol SAD', contrato: 2028 },
  { dorsal: 16, shirt: 'SALVA RUIZ', nombre: 'Salva', apellido: 'Ruiz', pos: 'DEF', rol: 'Lateral izquierdo', edad: 31, pais: 'España', bandera: '🇪🇸', procedencia: 'CD Castellón', contrato: 2028 },
  { dorsal: 20, shirt: 'MARC AZNAR', nombre: 'Marc', apellido: 'Aznar', pos: 'DEF', rol: 'Central', edad: 20, pais: 'España', bandera: '🇪🇸', procedencia: 'Girona FC Juvenil', contrato: 2028 },
  { dorsal: 24, shirt: 'V. GARCÍA', nombre: 'Víctor', apellido: 'García', pos: 'DEF', rol: 'Lateral derecho', edad: 32, pais: 'Venezuela', bandera: '🇻🇪', procedencia: 'Cultural Leonesa', contrato: 2028 },

  { dorsal: 6, shirt: 'JIMMY', nombre: 'Jimmy', apellido: 'Suárez', pos: 'MED', rol: 'Mediocentro', edad: 29, pais: 'España', bandera: '🇪🇸', procedencia: 'AEK Larnaca', contrato: 2028 },
  { dorsal: 7, shirt: 'TRESACO', nombre: 'Rafa', apellido: 'Tresaco', pos: 'MED', rol: 'Extremo izquierdo', edad: 26, pais: 'España', bandera: '🇪🇸', procedencia: 'Cultural Leonesa', contrato: 2028 },
  { dorsal: 10, shirt: 'PASCU', nombre: 'Pascu', apellido: 'Alba', pos: 'MED', rol: 'Mediapunta', edad: 26, pais: 'España', bandera: '🇪🇸', procedencia: 'Racing de Ferrol', contrato: 2028 },
  { dorsal: 11, shirt: 'LUISMI', nombre: 'Luismi', apellido: 'Redondo', pos: 'MED', rol: 'Extremo derecho', edad: 28, pais: 'España', bandera: '🇪🇸', procedencia: 'FC Andorra', contrato: 2028 },
  { dorsal: 14, shirt: 'MARIO GARCÍA', nombre: 'Mario', apellido: 'García', pos: 'MED', rol: 'Mediocentro', edad: 29, pais: 'España', bandera: '🇪🇸', procedencia: 'Zamora CF', contrato: 2027 },
  { dorsal: 17, shirt: 'D. COLLADO', nombre: 'Diego', apellido: 'Collado', pos: 'MED', rol: 'Mediapunta', edad: 25, pais: 'España', bandera: '🇪🇸', procedencia: 'Cultural Leonesa', contrato: 2027 },
  { dorsal: 21, shirt: 'DIEGO GÓMEZ', nombre: 'Diego', apellido: 'Gómez', pos: 'MED', rol: 'Extremo derecho', edad: 22, pais: 'España', bandera: '🇪🇸', procedencia: 'RC Deportivo', contrato: 2027 },
  { dorsal: 22, shirt: 'GOROSTIDI', nombre: 'Ander', apellido: 'Gorostidi', pos: 'MED', rol: 'Mediocentro', edad: 30, pais: 'España', bandera: '🇪🇸', procedencia: 'Racing de Ferrol', contrato: 2028 },
  { dorsal: 23, shirt: 'SIELVA', nombre: 'Óscar', apellido: 'Sielva', pos: 'MED', rol: 'Mediocentro', edad: 35, pais: 'España', bandera: '🇪🇸', procedencia: 'SD Eibar', contrato: 2029, capitan: true },

  { dorsal: 8, shirt: 'DOUGLAS', nombre: 'Douglas', apellido: 'Aurélio', pos: 'DEL', rol: 'Extremo derecho', edad: 27, pais: 'Brasil', bandera: '🇧🇷', procedencia: 'CD Castellón', contrato: 2027 },
  { dorsal: 9, shirt: 'SERGI ENRICH', nombre: 'Sergi', apellido: 'Enrich', pos: 'DEL', rol: 'Delantero centro', edad: 36, pais: 'España', bandera: '🇪🇸', procedencia: 'Real Zaragoza', contrato: 2028 },
  { dorsal: 18, shirt: 'JUÁREZ', nombre: 'Agustín', apellido: 'Juárez', pos: 'DEL', rol: 'Delantero centro', edad: 21, pais: 'Argentina', bandera: '🇦🇷', procedencia: "Newell's Old Boys", contrato: 2028 },
  { dorsal: 19, shirt: 'CRISTIAN H.', nombre: 'Cristian', apellido: 'Herrera', pos: 'DEL', rol: 'Delantero centro', edad: 35, pais: 'España', bandera: '🇪🇸', procedencia: 'RC Deportivo', contrato: 2027 },
];

export const SQUAD: Player[] = raw.map((p) => ({ ...p, id: `p${p.dorsal}` }));
