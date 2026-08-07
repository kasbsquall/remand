/**
 * Marca de Remand.
 *
 * Una R de angulos rectos cuyo contador es un cuadrado en lugar de una curva:
 * la evidencia es un bloque de datos. Las dos marcas de la derecha son el corte
 * de expediente. Usa `currentColor`, asi que hereda el color del contexto y no
 * necesita variantes para claro y oscuro.
 *
 * El trazo es 6 sobre una retícula de 64. Con ese peso, el cuerpo de la R se
 * estrecha a 40 unidades y las marcas del corte llevan remate recto: de lo
 * contrario el hueco entre ellas se cierra y a tamano pequeno se leen como una
 * sola barra.
 */

/** Solo el simbolo. Decorativo: el nombre accesible lo pone quien lo envuelve. */
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
      <path d="M14 10 V54" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
      <path d="M14 10 H40 V32 H14" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
      <path d="M30 32 L50 54" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
      <path d="M47 12 H58" stroke="currentColor" strokeWidth="6" strokeLinecap="butt" />
      <path d="M47 24 H58" stroke="currentColor" strokeWidth="6" strokeLinecap="butt" />
    </svg>
  );
}

/**
 * Logotipo completo: simbolo centrado sobre el nombre.
 *
 * La version apilada es la principal. El simbolo termina en una diagonal
 * descendente hacia la derecha, y puesto al costado del texto esa diagonal
 * empujaba la palabra en lugar de sostenerla. Centrado encima, la diagonal
 * apunta al nombre y el conjunto se lee como una pieza.
 */
export function RemandLockup({ markSize = 26, wordSize = "var(--t-lead)" }: { markSize?: number; wordSize?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: `${markSize * 0.14}px`,
        lineHeight: 1,
      }}
    >
      <RemandMark size={markSize} />
      <span className="remand-wordmark" style={{ fontSize: wordSize }}>
        Remand
      </span>
    </span>
  );
}
