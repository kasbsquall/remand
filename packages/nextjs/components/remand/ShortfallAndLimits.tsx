"use client";

/**
 * Qué le faltó al expediente, y hasta dónde llega la evidencia.
 *
 * Dos bloques que existen por la misma razón: un rechazo sin explicación
 * accionable es lo que Remand reprocha a la primera instancia, y un sistema que
 * presume de auditable no puede callar sus propios límites. Decirlos nosotros
 * antes de que alguien los descubra es la diferencia entre madurez y descuido.
 */

import { ArrowUp, Info, Warning } from "@phosphor-icons/react";
import { bps, marginsFor, type Verdict } from "~~/lib/contract";
import type { Weights } from "~~/components/remand/VerdictLedger";

/** Distancia al umbral y dónde está el margen más grande sin usar. */
export function Shortfall({ verdict, weights }: { verdict: Verdict; weights: Weights }) {
  if (verdict.approved) return null;

  const distancia = weights.threshold - verdict.totalScore;
  const margins = marginsFor(verdict, weights);
  const mayor = margins[0];
  const margenMayor = mayor.ceiling - mayor.current;

  // Cuánto de esa dimensión bastaría para cruzar el umbral, expresado como la
  // fracción de su techo que hay que recuperar.
  const alcanzaSolaConEsta = margenMayor >= distancia;

  return (
    <div className="remand-sunk p-[var(--ma-block)]">
      <div className="flex items-start gap-[var(--ma-close)]">
        <ArrowUp
          size={20}
          weight="light"
          aria-hidden="true"
          style={{ color: "var(--seal)", flexShrink: 0, marginTop: "0.1rem" }}
        />
        <div style={{ width: "100%" }}>
          <p className="remand-label" style={{ color: "var(--ink)" }}>
            Qué le faltó a este expediente
          </p>

          <div className="mt-[var(--ma-close)] flex flex-wrap items-end gap-[var(--ma-block)]">
            <div>
              <p className="remand-label">Puntaje</p>
              <p className="remand-num mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-lead)" }}>
                {bps(verdict.totalScore)}%
              </p>
            </div>
            <div>
              <p className="remand-label">Umbral</p>
              <p
                className="remand-num mt-[var(--ma-hair)]"
                style={{ fontSize: "var(--t-lead)", color: "var(--ink-faint)" }}
              >
                {bps(weights.threshold)}%
              </p>
            </div>
            <div>
              <p className="remand-label">Distancia</p>
              <p
                className="remand-num mt-[var(--ma-hair)]"
                style={{ fontSize: "var(--t-lead)", color: "var(--seal)", fontWeight: 600 }}
              >
                {bps(distancia)}
                <span style={{ fontSize: "var(--t-micro)", marginLeft: "0.4em" }}>puntos</span>
              </p>
            </div>
          </div>

          <p className="remand-prose mt-[var(--ma-block)]">
            La dimensión con más margen sin usar es <strong>{mayor.label}</strong>: aporta{" "}
            <span className="remand-num">{bps(mayor.current)}</span> de los{" "}
            <span className="remand-num">{bps(mayor.ceiling)}</span> puntos que podría.{" "}
            {alcanzaSolaConEsta
              ? "Mejorar sólo esa dimensión bastaría para cruzar el umbral."
              : "Ni siquiera llevándola al máximo alcanzaría: hará falta mejorar más de una."}
          </p>

          <ol className="mt-[var(--ma-block)]">
            {margins.map((m, index) => {
              const sinUsar = m.ceiling - m.current;
              return (
                <li key={m.dimension} className="remand-row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span style={{ fontSize: "var(--t-small)" }}>
                    <span className="remand-folio" aria-hidden="true" style={{ marginRight: "0.6em" }}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {m.label}
                  </span>
                  <span
                    className="remand-num"
                    style={{ fontSize: "var(--t-small)", color: sinUsar > 0 ? "var(--ink)" : "var(--ink-faint)" }}
                  >
                    {sinUsar > 0 ? `+${bps(sinUsar)} sin usar` : "al máximo"}
                  </span>
                </li>
              );
            })}
          </ol>

          <p
            className="mt-[var(--ma-close)]"
            style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)", maxWidth: "62ch" }}
          >
            El umbral y los pesos están escritos en el contrato y son iguales para todos los expedientes. Esta lectura
            no es una recomendación de inversión ni una promesa de aprobación futura: es aritmética sobre el mismo fallo
            que acabas de leer.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hasta dónde llega la evidencia.
 *
 * Un jurado escéptico va a preguntar si esto se puede falsificar. La respuesta
 * honesta es que los eventos no, pero se pueden generar a propósito, y que los
 * montos no se ponderan. Decirlo nosotros convierte una debilidad en una
 * declaración de alcance.
 */
export function EvidenceLimits() {
  return (
    <div className="remand-sheet p-[var(--ma-block)]">
      <div className="flex items-start gap-[var(--ma-close)]">
        <Info
          size={20}
          weight="light"
          aria-hidden="true"
          style={{ color: "var(--ink-faint)", flexShrink: 0, marginTop: "0.1rem" }}
        />
        <div>
          <p className="remand-label" style={{ color: "var(--ink)" }}>
            Hasta dónde llega esta evidencia
          </p>

          <ul className="mt-[var(--ma-close)]">
            <li className="remand-row" style={{ gridTemplateColumns: "auto 1fr", alignItems: "start" }}>
              <Warning
                size={16}
                weight="light"
                aria-hidden="true"
                className="remand-glyph-inline"
                style={{ color: "var(--seal)" }}
              />
              <p style={{ fontSize: "var(--t-small)", lineHeight: 1.55, color: "var(--ink-soft)" }}>
                Los eventos de préstamo, repago y liquidación se leen del pool de Aave V3 en Arbitrum One y no se pueden
                falsificar. Lo que sí puede hacerse es generarlos a propósito: pedir prestado y devolverse a uno mismo
                produce repagos auténticos que este fallo pondera. Remand todavía no distingue entre historial y
                actividad fabricada.
              </p>
            </li>
            <li className="remand-row" style={{ gridTemplateColumns: "auto 1fr", alignItems: "start" }}>
              <Warning
                size={16}
                weight="light"
                aria-hidden="true"
                className="remand-glyph-inline"
                style={{ color: "var(--seal)" }}
              />
              <p style={{ fontSize: "var(--t-small)", lineHeight: 1.55, color: "var(--ink-soft)" }}>
                Los montos no se ponderan. Diez repagos de un dólar puntúan igual que diez de diez mil.
              </p>
            </li>
            <li className="remand-row" style={{ gridTemplateColumns: "auto 1fr", alignItems: "start" }}>
              <Warning
                size={16}
                weight="light"
                aria-hidden="true"
                className="remand-glyph-inline"
                style={{ color: "var(--seal)" }}
              />
              <p style={{ fontSize: "var(--t-small)", lineHeight: 1.55, color: "var(--ink-soft)" }}>
                Sólo se lee Aave V3. Un historial impecable en otro mercado de préstamo no cuenta todavía, y eso
                perjudica a quien opera fuera del protocolo más grande.
              </p>
            </li>
            <li className="remand-row" style={{ gridTemplateColumns: "auto 1fr", alignItems: "start" }}>
              <Warning
                size={16}
                weight="light"
                aria-hidden="true"
                className="remand-glyph-inline"
                style={{ color: "var(--seal)" }}
              />
              <p style={{ fontSize: "var(--t-small)", lineHeight: 1.55, color: "var(--ink-soft)" }}>
                Pedir prestado en Aave exige depositar más de lo que se recibe, así que este expediente sólo existe para
                quien ya pudo hacerlo. Remand le libera capital inmovilizado. No alcanza todavía a quien nunca tuvo
                capital que depositar.
              </p>
            </li>
          </ul>

          <p
            className="mt-[var(--ma-close)]"
            style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)", maxWidth: "62ch" }}
          >
            El contrato valida que la evidencia sea internamente coherente, no que sea meritoria. Distinguir historial
            de actividad fabricada exige ponderar montos, contrapartes y distancia temporal, y es el siguiente trabajo
            del motor.
          </p>
        </div>
      </div>
    </div>
  );
}
