/**
 * Monograma de Remand.
 *
 * Una R de angulos rectos cuyo contador es un cuadrado en lugar de una curva:
 * la evidencia es un bloque de datos. Las dos marcas de la derecha son el corte
 * de expediente. Usa `currentColor`, asi que hereda el color del contexto y no
 * necesita variantes para claro y oscuro.
 *
 * No lleva `title` ni `aria-label`: el nombre accesible lo aporta el enlace que
 * lo contiene, y duplicarlo haria que un lector de pantalla lo anuncie dos veces.
 */
export function RemandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <path d="M14 10 V54" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
      <path d="M14 10 H42 V32 H14" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
      <path d="M32 32 L50 54" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
      <path d="M46 14 H54" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
      <path d="M46 22 H54" stroke="currentColor" strokeWidth="4" strokeLinecap="square" />
    </svg>
  );
}
