import * as THREE from 'three';

/**
 * Material de la camiseta con movimiento de tela en el vertex shader:
 * una brisa que ondula el tejido (más cuanto más lejos de la percha) y un
 * retraso del bajo respecto a los hombros cuando la percha gira o se balancea.
 */
export interface ClothUniforms {
  uTime: { value: number };
  uPhase: { value: number };
  /** Amplitud de la brisa en metros */
  uAmp: { value: number };
  /** Giro extra del bajo respecto a la percha (rad) */
  uTwist: { value: number };
  /** Desplazamiento del bajo en el plano xz local (m) */
  uBend: { value: THREE.Vector2 };
  /** Color del interior de la prenda */
  uLining: { value: THREE.Color };
}

const HEAD = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uAmp;
uniform float uTwist;
uniform vec2 uBend;

// 0 en los hombros (apoyados en la percha), 1 en el bajo; las mangas también cuelgan libres
float clothWeight(vec3 p) {
  float w = smoothstep(-0.13, -0.72, p.y);
  return max(w, 0.6 * smoothstep(0.17, 0.26, abs(p.x)) * smoothstep(-0.13, -0.24, p.y));
}

// x: altura de la onda; yz: su pendiente en x e y (para recalcular la normal)
vec3 clothWave(vec3 p) {
  float a1 = uTime * 1.15 + p.x * 6.0 + p.y * 9.0 + uPhase;
  float a2 = uTime * 1.9 + p.x * 16.0 - p.y * 7.0 + uPhase * 1.7;
  float a3 = uTime * 0.55 + p.y * 2.5 + uPhase * 0.6;
  float gust = 0.65 + 0.35 * sin(uTime * 0.31 + uPhase * 2.3);
  float h = 0.5 * sin(a1) + 0.3 * sin(a2) + sin(a3);
  vec2 g = vec2(3.0 * cos(a1) + 4.8 * cos(a2), 4.5 * cos(a1) - 2.1 * cos(a2) + 2.5 * cos(a3));
  return vec3(h, g) * gust;
}

vec2 clothTurn(vec2 xz, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * xz.x + s * xz.y, -s * xz.x + c * xz.y);
}
`;

const NORMAL = /* glsl */ `
float clothN = clothWeight(position);
objectNormal.xy -= objectNormal.z * uAmp * clothN * clothWave(position).yz;
objectNormal.xz = clothTurn(objectNormal.xz, uTwist * clothN);
objectNormal = normalize(objectNormal);
`;

const POSITION = /* glsl */ `
float clothW = clothWeight(position);
transformed.z += uAmp * clothW * clothWave(position).x;
transformed.xz += uBend * clothW * clothW;
transformed.xz = clothTurn(transformed.xz, uTwist * clothW);
`;

function animate(shader: { uniforms: Record<string, unknown>; vertexShader: string }, uniforms: ClothUniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${HEAD}`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${NORMAL}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${POSITION}`);
}

export function createClothMaterial(map: THREE.Texture, fabric: THREE.Texture, time: { value: number }, phase: number, lining: string) {
  const uniforms: ClothUniforms = {
    uTime: time,
    uPhase: { value: phase },
    uAmp: { value: 0 },
    uTwist: { value: 0 },
    uBend: { value: new THREE.Vector2() },
    uLining: { value: new THREE.Color(lining) },
  };
  const material = new THREE.MeshPhysicalMaterial({
    map,
    normalMap: fabric,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.66,
    // brillo satinado del poliéster: resalta el canto de cada pliegue
    sheen: 0.3,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color(0xe6ecff),
    // oclusión ambiental horneada en Blender (atributo color del modelo)
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    animate(shader, uniforms);
    // el interior de la prenda (se ve por el cuello, las mangas y el bajo) es tela lisa del color del kit
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLining;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = uLining;');
  };
  // la sombra tiene que deformarse igual que la tela
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depth.onBeforeCompile = (shader) => animate(shader, uniforms);
  return { material, depth, uniforms };
}
