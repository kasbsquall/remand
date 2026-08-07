/**
 * Huella del expediente.
 *
 * Convierte los recuentos de la evidencia en cuatro registros grabados, cada
 * uno con su tope visible. La rejilla de arriba da el número exacto; esto da la
 * escala, que es lo que permite juzgarlo: nadie sabe si 900 días es mucho hasta
 * que ve dónde está el tope.
 *
 * Los límites dibujados son los que aplica el contrato. Aparecen aquí porque un
 * umbral que sólo vive en el código no le sirve a quien lee el fallo.
 *
 * Va en HTML y CSS y no en SVG a propósito: un `preserveAspectRatio="none"`
 * engorda los trazos verticales y adelgaza los horizontales, y esta pieza vive
 * de que la línea mida un píxel real a cualquier ancho.
 */

import type { Evidence } from "~~/lib/evidence/collector";

const AGE_CAP_DAYS = 730;
const DIVERSITY_CAP = 8;
const LIQUIDATIONS_TO_ZERO = 3;

function Register({
  title,
  note,
  delay,
  children,
}: {
  title: string;
  note: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section className="remand-enter remand-register" style={{ "--delay": `${delay}ms` } as React.CSSProperties}>
      <h3 className="remand-label">{title}</h3>
      <div className="remand-register-plot">{children}</div>
      <p className="remand-register-note">{note}</p>
    </section>
  );
}

/** Escala graduada con aguja. El tope se marca con un filete alto. */
function AgeScale({ days }: { days: number }) {
  const capped = Math.min(days, AGE_CAP_DAYS);
  const pos = capped / AGE_CAP_DAYS;
  const ticks = Array.from({ length: 9 }, (_, i) => i * 90);

  return (
    <div>
      <div className="remand-scale-track" aria-hidden="true">
        {ticks.map((t, i) => (
          <span
            key={t}
            className="remand-scale-tick"
            data-major={t % 360 === 0 ? "" : undefined}
            style={{ left: `${(t / AGE_CAP_DAYS) * 100}%`, "--i": i } as React.CSSProperties}
          />
        ))}
        <span className="remand-scale-cap" />
        <span className="remand-scale-needle" style={{ "--pos": pos } as React.CSSProperties}>
          <span className="remand-scale-needle-head" />
        </span>
      </div>
      <div className="remand-scale-legend" aria-hidden="true">
        <span className="remand-num">0</span>
        <span className="remand-num">1 año</span>
        <span className="remand-num">2 años · tope</span>
      </div>
      <p className="sr-only">
        {days} días de antigüedad
        {days >= AGE_CAP_DAYS ? ", por encima del tope de dos años" : ""}.
      </p>
    </div>
  );
}

/** Peine de constancia. Entinta tantos dientes como meses activos. */
function ConsistencyComb({ active, total }: { active: number; total: number }) {
  const teeth = Math.max(total, 1);
  return (
    <div
      className="remand-comb"
      role="img"
      aria-label={`${active} meses con actividad de ${total} meses de vida de la wallet`}
    >
      {Array.from({ length: teeth }, (_, i) => (
        <span
          key={i}
          className="remand-comb-tooth"
          data-inked={i < active ? "" : undefined}
          style={{ "--i": Math.min(i, 23) } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Barras opuestas sobre una línea de fe. Las liquidaciones la cruzan. */
function BorrowBalance({
  borrows,
  repayments,
  liquidations,
}: {
  borrows: number;
  repayments: number;
  liquidations: number;
}) {
  const max = Math.max(borrows, repayments, 1);
  const notches = Math.min(liquidations, LIQUIDATIONS_TO_ZERO);

  return (
    <div>
      <div className="remand-balance-row">
        <span className="remand-label">Préstamos</span>
        <span className="remand-balance-bar">
          <span
            className="remand-balance-fill"
            style={{ "--fill": borrows / max, "--delay": "140ms" } as React.CSSProperties}
          />
        </span>
        <span className="remand-num remand-balance-value">{borrows}</span>
      </div>

      <div className="remand-balance-line" aria-hidden="true">
        {Array.from({ length: notches }, (_, i) => (
          <span key={i} className="remand-balance-notch" style={{ left: `${8 + i * 7}%` }} />
        ))}
      </div>

      <div className="remand-balance-row">
        <span className="remand-label">Repagos</span>
        <span className="remand-balance-bar" data-side="down">
          <span
            className="remand-balance-fill"
            style={{ "--fill": repayments / max, "--delay": "210ms" } as React.CSSProperties}
          />
        </span>
        <span className="remand-num remand-balance-value">{repayments}</span>
      </div>

      <p className="remand-balance-liq remand-num">
        {liquidations === 0
          ? "sin liquidaciones"
          : `${liquidations} ${liquidations === 1 ? "liquidación" : "liquidaciones"} · con ${LIQUIDATIONS_TO_ZERO} la dimensión aporta cero`}
      </p>
    </div>
  );
}

/** Cuenta de contratos distintos, hasta el tope de ocho. */
function DiversityTally({ protocols }: { protocols: number }) {
  const filled = Math.min(protocols, DIVERSITY_CAP);
  return (
    <div
      className="remand-tally"
      role="img"
      aria-label={`${protocols} contratos distintos, sobre un tope de ${DIVERSITY_CAP}`}
    >
      {Array.from({ length: DIVERSITY_CAP }, (_, i) => (
        <span
          key={i}
          className="remand-tally-slot"
          data-filled={i < filled ? "" : undefined}
          style={{ "--i": i } as React.CSSProperties}
        />
      ))}
      <span className="remand-num remand-tally-value">
        {protocols}
        <span className="remand-tally-cap"> / {DIVERSITY_CAP}</span>
      </span>
    </div>
  );
}

export function CaseFingerprint({ evidence }: { evidence: Evidence }) {
  return (
    <div className="remand-plate remand-fingerprint">
      <Register
        title="Antigüedad de la wallet"
        note={`${evidence.walletAgeDays} días operando. La dimensión deja de sumar a los dos años.`}
        delay={0}
      >
        <AgeScale days={evidence.walletAgeDays} />
      </Register>

      <Register
        title="Constancia de actividad"
        note={`${evidence.activeMonths} de ${evidence.totalMonths} meses con actividad. La fuente entrega el recuento, no en qué meses ocurrió: los dientes muestran la proporción, no el calendario.`}
        delay={60}
      >
        <ConsistencyComb active={evidence.activeMonths} total={evidence.totalMonths} />
      </Register>

      <Register
        title="Préstamos y repagos"
        note="Cada barra se mide contra la mayor de las dos. Las muescas sobre la línea de fe son liquidaciones."
        delay={120}
      >
        <BorrowBalance
          borrows={evidence.borrows}
          repayments={evidence.repayments}
          liquidations={evidence.liquidations}
        />
      </Register>

      <Register
        title="Diversidad de contratos"
        note="Contratos distintos con los que la wallet operó, sobre el tope de ocho."
        delay={180}
      >
        <DiversityTally protocols={evidence.distinctProtocols} />
      </Register>
    </div>
  );
}
