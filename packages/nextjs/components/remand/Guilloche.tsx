/**
 * Grabado de seguridad paramétrico.
 *
 * Es el lenguaje de los billetes, los bonos y los títulos: una curva que se
 * cierra sobre sí misma y cuyos cruces generan la trama. Cada expediente deriva
 * su propia roseta de su número de caso, así que dos expedientes no comparten
 * figura y el mismo expediente la conserva entre visitas.
 *
 * Todo se genera aquí, sin red y sin dependencias. Los trazos van en
 * `currentColor`, de modo que el tema se resuelve solo.
 */

/** FNV-1a de 32 bits. Determinista, igual en servidor y en navegador. */
function hash32(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * xorshift32 sembrado.
 *
 * No se usa Math.random a propósito: el servidor y el cliente tienen que
 * dibujar exactamente la misma figura o React reportaría un desajuste de
 * hidratación, y además el expediente dejaría de tener una roseta estable.
 */
function makeRandom(seed: number): () => number {
  let s = seed || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x1_0000_0000;
  };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Hipotrocoide: un círculo de radio r rodando dentro de otro de radio R, con el
 * lápiz a distancia d del centro del pequeño. La curva se cierra tras
 * r / mcd(R, r) vueltas, y ese cociente es lo que decide cuántos lóbulos tiene.
 */
function hypotrochoid(R: number, r: number, d: number, steps: number): string {
  const turns = r / gcd(R, r);
  const k = R - r;
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * turns * 2 * Math.PI;
    const x = k * Math.cos(t) + d * Math.cos((k / r) * t);
    const y = k * Math.sin(t) - d * Math.sin((k / r) * t);
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M ${points.join(" L ")} Z`;
}

/** Radio que produce lóbulos limpios: los divisores triviales dan círculos. */
function pickRadius(R: number, rand: () => number): number {
  const candidates: number[] = [];
  for (let r = 7; r < R * 0.62; r += 1) {
    if (gcd(R, r) <= 3) candidates.push(r);
  }
  return candidates[Math.floor(rand() * candidates.length)] ?? 23;
}

export type GuillocheProps = {
  /** Semilla: el número de expediente o la referencia del acta. */
  seed: string;
  size?: number;
  /** Curvas superpuestas. Su desfase es lo que produce el moiré del grabado. */
  layers?: number;
  weight?: number;
  /** Puntos por curva. Bajarlo aligera el DOM sin cambiar el trazo visible. */
  steps?: number;
  /** Texto que recorre el anillo exterior en microtipografía. */
  microtext?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function Guilloche({
  seed,
  size = 220,
  layers = 5,
  weight = 0.5,
  steps = 900,
  microtext,
  className,
  style,
}: GuillocheProps) {
  const rand = makeRandom(hash32(seed));
  const R = 100;

  // Dos familias de curvas, una densa y otra abierta, girando en sentidos
  // opuestos. La superposición es la que genera la trama.
  const inner = pickRadius(R, rand);
  const outer = pickRadius(R, rand);
  const dInner = 18 + rand() * 46;
  const dOuter = 24 + rand() * 52;
  const spin = rand() * 360;
  const scaleInner = 0.58 + rand() * 0.16;

  const pathOuter = hypotrochoid(R, outer, dOuter, steps);
  const pathInner = hypotrochoid(R, inner, dInner, Math.round(steps * 0.8));
  const ringId = `gr-ring-${hash32(seed).toString(36)}`;

  return (
    <svg
      viewBox="-110 -110 220 220"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth={weight} vectorEffect="non-scaling-stroke">
        {/* Un grabado siempre va encuadrado por anillos. */}
        <circle r="104" opacity="0.5" />
        <circle r="101" opacity="0.28" />
        <circle r="62" opacity="0.34" />

        <g transform={`rotate(${spin})`}>
          {Array.from({ length: layers }, (_, i) => (
            <path
              key={`o${i}`}
              d={pathOuter}
              transform={`rotate(${(i * 360) / (layers * 7)}) scale(${1 - i * 0.012})`}
              opacity={0.85 - i * 0.1}
            />
          ))}
        </g>

        <g transform={`rotate(${-spin * 0.6}) scale(${scaleInner})`}>
          {Array.from({ length: layers }, (_, i) => (
            <path
              key={`i${i}`}
              d={pathInner}
              transform={`rotate(${(-i * 360) / (layers * 5)})`}
              opacity={0.7 - i * 0.09}
            />
          ))}
        </g>
      </g>

      {microtext && (
        <>
          <defs>
            <path id={ringId} d="M 0 -95 A 95 95 0 1 1 0 95 A 95 95 0 1 1 0 -95" fill="none" />
          </defs>
          <text
            fill="currentColor"
            fontSize="4.4"
            letterSpacing="1.5"
            opacity="0.7"
            style={{ fontFamily: "var(--font-data), monospace", textTransform: "uppercase" }}
          >
            <textPath href={`#${ringId}`}>{`${microtext} · `.repeat(9)}</textPath>
          </text>
        </>
      )}
    </svg>
  );
}

/**
 * Filete ornamental de dos hebras trenzadas.
 *
 * Es la greca que separa el encabezado del cuerpo en un título o un bono. Se
 * teselea por patrón, así que cuesta un nodo y no uno por repetición.
 */
export function GuillocheRule({
  seed,
  height = 12,
  className,
  style,
}: {
  seed: string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const h = hash32(seed);
  const phase = (h % 360) / 360;
  const skew = 0.35 + ((h >> 9) % 100) / 400;

  const strand = (offset: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 96; i += 1) {
      const x = (i / 96) * 96;
      const y =
        6 +
        3.6 * Math.sin(((i / 96) * 4 + phase + offset) * 2 * Math.PI) +
        1.5 * Math.sin(((i / 96) * 9 + phase * skew + offset) * 2 * Math.PI);
      pts.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    return `M ${pts.join(" L ")}`;
  };

  const id = `gr-rule-${h.toString(36)}`;

  return (
    <svg
      viewBox="0 0 960 12"
      height={height}
      width="100%"
      preserveAspectRatio="xMinYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", color: "var(--ink-2)", opacity: 0.55, ...style }}
    >
      <defs>
        <pattern id={id} width="96" height="12" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="0.45" vectorEffect="non-scaling-stroke">
            <path d={strand(0)} />
            <path d={strand(0.5)} />
            <path d={strand(0.25)} opacity="0.45" />
          </g>
        </pattern>
      </defs>
      <rect width="960" height="12" fill={`url(#${id})`} />
    </svg>
  );
}

/**
 * Microtexto de firma.
 *
 * A tamaño normal se lee como una regla gris. Al acercarse se resuelve en
 * palabras. Es el detalle que hace que alguien pegue la cara a la pantalla, y
 * el mismo recurso que llevan los cheques bajo la zona de importe.
 */
export function MicrotextRule({ text }: { text: string }) {
  return (
    <svg
      viewBox="0 0 600 7"
      width="100%"
      height="7"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", color: "var(--ink-2)", opacity: 0.5, overflow: "hidden" }}
    >
      <text
        x="0"
        y="5.4"
        fill="currentColor"
        fontSize="4"
        letterSpacing="0.55"
        style={{ fontFamily: "var(--font-data), monospace", textTransform: "uppercase" }}
      >
        {`${text} · `.repeat(14)}
      </text>
    </svg>
  );
}
