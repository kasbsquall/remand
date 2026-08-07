"use client";

/**
 * Acta del fallo.
 *
 * Muestra la aritmética completa en vez del resultado: puntaje por dimensión,
 * peso aplicado, y el aporte que cada una hace al total. La última columna suma
 * exactamente el puntaje final, así que el lector puede rehacer la cuenta con
 * los ojos. Publicar solo el total sería pedir confianza, y pedir confianza es
 * justo lo que Remand reprocha a las evaluaciones que ocurren en un servidor
 * privado.
 */

import { ArrowsClockwise, Calendar, HandCoins, ShieldWarning, StackSimple } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { bps, type Verdict } from "~~/lib/contract";

export type Weights = {
  repayment: number;
  consistency: number;
  age: number;
  liquidation: number;
  diversity: number;
  threshold: number;
};

type Row = {
  key: string;
  label: string;
  meaning: string;
  score: number;
  weight: number;
  IconGlyph: Icon;
};

function buildRows(verdict: Verdict, weights: Weights): Row[] {
  return [
    {
      key: "repayment",
      label: "Historial de repago",
      meaning: "Proporción de préstamos devueltos",
      score: verdict.scoreRepayment,
      weight: weights.repayment,
      IconGlyph: HandCoins,
    },
    {
      key: "consistency",
      label: "Consistencia de actividad",
      meaning: "Meses con actividad sobre meses de vida",
      score: verdict.scoreConsistency,
      weight: weights.consistency,
      IconGlyph: ArrowsClockwise,
    },
    {
      key: "age",
      label: "Antigüedad de la wallet",
      meaning: "Tiempo operando, satura a los dos años",
      score: verdict.scoreAge,
      weight: weights.age,
      IconGlyph: Calendar,
    },
    {
      key: "liquidation",
      label: "Ausencia de liquidaciones",
      meaning: "Cae a cero con tres liquidaciones",
      score: verdict.scoreLiquidation,
      weight: weights.liquidation,
      IconGlyph: ShieldWarning,
    },
    {
      key: "diversity",
      label: "Diversidad de protocolos",
      meaning: "Contratos distintos usados, satura en ocho",
      score: verdict.scoreDiversity,
      weight: weights.diversity,
      IconGlyph: StackSimple,
    },
  ];
}

/** Aporte de una dimensión al total, con la misma división entera del contrato. */
function contribution(score: number, weight: number): number {
  return Math.floor((score * weight) / 10_000);
}

export function VerdictLedger({ verdict, weights }: { verdict: Verdict; weights: Weights }) {
  const rows = buildRows(verdict, weights);
  const sum = rows.reduce((acc, r) => acc + contribution(r.score, r.weight), 0);

  return (
    <section aria-labelledby="acta-heading">
      <header className="mb-[var(--ma-block)] flex flex-wrap items-baseline justify-between gap-[var(--ma-close)]">
        <h2 id="acta-heading" className="remand-label">
          Acta del fallo
        </h2>
        <p className="remand-label" style={{ letterSpacing: "0.08em" }}>
          Umbral de aprobación {bps(weights.threshold)}%
        </p>
      </header>

      {/* Cabecera de columnas. En móvil desaparece y cada fila se autoexplica. */}
      <div className="remand-label remand-ledger-head hidden md:grid" style={{ paddingBottom: "var(--ma-tight)" }}>
        <span>Dimensión</span>
        <span className="text-right">Puntaje</span>
        <span className="text-right">Peso</span>
        <span className="text-right">Aporte, en puntos</span>
      </div>

      <div style={{ borderTop: "1px solid var(--rule-strong)" }}>
        {rows.map((row, index) => {
          const aporte = contribution(row.score, row.weight);
          const Glyph = row.IconGlyph;
          return (
            <div
              key={row.key}
              className="remand-ledger-row remand-enter"
              style={{ "--delay": `${Math.min(index, 7) * 30}ms` } as React.CSSProperties}
            >
              <div className="flex items-start gap-[var(--ma-close)]">
                <Glyph
                  size={18}
                  weight="light"
                  aria-hidden="true"
                  style={{ color: "var(--ink-faint)", marginTop: "0.15rem", flexShrink: 0 }}
                />
                <div>
                  <p style={{ lineHeight: 1.35 }}>{row.label}</p>
                  <p
                    style={{
                      fontSize: "var(--t-small)",
                      color: "var(--ink-faint)",
                      lineHeight: 1.45,
                    }}
                  >
                    {row.meaning}
                  </p>
                  <div
                    className="remand-meter mt-[var(--ma-tight)] max-w-[16rem]"
                    role="img"
                    aria-label={`${bps(row.score)} por ciento`}
                  >
                    <span
                      className="remand-meter-fill"
                      style={
                        {
                          "--fill": row.score / 10_000,
                          "--delay": `${140 + Math.min(index, 7) * 70}ms`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
              </div>

              {/* En móvil los tres números se agrupan a la derecha con su etiqueta;
                  en escritorio ocupan sus propias columnas alineadas. */}
              <dl className="remand-ledger-figures">
                <div className="remand-ledger-figure">
                  <dt className="remand-label">Puntaje</dt>
                  <dd className="remand-num" style={{ fontSize: "var(--t-small)" }}>
                    {bps(row.score)}%
                  </dd>
                </div>
                <div className="remand-ledger-figure">
                  <dt className="remand-label">Peso</dt>
                  <dd className="remand-num" style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}>
                    {bps(row.weight)}%
                  </dd>
                </div>
                <div className="remand-ledger-figure">
                  <dt className="remand-label">Aporte</dt>
                  <dd className="remand-num" style={{ fontSize: "var(--t-small)", fontWeight: 600 }}>
                    {bps(aporte)}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <div
        className="remand-ledger-total items-baseline py-[var(--ma-close)]"
        style={{ borderTop: "1px solid var(--rule-strong)" }}
      >
        <p className="remand-label" style={{ color: "var(--ink)" }}>
          Suma de aportes
        </p>
        <span className="hidden md:block" />
        <span className="hidden md:block" />
        <p className="remand-num md:text-right" style={{ fontSize: "var(--t-lead)", fontWeight: 600 }}>
          {bps(sum)}%
        </p>
      </div>

      {sum !== verdict.totalScore && (
        <p className="remand-num" style={{ fontSize: "var(--t-small)", color: "var(--denied)" }} role="alert">
          La suma de aportes ({bps(sum)}%) no coincide con el total del contrato ({bps(verdict.totalScore)}%). Revisar
          el motor antes de confiar en este fallo.
        </p>
      )}
    </section>
  );
}
