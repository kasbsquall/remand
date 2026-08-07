"use client";

/**
 * Verificador público.
 *
 * Esta pantalla habla directamente con Arbitrum desde el navegador. No pasa por
 * el servidor de Remand a propósito: si la verificación dependiera de nosotros,
 * no sería verificación. Cambiar cualquier cifra y ver cómo se mueve el fallo es
 * la manera más rápida de comprobar que el motor hace lo que dice.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowClockwise, CheckCircle, Terminal, Warning } from "@phosphor-icons/react";
import { Docket, docketNumber } from "~~/components/remand/Docket";
import { VerdictLedger, type Weights } from "~~/components/remand/VerdictLedger";
import {
  bps,
  previewVerdict,
  readWeights,
  REMAND_VERDICT_ADDRESS,
  type EvidenceInput,
  type Verdict,
} from "~~/lib/contract";

const FIELDS: { key: keyof EvidenceInput; param: string; label: string; hint: string }[] = [
  { key: "walletAgeDays", param: "age", label: "Antigüedad", hint: "días desde la primera transacción" },
  { key: "activeMonths", param: "active", label: "Meses activos", hint: "con al menos una transacción" },
  {
    key: "totalMonths",
    param: "total",
    label: "Meses desde el inicio",
    hint: "transcurridos desde su primera transacción",
  },
  {
    key: "repayments",
    param: "repaid",
    label: "Repagos",
    hint: "devoluciones registradas en Aave V3",
  },
  { key: "borrows", param: "borrowed", label: "Préstamos", hint: "préstamos tomados en Aave V3" },
  {
    key: "liquidations",
    param: "liq",
    label: "Liquidaciones",
    hint: "veces que un préstamo se cerró por falta de colateral",
  },
  {
    key: "distinctProtocols",
    param: "protocols",
    label: "Contratos usados",
    hint: "contratos distintos con los que operó",
  },
];

const DEFAULTS: EvidenceInput = {
  walletAgeDays: 900,
  activeMonths: 3,
  totalMonths: 30,
  repayments: 3,
  borrows: 3,
  liquidations: 2,
  distinctProtocols: 5,
};

function castCommand(e: EvidenceInput): string {
  return [
    `cast call ${REMAND_VERDICT_ADDRESS} \\`,
    `  "previewVerdict(uint32,uint32,uint32,uint32,uint32,uint32,uint32)(uint32,uint32,uint32,uint32,uint32,uint32,bool,uint32)" \\`,
    `  ${e.walletAgeDays} ${e.activeMonths} ${e.totalMonths} ${e.repayments} ${e.borrows} ${e.liquidations} ${e.distinctProtocols} \\`,
    `  --rpc-url https://sepolia-rollup.arbitrum.io/rpc`,
  ].join("\n");
}

function VerificadorInterno() {
  const searchParams = useSearchParams();

  // Puntaje que traía el expediente de origen, si se llegó desde uno.
  const esperadoRaw = searchParams.get("expect");
  const esperado = esperadoRaw !== null && /^\d+$/.test(esperadoRaw) ? Number(esperadoRaw) : null;
  const origen = searchParams.get("from");

  const [evidence, setEvidence] = useState<EvidenceInput>(() => {
    const initial = { ...DEFAULTS };
    for (const field of FIELDS) {
      const raw = searchParams.get(field.param);
      if (raw !== null && /^\d+$/.test(raw)) initial[field.key] = Number(raw);
    }
    return initial;
  });

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "error">("reading");
  const [message, setMessage] = useState<string | null>(null);

  const consultar = useCallback(async (input: EvidenceInput) => {
    setStatus("reading");
    setMessage(null);
    try {
      const [v, w] = await Promise.all([previewVerdict(input), readWeights()]);
      setVerdict(v);
      setWeights(w);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      // El detalle tecnico del RPC no le sirve a quien mira esta pantalla.
      setMessage(
        "Las cifras que ingresaste no forman un historial posible, o la red no respondió. Ajusta los valores y vuelve a consultar.",
      );
    }
  }, []);

  useEffect(() => {
    consultar(evidence);
    // Sólo en el montaje: después la consulta la dispara el usuario, para que
    // cada lectura corresponda a una acción suya y no a un teclazo suelto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <section className="pt-[var(--ma-section)]">
        <p className="remand-label remand-enter">Verificador público</p>
        <h1
          className="remand-display remand-enter mt-[var(--ma-close)]"
          style={{ fontSize: "var(--t-title)", maxWidth: "24ch", "--delay": "60ms" } as React.CSSProperties}
        >
          Comprueba el fallo tú mismo, sin pasar por nosotros.
        </h1>
        <p
          className="remand-prose remand-enter mt-[var(--ma-block)]"
          style={{ "--delay": "120ms" } as React.CSSProperties}
        >
          Esta página consulta el contrato en Arbitrum directamente desde tu navegador, sin pasar por nuestro servidor.
          Cambia cualquier cifra y vuelve a consultar: el fallo se recalcula dentro del contrato, no aquí.
        </p>
      </section>

      <section className="mt-[var(--ma-section)]" aria-labelledby="entrada-heading">
        <h2 id="entrada-heading" className="remand-label">
          Evidencia a evaluar
        </h2>

        <form
          className="mt-[var(--ma-close)]"
          onSubmit={event => {
            event.preventDefault();
            if (status === "reading") return;
            consultar(evidence);
          }}
        >
          <div className="grid gap-[var(--ma-close)] sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.map(field => (
              <div key={field.key}>
                <label htmlFor={field.key} className="remand-label">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  className="remand-field mt-[var(--ma-hair)]"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={evidence[field.key]}
                  aria-invalid={status === "error" ? true : undefined}
                  aria-describedby={status === "error" ? `${field.key}-hint verificador-error` : `${field.key}-hint`}
                  onChange={event =>
                    setEvidence(current => ({
                      ...current,
                      [field.key]: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
                <p
                  id={`${field.key}-hint`}
                  className="mt-[var(--ma-hair)]"
                  style={{ fontSize: "var(--t-micro)", color: "var(--ink-faint)" }}
                >
                  {field.hint}
                </p>
              </div>
            ))}
          </div>

          <button type="submit" className="remand-action mt-[var(--ma-block)]" disabled={status === "reading"}>
            <ArrowClockwise size={16} weight="light" aria-hidden="true" />
            {status === "reading" ? "Consultando Arbitrum…" : "Consultar el contrato"}
          </button>
        </form>
      </section>

      {/* Franja de contraste.
          Es el unico momento del producto donde dos numeros calculados por vias
          distintas se ponen uno junto a otro. Sin esto, la reproducibilidad se
          afirma en prosa y no se ve nunca. */}
      {esperado !== null && (
        <section className="mt-[var(--ma-section)]" aria-live="polite">
          <div
            className="remand-sunk p-[var(--ma-block)]"
            style={{
              borderColor:
                verdict === null ? "var(--rule)" : verdict.totalScore === esperado ? "var(--granted)" : "var(--seal)",
            }}
          >
            <p className="remand-label" style={{ color: "var(--ink)" }}>
              {origen
                ? `Reproduciendo el expediente ${origen.slice(0, 8)}…${origen.slice(-6)}`
                : "Reproduciendo un expediente"}
            </p>

            <div className="mt-[var(--ma-close)] flex flex-wrap items-end gap-[var(--ma-block)]">
              <div>
                <p className="remand-label">Registrado en el expediente</p>
                <p className="remand-num mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-lead)" }}>
                  {bps(esperado)}%
                </p>
              </div>
              <div>
                <p className="remand-label">Devuelto ahora por el contrato</p>
                <p className="remand-num mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-lead)" }}>
                  {verdict === null ? "—" : `${bps(verdict.totalScore)}%`}
                </p>
              </div>
              {verdict !== null && (
                <span
                  className={`remand-seal ${verdict.totalScore === esperado ? "remand-seal-granted" : "remand-seal-denied"}`}
                  style={{ "--delay": "0ms" } as React.CSSProperties}
                >
                  {verdict.totalScore === esperado ? (
                    <CheckCircle size={15} weight="light" aria-hidden="true" />
                  ) : (
                    <Warning size={15} weight="light" aria-hidden="true" />
                  )}
                  {verdict.totalScore === esperado ? "Coincide" : "No coincide"}
                </span>
              )}
            </div>

            <p
              className="mt-[var(--ma-close)]"
              style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)", maxWidth: "62ch" }}
            >
              {verdict !== null && verdict.totalScore === esperado
                ? "Este navegador no calculó nada: llamó al contrato en Arbitrum y comparó el resultado con el que traía el expediente."
                : "La evidencia ya no es la del expediente original, así que el fallo cambia. Es el comportamiento correcto: el motor responde a los datos que recibe."}
            </p>
          </div>
        </section>
      )}

      <section className="mt-[var(--ma-section)]" aria-live="polite" aria-busy={status === "reading"}>
        {status === "error" && (
          <div className="remand-sunk p-[var(--ma-block)]" role="alert">
            <div className="flex items-start gap-[var(--ma-tight)]">
              <Warning size={20} weight="light" aria-hidden="true" style={{ color: "var(--denied)" }} />
              <div>
                <p className="remand-label" style={{ color: "var(--ink)" }}>
                  Consulta rechazada
                </p>
                <p id="verificador-error" className="remand-prose mt-[var(--ma-tight)]">
                  {message}
                </p>
                <p className="mt-[var(--ma-tight)]" style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}>
                  El contrato rechaza evidencia incoherente en vez de corregirla en silencio. Los repagos no pueden
                  superar a los préstamos, ni los meses activos a los de vida.
                </p>
              </div>
            </div>
          </div>
        )}

        {status === "reading" && (
          <div className="grid gap-[var(--ma-close)]">
            <div className="remand-skeleton" style={{ height: "4rem", maxWidth: "18rem" }} />
            <div className="remand-skeleton" style={{ height: "14rem" }} />
          </div>
        )}

        {status === "idle" && verdict && weights && (
          <div className="remand-sheet remand-enter" style={{ padding: "var(--ma-section) var(--ma-block)" }}>
            <p className="sr-only">
              Resultado: apelación {verdict.approved ? "concedida" : "denegada"}, puntaje {bps(verdict.totalScore)} por
              ciento.
            </p>
            <div className="flex flex-wrap items-end justify-between gap-[var(--ma-block)]">
              <div>
                <p className="remand-label">Puntaje del fallo</p>
                <p className="remand-figure mt-[var(--ma-tight)]">
                  {bps(verdict.totalScore)}
                  <span style={{ fontSize: "0.28em", marginLeft: "0.08em" }}>%</span>
                </p>
              </div>
              <div className="grid gap-[var(--ma-close)]">
                <span className={`remand-seal ${verdict.approved ? "remand-seal-granted" : "remand-seal-denied"}`}>
                  {verdict.approved ? (
                    <CheckCircle size={15} weight="light" aria-hidden="true" />
                  ) : (
                    <Warning size={15} weight="light" aria-hidden="true" />
                  )}
                  {verdict.approved ? "Concedida" : "Denegada"}
                </span>
                <div>
                  <p className="remand-label">Colateral exigido tras el recálculo</p>
                  <p className="remand-num mt-[var(--ma-hair)]" style={{ fontSize: "var(--t-lead)" }}>
                    {bps(verdict.collateralRequiredBps)}%
                    <span
                      style={{
                        fontSize: "var(--t-micro)",
                        color: "var(--ink-faint)",
                        marginLeft: "0.6em",
                      }}
                    >
                      antes 120,00%
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <hr className="remand-rule my-[var(--ma-block)]" />
            <VerdictLedger verdict={verdict} weights={weights} />
          </div>
        )}
      </section>

      <section className="mt-[var(--ma-section)]" aria-labelledby="terminal-heading">
        <h2 id="terminal-heading" className="remand-label">
          La misma consulta, sin navegador
        </h2>
        <p className="remand-prose mt-[var(--ma-close)]">
          Si no quieres confiar tampoco en esta página, la consulta se hace igual desde una terminal con Foundry.
          Devuelve exactamente los mismos números.
        </p>
        <pre
          className="remand-sunk remand-num mt-[var(--ma-close)] overflow-x-auto p-[var(--ma-close)]"
          style={{ fontSize: "var(--t-micro)", lineHeight: 1.7 }}
        >
          <code>{castCommand(evidence)}</code>
        </pre>
        <p
          className="mt-[var(--ma-tight)] flex items-start gap-[var(--ma-tight)]"
          style={{ fontSize: "var(--t-small)", color: "var(--ink-faint)" }}
        >
          <Terminal size={16} weight="light" aria-hidden="true" className="remand-glyph-inline" />
          El comando se actualiza con las cifras del formulario.
        </p>
      </section>
    </>
  );
}

export default function Verificador() {
  return (
    <Docket reference={docketNumber("V")}>
      <Suspense
        fallback={
          <div className="pt-[var(--ma-section)]">
            <div className="remand-skeleton" style={{ height: "10rem" }} />
          </div>
        }
      >
        <VerificadorInterno />
      </Suspense>
    </Docket>
  );
}
